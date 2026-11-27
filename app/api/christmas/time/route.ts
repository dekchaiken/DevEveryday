import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// เวลาของเซิร์ฟเวอร์ใช้ซิงก์ช่วงเวลาซานตาบิน ให้ทุกคนเห็นภาพเดียวกันในเวลาเดียวกัน (ไม่ถูกเก็บไว้ในแคช)
export async function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
