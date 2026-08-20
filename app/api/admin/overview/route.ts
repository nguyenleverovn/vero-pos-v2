import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { getCurrentAccount } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    if (!account.isPlatformAdmin) {
      return NextResponse.json({ error: "Anh không có quyền quản trị VERO." }, { status: 403 });
    }

    const [statsResult, storesResult] = await Promise.all([
      getPool().query<{
        store_count: string;
        owner_count: string;
        staff_count: string;
        registered_today: string;
      }>(
        `SELECT
           (SELECT count(*) FROM stores WHERE status = 'active') AS store_count,
           (SELECT count(DISTINCT user_id) FROM store_memberships WHERE role = 'owner' AND status = 'active') AS owner_count,
           (SELECT count(*) FROM store_memberships WHERE role <> 'owner' AND status = 'active') AS staff_count,
           (SELECT count(*) FROM stores
             WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS registered_today`
      ),
      getPool().query<{
        id: string;
        name: string;
        phone: string | null;
        address: string | null;
        status: "active" | "disabled";
        created_at: Date;
        owner_name: string;
        owner_email: string | null;
        staff_count: string;
        last_login_at: Date | null;
      }>(
        `SELECT s.id, s.name, s.phone, s.address, s.status, s.created_at,
                owner.display_name AS owner_name, owner.email AS owner_email,
                (SELECT count(*) FROM store_memberships staff
                  WHERE staff.store_id = s.id AND staff.role <> 'owner' AND staff.status = 'active') AS staff_count,
                (SELECT max(auth.created_at) FROM auth_sessions auth WHERE auth.user_id = owner.id) AS last_login_at
           FROM stores s
           JOIN LATERAL (
             SELECT u.id, u.display_name, u.email
               FROM store_memberships membership
               JOIN users u ON u.id = membership.user_id
              WHERE membership.store_id = s.id AND membership.role = 'owner'
              ORDER BY membership.created_at
              LIMIT 1
           ) owner ON true
          ORDER BY s.created_at DESC
          LIMIT 200`
      )
    ]);

    const stats = statsResult.rows[0];
    return NextResponse.json({
      stats: {
        stores: Number(stats.store_count),
        owners: Number(stats.owner_count),
        staff: Number(stats.staff_count),
        registeredToday: Number(stats.registered_today)
      },
      stores: storesResult.rows.map((store) => ({
        id: store.id,
        name: store.name,
        phone: store.phone,
        address: store.address,
        status: store.status,
        createdAt: store.created_at,
        ownerName: store.owner_name,
        ownerEmail: store.owner_email,
        staffCount: Number(store.staff_count),
        lastLoginAt: store.last_login_at
      }))
    });
  } catch (error) {
    console.error("admin_overview_failed", error);
    return NextResponse.json({ error: "Chưa thể tải dữ liệu quản trị." }, { status: 500 });
  }
}
