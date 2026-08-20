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

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Đăng nhập Google chưa được cấu hình." }, { status: 503 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const credential = typeof body?.credential === "string" ? body.credential : "";
  if (!credential) return NextResponse.json({ error: "Dữ liệu đăng nhập không hợp lệ." }, { status: 400 });

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
      const activeMembership = await client.query(
        "SELECT 1 FROM store_memberships WHERE user_id = $1 AND status = 'active' LIMIT 1",
        [identity.rows[0].user_id]
      );
      if (!activeMembership.rows[0]) throw new AuthError("Tài khoản chưa được cửa hàng cấp quyền.", 403);
      const token = await issueSession(client, identity.rows[0].user_id);
      return { userId: identity.rows[0].user_id, token };
    });

    if (existing) {
      await setSessionCookie(existing.token);
      return NextResponse.json({ userId: existing.userId, isNewAccount: false });
    }

    const defaultStoreName = cleanText(`Cửa hàng của ${googleDisplayName}`, 160) || "Cửa hàng mới";

    const result = await withTransaction(async (client) => {
      const sameEmail = await client.query<{ id: string; status: string }>(
        "SELECT id, status FROM users WHERE lower(email) = lower($1) LIMIT 1 FOR UPDATE",
        [googleEmail]
      );
      if (sameEmail.rows[0]?.status === "disabled") throw new AuthError("Tài khoản này đã bị tạm khóa.", 403);

      let userId = sameEmail.rows[0]?.id;
      if (!userId) {
        const user = await client.query<{ id: string }>(
          "INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, NULL) RETURNING id",
          [googleDisplayName, googleEmail]
        );
        userId = user.rows[0].id;
      }

      await client.query(
        "INSERT INTO auth_identities (provider, provider_subject, user_id, email) VALUES ('google', $1, $2, $3)",
        [googleSubject, userId, googleEmail]
      );

      const membership = await client.query<{ store_id: string }>(
        `SELECT m.store_id
           FROM store_memberships m
           JOIN stores s ON s.id = m.store_id
          WHERE m.user_id = $1
            AND m.status = 'active'
            AND s.status = 'active'
          ORDER BY m.created_at
          LIMIT 1`,
        [userId]
      );

      const disabledMembership = !membership.rows[0] ? await client.query(
        "SELECT 1 FROM store_memberships WHERE user_id = $1 AND status = 'disabled' LIMIT 1",
        [userId]
      ) : null;
      if (disabledMembership?.rows[0]) throw new AuthError("Tài khoản chưa được cửa hàng cấp quyền.", 403);

      let storeId = membership.rows[0]?.store_id;
      let isNewAccount = false;
      if (!storeId) {
        const store = await client.query<{ id: string }>(
          "INSERT INTO stores (name) VALUES ($1) RETURNING id",
          [defaultStoreName]
        );
        storeId = store.rows[0].id;
        await client.query(
          "INSERT INTO store_memberships (store_id, user_id, role) VALUES ($1, $2, 'owner')",
          [storeId, userId]
        );
        isNewAccount = true;
      }

      const token = await issueSession(client, userId);
      return { userId, storeId, token, isNewAccount };
    });

    await setSessionCookie(result.token);
    return NextResponse.json(
      { userId: result.userId, storeId: result.storeId, isNewAccount: result.isNewAccount },
      { status: result.isNewAccount ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (isUniqueViolation(error)) return NextResponse.json({ error: "Tài khoản Google đã được sử dụng." }, { status: 409 });
    console.error("google_auth_failed", error);
    return NextResponse.json({ error: "Chưa thể xác minh tài khoản Google." }, { status: 500 });
  }
}
