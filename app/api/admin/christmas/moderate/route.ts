import { NextResponse } from "next/server";
import { ROOMS } from "@/lib/christmas/rooms";
import { clearDecor, removeDecor } from "@/lib/christmas/decor";
import { clearRoomStore, removeEvent, removeOrnament } from "@/lib/christmas/store";
import { writeLog } from "@/lib/christmas/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | { action: "delete_ornament"; room: string; id: string }
  | { action: "delete_decor"; room: string; slot: number }
  | { action: "delete_event"; room: string; id: string }
  | { action: "clear_room"; room: string };

const ROOM_IDS = new Set(ROOMS.map((r) => r.id));

// ลบรายการทีละชิ้น หรือส่งเป็นชุด (batch) เพื่อลบหลายรายการพร้อมกัน ทุกการลบจะถูกบันทึกเป็น log
export async function POST(req: Request) {
  let body: { items?: Action[] } & Partial<Action>;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const items: Action[] = Array.isArray(body.items) ? body.items.slice(0, 300) : body.action ? [body as Action] : [];
  if (items.length === 0) return NextResponse.json({ error: "ไม่มีรายการให้ลบ" }, { status: 400 });

  const results: { ok: boolean; note: string }[] = [];
  for (const it of items) {
    const room = it.room === "all" && it.action === "clear_room" ? "all" : it.room;
    if (room !== "all" && !ROOM_IDS.has(room)) {
      results.push({ ok: false, note: "ไม่พบห้อง" });
      continue;
    }
    const targets = room === "all" ? [...ROOM_IDS] : [room];
    if (it.action === "clear_room") {
      for (const r of targets) {
        await clearRoomStore(r);
        await clearDecor(r);
        await writeLog({ type: "moderation", room: r, actor: "admin", text: "ล้างข้อมูลทั้งห้อง" });
      }
      results.push({ ok: true, note: `ล้างห้อง ${room}` });
    } else if (it.action === "delete_ornament") {
      const ok = await removeOrnament(room, it.id);
      if (ok) await writeLog({ type: "moderation", room, actor: "admin", text: `ลบลูกบอล ${it.id.slice(0, 8)}` });
      results.push({ ok, note: ok ? "ลบลูกบอลแล้ว" : "ไม่พบรายการ" });
    } else if (it.action === "delete_decor") {
      const ok = await removeDecor(room, Number(it.slot));
      if (ok) await writeLog({ type: "moderation", room, actor: "admin", text: `ลบตุ๊กตาช่อง ${Number(it.slot) + 1}` });
      results.push({ ok, note: ok ? "ลบตุ๊กตาแล้ว" : "ไม่พบรายการ" });
    } else if (it.action === "delete_event") {
      const ok = await removeEvent(room, it.id);
      if (ok) await writeLog({ type: "moderation", room, actor: "admin", text: `ลบเหตุการณ์ ${it.id.slice(0, 8)}` });
      results.push({ ok, note: ok ? "ลบเหตุการณ์แล้ว" : "ไม่พบรายการ" });
    } else {
      results.push({ ok: false, note: "คำสั่งไม่ถูกต้อง" });
    }
  }
  return NextResponse.json({ ok: true, results });
}
