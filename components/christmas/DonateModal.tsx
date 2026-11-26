"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { OrderPreview } from "@/lib/christmas/types";
import "./christmas.css";
import { Icon } from "./Icon";
import { SnowmanPreview, type SnowParts } from "./SnowmanPreview";
import type { MessageTheme } from "@/lib/christmas/types";
import { GIANT_SPOT_DEFS } from "@/lib/christmas/slots";
import type { Social } from "@/lib/christmas/social";

// ธีมการแสดงข้อความบนท้องฟ้า: ทุกคนในห้องจะเห็นพร้อมกัน ทั้งคอมและมือถือ
const THEMES: { id: MessageTheme; label: string; hint: string; icon: "firework" | "snow" | "sparkle" | "sleigh" }[] = [
  { id: "fireworks", label: "พลุฉลอง", hint: "พลุสีทองระเบิดเหนือต้น", icon: "firework" },
  { id: "snow", label: "หิมะโปรยปราย", hint: "หิมะตกหนักพร้อมแสงน้ำแข็ง", icon: "snow" },
  { id: "sparkle", label: "ประกายระยิบ", hint: "กรอบดาวกระพริบรอบข้อความ", icon: "sparkle" },
  { id: "sleigh", label: "เลื่อนกวางเรนเดียร์", hint: "เลื่อนของซานตาวิ่งผ่านท้องฟ้า", icon: "sleigh" },
];

// ชื่อระดับของแต่ละยอดตามลำดับของ presetPrices (ยอดอื่นที่กรอกเองจะไม่มีชื่อระดับ)
const TIER_NAMES = ["ดาวดวงเล็ก", "ระฆังเงิน", "ดาวประจำห้อง"];
// ประโยคขอบคุณสำเร็จรูป กดเพื่อเติมข้อความได้เลย
const THANKS_CHIPS = ["ขอบคุณที่ทำให้คริสต์มาสนี้อบอุ่น", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "สุขสันต์วันคริสต์มาสนะ"];
// ตุ๊กตาหิมะยักษ์ชุดพิเศษสำหรับหน้าสนับสนุน
const GIANT_PARTS = { hat: "crown", scarf: "gold", nose: "star", arms: "wings", body: "white", legs: "snow", acc: "bow" };

type Cfg = { enabled: boolean; payMode: "manual" | "gateway"; presetPrices: number[]; customMin: number; customMax: number; decorPrice: number };

// ตุ๊กตา Exclusive ที่ผู้ใช้ตกแต่งและเลือกช่องไว้แล้ว รอชำระเงินเพื่อวาง
export type DecorDraft = { slot: number; parts: SnowParts; name: string; social?: Social };

