import { NextResponse } from "next/server";
import { ROOM_CAPACITY, ROOMS } from "@/lib/christmas/rooms";
import { roomCounts } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// รายชื่อห้องพร้อมจำนวนคนออนไลน์ ใช้แคชสั้น ๆ ที่ CDN
export async function GET() {
  const counts = await roomCounts(Date.now());
  const rooms = ROOMS.map((r) => ({ ...r, online: counts[r.id] ?? 0, capacity: ROOM_CAPACITY }));
  return NextResponse.json({ rooms }, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } });
}
