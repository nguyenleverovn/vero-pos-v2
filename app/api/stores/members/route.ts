import { NextResponse } from "next/server";
import { getPool, withTransaction } from "@/lib/server/db";
import { cleanText, isSameOrigin, normalizeEmail } from "@/lib/server/request";
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
      email: string | null;
      role: "owner" | StaffRole;
      status: MemberStatus;
    }>(
      `SELECT u.id AS user_id, u.display_name, u.email, m.role, m.status
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
        email: member.email,
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
    const email = normalizeEmail(body?.email);
    const role = cleanText(body?.role, 16);
    if (!storeId || !/^\S+@\S+\.\S+$/.test(email) || !isStaffRole(role)) {
      return NextResponse.json({ error: "Vui lòng nhập Gmail và chọn quyền hợp lệ." }, { status: 400 });
    }

    const authorization = await requireOwner(storeId);
    if (!authorization.ok) return authorization.response;
    if (authorization.account.user.email?.toLowerCase() === email) {
      return NextResponse.json({ error: "Anh đang là chủ cửa hàng, không thể tự đổi quyền của mình." }, { status: 400 });
    }

    const member = await withTransaction(async (client) => {
      const existingUser = await client.query<{ id: string; display_name: string; status: string }>(
        "SELECT id, display_name, status FROM users WHERE lower(email) = lower($1) LIMIT 1 FOR UPDATE",
        [email]
      );
      if (existingUser.rows[0]?.status === "disabled") throw new Error("USER_DISABLED");

      let userId = existingUser.rows[0]?.id;
      let displayName = existingUser.rows[0]?.display_name;
      if (!userId) {
        const created = await client.query<{ id: string; display_name: string }>(
          "INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, NULL) RETURNING id, display_name",
          [email.split("@")[0], email]
        );
        userId = created.rows[0].id;
        displayName = created.rows[0].display_name;
      }

      const otherStore = await client.query(
        "SELECT 1 FROM store_memberships WHERE user_id = $1 AND store_id <> $2 AND status = 'active' LIMIT 1",
        [userId, storeId]
      );
      if (otherStore.rows[0]) throw new Error("OTHER_STORE");

      await client.query(
        `INSERT INTO store_memberships (store_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (store_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
        [storeId, userId, role]
      );
      return { userId, displayName, email, role, status: "active" as const };
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "OTHER_STORE") {
      return NextResponse.json({ error: "Gmail này đang thuộc một cửa hàng khác trên VERO POS." }, { status: 409 });
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
    if (!storeId || !userId || !isStaffRole(role) || !isMemberStatus(status)) {
      return NextResponse.json({ error: "Thông tin phân quyền không hợp lệ." }, { status: 400 });
    }

    const authorization = await requireOwner(storeId);
    if (!authorization.ok) return authorization.response;
    if (authorization.account.user.id === userId) {
      return NextResponse.json({ error: "Không thể thay đổi quyền chủ cửa hàng." }, { status: 400 });
    }

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
      return result.rows[0];
    });
    if (!updated) return NextResponse.json({ error: "Không tìm thấy nhân viên." }, { status: 404 });
    return NextResponse.json({ userId, role, status });
  } catch (error) {
    console.error("store_member_update_failed", error);
    return NextResponse.json({ error: "Chưa thể cập nhật quyền nhân viên." }, { status: 500 });
  }
}
