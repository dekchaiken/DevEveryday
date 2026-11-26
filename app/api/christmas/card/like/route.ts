import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { likeOrnament } from "@/lib/christmas/likes";
import { rateOk } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// กดถูกใจการ์ดในโซนคำอวยพร (หนึ่งครั้งต่อคนต่อใบ)
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
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await rateOk(ip, "clike", 40, Date.now()))) {
    return NextResponse.json({ error: "กดถูกใจบ่อยเกินไป รอสักครู่" }, { status: 429 });
  }
  const res = await likeOrnament(room.id, id, clientId);
  return NextResponse.json({ ok: true, ...res });
}
