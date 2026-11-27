import { NextResponse } from "next/server";
import { retrieveCharge } from "@/lib/christmas/omise";
import { chargeMatches, confirmPayment } from "@/lib/christmas/payments";
import { getOrder } from "@/lib/christmas/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// รับแจ้งเตือนจาก Omise เมื่อการชำระเงินเสร็จ
// ไม่เชื่อข้อมูลในเนื้อความ แต่ดึงรายการจาก Omise อีกครั้งเพื่อยืนยันก่อน
export async function POST(req: Request) {
  let body: { key?: string; data?: { id?: string; object?: string } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: true }); // ตอบ 200 เพื่อไม่ให้ Omise ส่งซ้ำไม่รู้จบ
  }
  if (body.key?.startsWith("charge.") && body.data?.object === "charge" && body.data.id) {
    try {
      const charge = await retrieveCharge(body.data.id);
      const orderId = charge.metadata?.orderId;
      const order = orderId ? await getOrder(orderId) : null;
      if (order && chargeMatches(order, charge)) await confirmPayment(order.id, charge.id);
    } catch {
      return NextResponse.json({ error: "ตรวจสอบรายการไม่สำเร็จ" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
