import { NextResponse } from "next/server";
import { getConfig } from "@/lib/christmas/config";
import { getRoom } from "@/lib/christmas/rooms";
import { releaseGiantSpot, reserveGiantSpot, saveOrder, toPreview, type Order, type OrderKind } from "@/lib/christmas/orders";
import { createPromptPayCharge } from "@/lib/christmas/omise";
import { promptPayPayload } from "@/lib/christmas/promptpay";
import { rateOk } from "@/lib/christmas/store";
import { clean, hasBlocked } from "@/lib/christmas/validate";
import { MESSAGE_THEMES, type MessageTheme } from "@/lib/christmas/types";
import { maskIp, writeLog } from "@/lib/christmas/log";
import { GIANT_CAPACITY } from "@/lib/christmas/slots";
import { sanitizeSocial } from "@/lib/christmas/social";
import { listDecor, parseDecorPick } from "@/lib/christmas/decor";
import { parseGiantLook } from "@/lib/christmas/giant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สร้างคำสั่งซื้อ: giant (ป้าย Exclusive) · support (สนับสนุนทีม) · decor (ตุ๊กตา Exclusive จ่ายต่อตัว)
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const config = await getConfig();
  if (!config.enabled) return NextResponse.json({ error: "ปิดรับการสนับสนุนชั่วคราว" }, { status: 503 });

  const room = getRoom(typeof body.room === "string" ? body.room : null);
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await rateOk(ip, "donate", 10, Date.now()))) {
    return NextResponse.json({ error: "ทำรายการบ่อยเกินไป ลองใหม่ภายหลัง" }, { status: 429 });
  }

  const kind: OrderKind = body.kind === "support" ? "support" : body.kind === "decor" ? "decor" : body.kind === "message" ? "message" : "giant";

  // ราคาของตุ๊กตา Exclusive และข้อความขึ้นจอตั้งจากระบบเสมอ ไม่รับราคาจากหน้าเว็บ
  let amount = kind === "decor" ? config.decorPrice : kind === "message" ? config.messagePrice : 0;
  if (kind !== "decor" && kind !== "message") {
    amount = Number(body.amount);
    const allowed = config.presetPrices.includes(amount) || (Number.isInteger(amount) && amount >= config.customMin && amount <= config.customMax);
    if (!Number.isInteger(amount) || !allowed) {
      return NextResponse.json({ error: `จำนวนเงินต้องอยู่ระหว่าง ฿${config.customMin}–฿${config.customMax}` }, { status: 400 });
    }
  }

  const name = clean(body.name, 20);
  const message = kind === "decor" ? "" : clean(body.message, 80);
  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  if (kind === "message" && !message) return NextResponse.json({ error: "กรุณาใส่ข้อความที่จะขึ้นจอ" }, { status: 400 });
  if (hasBlocked(name, config.blockedWords) || hasBlocked(message, config.blockedWords)) {
    await writeLog({ type: "blocked", room: room.id, actor: maskIp(ip), text: `สนับสนุน: ${name} / ${message}` });
    return NextResponse.json({ error: "ข้อความมีคำที่ไม่เหมาะสม" }, { status: 400 });
  }

  let decor: ReturnType<typeof parseDecorPick> = null;
  if (kind === "decor") {
    decor = parseDecorPick(body.decor);
    if (!decor) return NextResponse.json({ error: "ชิ้นส่วนตุ๊กตาไม่ถูกต้อง" }, { status: 400 });
    // ช่องที่ซื้อยังต้องว่าง (ช่องสงวนซื้อได้ แต่ช่องที่คนอื่นวางแล้วไม่ได้)
    if ((await listDecor(room.id)).some((d) => d.slot === decor!.slot)) {
      return NextResponse.json({ error: "ช่องนี้มีคนวางแล้ว เลือกช่องอื่น" }, { status: 409 });
    }
  }

  // จุดที่ผู้ซื้อเลือกเอง (ไม่ส่งมาก็ได้ ระบบจะหาจุดว่างให้) ตรวจรูปแบบไว้ก่อน แล้วค่อยจองจริงหลังผ่านการตรวจอื่นทั้งหมด
  let wantedSpot: number | null = null;
  if (kind === "giant" && body.spot !== undefined && body.spot !== null) {
    const s = Number(body.spot);
    if (!Number.isInteger(s) || s < 0 || s >= GIANT_CAPACITY) {
      return NextResponse.json({ error: "จุดที่เลือกไม่ถูกต้อง" }, { status: 400 });
    }
    wantedSpot = s;
  }
  let look: ReturnType<typeof parseGiantLook> = null;
  if (kind === "giant") {
    look = parseGiantLook(body.look);
    if (!look) return NextResponse.json({ error: "ตกแต่งตุ๊กตายักษ์ไม่ถูกต้อง" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  // จองจุดตั้งแต่ตอนนี้ ถ้าคนอื่นได้จุดนี้ไปแล้วจะแจ้งให้ผู้ซื้อเลือกใหม่ (ก่อนจ่ายเงิน)
  let spot = -1;
  if (kind === "giant") {
    const r = await reserveGiantSpot(room.id, id, wantedSpot);
    if ("error" in r) {
      if (r.error === "taken") {
        return NextResponse.json({ code: "spot_taken", error: "จุดนี้มีคนเอาไปแล้ว เลือกจุดใหม่นะ" }, { status: 409 });
      }
      return NextResponse.json({ error: "ตุ๊กตายักษ์ในห้องนี้เต็มพื้นที่แล้ว" }, { status: 409 });
    }
    spot = r.spot;
  }
  const base: Order = {
    id,
    room: room.id,
    kind,
    amount,
    name,
    message,
    social: sanitizeSocial(body.social, (s) => hasBlocked(s, config.blockedWords)),
    spot: Math.max(0, spot),
    theme: MESSAGE_THEMES.includes(body.theme as MessageTheme) ? (body.theme as MessageTheme) : "fireworks",
    mode: config.payMode,
    status: "awaiting_payment",
    createdAt: Date.now(),
    paidAt: null,
    providerRef: "",
    qrPayload: "",
    qrImage: "",
    ...(decor ? { decor } : {}),
    ...(look ? { look } : {}),
  };

  try {
    if (config.payMode === "manual") {
      const payload = promptPayPayload(amount, id.slice(0, 8));
      if (!payload) {
        if (spot >= 0) await releaseGiantSpot(room.id, spot, id);
        return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าบัญชี PromptPay" }, { status: 503 });
      }
      base.qrPayload = payload;
    } else {
      const charge = await createPromptPayCharge(amount, id);
      base.providerRef = charge.id;
      base.qrImage = charge.source?.scannable_code?.image?.download_uri ?? "";
    }
  } catch (err) {
    if (spot >= 0) await releaseGiantSpot(room.id, spot, id);
    return NextResponse.json({ error: err instanceof Error ? err.message : "สร้างรายการไม่สำเร็จ" }, { status: 502 });
  }

  await saveOrder(base);
  const label = kind === "giant" ? "Exclusive" : kind === "decor" ? `ตุ๊กตา Exclusive ช่อง ${decor!.slot + 1}` : "สนับสนุนทีม";
  await writeLog({ type: "order", room: room.id, actor: maskIp(ip), text: `${label} ฿${amount} · ${name} · ${config.payMode} · รอชำระ` });
  return NextResponse.json({ order: toPreview(base) });
}
