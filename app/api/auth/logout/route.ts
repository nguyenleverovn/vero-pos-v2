import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/request";
import { revokeCurrentSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  await revokeCurrentSession();
  return NextResponse.json({ ok: true });
}
