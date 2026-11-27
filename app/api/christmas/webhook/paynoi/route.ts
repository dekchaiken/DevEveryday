import { NextResponse } from "next/server";
import { checkPaynoiTransaction, paynoiMatches } from "@/lib/christmas/paynoi";
import { confirmPayment } from "@/lib/christmas/payments";
import { getOrder } from "@/lib/christmas/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// paynoi แจ้งเมื่อมีการโอนเข้าบัญชี ไม่เชื่อเนื้อความของ webhook ตรง ๆ
// ถามสถานะรายการนั้นกลับจาก paynoi ด้วย API key ของเราก่อน แล้วยืนยันเฉพาะเมื่อครบทั้งสถานะ รหัสออเดอร์ และยอดสตางค์
// ตอบ {"status":1} เมื่อประมวลผลแล้ว (paynoi จะบันทึกว่าส่งไม่สำเร็จถ้าไม่ตอบแบบนี้)
export async function POST(req: Request) {
  let body: { data?: { trans_id?: unknown; ref1?: unknown } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ status: 0 }, { status: 400 });
  }
  const transId = typeof body.data?.trans_id === "string" ? body.data.trans_id : "";
  const ref1 = typeof body.data?.ref1 === "string" ? body.data.ref1 : "";
  if (!transId || !ref1) return NextResponse.json({ status: 0 }, { status: 400 });

  const order = await getOrder(ref1);
  // ไม่ใช่ออเดอร์ paynoi ของเรา: ตอบว่ารับแล้วเพื่อไม่ให้ส่งซ้ำ
  if (!order || order.mode !== "paynoi" || order.providerRef !== transId) return NextResponse.json({ status: 1 });
  if (order.status === "paid") return NextResponse.json({ status: 1 });

  try {
    const check = await checkPaynoiTransaction(transId);
    if (paynoiMatches(check, order.payAmountSatang)) await confirmPayment(order.id, transId);
    return NextResponse.json({ status: 1 });
  } catch {
    // ตรวจไม่ได้ตอนนี้ ให้ paynoi ส่งซ้ำภายหลัง
    return NextResponse.json({ status: 0 }, { status: 500 });
  }
}
