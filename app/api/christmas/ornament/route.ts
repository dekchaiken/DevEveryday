import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { addOrnament, rateOk } from "@/lib/christmas/store";
import { parseOrnament } from "@/lib/christmas/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// แขวนลูกบอลหนึ่งชิ้นในห้องที่เลือก จำกัด 6 ชิ้นต่อนาทีต่อ IP
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const room = getRoom(typeof body.room === "string" ? body.room : null);
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await rateOk(ip, "ornament", 6, Date.now()))) {
    return NextResponse.json({ error: "แขวนบ่อยเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }
  const parsed = parseOrnament(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const ornament = { ...parsed.value, id: crypto.randomUUID(), createdAt: Date.now() };
  await addOrnament(room.id, ornament);
  return NextResponse.json({ ok: true, ornament });
}
