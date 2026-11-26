import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { listDecor } from "@/lib/christmas/decor";
import { ornamentLikeCounts } from "@/lib/christmas/likes";
import { adminOrnaments } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// อันดับคำอวยพรและตุ๊กตาหิมะที่มีคนชอบมากที่สุดในห้อง พร้อมจำนวนถูกใจของลูกบอลทั้งหมด
export async function GET(req: Request) {
  const room = getRoom(new URL(req.url).searchParams.get("room"));
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const [ornaments, decor, counts] = await Promise.all([adminOrnaments(room.id), listDecor(room.id), ornamentLikeCounts(room.id)]);
  const wishes = ornaments
    .map((o) => ({ id: o.id, name: o.name, wish: o.wish, color: o.color, shape: o.shape, createdAt: o.createdAt, likes: counts[o.id] ?? 0 }))
    .filter((w) => w.likes > 0)
    .sort((a, b) => b.likes - a.likes || a.createdAt - b.createdAt)
    .slice(0, 5);
  const snowmen = decor
    .filter((d) => d.likes > 0)
    .map((d) => ({ id: d.id, name: d.name, slot: d.slot, createdAt: d.createdAt, likes: d.likes }))
    .sort((a, b) => b.likes - a.likes || a.createdAt - b.createdAt)
    .slice(0, 5);
  return NextResponse.json({ wishes, snowmen, counts }, { headers: { "Cache-Control": "no-store" } });
}
