import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { enqueueEvent, rateOk } from "@/lib/christmas/store";
import { parseEvent } from "@/lib/christmas/validate";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// จัดคิวพลุหรือข้อความให้ทุกคนเห็นพร้อมกัน
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

  const event = await enqueueEvent(parsed.value, Date.now());
  return NextResponse.json({ ok: true, event });
}
