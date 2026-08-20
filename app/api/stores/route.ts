import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/server/db";
import { cleanText, isSameOrigin } from "@/lib/server/request";
import { getCurrentAccount } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    return NextResponse.json({ stores: account.stores });
  } catch (error) {
    console.error("stores_read_failed", error);
    return NextResponse.json({ error: "Chưa thể tải cửa hàng." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  try {
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const name = cleanText(body?.name, 160);
    if (!name) return NextResponse.json({ error: "Vui lòng nhập tên cửa hàng." }, { status: 400 });

    const storeId = await withTransaction(async (client) => {
      const storeResult = await client.query<{ id: string }>("INSERT INTO stores (name) VALUES ($1) RETURNING id", [name]);
      const id = storeResult.rows[0].id;
      await client.query("INSERT INTO store_memberships (store_id, user_id, role) VALUES ($1, $2, 'owner')", [id, account.user.id]);
      return id;
    });
    return NextResponse.json({ id: storeId, name, role: "owner" }, { status: 201 });
  } catch (error) {
    console.error("store_create_failed", error);
    return NextResponse.json({ error: "Chưa thể tạo cửa hàng." }, { status: 500 });
  }
}
