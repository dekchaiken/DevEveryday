import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { readState } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สถานะกลางของต้นคริสต์มาสในห้องที่เลือก ผู้ใช้ทุกคนในห้องได้ข้อมูลชุดเดียวกัน
// s-maxage=1 ให้ CDN เก็บคำตอบต่อห้องไว้ 1 วินาที ทำให้คนจำนวนมากไม่ยิงฐานข้อมูลพร้อมกัน
export async function GET(req: Request) {
  const room = getRoom(new URL(req.url).searchParams.get("room"));
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const state = await readState(room.id, Date.now());
  return NextResponse.json(state, {
    headers: { "Cache-Control": "public, s-maxage=1, stale-while-revalidate=2" },
  });
}
