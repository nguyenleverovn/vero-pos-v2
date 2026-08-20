import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    return NextResponse.json(account);
  } catch (error) {
    console.error("account_read_failed", error);
    return NextResponse.json({ error: "Chưa thể tải tài khoản." }, { status: 500 });
  }
}
