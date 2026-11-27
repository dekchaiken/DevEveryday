import { NextResponse } from "next/server";
import { getOrder, toPreview } from "@/lib/christmas/orders";
import { retrieveCharge } from "@/lib/christmas/omise";
import { chargeMatches, confirmPayment } from "@/lib/christmas/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ตรวจสถานะคำสั่งสนับสนุน ถ้าเป็นโหมด gateway จะถาม Omise โดยตรงด้วย (ไม่เชื่อข้อมูลจากฝั่งลูกค้า)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "ไม่พบคำสั่งนี้" }, { status: 404 });

  if (order.status === "awaiting_payment" && order.mode === "gateway" && order.providerRef) {
    try {
      const charge = await retrieveCharge(order.providerRef);
      if (charge.metadata?.orderId === order.id && chargeMatches(order, charge)) {
        order = (await confirmPayment(order.id, charge.id)) ?? order;
      }
    } catch {
      /* ยังตรวจไม่ได้ ลองใหม่รอบถัดไป */
    }
  }
  return NextResponse.json({ order: toPreview(order) }, { headers: { "Cache-Control": "no-store" } });
}
