import { NextResponse } from "next/server";
import { ROOMS } from "@/lib/christmas/rooms";
import { listDecor } from "@/lib/christmas/decor";
import { adminEvents, adminOrnaments } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// รายการลูกบอล ตุ๊กตาหิมะ และคิวเหตุการณ์ของห้อง (หรือทุกห้องถ้า room=all) สำหรับแอดมินดูและลบ
export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get("room") ?? "all";
  const rooms = room === "all" ? ROOMS.map((r) => r.id) : ROOMS.filter((r) => r.id === room).map((r) => r.id);
  const ornaments: unknown[] = [];
  const decor: unknown[] = [];
  const events: unknown[] = [];
  for (const id of rooms) {
    const [o, d, e] = await Promise.all([adminOrnaments(id), listDecor(id), adminEvents(id)]);
    ornaments.push(...o.map((x) => ({ ...x, room: id })));
    decor.push(...d.map((x) => ({ ...x, room: id })));
    events.push(...e.map((x) => ({ ...x, room: id })));
  }
  return NextResponse.json({
    ornaments: (ornaments as { createdAt: number }[]).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500),
    decor: (decor as { createdAt: number }[]).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500),
    events: (events as { startAt: number }[]).sort((a, b) => b.startAt - a.startAt).slice(0, 300),
  });
}
