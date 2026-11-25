import { NextResponse } from "next/server";
import { readState } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สถานะกลางของต้นคริสต์มาส ผู้ใช้ทุกคนได้ข้อมูลชุดเดียวกัน
// s-maxage=1 ให้ CDN เก็บคำตอบไว้ 1 วินาที ทำให้คนจำนวนมากไม่ยิงฐานข้อมูลพร้อมกัน
export async function GET() {
  const state = await readState(Date.now());
  return NextResponse.json(state, {
    headers: { "Cache-Control": "public, s-maxage=1, stale-while-revalidate=2" },
  });
}
