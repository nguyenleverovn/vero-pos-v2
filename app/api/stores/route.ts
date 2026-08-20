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

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  try {
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const storeId = cleanText(body?.id, 64);
    const name = cleanText(body?.name, 160);
    const phone = cleanText(body?.phone, 32);
    const address = cleanText(body?.address, 240);
    if (!storeId || !name || !phone || !address) {
      return NextResponse.json({ error: "Vui lòng nhập đủ tên, số điện thoại và địa chỉ cửa hàng." }, { status: 400 });
    }

    const membership = account.stores.find((store) => store.id === storeId);
    if (!membership) return NextResponse.json({ error: "Không tìm thấy cửa hàng." }, { status: 404 });
    if (membership.role === "cashier") {
      return NextResponse.json({ error: "Thu ngân không có quyền sửa thông tin cửa hàng." }, { status: 403 });
    }

    const updated = await withTransaction(async (client) => {
      const result = await client.query<{ id: string; name: string; phone: string; address: string }>(
        `UPDATE stores
            SET name = $1, phone = $2, address = $3
          WHERE id = $4 AND status = 'active'
          RETURNING id, name, phone, address`,
        [name, phone, address, storeId]
      );
      return result.rows[0];
    });
    if (!updated) return NextResponse.json({ error: "Không tìm thấy cửa hàng." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("store_update_failed", error);
    return NextResponse.json({ error: "Chưa thể lưu thông tin cửa hàng." }, { status: 500 });
  }
}
