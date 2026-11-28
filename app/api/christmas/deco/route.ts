import { NextResponse } from "next/server";
import { clientIp } from "@/lib/clientIp";
import { getRoom } from "@/lib/christmas/rooms";
import { claimDecor, claimFreeDecor, releaseFreeDecor, SLOT_COUNT, type Decor } from "@/lib/christmas/decor";
import { parseSnowParts } from "@/lib/christmas/snowman";
import { rateOk } from "@/lib/christmas/store";
import { clean, hasBlocked } from "@/lib/christmas/validate";
import { isReservedSlot } from "@/lib/christmas/slots";
import { getConfig } from "@/lib/christmas/config";
import { maskIp, writeLog } from "@/lib/christmas/log";
import { sanitizeSocial } from "@/lib/christmas/social";

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

  const ip = clientIp(req);
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
  const parts = parseSnowParts(body);
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) return NextResponse.json({ error: `เลือกช่องระหว่าง 1–${SLOT_COUNT}` }, { status: 400 });
  if (isReservedSlot(slot)) return NextResponse.json({ error: "ช่องนี้อยู่ในเขตโซนคำอวยพรหรือทางเดิน เลือกช่องอื่น" }, { status: 409 });
  if (!parts) return NextResponse.json({ error: "ชิ้นส่วนไม่ถูกต้อง" }, { status: 400 });

  // ตุ๊กตาฟรี: วางได้คนละ 1 ตัวต่อห้อง เพื่อให้คนอื่นมีโอกาสวางด้วย
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 80) : "";
  if (!clientId) return NextResponse.json({ error: "ไม่พบตัวตนของผู้เล่น ลองรีเฟรชหน้าแล้วลองใหม่" }, { status: 400 });

  const id = crypto.randomUUID();
  const decor: Decor = {
    ...parts,
    id,
    room: room.id,
    slot,
    name,
    createdAt: Date.now(),
    likes: 0,
    social: sanitizeSocial(body.social, (s) => hasBlocked(s, cfg.blockedWords)),
  };
  if (!(await claimFreeDecor(room.id, clientId, id))) {
    return NextResponse.json({ error: "คุณวางตุ๊กตาฟรีของห้องนี้ไปแล้ว 1 ตัว ให้โอกาสคนอื่นได้วางบ้าง" }, { status: 409 });
  }
  const ok = await claimDecor(decor);
  if (!ok) {
    await releaseFreeDecor(room.id, clientId);
    return NextResponse.json({ error: "ช่องนี้มีคนวางแล้ว เลือกช่องอื่น" }, { status: 409 });
  }
  await writeLog({ type: "decor", room: room.id, actor: maskIp(ip), text: `${name} วางตุ๊กตาช่อง ${slot + 1} (${parts.hat}/${parts.scarf}/${parts.body})` });
  return NextResponse.json({ ok: true, decor });
}
