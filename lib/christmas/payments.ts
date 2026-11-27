// ยืนยันการชำระเงินหนึ่งครั้ง: ทำเครื่องหมายว่าจ่ายแล้ว และส่งข้อความขึ้นท้องฟ้าของห้องนั้น
// เรียกได้หลายครั้งโดยไม่เกิดผลซ้ำ (จะส่งข้อความเฉพาะการยืนยันแรก)
import { enqueueEvent } from "@/lib/christmas/store";
import { getOrder, markPaid } from "@/lib/christmas/orders";
import type { OmiseCharge } from "@/lib/christmas/omise";
import { writeLog } from "@/lib/christmas/log";
import { placePaidDecor } from "@/lib/christmas/decor";

// ตรวจว่าใบเรียกเก็บเงินจาก Omise ตรงกับคำสั่งซื้อจริง ทั้งสถานะ ยอด (สตางค์) และสกุลเงิน
export function chargeMatches(order: { amount: number }, charge: OmiseCharge): boolean {
  return charge.status === "successful" && charge.amount === Math.round(order.amount * 100) && (charge.currency ?? "").toLowerCase() === "thb";
}

export async function confirmPayment(orderId: string, providerRef: string) {
  const before = await getOrder(orderId);
  if (!before || before.status === "paid") return before;
  const now = Date.now();
  const paid = await markPaid(orderId, providerRef, now);
  if (paid) await writeLog({ type: "paid", room: paid.room, actor: paid.mode, text: `ชำระแล้ว ฿${paid.amount} · ${paid.name} (${paid.kind})` });
  if (paid && paid.kind === "decor" && paid.decor) {
    const placed = await placePaidDecor(paid.room, paid.id, paid.name, paid.social ?? {}, paid.decor);
    await writeLog({
      type: "decor",
      room: paid.room,
      actor: paid.mode,
      text: placed ? `ตุ๊กตา Exclusive ${paid.name} วางช่อง ${placed.decor.slot + 1}${placed.moved ? " (ช่องที่เลือกถูกแย่งไปก่อน ย้ายให้อัตโนมัติ)" : ""}` : `ตุ๊กตา Exclusive ${paid.name} วางไม่ได้ ไม่มีช่องว่าง`,
    });
  }
  // ข้อความขึ้นท้องฟ้าเฉพาะแบบข้อความอวยพรขึ้นจอ ข้อความของตุ๊กตายักษ์อยู่บนป้ายเท่านั้น
  if (paid && paid.kind === "message") {
    await enqueueEvent(
      paid.room,
      {
        kind: "message",
        text: paid.message.trim() || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส",
        by: paid.name,
        color: "gold",
        theme: paid.theme ?? "fireworks",
        duration: paid.theme === "sleigh" ? 9000 : 7000,
      },
      now,
    );
  }
  return paid;
}
