"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { OrderPreview } from "@/lib/christmas/types";
import { Icon } from "./Icon";

// ค่าการตั้งค่าที่หน้าเว็บใช้ (ราคาและสถานะการเปิดรับ)
export type DonateCfg = {
  enabled: boolean;
  payMode: "manual" | "gateway";
  presetPrices: number[];
  customMin: number;
  customMax: number;
  decorPrice: number;
  messagePrice: number;
};

export function useDonateConfig() {
  const [cfg, setCfg] = useState<DonateCfg | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/christmas/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: DonateCfg) => setCfg(c))
      .catch(() => setError("โหลดการตั้งค่าไม่สำเร็จ ลองปิดแล้วเปิดใหม่"));
  }, []);
  return { cfg, error };
}

// ฟอร์มชำระเงินแบบเรียลไทม์: ตรวจสถานะทุก 3 วินาที และไม่ให้ปิดหน้าจนกว่าจะชำระสำเร็จ
export function PaymentPanel({
  order,
  onUpdate,
  onClose,
}: {
  order: OrderPreview;
  onUpdate: (o: OrderPreview) => void;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  const [seconds, setSeconds] = useState(0);
  const paid = order.status === "paid";
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;

  // QR ของโหมด manual สร้างจากข้อความ PromptPay ที่มียอดและเลขอ้างอิง
  useEffect(() => {
    if (order.mode === "manual" && order.qrPayload) {
      QRCode.toDataURL(order.qrPayload, { margin: 1, width: 240, color: { dark: "#0f1f14", light: "#ffffff" } })
        .then(setQr)
        .catch(() => setQr(""));
    }
  }, [order.mode, order.qrPayload]);

  // ตรวจสถานะการชำระเงินจนกว่าจะเสร็จ
  useEffect(() => {
    if (paid) return;
    let stopped = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/christmas/donate/${order.id}`, { cache: "no-store" });
        const data = (await res.json()) as { order?: OrderPreview };
        if (!stopped && data.order) updateRef.current(data.order);
      } catch {
        /* ลองใหม่รอบถัดไป */
      }
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [order.id, paid]);

  // นับเวลารอ
  useEffect(() => {
    if (paid) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paid]);

  // กันการปิดแท็บหรือรีเฟรชระหว่างรอชำระ
  useEffect(() => {
    if (paid) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [paid]);

  if (paid) {
    return (
      <div className="xmas-pay-panel is-done" role="status">
        <span className="xmas-pay-check" aria-hidden>
          <Icon name="check" size={30} />
        </span>
        <b>ชำระเรียบร้อยแล้ว</b>
        <p>ขอบคุณที่สนับสนุน ฿{order.amount}</p>
        <button type="button" className="xmas-submit" onClick={onClose}>
          ปิด
        </button>
      </div>
    );
  }

  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="xmas-pay-panel">
      <div className="xmas-pay-head">
        <span className="xmas-pay-pulse" aria-hidden />
        รอการชำระเงิน · {Math.floor(seconds / 60)}:{ss}
      </div>
      <div className="xmas-pay-qr">
        {order.mode === "manual" && qr && <img src={qr} alt="QR PromptPay" width={220} height={220} />}
        {order.mode === "gateway" && order.qrImage && <img src={order.qrImage} alt="QR PromptPay" width={220} height={220} />}
        {!qr && !order.qrImage && <span className="xmas-hint">กำลังสร้าง QR…</span>}
      </div>
      <p className="xmas-pay-amount">ยอดที่ต้องโอน ฿{order.amount}</p>
      <ol className="xmas-pay-steps">
        <li>เปิดแอปธนาคารหรือทรูมันนี่แล้วเลือกสแกน QR</li>
        <li>ตรวจว่ายอดตรงกับ ฿{order.amount}</li>
        <li>รอระบบยืนยัน หน้านี้จะอัปเดตเองไม่ต้องรีเฟรช</li>
      </ol>
      {order.mode === "manual" && <p className="xmas-pay-note">โหมดนี้ทีมงานจะตรวจยอดและยืนยันให้หลังเงินเข้า</p>}
      <div className="xmas-pay-warn" role="alert">
        <Icon name="star" size={16} />
        <span>
          <b>กรุณาอย่าปิดหน้านี้</b> ปิดหรือรีเฟรชตอนนี้อาจทำให้ไม่เห็นผลการชำระ
        </span>
      </div>
    </div>
  );
}
