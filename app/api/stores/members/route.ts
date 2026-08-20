import { NextResponse } from "next/server";
import { getPool, withTransaction } from "@/lib/server/db";
import { cleanText, isSameOrigin, normalizePhone } from "@/lib/server/request";
import { hashPin } from "@/lib/server/pin";
import { getCurrentAccount } from "@/lib/server/session";

export const runtime = "nodejs";

type StaffRole = "manager" | "cashier";
type MemberStatus = "active" | "disabled";
type CurrentAccount = NonNullable<Awaited<ReturnType<typeof getCurrentAccount>>>;
type OwnerAuthorization =
  | { ok: true; account: CurrentAccount }
  | { ok: false; response: NextResponse };

function isStaffRole(value: string): value is StaffRole {
  return value === "manager" || value === "cashier";
}

function isMemberStatus(value: string): value is MemberStatus {
  return value === "active" || value === "disabled";
}

async function requireOwner(storeId: string): Promise<OwnerAuthorization> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, response: NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  const membership = account.stores.find((store) => store.id === storeId);
  if (!membership) return { ok: false, response: NextResponse.json({ error: "Không tìm thấy cửa hàng." }, { status: 404 }) };
  if (membership.role !== "owner") {
    return { ok: false, response: NextResponse.json({ error: "Chỉ chủ cửa hàng được phân quyền nhân viên." }, { status: 403 }) };
  }
  return { ok: true, account };
}

export async function GET(request: Request) {
  try {
    const storeId = cleanText(new URL(request.url).searchParams.get("storeId"), 64);
    if (!storeId) return NextResponse.json({ error: "Thiếu cửa hàng." }, { status: 400 });
    const authorization = await requireOwner(storeId);
    if (!authorization.ok) return authorization.response;

    const result = await getPool().query<{
      user_id: string;
      display_name: string;
      phone: string | null;
      role: "owner" | StaffRole;
      status: MemberStatus;
    }>(
      `SELECT u.id AS user_id, u.display_name, u.phone, m.role, m.status
         FROM store_memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.store_id = $1
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, lower(u.display_name)`,
      [storeId]
    );

    return NextResponse.json({
      members: result.rows.map((member) => ({
        userId: member.user_id,
        displayName: member.display_name,
        phone: member.phone,
        role: member.role,
        status: member.status
      }))
    });
  } catch (error) {
    console.error("store_members_read_failed", error);
    return NextResponse.json({ error: "Chưa thể tải danh sách nhân viên." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const storeId = cleanText(body?.storeId, 64);
    const name = cleanText(body?.name, 120);
    const phone = normalizePhone(body?.phone);
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
    const role = cleanText(body?.role, 16);
    if (!storeId || !name || phone.length < 9 || !/^\d{6}$/.test(pin) || !isStaffRole(role)) {
      return NextResponse.json({ error: "Vui lòng nhập tên, số điện thoại, PIN 6 số và quyền hợp lệ." }, { status: 400 });
    }

    const authorization = await requireOwner(storeId);
    if (!authorization.ok) return authorization.response;
    const passwordHash = await hashPin(pin);

    const member = await withTransaction(async (client) => {
      const existingUser = await client.query<{ id: string; status: string; email: string | null }>(
        "SELECT id, status, email FROM users WHERE phone = $1 LIMIT 1 FOR UPDATE",
        [phone]
      );
      if (existingUser.rows[0]?.status === "disabled") throw new Error("USER_DISABLED");
      if (existingUser.rows[0]?.email) throw new Error("OWNER_PHONE");

      let userId = existingUser.rows[0]?.id;
      if (!userId) {
        const created = await client.query<{ id: string }>(
          "INSERT INTO users (display_name, phone, password_hash) VALUES ($1, $2, $3) RETURNING id",
          [name, phone, passwordHash]
        );
        userId = created.rows[0].id;
      }

      const otherStore = await client.query(
        "SELECT 1 FROM store_memberships WHERE user_id = $1 AND store_id <> $2 AND status = 'active' LIMIT 1",
        [userId, storeId]
      );
      if (otherStore.rows[0]) throw new Error("OTHER_STORE");

      await client.query("UPDATE users SET display_name = $1, password_hash = $2, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $3", [name, passwordHash, userId]);
      await client.query(
        `INSERT INTO store_memberships (store_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (store_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
        [storeId, userId, role]
      );
      return { userId, displayName: name, phone, role, status: "active" as const };
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "OTHER_STORE") {
      return NextResponse.json({ error: "Số điện thoại này đang thuộc một cửa hàng khác trên VERO POS." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "OWNER_PHONE") {
      return NextResponse.json({ error: "Số điện thoại này đã thuộc tài khoản chủ cửa hàng." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Tài khoản này đang bị khóa." }, { status: 403 });
    }
    console.error("store_member_create_failed", error);
    return NextResponse.json({ error: "Chưa thể thêm nhân viên." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const storeId = cleanText(body?.storeId, 64);
    const userId = cleanText(body?.userId, 64);
    const role = cleanText(body?.role, 16);
    const status = cleanText(body?.status, 16);
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
    if (!storeId || !userId || !isStaffRole(role) || !isMemberStatus(status) || (pin && !/^\d{6}$/.test(pin))) {
      return NextResponse.json({ error: "Thông tin phân quyền không hợp lệ." }, { status: 400 });
    }

    const authorization = await requireOwner(storeId);
    if (!authorization.ok) return authorization.response;
    if (authorization.account.user.id === userId) {
      return NextResponse.json({ error: "Không thể thay đổi quyền chủ cửa hàng." }, { status: 400 });
    }

    const passwordHash = pin ? await hashPin(pin) : null;
    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE store_memberships
            SET role = $3, status = $4
          WHERE store_id = $1 AND user_id = $2 AND role <> 'owner'
          RETURNING user_id`,
        [storeId, userId, role, status]
      );
      if (status === "disabled" && result.rows[0]) {
        await client.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
      }
      if (passwordHash && result.rows[0]) {
        await client.query("UPDATE users SET password_hash = $1, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $2", [passwordHash, userId]);
        await client.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
      }
      return result.rows[0];
    });
    if (!updated) return NextResponse.json({ error: "Không tìm thấy nhân viên." }, { status: 404 });
    return NextResponse.json({ userId, role, status });
  } catch (error) {
    console.error("store_member_update_failed", error);
    return NextResponse.json({ error: "Chưa thể cập nhật quyền nhân viên." }, { status: 500 });
  }
}
