"use client";

import { rememberPending } from "./pendingOrders";
import { useEffect, useState, type FormEvent } from "react";
import type { OrderPreview } from "@/lib/christmas/types";
import type { Social } from "@/lib/christmas/social";
import { Icon } from "./Icon";
import { PaymentPanel, useDonateConfig } from "./PaymentPanel";

// หน้าต่างสนับสนุนทีมงานอย่างเดียว: ซ้ายเลือกจำนวนเงิน ขวากรอกชื่อและข้อความ
const NOTE_CHIPS = ["ขอบคุณทีมงานทุกคน", "สู้ ๆ นะ ทีม DevEveryday", "ขอให้ปีใหม่มีแต่รอยยิ้ม"];
const DEFAULT_NOTE = "ค่ากาแฟให้ทีมงานทุกคน";

export default function SupportModal({
  roomId,
  onClose,
  onPaid,
  defaultName = "",
  social,
}: {
  roomId: string;
  onClose: () => void;
  onPaid: (name: string) => void;
  defaultName?: string;
  social?: Social;
}) {
  const { cfg, error: cfgError } = useDonateConfig();
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  // บนมือถือแสดงทีละขั้น: 0 เลือกจำนวน · 1 ชื่อและข้อความ
  const [step, setStep] = useState(0);

  const chosen = amount ?? (custom ? Number(custom) : null);
  const locked = order !== null && order.status !== "paid";
  const disabled = cfg !== null && !cfg.enabled;

  // ปิดด้วย Esc ได้เฉพาะตอนที่ไม่ได้รอชำระ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return setError("เลือกหรือกรอกจำนวนเงินก่อน");
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดง");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/christmas/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, kind: "support", amount: chosen, name: name.trim(), message: note.trim(), social: social ?? {} }),
      });
      const data = (await res.json()) as { order?: OrderPreview; error?: string };
      if (!res.ok || !data.order) throw new Error(data.error ?? "สร้างรายการไม่สำเร็จ");
      rememberPending({ id: data.order.id, room: roomId, kind: "support", amount: data.order.payAmount ? Number(data.order.payAmount) : data.order.amount, name: name.trim(), at: Date.now() });
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="xmas-modal-back" role="presentation" onClick={locked ? undefined : onClose}>
      <div className="xmas-modal xmas-support" role="dialog" aria-modal="true" aria-label="สนับสนุนทีมงาน" onClick={(e) => e.stopPropagation()}>
        {!locked && (
          <button className="xmas-x" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
        )}

        <header className="xmas-sup-head">
          <span className="xmas-sup-badge" aria-hidden>
            <Icon name="gift" size={22} />
          </span>
          <div>
            <p className="xmas-kicker">สนับสนุนทีม DevEveryday</p>
            <h2>เลี้ยงกาแฟทีมงาน</h2>
          </div>
        </header>
        <p className="xmas-sup-lead">ยอดสนับสนุนช่วยให้เราพัฒนาและดูแลกิจกรรมนี้ต่อ ชื่อของคุณจะแสดงในรายการผู้สนับสนุน</p>

        {cfgError && <p className="xmas-msg err">{cfgError}</p>}
        {disabled && <p className="xmas-msg err">ตอนนี้ปิดรับการสนับสนุนชั่วคราว</p>}

        {order && <PaymentPanel order={order} onUpdate={setOrder} onClose={() => onPaid(name.trim())} />}

        {!order && cfg && !disabled && (
          <form className="xmas-sup-grid" onSubmit={submit}>
            <section className="xmas-sup-card" data-step="0" data-on={step === 0}>
              <h3>
                <span className="xmas-sup-num">1</span> เลือกจำนวน
              </h3>
              <div className="xmas-sup-prices">
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

            <section className="xmas-sup-card" data-step="1" data-on={step === 1}>
              <h3>
                <span className="xmas-sup-num">2</span> ฝากชื่อและข้อความ
              </h3>
              <label className="xmas-sup-field">
                <span>ชื่อที่จะแสดง</span>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
              </label>
              <label className="xmas-sup-field">
                <span>
                  ข้อความ <em>{note.length}/80</em>
                </span>
                <textarea value={note} maxLength={80} rows={3} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="xmas-sup-chips">
                {NOTE_CHIPS.map((t) => (
                  <button type="button" key={t} onClick={() => setNote(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <div className="xmas-sup-foot">
              {error && <p className="xmas-msg err">{error}</p>}
              <nav className="xmas-wiz-nav" aria-label="ขั้นตอน">
                <button type="button" className="xmas-wiz-back" onClick={() => setStep(0)} disabled={step === 0}>
                  ย้อนกลับ
                </button>
                <span className="xmas-wiz-count">ขั้นที่ {step + 1} จาก 2</span>
                {step === 0 ? (
                  <button type="button" className="xmas-wiz-next" onClick={() => setStep(1)} disabled={!chosen}>
                    ถัดไป
                  </button>
                ) : (
                  <span className="xmas-wiz-spacer" />
                )}
              </nav>
              <button className="xmas-submit xmas-wiz-final" data-step="1" data-on={step === 1} disabled={busy || !chosen}>
                {busy ? "กำลังสร้างรายการ…" : chosen ? `ชำระ ฿${chosen}` : "เลือกจำนวนก่อน"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
