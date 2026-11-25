// ยืนยันการชำระเงินหนึ่งครั้ง: ทำเครื่องหมายว่าจ่ายแล้ว และส่งข้อความขึ้นท้องฟ้าของห้องนั้น
// เรียกได้หลายครั้งโดยไม่เกิดผลซ้ำ (จะส่งข้อความเฉพาะการยืนยันแรก)
import { enqueueEvent } from "@/lib/christmas/store";
import { getOrder, markPaid } from "@/lib/christmas/orders";

export async function confirmPayment(orderId: string, providerRef: string) {
  const before = await getOrder(orderId);
  if (!before || before.status === "paid") return before;
  const now = Date.now();
  const paid = await markPaid(orderId, providerRef, now);
  if (paid && paid.kind !== "support") {
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
