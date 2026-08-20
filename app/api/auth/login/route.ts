import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { isSameOrigin, normalizeEmail, normalizePhone } from "@/lib/server/request";
import { issueSession, setSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) return NextResponse.json({ error: "Vui lòng nhập thông tin đăng nhập." }, { status: 400 });

  try {
    const result = await getPool().query<{ id: string; password_hash: string }>(
      `SELECT id, password_hash
         FROM users
        WHERE status = 'active'
          AND (lower(email) = $1 OR phone = $2)
        LIMIT 1`,
      [normalizeEmail(identifier), normalizePhone(identifier)]
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Thông tin đăng nhập không đúng." }, { status: 401 });
    }

    const token = await issueSession(getPool(), user.id);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("login_failed", error);
    return NextResponse.json({ error: "Chưa thể đăng nhập. Vui lòng thử lại." }, { status: 500 });
  }
}
