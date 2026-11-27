import { NextResponse } from "next/server";
import { getOrder } from "@/lib/christmas/orders";
import { confirmPayment } from "@/lib/christmas/payments";
import { SpotLostError } from "@/lib/christmas/orders";
import { writeLog } from "@/lib/christmas/log";
import { checkPaynoiTransaction, paynoiMatches } from "@/lib/christmas/paynoi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// แอดมินยืนยันการโอนเงินด้วยตนเอง (ใช้กับโหมด manual เท่านั้น)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "ไม่พบคำสั่งนี้" }, { status: 404 });

  // ถามสถานะกับ paynoi ของคำสั่งนี้ และยืนยันถ้าจ่ายครบ (ใช้กู้คำสั่งที่โอนแล้วแต่ยังไม่ขึ้น)
  if (body.action === "check_paynoi") {
    if (order.mode !== "paynoi" || !order.providerRef) return NextResponse.json({ error: "คำสั่งนี้ไม่ใช่ paynoi" }, { status: 400 });
    if (order.status === "paid") return NextResponse.json({ ok: true, status: "paid", paynoi: "completed" });
    try {
      const check = await checkPaynoiTransaction(order.providerRef);
      if (!paynoiMatches(check, order.payAmountSatang)) return NextResponse.json({ ok: true, status: order.status, paynoi: check.paymentStatus });
      const paid = await confirmPayment(order.id, order.providerRef);
      await writeLog({ type: "paid", room: order.room, actor: "admin", text: `แอดมินตรวจกับ paynoi แล้วยืนยัน ${id.slice(0, 8)} ฿${order.amount}` });
      return NextResponse.json({ ok: true, status: paid?.status ?? "paid", paynoi: check.paymentStatus });
    } catch (err) {
      if (err instanceof SpotLostError) return NextResponse.json({ error: err.message, code: "spot_lost" }, { status: 409 });
      return NextResponse.json({ error: err instanceof Error ? err.message : "ตรวจกับ paynoi ไม่สำเร็จ" }, { status: 502 });
    }
  }

  // ยืนยันด้วยมือสำหรับ paynoi: ใช้เมื่อแอดมินตรวจ SMS หรือสลิปแล้วว่าเงินเข้าบัญชีจริง แต่ paynoi ยังไม่จับคู่
  if (body.action === "confirm_manual") {
    if (order.mode !== "paynoi") return NextResponse.json({ error: "ใช้ได้เฉพาะคำสั่ง paynoi" }, { status: 400 });
    if (order.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });
    try {
      const paid = await confirmPayment(id, `manual-paynoi:${new Date().toISOString()}`);
      await writeLog({ type: "paid", room: order.room, actor: "admin", text: `แอดมินยืนยันด้วยมือ (paynoi ยังไม่จับคู่) ${id.slice(0, 8)} ฿${order.amount}` });
      return NextResponse.json({ ok: true, status: paid?.status });
    } catch (err) {
      if (err instanceof SpotLostError) return NextResponse.json({ error: err.message, code: "spot_lost" }, { status: 409 });
      throw err;
    }
  }

  if (body.action !== "confirm") return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  if (order.mode !== "manual") return NextResponse.json({ error: "คำสั่งนี้ยืนยันอัตโนมัติผ่าน Omise" }, { status: 400 });
  if (order.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });
  try {
    const paid = await confirmPayment(id, `manual:${new Date().toISOString()}`);
    await writeLog({ type: "paid", room: order.room, actor: "admin", text: `แอดมินยืนยันการโอน ${id.slice(0, 8)} ฿${order.amount}` });
    return NextResponse.json({ ok: true, status: paid?.status });
  } catch (err) {
    if (err instanceof SpotLostError) return NextResponse.json({ error: err.message, code: "spot_lost" }, { status: 409 });
    throw err;
  }
}
