import { NextResponse } from "next/server";
import { getConfig } from "@/lib/christmas/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ตั้งค่าการสนับสนุนที่หน้าเว็บใช้ (ไม่มีข้อมูลลับ)
export async function GET() {
  const c = await getConfig();
  return NextResponse.json(
    { enabled: c.enabled, payMode: c.payMode, presetPrices: c.presetPrices, customMin: c.customMin, customMax: c.customMax, decorPrice: c.decorPrice, messagePrice: c.messagePrice, celebrateMessage: c.celebrateMessage },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
