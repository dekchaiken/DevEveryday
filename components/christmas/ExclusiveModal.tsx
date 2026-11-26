"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { MessageTheme, OrderPreview } from "@/lib/christmas/types";
import { MESSAGE_THEMES } from "@/lib/christmas/types";
import { GIANT_SPOT_DEFS } from "@/lib/christmas/slots";
import type { Social } from "@/lib/christmas/social";
import type { SnowParts } from "./SnowmanPreview";
import { SnowmanPreview } from "./SnowmanPreview";
import { Icon } from "./Icon";
import { PaymentPanel, useDonateConfig } from "./PaymentPanel";

// ตุ๊กตาหิมะ Exclusive ที่ผู้ใช้ตกแต่งและเลือกช่องไว้แล้ว รอชำระเงินเพื่อวาง
export type DecorDraft = { slot: number; parts: SnowParts; name: string; social?: Social };

const TIER_NAMES = ["ดาวดวงเล็ก", "ระฆังเงิน", "ดาวประจำห้อง"];
const THEMES: { id: MessageTheme; label: string; hint: string; icon: "firework" | "snow" | "sparkle" | "sleigh" }[] = [
  { id: "fireworks", label: "พลุฉลอง", hint: "พลุสีทองระเบิดเหนือต้น", icon: "firework" },
  { id: "snow", label: "หิมะโปรยปราย", hint: "หิมะตกหนักพร้อมแสงน้ำแข็ง", icon: "snow" },
  { id: "sparkle", label: "ประกายระยิบ", hint: "กรอบดาวกระพริบรอบข้อความ", icon: "sparkle" },
  { id: "sleigh", label: "เลื่อนกวางเรนเดียร์", hint: "เลื่อนของซานตาวิ่งผ่านท้องฟ้า", icon: "sleigh" },
];
const THANKS_CHIPS = ["ขอบคุณที่ทำให้คริสต์มาสนี้อบอุ่น", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "สุขสันต์วันคริสต์มาสนะ"];

type View = "menu" | "giant" | "message" | "decor";

