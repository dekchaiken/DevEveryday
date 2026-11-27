"use client";

// แถบสถานะคำสั่งซื้อที่ค้างอยู่ในเครื่องนี้: ตรวจกลับจากเซิร์ฟเวอร์เป็นระยะ
// ถ้าคำสั่งถูกยืนยันทีหลัง (เช่นโอนแล้วระบบจับคู่ช้า) จะขึ้นข้อความขอบคุณให้เอง
import { useCallback, useEffect, useState } from "react";
import { forgetPending, listPending, type PendingOrder } from "./pendingOrders";

export function PendingOrdersWatch({ roomId, notify }: { roomId: string; notify: (kind: "ok" | "err", text: string) => void }) {
  const [items, setItems] = useState<PendingOrder[]>([]);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    const mine = listPending().filter((o) => o.room === roomId);
    setChecking(true);
    for (const o of mine) {
      try {
        const res = await fetch(`/api/christmas/donate/${o.id}`, { cache: "no-store" });
        if (!res.ok) {
          forgetPending(o.id); // ไม่พบคำสั่งนี้แล้ว
          continue;
        }
        const { order } = (await res.json()) as { order: { status: string } };
        if (order.status === "paid") {
          forgetPending(o.id);
          notify("ok", `คำสั่งซื้อ ฿${o.amount} ของคุณชำระสำเร็จแล้ว ขอบคุณที่สนับสนุนนะ`);
        } else if (order.status === "cancelled") {
          forgetPending(o.id);
        }
      } catch {
        /* ตรวจไม่ได้ตอนนี้ ลองใหม่รอบถัดไป */
      }
    }
    setItems(listPending().filter((o) => o.room === roomId));
    setChecking(false);
  }, [roomId, notify]);

  useEffect(() => {
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, [check]);

  if (items.length === 0) return null;
  return (
    <div className="xmas-pending" role="status">
      <span>
        มีคำสั่งซื้อรอชำระ {items.length} รายการ (฿{items.map((o) => o.amount).join(", ฿")})
      </span>
      <button type="button" onClick={check} disabled={checking}>
        {checking ? "กำลังตรวจ…" : "ตรวจสถานะ"}
      </button>
      <button
        type="button"
        onClick={() => {
          items.forEach((o) => forgetPending(o.id));
          setItems([]);
        }}
        aria-label="ซ่อนคำสั่งที่รอชำระ"
      >
        ซ่อน
      </button>
    </div>
  );
}
