import { NextResponse } from "next/server";
import { ROOMS } from "@/lib/christmas/rooms";
import { listGiants, removeGiant } from "@/lib/christmas/orders";
import { writeLog } from "@/lib/christmas/log";
import { GIANT_CAPACITY } from "@/lib/christmas/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOM_IDS = new Set(ROOMS.map((r) => r.id));

// รายการตุ๊กตายักษ์ (Exclusive) ทุกจุดของห้องที่เลือก หรือทุกห้องถ้า room=all
export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get("room") ?? "all";
  const ids = room === "all" ? [...ROOM_IDS] : ROOM_IDS.has(room) ? [room] : [];
  const giants: {
    room: string;
    spot: number;
    name: string;
    message: string;
    amount: number;
    paidAt: number;
    orderId: string;
    social: Record<string, string> | null;
  }[] = [];
  for (const id of ids) {
    for (const g of await listGiants(id)) {
      giants.push({ room: id, spot: g.spot, name: g.name, message: g.message, amount: g.amount, paidAt: g.paidAt, orderId: g.orderId, social: (g.social as Record<string, string>) ?? null });
    }
  }
  giants.sort((a, b) => b.paidAt - a.paidAt);
  return NextResponse.json({ giants, capacity: GIANT_CAPACITY });
}

// ถอดตุ๊กตายักษ์ออกจากจุดหนึ่ง ใช้กับเนื้อหาไม่เหมาะสมหรือคำขอคืนจุด ทุกครั้งถูกบันทึกเป็น log
export async function DELETE(req: Request) {
  let body: { room?: unknown; spot?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const room = typeof body.room === "string" ? body.room : "";
  const spot = Number(body.spot);
  if (!ROOM_IDS.has(room)) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  if (!Number.isInteger(spot) || spot < 0 || spot >= GIANT_CAPACITY) return NextResponse.json({ error: "จุดไม่ถูกต้อง" }, { status: 400 });
  const ok = await removeGiant(room, spot);
  if (!ok) return NextResponse.json({ error: "ไม่พบตุ๊กตาที่จุดนี้" }, { status: 404 });
  await writeLog({ type: "moderation", room, actor: "admin", text: `ถอดตุ๊กตายักษ์จากจุด ${spot + 1}` });
  return NextResponse.json({ ok: true });
}
