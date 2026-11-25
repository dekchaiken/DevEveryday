import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { ACCESSORIES, ARMS, BODY_COLORS, claimDecor, HATS, LEGS, NOSES, SCARVES, SLOT_COUNT, type Decor } from "@/lib/christmas/decor";
import { rateOk } from "@/lib/christmas/store";
import { clean, hasBlocked } from "@/lib/christmas/validate";
import { isReservedSlot } from "@/lib/christmas/slots";
import { getConfig } from "@/lib/christmas/config";
import { maskIp, writeLog } from "@/lib/christmas/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// วางตุ๊กตาหิมะที่ตกแต่งแล้วลงช่องรอบต้น (ฟรี)
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
  if (!(await rateOk(ip, "deco", 20, Date.now()))) {
    return NextResponse.json({ error: "วางบ่อยเกินไป รอสักครู่" }, { status: 429 });
  }
  const name = clean(body.name, 20);
  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  const cfg = await getConfig();
  if (hasBlocked(name, cfg.blockedWords)) {
    await writeLog({ type: "blocked", room: room.id, actor: maskIp(ip), text: `ตกแต่งตุ๊กตา: ${name}` });
    return NextResponse.json({ error: "ชื่อมีคำที่ไม่เหมาะสม" }, { status: 400 });
  }

  const slot = Number(body.slot);
  const pick = <T extends string>(v: unknown, list: readonly T[]) => (list as readonly string[]).includes(String(v)) ? String(v) : null;
  const hat = pick(body.hat, HATS);
  const scarf = pick(body.scarf, SCARVES);
  const nose = pick(body.nose, NOSES);
  const arms = pick(body.arms, ARMS);
  const bodyColor = pick(body.body, BODY_COLORS);
  const legs = pick(body.legs, LEGS);
  const acc = pick(body.acc, ACCESSORIES);
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) return NextResponse.json({ error: `เลือกช่องระหว่าง 1–${SLOT_COUNT}` }, { status: 400 });
  if (isReservedSlot(slot)) return NextResponse.json({ error: "ช่องนี้สงวนไว้สำหรับป้ายประจำห้อง เลือกช่องอื่น" }, { status: 409 });
  if (!hat || !scarf || !nose || !arms || !bodyColor || !legs || !acc) return NextResponse.json({ error: "ชิ้นส่วนไม่ถูกต้อง" }, { status: 400 });

  const decor: Decor = {
    id: crypto.randomUUID(),
    room: room.id,
    slot,
    name,
    hat,
    scarf,
    nose,
    arms,
    body: bodyColor,
    legs,
    acc,
    createdAt: Date.now(),
    likes: 0,
  };
  const ok = await claimDecor(decor);
  if (!ok) return NextResponse.json({ error: "ช่องนี้มีคนวางแล้ว เลือกช่องอื่น" }, { status: 409 });
  await writeLog({ type: "decor", room: room.id, actor: maskIp(ip), text: `${name} วางตุ๊กตาช่อง ${slot + 1} (${hat}/${scarf}/${bodyColor})` });
  return NextResponse.json({ ok: true, decor });
}
