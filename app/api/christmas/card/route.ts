import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { rateOk } from "@/lib/christmas/store";
import { getConfig } from "@/lib/christmas/config";
import { hasBlocked } from "@/lib/christmas/validate";
import { parseCard } from "@/lib/christmas/cardSpec";
import { addCard, listCards } from "@/lib/christmas/cards";
import { ornamentLikeCounts } from "@/lib/christmas/likes";
import { maskIp, writeLog } from "@/lib/christmas/log";
import { sanitizeSocial } from "@/lib/christmas/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// โซนคำอวยพร: รายการการ์ดทั้งหมดของห้อง พร้อมจำนวนถูกใจ
export async function GET(req: Request) {
  const room = getRoom(new URL(req.url).searchParams.get("room"));
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });
  const [cards, likes] = await Promise.all([listCards(room.id), ornamentLikeCounts(room.id)]);
  return NextResponse.json({ cards: cards.map((c) => ({ ...c, likes: likes[c.id] ?? 0 })) }, { headers: { "Cache-Control": "no-store" } });
}

// ส่งการ์ดหนึ่งใบไปยังโซนคำอวยพร จำกัด 6 ใบต่อนาทีต่อ IP
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
  if (!(await rateOk(ip, "card", 6, Date.now()))) {
    return NextResponse.json({ error: "ส่งการ์ดบ่อยเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }
  const cfg = await getConfig();
  const parsed = parseCard(body, (s) => hasBlocked(s, cfg.blockedWords));
  if ("error" in parsed) {
    if (parsed.error.includes("ไม่เหมาะสม")) {
      await writeLog({ type: "blocked", room: room.id, actor: maskIp(ip), text: `การ์ด: ${String(body.name ?? "")} / ${String(body.wish ?? "")}` });
    }
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const social = sanitizeSocial(body.social, (s) => hasBlocked(s, cfg.blockedWords));
  const card = { ...parsed.value, id: crypto.randomUUID(), room: room.id, createdAt: Date.now(), ...(Object.keys(social).length ? { social } : {}) };
  await addCard(card);
  await writeLog({ type: "ornament", room: room.id, actor: maskIp(ip), text: `การ์ด ${card.name}: ${card.wish}` });
  return NextResponse.json({ ok: true, card: { ...card, likes: 0 } });
}
