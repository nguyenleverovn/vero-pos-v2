import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { cleanText, isSameOrigin, isUniqueViolation, normalizeEmail, normalizePhone } from "@/lib/server/request";
import { issueSession, setSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });

  const displayName = cleanText(body.displayName, 120);
  const storeName = cleanText(body.storeName, 160);
  const email = normalizeEmail(body.email) || null;
  const phone = normalizePhone(body.phone) || null;
  const password = typeof body.password === "string" ? body.password : "";

  if (!displayName || !storeName || (!email && !phone)) {
    return NextResponse.json({ error: "Vui lòng nhập đủ tên, cửa hàng và thông tin liên hệ." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email chưa đúng định dạng." }, { status: 400 });
  }
  if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) {
    return NextResponse.json({ error: "Số điện thoại chưa đúng định dạng." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Mật khẩu cần từ 8 đến 128 ký tự." }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await withTransaction(async (client) => {
      const userResult = await client.query<{ id: string }>(
        "INSERT INTO users (display_name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id",
        [displayName, email, phone, passwordHash]
      );
      const userId = userResult.rows[0].id;
      const storeResult = await client.query<{ id: string }>(
        "INSERT INTO stores (name) VALUES ($1) RETURNING id",
        [storeName]
      );
      const storeId = storeResult.rows[0].id;
      await client.query(
        "INSERT INTO store_memberships (store_id, user_id, role) VALUES ($1, $2, 'owner')",
        [storeId, userId]
      );
      const token = await issueSession(client, userId);
      return { userId, storeId, token };
    });

    await setSessionCookie(result.token);
    return NextResponse.json({ userId: result.userId, storeId: result.storeId }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Email hoặc số điện thoại đã được sử dụng." }, { status: 409 });
    }
    console.error("register_failed", error);
    return NextResponse.json({ error: "Chưa thể tạo cửa hàng. Vui lòng thử lại." }, { status: 500 });
  }
}
