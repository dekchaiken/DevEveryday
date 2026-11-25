import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { listDecor } from "@/lib/christmas/decor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ตุ๊กตาหิมะทั้งหมดของห้อง (สูงสุด 1,000 ชิ้น) แคชที่ CDN สั้น ๆ เพื่อลดการอ่านฐานข้อมูล
export async function GET(req: Request) {
  const room = getRoom(new URL(req.url).searchParams.get("room"));
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const decor = await listDecor(room.id);
  return NextResponse.json({ decor }, { headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=6" } });
}
