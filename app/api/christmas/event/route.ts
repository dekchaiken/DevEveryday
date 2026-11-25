import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRoom, ROOMS } from "@/lib/christmas/rooms";
import { enqueueEvent, rateOk } from "@/lib/christmas/store";
import { parseEvent } from "@/lib/christmas/validate";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// จัดคิวพลุหรือข้อความให้ทุกคนในห้องเห็นพร้อมกัน (room = "all" คือทุกห้อง)
// ตอนนี้จำกัดเฉพาะแอดมิน การชำระเงินจากผู้ใช้จะเพิ่มในขั้นถัดไป
export async function POST(req: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await rateOk(ip, "event", 30, Date.now()))) {
    return NextResponse.json({ error: "ส่งบ่อยเกินไป" }, { status: 429 });
  }
  const parsed = parseEvent(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // room = "all" ส่งให้ทุกห้อง เพื่อให้ทุกคนเห็นพลุหรือข้อความเดียวกัน
  const target = body.room === "all" ? ROOMS.map((r) => r.id) : [getRoom(typeof body.room === "string" ? body.room : null)?.id];
  if (target.some((id) => !id)) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const now = Date.now();
  const events = [];
  for (const id of target) events.push(await enqueueEvent(id as string, parsed.value, now));
  return NextResponse.json({ ok: true, events });
}
