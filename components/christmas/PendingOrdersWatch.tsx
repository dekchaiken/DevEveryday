"use client";

// กล่องจดหมายคำสั่งซื้อของลูกค้า: แสดงคำสั่งที่ค้างในเครื่องนี้ พร้อมสถานะจากเซิร์ฟเวอร์
// รอชำระ: กดเพื่อกลับไปดู QR และชำระต่อ · ชำระแล้ว: ขึ้นตำแหน่งหรือช่องที่ได้ · เลยเวลาจอง: แจ้งให้สั่งใหม่
import { useCallback, useEffect, useState } from "react";
import type { OrderPreview } from "@/lib/christmas/types";
import { PaymentPanel } from "./PaymentPanel";
import { forgetPending, listPending, markNotified, type PendingOrder } from "./pendingOrders";

type Row = PendingOrder & { preview?: OrderPreview; expired?: boolean };

const KIND_TH: Record<string, string> = {
  giant: "บ้านหิมะ Exclusive",
  decor: "ตุ๊กตา Exclusive",
  message: "ข้อความอวยพรขึ้นจอ",
  support: "สนับสนุนทีมงาน",
};
const HOLD_MS = 60 * 60 * 1000; // ตรงกับเวลาจองตำแหน่งบนเซิร์ฟเวอร์

export function PendingOrdersWatch({ roomId, notify, hideButton = false }: { roomId: string; notify: (kind: "ok" | "err", text: string) => void; hideButton?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<OrderPreview | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    const mine = listPending().filter((o) => o.room === roomId);
    setChecking(true);
    const next: Row[] = [];
    for (const o of mine) {
      try {
        const res = await fetch(`/api/christmas/donate/${o.id}`, { cache: "no-store" });
        if (!res.ok) {
          forgetPending(o.id);
          continue;
        }
        const { order } = (await res.json()) as { order: OrderPreview };
        if (order.status === "cancelled") {
          forgetPending(o.id);
          continue;
        }
        if (order.status === "paid" && !o.notified) {
          notify("ok", `${KIND_TH[o.kind] ?? "คำสั่งซื้อ"} ชำระสำเร็จแล้ว ขอบคุณที่สนับสนุนนะ`);
          markNotified(o.id);
        }
        next.push({ ...o, notified: o.notified || order.status === "paid", preview: order, expired: order.status === "awaiting_payment" && Date.now() - o.at > HOLD_MS });
      } catch {
        next.push({ ...o });
      }
    }
    setRows(next);
    setChecking(false);
  }, [roomId, notify]);

  useEffect(() => {
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, [check]);

  const needs = rows.filter((r) => r.preview?.status === "awaiting_payment" || (r.preview?.status === "paid" && !r.notified)).length;
  if (rows.length === 0 && !open) return null;

  return (
    <>
      {/* ซ่อนปุ่มตอนเปิดหน้าต่างอื่นหรือเลือกช่องบนฉาก ไม่ให้ลอยทับเนื้อหา */}
      {!hideButton && (
        <button type="button" className="xmas-inbox-btn" onClick={() => setOpen(true)} aria-label="กล่องจดหมายคำสั่งซื้อ">
          กล่องจดหมาย
          {needs > 0 && <b>{needs}</b>}
        </button>
      )}

      {open && (
        <div className="xmas-inbox-back" role="presentation" onClick={() => setOpen(false)}>
          <div className="xmas-inbox" role="dialog" aria-label="กล่องจดหมายคำสั่งซื้อ" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>คำสั่งซื้อของคุณ</h3>
              <button type="button" onClick={check} disabled={checking}>
                {checking ? "กำลังตรวจ…" : "ตรวจสถานะ"}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="ปิด">
                ×
              </button>
            </header>
            {rows.length === 0 && <p className="xmas-inbox-empty">ยังไม่มีคำสั่งซื้อในเครื่องนี้</p>}
            <ul>
              {rows.map((r) => {
                const p = r.preview;
                const amount = p?.payAmount ?? String(r.amount);
                const status = p?.status;
                return (
                  <li key={r.id} className={status === "paid" ? "is-paid" : r.expired ? "is-expired" : ""}>
                    <div>
                      <b>
                        {KIND_TH[r.kind] ?? "คำสั่งซื้อ"} · ฿{amount}
                      </b>
                      {r.name && <small>ชื่อ {r.name}</small>}
                      {status === "paid" && r.kind === "giant" && p?.spot !== undefined && <small>ตั้งอยู่ที่จุด {p.spot + 1} บนลาน (สีแดงบนแผนที่)</small>}
                      {status === "paid" && r.kind === "decor" && p?.slot !== undefined && <small>วางตุ๊กตาที่ช่อง {p.slot + 1} แล้ว</small>}
                      {status === "paid" && r.kind === "message" && <small>ข้อความขึ้นบนท้องฟ้าแล้ว</small>}
                      {status === "paid" && r.kind === "support" && <small>ขอบคุณที่สนับสนุนทีมงาน</small>}
                      {r.expired && status === "awaiting_payment" && <small>เลยเวลาจองแล้ว ถ้าชำระตอนนี้ตำแหน่งอาจถูกคนอื่นจองไปก่อน ลองสั่งใหม่จะดีกว่า</small>}
                    </div>
                    <div className="xmas-inbox-act">
                      {status === "paid" && <span className="pill ok">ชำระแล้ว</span>}
                      {status === "awaiting_payment" && !r.expired && (
                        <>
                          <span className="pill wait">รอชำระ</span>
                          <button type="button" onClick={() => p && setPaying(p)}>
                            ดู QR และชำระ
                          </button>
                        </>
                      )}
                      {r.expired && <span className="pill warn">หมดเวลา</span>}
                      {status !== "awaiting_payment" || r.expired ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            forgetPending(r.id);
                            check();
                          }}
                        >
                          ซ่อน
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {paying && (
        <div className="xmas-inbox-back" role="presentation" onClick={() => setPaying(null)}>
          <div className="xmas-inbox-pay" onClick={(e) => e.stopPropagation()}>
            <PaymentPanel
              order={paying}
              onUpdate={(o) => setPaying(o)}
              onClose={() => {
                setPaying(null);
                check();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
