import { NextResponse } from "next/server";
import { alertsConfigured, notifyAdmin } from "@/lib/christmas/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ส่งข้อความทดสอบไปยัง Webhook แจ้งเตือน เพื่อตรวจว่าตั้งค่าถูกต้อง
export async function POST() {
  if (!alertsConfigured()) return NextResponse.json({ ok: false, note: "ยังไม่ได้ตั้งค่า XMAS_ALERT_WEBHOOK_URL" });
  const ok = await notifyAdmin("ทดสอบการแจ้งเตือนจากหลังบ้านคริสต์มาส");
  return NextResponse.json({ ok, note: ok ? "ส่งข้อความทดสอบแล้ว" : "ส่งไม่สำเร็จ ตรวจ URL ของ Webhook" });
}
