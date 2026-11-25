import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { like } from "@/lib/christmas/decor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// กดถูกใจตุ๊กตาหิมะ (หนึ่งครั้งต่อคนต่อชิ้น)
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const room = getRoom(typeof body.room === "string" ? body.room : null);
  const id = typeof body.id === "string" ? body.id.slice(0, 64) : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 64) : "";
  if (!room || !id || !clientId) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const likes = await like(room.id, id, clientId);
  return NextResponse.json({ ok: true, likes });
}
