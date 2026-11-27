import { NextResponse } from "next/server";
import { ROOMS } from "@/lib/christmas/rooms";
import { pageCards, releaseCardSlot, removeCard } from "@/lib/christmas/cards";
import { writeLog } from "@/lib/christmas/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOM_IDS = new Set(ROOMS.map((r) => r.id));

// การ์ดอวยพรของห้องหนึ่ง แบ่งหน้า (ไม่มีข้อมูลภายในอย่าง owner ออกไปด้วย)
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const room = sp.get("room") ?? "";
  if (!ROOM_IDS.has(room)) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const size = Math.min(100, Math.max(1, Math.floor(Number(sp.get("size")) || 30)));
  const { items, total } = await pageCards(room, page, size);
  const cards = items.map(({ owner: _owner, ...c }) => {
    void _owner;
    return c;
  });
  return NextResponse.json({ cards, total, page, size });
}

// ลบการ์ดทีละใบ (หรือส่งหลายรายการใน batch) คืนโควตาให้ผู้ส่ง และบันทึกทุกการลบเป็น log
export async function DELETE(req: Request) {
  let body: { items?: { room?: unknown; id?: unknown }[]; room?: unknown; id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const list = Array.isArray(body.items) ? body.items : [body];
  const results: { ok: boolean; note: string }[] = [];
  for (const it of list.slice(0, 200)) {
    const room = typeof it.room === "string" ? it.room : "";
    const id = typeof it.id === "string" ? it.id.slice(0, 64) : "";
    if (!ROOM_IDS.has(room) || !id) {
      results.push({ ok: false, note: "ข้อมูลไม่ครบ" });
      continue;
    }
    const card = await removeCard(room, id);
    if (!card) {
      results.push({ ok: false, note: "ไม่พบการ์ด" });
      continue;
    }
    if (card.owner) await releaseCardSlot(room, card.owner);
    await writeLog({ type: "moderation", room, actor: "admin", text: `ลบการ์ดของ ${card.name || "ไม่ระบุชื่อ"} (${id.slice(0, 8)})` });
    results.push({ ok: true, note: "ลบการ์ดแล้ว" });
  }
  return NextResponse.json({ ok: true, results });
}
