import { createHash } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/server/db";
import { cleanText, isSameOrigin, isUniqueViolation } from "@/lib/server/request";
import { issueSession, setSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function hashInviteCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Đăng nhập Google chưa được cấu hình." }, { status: 503 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const mode = body?.mode === "register" ? "register" : body?.mode === "login" ? "login" : null;
  const credential = typeof body?.credential === "string" ? body.credential : "";
  if (!mode || !credential) return NextResponse.json({ error: "Dữ liệu đăng nhập không hợp lệ." }, { status: 400 });

  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: credential, audience: clientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      throw new AuthError("Tài khoản Google chưa có email được xác minh.", 401);
    }
    const googleSubject = profile.sub;
    const googleEmail = profile.email.toLowerCase();
    const googleDisplayName = cleanText(profile.name, 120) || googleEmail.split("@")[0];

    const existing = await withTransaction(async (client) => {
      const identity = await client.query<{ user_id: string }>(
        `SELECT i.user_id
           FROM auth_identities i
           JOIN users u ON u.id = i.user_id
          WHERE i.provider = 'google' AND i.provider_subject = $1 AND u.status = 'active'
          LIMIT 1`,
        [googleSubject]
      );
      if (!identity.rows[0]) return null;
      const token = await issueSession(client, identity.rows[0].user_id);
      return { userId: identity.rows[0].user_id, token };
    });

    if (existing) {
      await setSessionCookie(existing.token);
      return NextResponse.json({ userId: existing.userId });
    }

    if (mode === "login") throw new AuthError("Tài khoản này chưa được đăng ký.", 404);

    const storeName = cleanText(body?.storeName, 160);
    const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";
    if (!storeName || !inviteCode) throw new AuthError("Vui lòng nhập tên cửa hàng và mã mời.", 400);

    const result = await withTransaction(async (client) => {
      const invite = await client.query<{ id: string }>(
        `SELECT id
           FROM invite_codes
          WHERE code_hash = $1
            AND disabled_at IS NULL
            AND (expires_at IS NULL OR expires_at > now())
            AND used_count < max_uses
          FOR UPDATE`,
        [hashInviteCode(inviteCode)]
      );
      if (!invite.rows[0]) throw new AuthError("Mã mời không hợp lệ hoặc đã được sử dụng.", 403);

      const sameEmail = await client.query("SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1", [googleEmail]);
      if (sameEmail.rows[0]) throw new AuthError("Email này đã được sử dụng bằng phương thức khác.", 409);

      const user = await client.query<{ id: string }>(
        "INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, NULL) RETURNING id",
        [googleDisplayName, googleEmail]
      );
      const userId = user.rows[0].id;
      await client.query(
        "INSERT INTO auth_identities (provider, provider_subject, user_id, email) VALUES ('google', $1, $2, $3)",
        [googleSubject, userId, googleEmail]
      );
      const store = await client.query<{ id: string }>("INSERT INTO stores (name) VALUES ($1) RETURNING id", [storeName]);
      await client.query(
        "INSERT INTO store_memberships (store_id, user_id, role) VALUES ($1, $2, 'owner')",
        [store.rows[0].id, userId]
      );
      await client.query("UPDATE invite_codes SET used_count = used_count + 1 WHERE id = $1", [invite.rows[0].id]);
      const token = await issueSession(client, userId);
      return { userId, storeId: store.rows[0].id, token };
    });

    await setSessionCookie(result.token);
    return NextResponse.json({ userId: result.userId, storeId: result.storeId }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (isUniqueViolation(error)) return NextResponse.json({ error: "Tài khoản Google đã được sử dụng." }, { status: 409 });
    console.error("google_auth_failed", error);
    return NextResponse.json({ error: "Chưa thể xác minh tài khoản Google." }, { status: 500 });
  }
}
