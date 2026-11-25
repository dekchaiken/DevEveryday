import { NextResponse } from "next/server";
import { getRoom, ROOM_CAPACITY } from "@/lib/christmas/rooms";
import { heartbeat } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ผู้ใช้ส่งสัญญาณว่ายังอยู่ในห้องทุก ๆ ไม่กี่วินาที
// ถ้าห้องเต็ม จะตอบ full = true เพื่อให้หน้าเว็บพาไปเลือกห้องอื่น
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const room = getRoom(typeof body.room === "string" ? body.room : null);
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 64) : "";
  if (!room || !clientId) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  // ไม่จำกัดตาม IP เพราะหลายคนอาจใช้เครือข่ายเดียวกัน ความจุของห้องคือการจำกัดจริง
  const result = await heartbeat(room.id, clientId, Date.now());
  return NextResponse.json({ ok: true, ...result, capacity: ROOM_CAPACITY });
}
