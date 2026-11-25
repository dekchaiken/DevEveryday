import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// เวลาเซิร์ฟเวอร์สำหรับซิงก์นาฬิกาของเบราว์เซอร์ ห้ามแคช
export async function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