export default function ExclusiveModal({
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
  onPaid: (kind: "giant" | "message" | "decor", name: string) => void;
  onPreview?: (p: { spot: number; name: string; message: string; theme: MessageTheme }) => void;
  defaultName?: string;
  social?: Social;
  decor?: DecorDraft;
}) {
  const { cfg, error: cfgError } = useDonateConfig();
  const [view, setView] = useState<View>(decor ? "decor" : "menu");
  const [name, setName] = useState(decor?.name ?? defaultName);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<MessageTheme>("fireworks");
  const [spot, setSpot] = useState(0);
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const [orderKind, setOrderKind] = useState<"giant" | "message" | "decor">("giant");

  const locked = order !== null && order.status !== "paid";
  const disabled = cfg !== null && !cfg.enabled;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  // ยอดของป้ายยักษ์เลือกจากระดับที่ตั้งไว้ หรือกรอกเอง
  const giantChosen = amount ?? (custom ? Number(custom) : null);

  async function create(kind: "giant" | "message" | "decor", body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/christmas/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, kind, social: social ?? {}, ...body }),
      });
      const data = (await res.json()) as { order?: OrderPreview; error?: string };
      if (!res.ok || !data.order) throw new Error(data.error ?? "สร้างรายการไม่สำเร็จ");
      setOrderKind(kind);
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  function submitGiant(e: FormEvent) {
    e.preventDefault();
    if (!giantChosen) return setError("เลือกหรือกรอกยอดก่อน");
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดงบนป้าย");
    create("giant", { amount: giantChosen, name: name.trim(), message: message.trim(), spot, theme });
  }

  function submitMessage(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณาใส่ชื่อ");
    if (!message.trim()) return setError("กรุณาใส่ข้อความที่จะขึ้นจอ");
    create("message", { name: name.trim(), message: message.trim(), theme });
  }

  function submitDecor(e: FormEvent) {
    e.preventDefault();
    if (!decor) return;
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดงบนตุ๊กตา");
    create("decor", { decor: { ...decor.parts, slot: decor.slot }, name: name.trim() });
  }

  const title = {
    menu: "Exclusive",
    giant: "ตั้งป้ายตุ๊กตาหิมะยักษ์",
    message: "ข้อความอวยพรขึ้นจอ",
    decor: "วางตุ๊กตาหิมะ Exclusive",
  }[view];

  return (
    <div className="xmas-modal-back" role="presentation" onClick={locked ? undefined : onClose}>
      <div className="xmas-modal xmas-exclusive" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {!locked && (
          <button className="xmas-x" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
        )}

        <p className="xmas-kicker">Exclusive · {roomName}</p>
        <h2>{title}</h2>
        {cfgError && <p className="xmas-msg err">{cfgError}</p>}
        {disabled && <p className="xmas-msg err">ตอนนี้ปิดรับการสนับสนุนชั่วคราว</p>}

        {order && (
          <PaymentPanel
            order={order}
            onUpdate={setOrder}
            onClose={() => onPaid(orderKind, name.trim())}
          />
        )}

        {!order && cfg && !disabled && view === "menu" && (
          <div className="xmas-ex-menu">
            <p className="xmas-sup-lead">เลือกฟีเจอร์ที่ต้องการ แต่ละแบบมีการชำระแยกกัน</p>
            <button type="button" className="xmas-ex-card" onClick={() => setView("giant")}>
              <span className="xmas-ex-icon" aria-hidden>
                <Icon name="crown" size={26} />
              </span>
              <span className="xmas-ex-body">
                <b>ตุ๊กตาหิมะยักษ์</b>
                <small>ป้ายประจำห้องบนลาน 4 ตำแหน่ง พร้อมข้อความที่ขึ้นบนท้องฟ้า ทุกคนในห้องเห็นพร้อมกัน</small>
                <em>เริ่มที่ ฿{cfg.presetPrices[0]}</em>
              </span>
              <Icon name="sparkle" size={18} />
            </button>
            <button type="button" className="xmas-ex-card" onClick={() => setView("message")}>
              <span className="xmas-ex-icon" aria-hidden>
                <Icon name="sparkle" size={26} />
              </span>
              <span className="xmas-ex-body">
                <b>ข้อความอวยพรขึ้นจอ</b>
                <small>ให้ข้อความของคุณขึ้นบนท้องฟ้าให้ทุกคนในห้องเห็นพร้อมกัน เลือกธีมการแสดงได้</small>
                <em>฿{cfg.messagePrice}</em>
              </span>
              <Icon name="sparkle" size={18} />
            </button>
          </div>
        )}

        {!order && cfg && !disabled && view === "giant" && (
          <form className="xmas-sup-grid" onSubmit={submitGiant}>
            <button type="button" className="xmas-ex-back" onClick={() => setView("menu")}>
              ← กลับไปเลือกฟีเจอร์
            </button>
            <section className="xmas-sup-card">
              <h3>
                <span className="xmas-sup-num">1</span> ตำแหน่งป้ายและยอด
              </h3>
              <div className="xmas-spot-grid">
                {GIANT_SPOT_DEFS.map((d, i) => (
                  <button type="button" key={d.label} className={spot === i ? "is-on" : ""} aria-pressed={spot === i} onClick={() => setSpot(i)}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="xmas-sup-prices">
                {cfg.presetPrices.map((p, i) => (
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
                    {TIER_NAMES[i] && <small>{TIER_NAMES[i]}</small>}
                  </button>
                ))}
              </div>
              <label className="xmas-sup-custom">
                <span>หรือกรอกจำนวนเอง</span>
                <div>
                  <b>฿</b>
                  <input
                    inputMode="numeric"
                    value={custom}
                    placeholder={`${cfg.customMin}–${cfg.customMax}`}
                    onChange={(e) => {
                      setCustom(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setAmount(null);
                    }}
                  />
                </div>
              </label>
            </section>
            <section className="xmas-sup-card">
              <h3>
                <span className="xmas-sup-num">2</span> ชื่อและข้อความบนป้าย
              </h3>
              <label className="xmas-sup-field">
                <span>ชื่อที่จะแสดง</span>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
              </label>
              <label className="xmas-sup-field">
                <span>
                  ข้อความจากใจ <em>{message.length}/80</em>
                </span>
                <textarea value={message} maxLength={80} rows={2} onChange={(e) => setMessage(e.target.value)} placeholder="เขียนสิ่งที่อยากบอกทุกคนในห้อง" />
              </label>
              <div className="xmas-sup-chips">
                {THANKS_CHIPS.map((t) => (
                  <button type="button" key={t} onClick={() => setMessage(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </section>
            <section className="xmas-sup-card xmas-sup-wide">
              <h3>
                <span className="xmas-sup-num">3</span> ธีมการแสดงบนท้องฟ้า
              </h3>
              <div className="xmas-theme-grid">
                {THEMES.map((t) => (
                  <button type="button" key={t.id} className={theme === t.id ? "is-on" : ""} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
                    <Icon name={t.icon} size={20} />
                    <b>{t.label}</b>
                    <small>{t.hint}</small>
                  </button>
                ))}
              </div>
            </section>
            <div className="xmas-sup-foot">
              {error && <p className="xmas-msg err">{error}</p>}
              {onPreview && (
                <button
                  type="button"
                  className="xmas-ghost-btn"
                  onClick={() => onPreview({ spot, name: name.trim() || "ตัวอย่าง", message: message.trim(), theme })}
                >
                  ดูตัวอย่างบนฉาก
                </button>
              )}
              <button className="xmas-submit" disabled={busy}>
                {busy ? "กำลังสร้างรายการ…" : giantChosen ? `ชำระ ฿${giantChosen}` : "เลือกยอดก่อน"}
              </button>
            </div>
          </form>
        )}

        {!order && cfg && !disabled && view === "message" && (
          <form className="xmas-sup-grid" onSubmit={submitMessage}>
            <button type="button" className="xmas-ex-back" onClick={() => setView("menu")}>
              ← กลับไปเลือกฟีเจอร์
            </button>
            <section className="xmas-sup-card xmas-sup-wide">
              <h3>
                <span className="xmas-sup-num">1</span> เลือกธีมการแสดง
              </h3>
              <div className="xmas-theme-grid">
                {THEMES.map((t) => (
                  <button type="button" key={t.id} className={theme === t.id ? "is-on" : ""} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
                    <Icon name={t.icon} size={20} />
                    <b>{t.label}</b>
                    <small>{t.hint}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="xmas-sup-card">
              <h3>
                <span className="xmas-sup-num">2</span> ข้อความ
              </h3>
              <label className="xmas-sup-field">
                <span>ชื่อผู้ส่ง</span>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
              </label>
              <label className="xmas-sup-field">
                <span>
                  ข้อความที่จะขึ้นจอ <em>{message.length}/80</em>
                </span>
                <textarea value={message} maxLength={80} rows={3} onChange={(e) => setMessage(e.target.value)} placeholder="ขอให้ทุกคนมีความสุขในวันคริสต์มาส" />
              </label>
              <div className="xmas-sup-chips">
                {THANKS_CHIPS.map((t) => (
                  <button type="button" key={t} onClick={() => setMessage(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </section>
            <div className="xmas-sup-foot">
              {error && <p className="xmas-msg err">{error}</p>}
              <button className="xmas-submit" disabled={busy}>
                {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${cfg.messagePrice}`}
              </button>
            </div>
          </form>
        )}

        {!order && cfg && !disabled && view === "decor" && decor && (
          <form className="xmas-decor-pay" onSubmit={submitDecor}>
            <div className="xmas-decor-pay-preview">
              <SnowmanPreview parts={decor.parts} className="xmas-donate-snow" />
              <span>ช่อง {decor.slot + 1}</span>
            </div>
            <div className="xmas-decor-pay-form">
              <p className="xmas-hint">
                ชำระ ฿{cfg.decorPrice} สำหรับตุ๊กตา 1 ตัว วางบนช่องที่เลือกได้ แม้เป็นช่องสงวน
              </p>
              <label className="xmas-sup-field">
                <span>ชื่อที่จะแสดงบนตุ๊กตา</span>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
              </label>
              {error && <p className="xmas-msg err">{error}</p>}
              <button className="xmas-submit" disabled={busy}>
                {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${cfg.decorPrice}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
