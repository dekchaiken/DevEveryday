import { NextResponse } from "next/server";
import { clearLogs, listLogs, writeLog } from "@/lib/christmas/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ดู log กิจกรรม กรองตามประเภทและห้องได้
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 300, 1), 1000);
  return NextResponse.json({ logs: await listLogs(limit, sp.get("type") ?? "all", sp.get("room") ?? "all") });
}

// ล้าง log ทั้งหมด (แอดมินเท่านั้น)
export async function DELETE() {
  await clearLogs();
  // ทิ้งรอยไว้ว่ามีการล้าง log (รายการนี้จะเป็นรายการแรกหลังล้าง)
  await writeLog({ type: "moderation", room: "all", actor: "admin", text: "ล้าง log ทั้งหมดโดยแอดมิน" });
  return NextResponse.json({ ok: true });
}
