import { NextResponse } from "next/server";
import { ROOMS } from "@/lib/christmas/rooms";
import { getConfig } from "@/lib/christmas/config";
import { listDecor } from "@/lib/christmas/decor";
import { adminEvents, adminOrnaments } from "@/lib/christmas/store";
import { listOrders } from "@/lib/christmas/orders";
import { hasBlocked } from "@/lib/christmas/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ค้นหารายการที่มีคำต้องห้าม (พื้นฐาน + ที่แอดมินเพิ่ม) เพื่อให้ตรวจแล้วลบเป็นชุด
export async function GET() {
  const cfg = await getConfig();
  const extra = cfg.blockedWords;
  const flagged: { kind: string; room: string; id: string; slot?: number; text: string }[] = [];
  for (const r of ROOMS) {
    for (const o of await adminOrnaments(r.id)) {
      const text = `${o.name} ${o.wish}`;
      if (hasBlocked(text, extra)) flagged.push({ kind: "ornament", room: r.id, id: o.id, text });
    }
    for (const d of await listDecor(r.id)) {
      if (hasBlocked(d.name, extra)) flagged.push({ kind: "decor", room: r.id, id: d.id, slot: d.slot, text: d.name });
    }
    for (const e of await adminEvents(r.id)) {
      const text = `${e.by} ${e.text}`;
      if (hasBlocked(text, extra)) flagged.push({ kind: "event", room: r.id, id: e.id, text });
    }
  }
  // คำสั่งสนับสนุนเป็นข้อมูลการเงิน จึงแค่แสดงให้ตรวจ ไม่ให้ลบจากหน้านี้
  const orders = (await listOrders(200)).filter((o) => hasBlocked(`${o.name} ${o.message}`, extra)).map((o) => ({ id: o.id, room: o.room, status: o.status, text: `${o.name} ${o.message}` }));
  return NextResponse.json({ flagged, orders, blockedWords: extra.length });
}
