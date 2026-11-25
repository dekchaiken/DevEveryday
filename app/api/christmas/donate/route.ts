import { NextResponse } from "next/server";
import { getConfig } from "@/lib/christmas/config";
import { getRoom } from "@/lib/christmas/rooms";
import { saveOrder, toPreview, type Order } from "@/lib/christmas/orders";
import { createPromptPayCharge } from "@/lib/christmas/omise";
import { promptPayPayload } from "@/lib/christmas/promptpay";
import { rateOk } from "@/lib/christmas/store";
import { clean, hasBlocked } from "@/lib/christmas/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สร้างคำสั่งสนับสนุนตุ๊กตาหิมะยักษ์ตามโหมดที่แอดมินตั้งไว้
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

  const amount = Number(body.amount);
  const allowed = config.presetPrices.includes(amount) || (Number.isInteger(amount) && amount >= config.customMin && amount <= config.customMax);
  if (!Number.isInteger(amount) || !allowed) {
    return NextResponse.json({ error: `จำนวนเงินต้องอยู่ระหว่าง ฿${config.customMin}–฿${config.customMax}` }, { status: 400 });
  }
  const name = clean(body.name, 20);
  const message = clean(body.message, 80);
  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  if (hasBlocked(name) || hasBlocked(message)) return NextResponse.json({ error: "ข้อความมีคำที่ไม่เหมาะสม" }, { status: 400 });

  const kind = body.kind === "support" ? "support" : "giant";
  const id = crypto.randomUUID();
  const base: Order = {
    id,
    room: room.id,
    kind,
    amount,
    name,
    message,
    mode: config.payMode,
    status: "awaiting_payment",
    createdAt: Date.now(),
    paidAt: null,
    providerRef: "",
    qrPayload: "",
    qrImage: "",
  };

  try {
    if (config.payMode === "manual") {
      const payload = promptPayPayload(amount, id.slice(0, 8));
      if (!payload) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าบัญชี PromptPay" }, { status: 503 });
      base.qrPayload = payload;
    } else {
      const charge = await createPromptPayCharge(amount, id);
      base.providerRef = charge.id;
      base.qrImage = charge.source?.scannable_code?.image?.download_uri ?? "";
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "สร้างรายการไม่สำเร็จ" }, { status: 502 });
  }

  await saveOrder(base);
  return NextResponse.json({ order: toPreview(base) });
}
