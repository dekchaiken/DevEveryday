import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { rateOk } from "@/lib/christmas/store";
import { getConfig } from "@/lib/christmas/config";
import { hasBlocked } from "@/lib/christmas/validate";
import { parseCard, CARDS_PER_PERSON } from "@/lib/christmas/cardSpec";
import { addCard, findCard, pageCards, releaseCardSlot, reserveCardSlot, toPublic, usedCardSlots } from "@/lib/christmas/cards";
import { likesFor } from "@/lib/christmas/likes";
import { maskIp, writeLog } from "@/lib/christmas/log";
import { sanitizeSocial } from "@/lib/christmas/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// โซนคำอวยพร: รายการการ์ดทั้งหมดของห้อง พร้อมจำนวนถูกใจ และโควตาที่เหลือของผู้เรียก
export async function GET(req: Request) {
  const url = new URL(req.url);
  const room = getRoom(url.searchParams.get("room"));
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const clientId = (url.searchParams.get("clientId") ?? "").slice(0, 64);
  // ลิงก์แชร์: ?id=... ขอการ์ดใบเดียว (อยู่ในไฟล์เดียวกับรายการเพื่อให้ใช้หน่วยความจำชุดเดียวกันตอนพัฒนา)
  const oneId = (url.searchParams.get("id") ?? "").slice(0, 64);
  if (oneId) {
    const card = await findCard(room.id, oneId);
    if (!card) return NextResponse.json({ error: "ไม่พบการ์ดนี้" }, { status: 404 });
    const likes = await likesFor(room.id, [card.id]);
    return NextResponse.json({ card: toPublic(card, likes[card.id] ?? 0) }, { headers: { "Cache-Control": "no-store" } });
  }
  // แบ่งเป็นหน้า: หน้าละไม่เกิน 300 ใบ อ่านเฉพาะหน้าที่ขอจากดัชนีเวลา (ไม่ดึงทั้งห้อง)
  const size = Math.min(300, Math.max(1, Number(url.searchParams.get("size")) || 60));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const [{ items, total }, used] = await Promise.all([pageCards(room.id, page, size), clientId ? usedCardSlots(room.id, clientId) : Promise.resolve(0)]);
  const likes = await likesFor(room.id, items.map((c) => c.id));
  return NextResponse.json(
    {
      cards: items.map((c) => toPublic(c, likes[c.id] ?? 0)),
      total,
      page,
      size,
      left: clientId ? Math.max(0, CARDS_PER_PERSON - used) : CARDS_PER_PERSON,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// ส่งการ์ดหนึ่งใบไปยังโซนคำอวยพร ต่อคนต่อห้องส่งได้ไม่เกินโควตา และจำกัด 6 ใบต่อนาทีต่อ IP
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const room = getRoom(typeof body.room === "string" ? body.room : null);
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 64) : "";
  if (!clientId) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await rateOk(ip, "card", 6, Date.now()))) {
    return NextResponse.json({ error: "ส่งการ์ดบ่อยเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }
  const cfg = await getConfig();
  const parsed = parseCard(body, (s) => hasBlocked(s, cfg.blockedWords));
  if ("error" in parsed) {
    if (parsed.error.includes("ไม่เหมาะสม")) {
      await writeLog({ type: "blocked", room: room.id, actor: maskIp(ip), text: `การ์ด: ${String(body.name ?? "")}` });
    }
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const social = sanitizeSocial(body.social, (s) => hasBlocked(s, cfg.blockedWords));
  const card = {
    ...parsed.value,
    id: crypto.randomUUID(),
    room: room.id,
    createdAt: Date.now(),
    owner: clientId,
    ...(Object.keys(social).length ? { social } : {}),
  };
  // จองโควตาก่อนบันทึก ถ้าบันทึกไม่สำเร็จจะคืนโควตาให้
  if (!(await reserveCardSlot(room.id, clientId))) {
    return NextResponse.json({ error: `ส่งการ์ดในห้องนี้ครบ ${CARDS_PER_PERSON} ใบแล้ว ลองไปอวยพรห้องอื่นดูนะ` }, { status: 409 });
  }
  try {
    await addCard(card);
  } catch (err) {
    await releaseCardSlot(room.id, clientId);
    throw err;
  }
  await writeLog({ type: "ornament", room: room.id, actor: maskIp(ip), text: `การ์ด ${card.name}` });
  const used = await usedCardSlots(room.id, clientId);
  return NextResponse.json({ ok: true, card: toPublic(card, 0), left: Math.max(0, CARDS_PER_PERSON - used) });
}
