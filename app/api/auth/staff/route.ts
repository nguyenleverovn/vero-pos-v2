import { NextResponse } from "next/server";
import { getPool, withTransaction } from "@/lib/server/db";
import { isSameOrigin, normalizePhone } from "@/lib/server/request";
import { verifyPin } from "@/lib/server/pin";
import { issueSession, setSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

const DUMMY_PIN_HASH = `scrypt$${Buffer.from("vero-pos-staff").toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const phone = normalizePhone(body?.phone);
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
    if (!phone || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "Vui lòng nhập số điện thoại và PIN 6 số." }, { status: 400 });
    }

    const result = await getPool().query<{
      id: string;
      password_hash: string | null;
      pin_failed_attempts: number;
      pin_locked_until: Date | null;
    }>(
      `SELECT DISTINCT u.id, u.password_hash, u.pin_failed_attempts, u.pin_locked_until
         FROM users u
         JOIN store_memberships m ON m.user_id = u.id
         JOIN stores s ON s.id = m.store_id
        WHERE u.phone = $1
          AND u.status = 'active'
          AND m.status = 'active'
          AND m.role IN ('manager', 'cashier')
          AND s.status = 'active'
        LIMIT 1`,
      [phone]
    );
    const user = result.rows[0];
    if (user?.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
      return NextResponse.json({ error: "Tài khoản đang tạm khóa 15 phút vì nhập sai PIN nhiều lần." }, { status: 429 });
    }

    const valid = await verifyPin(pin, user?.password_hash || DUMMY_PIN_HASH);
    if (!user || !valid) {
      if (user) {
        await getPool().query(
          `UPDATE users
              SET pin_failed_attempts = pin_failed_attempts + 1,
                  pin_locked_until = CASE WHEN pin_failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
            WHERE id = $1`,
          [user.id]
        );
      }
      return NextResponse.json({ error: "Số điện thoại hoặc PIN không đúng." }, { status: 401 });
    }

    const token = await withTransaction(async (client) => {
      await client.query("UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1", [user.id]);
      return issueSession(client, user.id);
    });
    await setSessionCookie(token);
    return NextResponse.json({ userId: user.id });
  } catch (error) {
    console.error("staff_auth_failed", error);
    return NextResponse.json({ error: "Chưa thể đăng nhập nhân viên." }, { status: 500 });
  }
}