// ป๊อปอัปสนับสนุน: เลือกยอด กรอกชื่อและข้อความ แล้วชำระผ่าน PromptPay
// โหมด manual แสดง QR ให้โอนแล้วรอแอดมินยืนยัน โหมด gateway แสดง QR จาก Omise และตรวจสถานะอัตโนมัติ
export default function DonateModal({
  roomId,
  roomName,
  onClose,
  onPaid,
  onPreview,
  defaultName = "",
  social,
  decor,
}: {
  roomId: string;
  roomName: string;
  onClose: () => void;
  onPaid: (name: string) => void;
  decor?: DecorDraft;
  onPreview?: (p: { spot: number; name: string; message: string; theme: MessageTheme }) => void;
  defaultName?: string;
  social?: Social;
}) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const [kind, setKind] = useState<"giant" | "support">("giant");
  const [theme, setTheme] = useState<MessageTheme>("fireworks");
  const [spot, setSpot] = useState(0);
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
        body: JSON.stringify(
          decor
            ? { room: roomId, kind: "decor", decor: { ...decor.parts, slot: decor.slot }, name, social: social ?? {} }
            : { room: roomId, amount: chosen, name, message, kind, theme, spot, social: social ?? {} },
        ),
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
      <div className="xmas-modal xmas-donate glass" role="dialog" aria-modal="true" aria-label="สนับสนุนตุ๊กตาหิมะยักษ์" onClick={(e) => e.stopPropagation()}>
        <button className="xmas-x" onClick={onClose} aria-label="ปิด">
          <Icon name="close" size={18} />
        </button>
        <div className="xmas-donate-hero" aria-hidden>
          <div className="xmas-donate-glow" />
          <SnowmanPreview parts={decor ? decor.parts : GIANT_PARTS} className="xmas-donate-snow" />
        </div>
        <p className="xmas-kicker">{decor || kind === "giant" ? `Exclusive · ${roomName}` : "สนับสนุนทีม DevEveryday"}</p>
        <h2>{decor ? "วางตุ๊กตาหิมะ Exclusive" : kind === "giant" ? "ตั้งป้ายประจำห้อง" : "ส่งกำลังใจให้ทีม"}</h2>
        <p className="xmas-hint">
          {decor
            ? `ช่อง ${decor.slot + 1} · ฿${cfg?.decorPrice ?? "—"} ต่อตัว วางได้ไม่จำกัด และวางบนช่องสงวนได้`
            : kind === "giant"
            ? "ป้ายของคุณจะแสดงให้ทุกคนในห้องเห็นพร้อมกัน และข้อความจะขึ้นบนท้องฟ้า"
            : "ยอดสนับสนุนช่วยให้ทีม DevEveryday พัฒนาและดูแลกิจกรรมนี้ต่อไป ชื่อของคุณจะแสดงในรายการผู้สนับสนุน"}
        </p>

        {disabled && <p className="xmas-msg err">ตอนนี้ปิดรับการสนับสนุนชั่วคราว</p>}

        {!order && cfg && !disabled && decor && (
          <form onSubmit={submit} className="xmas-form">
            <label>
              ชื่อที่แสดงบนตุ๊กตา
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
            </label>
            <button className="xmas-submit" disabled={busy}>
              {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${cfg.decorPrice}`}
            </button>
          </form>
        )}

        {!order && cfg && !disabled && !decor && (
          <form onSubmit={submit} className="xmas-form">
            <div className="xmas-kind" role="tablist" aria-label="ประเภทการสนับสนุน">
              <button type="button" role="tab" aria-selected={kind === "giant"} className={kind === "giant" ? "is-on" : ""} onClick={() => setKind("giant")}>
                <Icon name="star" size={15} /> Exclusive
              </button>
              <button type="button" role="tab" aria-selected={kind === "support"} className={kind === "support" ? "is-on" : ""} onClick={() => setKind("support")}>
                <Icon name="gift" size={15} /> สนับสนุนทีม
              </button>
            </div>
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
                    {kind === "giant" && TIER_NAMES[cfg.presetPrices.indexOf(p)] && <small>{TIER_NAMES[cfg.presetPrices.indexOf(p)]}</small>}
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
            {kind === "giant" && (
              <fieldset className="xmas-spot-pick">
                <legend>ตำแหน่งป้ายบนลาน</legend>
                <div className="xmas-spot-grid">
                  {GIANT_SPOT_DEFS.map((d, i) => (
                    <button type="button" key={d.label} className={spot === i ? "is-on" : ""} aria-pressed={spot === i} onClick={() => setSpot(i)}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <small className="xmas-hint">ป้ายจะตั้งอยู่ตำแหน่งที่เลือก และหันหน้าเข้าหาต้นคริสต์มาส</small>
              </fieldset>
            )}
            {kind === "giant" && (
              <fieldset className="xmas-theme-pick">
                <legend>ธีมการแสดงบนท้องฟ้า</legend>
                <div className="xmas-theme-grid">
                  {THEMES.map((t) => (
                    <button type="button" key={t.id} className={theme === t.id ? "is-on" : ""} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
                      <Icon name={t.icon} size={18} />
                      <b>{t.label}</b>
                      <small>{t.hint}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="xmas-thanks-input">
              <label>
                <span>{kind === "giant" ? "ข้อความขอบคุณจากใจ" : "ข้อความถึงทีม"} <em>{message.length}/80</em></span>
                <textarea
                  value={message}
                  maxLength={80}
                  rows={2}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={kind === "giant" ? "เขียนสิ่งที่อยากบอกทุกคนในห้อง…" : "ขอบคุณที่ช่วยให้ทุกคนได้ร่วมฉลองกัน"}
                />
              </label>
              <div className="xmas-thanks-chips">
                {THANKS_CHIPS.map((t) => (
                  <button type="button" key={t} onClick={() => setMessage(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {kind === "giant" && onPreview && (
              <button
                type="button"
                className="xmas-preview-btn"
                onClick={() => onPreview({ spot, name: name.trim() || "ตัวอย่าง", message: message.trim(), theme })}
              >
                ดูตัวอย่างบนฉากก่อนชำระ
              </button>
            )}
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
          <div className="xmas-thanks-card">
            <div className="xmas-donate-glow" aria-hidden />
            <SnowmanPreview parts={decor ? decor.parts : GIANT_PARTS} className="xmas-donate-snow" />
            <p className="xmas-thanks-kicker">ขอบคุณจากใจจริง</p>
            <blockquote>{message.trim() || "ขอบคุณที่มาร่วมแขวนแสงให้ห้องนี้"}</blockquote>
            <p className="xmas-thanks-by">— {name}</p>
            <p className="xmas-hint">{decor ? "ตุ๊กตาหิมะ Exclusive ของคุณวางบนต้นให้ทุกคนในห้องเห็นแล้ว" : kind === "giant" ? "ตุ๊กตาหิมะยักษ์ของคุณขึ้นป้ายให้ทุกคนในห้องเห็นแล้ว" : "ขอบคุณที่ช่วยสนับสนุนทีม"}</p>
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
