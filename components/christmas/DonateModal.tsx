"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { OrderPreview } from "@/lib/christmas/types";
import "./christmas.css";

type Cfg = { enabled: boolean; payMode: "manual" | "gateway"; presetPrices: number[]; customMin: number; customMax: number };

// ป๊อปอัปสนับสนุน: เลือกยอด กรอกชื่อและข้อความ แล้วชำระผ่าน PromptPay
// โหมด manual แสดง QR ให้โอนแล้วรอแอดมินยืนยัน โหมด gateway แสดง QR จาก Omise และตรวจสถานะอัตโนมัติ
export default function DonateModal({
  roomId,
  roomName,
  onClose,
  onPaid,
}: {
  roomId: string;
  roomName: string;
  onClose: () => void;
  onPaid: (name: string) => void;
}) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    fetch("/api/christmas/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: Cfg) => setCfg(c))
      .catch(() => setError("โหลดการตั้งค่าไม่สำเร็จ"));
  }, []);

  // แสดง QR ของโหมด manual จากข้อความ PromptPay
  useEffect(() => {
    if (order?.mode === "manual" && order.qrPayload) {
      QRCode.toDataURL(order.qrPayload, { margin: 1, width: 240, color: { dark: "#0f1f14", light: "#ffffff" } })
        .then(setQrUrl)
        .catch(() => setError("สร้าง QR ไม่สำเร็จ"));
    }
  }, [order]);

  // ตรวจสถานะการชำระเงินทุก 3 วินาทีจนกว่าจะจ่ายแล้ว
  useEffect(() => {
    if (!order || order.status !== "awaiting_payment") return;
    let stopped = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/christmas/donate/${order.id}`, { cache: "no-store" });
        const data = (await res.json()) as { order: OrderPreview };
        if (stopped) return;
        setOrder(data.order);
        if (data.order.status === "paid") onPaid(name);
      } catch {
        /* ลองใหม่รอบถัดไป */
      }
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [order, name, onPaid]);

  const chosen = amount ?? (custom ? Number(custom) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return setError("เลือกหรือกรอกจำนวนเงินก่อน");
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดงบนป้าย");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/christmas/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, amount: chosen, name, message }),
      });
      const data = (await res.json()) as { order?: OrderPreview; error?: string };
      if (!res.ok || !data.order) throw new Error(data.error ?? "สร้างรายการไม่สำเร็จ");
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const disabled = cfg !== null && !cfg.enabled;

  return (
    <div className="xmas-modal-back" role="presentation" onClick={onClose}>
      <div className="xmas-modal glass" role="dialog" aria-modal="true" aria-label="สนับสนุนตุ๊กตาหิมะยักษ์" onClick={(e) => e.stopPropagation()}>
        <button className="xmas-x" onClick={onClose} aria-label="ปิด">
          ×
        </button>
        <p className="xmas-kicker">ตุ๊กตาหิมะยักษ์ · {roomName}</p>
        <h2>ตั้งตุ๊กตาหิมะยักษ์ให้ห้องนี้</h2>
        <p className="xmas-hint">ป้ายของคุณจะแสดงให้ทุกคนในห้องเห็นพร้อมกัน และข้อความจะขึ้นบนท้องฟ้า</p>

        {disabled && <p className="xmas-msg err">ตอนนี้ปิดรับการสนับสนุนชั่วคราว</p>}

        {!order && cfg && !disabled && (
          <form onSubmit={submit} className="xmas-form">
            <fieldset>
              <legend>เลือกยอด</legend>
              <div className="xmas-shapes">
                {cfg.presetPrices.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={amount === p ? "is-on" : ""}
                    aria-pressed={amount === p}
                    onClick={() => {
                      setAmount(p);
                      setCustom("");
                    }}
                  >
                    ฿{p}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              หรือกรอกจำนวนเอง (฿{cfg.customMin}–฿{cfg.customMax})
              <input
                inputMode="numeric"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setAmount(null);
                }}
                placeholder="เช่น 50"
              />
            </label>
            <label>
              ชื่อที่แสดงบนป้าย
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
            </label>
            <label>
              ข้อความบนป้าย
              <textarea value={message} maxLength={80} rows={2} onChange={(e) => setMessage(e.target.value)} placeholder="สุขสันต์วันคริสต์มาส" />
            </label>
            <button className="xmas-submit" disabled={busy}>
              {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${chosen ?? "—"}`}
            </button>
          </form>
        )}

        {order && order.status === "awaiting_payment" && (
          <div className="xmas-pay">
            <p className="xmas-hint">
              สแกน QR เพื่อชำระ ฿{order.amount}
              {order.mode === "manual" ? " แล้วรอแอดมินยืนยัน" : ""}
            </p>
            {order.mode === "manual" && qrUrl && <img src={qrUrl} alt="QR PromptPay" width={240} height={240} className="xmas-qr" />}
            {order.mode === "gateway" && order.qrImage && (
              <img src={order.qrImage} alt="QR PromptPay" width={240} height={240} className="xmas-qr" />
            )}
            <p className="xmas-hint">กำลังรอการชำระเงิน…</p>
          </div>
        )}

        {order && order.status === "paid" && (
          <div className="xmas-pay">
            <p className="xmas-msg ok">ได้รับการสนับสนุนแล้ว ขอบคุณค่ะ ✨ ตุ๊กตาหิมะยักษ์ของคุณขึ้นป้ายแล้ว</p>
            <button className="xmas-submit" onClick={onClose}>
              ปิด
            </button>
          </div>
        )}

        {error && <p className="xmas-msg err">{error}</p>}
      </div>
    </div>
  );
}
