import { NextResponse } from "next/server";
import { clearLogs, listLogs } from "@/lib/christmas/log";

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
  return NextResponse.json({ ok: true });
}
