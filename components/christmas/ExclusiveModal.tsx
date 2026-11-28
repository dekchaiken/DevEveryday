"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { OrderPreview } from "@/lib/christmas/types";
import type { Social } from "@/lib/christmas/social";
import { DEFAULT_GIANT_LOOK, giantTier, type GiantLook } from "@/lib/christmas/giant";
import type { SnowParts } from "@/lib/christmas/snowman";
import { SnowmanImage } from "./Snowman3D";
import { GiantEditor } from "./GiantEditor";
import { rememberPending } from "./pendingOrders";
import { Icon } from "./Icon";
import { PaymentPanel, useDonateConfig } from "./PaymentPanel";
import { DEFAULT_SKY_STYLE, type SkyStyle } from "@/lib/christmas/skyStyle";
import { SkyPreview, SkyStyleEditor } from "./SkyStudio";

// ตุ๊กตาหิมะ Exclusive ที่ผู้ใช้ตกแต่งและเลือกช่องไว้แล้ว รอชำระเงินเพื่อวาง
export type DecorDraft = { slot: number; parts: SnowParts; name: string; social?: Social };

const THANKS_CHIPS = ["ขอบคุณที่ทำให้คริสต์มาสนี้อบอุ่น", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "สุขสันต์วันคริสต์มาสนะ"];


type View = "menu" | "giant" | "message" | "decor";

// แถบถอยกลับ/ถัดไปของขั้นตอน (แสดงเฉพาะบนมือถือ)
function WizardNav({ step, last, setStep, canNext = true }: { step: number; last: number; setStep: (n: number | ((n: number) => number)) => void; canNext?: boolean }) {
  return (
    <nav className="xmas-wiz-nav" aria-label="ขั้นตอน">
      <button type="button" className="xmas-wiz-back" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0}>
        ย้อนกลับ
      </button>
      <span className="xmas-wiz-count">ขั้นที่ {step + 1} จาก {last + 1}</span>
      {step < last ? (
        <button type="button" className="xmas-wiz-next" onClick={() => setStep((n) => Math.min(last, n + 1))} disabled={!canNext} title={canNext ? undefined : "เลือกหรือกรอกยอดก่อน"}>
          ถัดไป
        </button>
      ) : (
        <span className="xmas-wiz-spacer" />
      )}
    </nav>
  );
}
export default function ExclusiveModal({
  roomId,
  roomName,
  onClose,
  onPaid,
  defaultName = "",
  social,
  decor,
  hidden = false,
  onPickOnScene,
  pickedSpot,
}: {
  roomId: string;
  roomName: string;
  onClose: () => void;
  onPaid: (kind: "giant" | "message" | "decor", name: string) => void;
  defaultName?: string;
  social?: Social;
  decor?: DecorDraft;
  hidden?: boolean; // ซ่อนชั่วคราวระหว่างเลือกจุดบนฉาก (ยังจำค่าที่กรอกไว้)
  onPickOnScene?: (taken: number[], held: number[], current: number | null) => void; // เลือกจุดตั้งบ้านบนฉากจริง
  pickedSpot?: { spot: number; at: number } | null; // จุดที่เลือกจากฉาก
}) {
  const { cfg, error: cfgError } = useDonateConfig();
  const [view, setView] = useState<View>(decor ? "decor" : "menu");
  const [name, setName] = useState(decor?.name ?? defaultName);
  const [message, setMessage] = useState("");
  const [skyStyle, setSkyStyle] = useState<SkyStyle>(DEFAULT_SKY_STYLE);
  const [look, setLook] = useState<GiantLook>(DEFAULT_GIANT_LOOK);
  const [selId, setSelId] = useState<string | null>(null);
  const [spotPick, setSpotPick] = useState<number | null>(null);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [spotPopup, setSpotPopup] = useState(false);
  useEffect(() => {
    if (pickedSpot) setSpotPick(pickedSpot.spot);
  }, [pickedSpot]);
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const [orderKind, setOrderKind] = useState<"giant" | "message" | "decor">("giant");
  // บนมือถือแสดงทีละขั้น (บนคอมแสดงทุกขั้นพร้อมกัน)
  const [step, setStep] = useState(0);

  const locked = order !== null && order.status !== "paid";
  const disabled = cfg !== null && !cfg.enabled;
  const giantChosen = amount ?? (custom ? Number(custom) : null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  // โหลดจุดที่มีคนจองแล้ว: ตอนเปิดฟอร์มตุ๊กตายักษ์ และตอนที่ผู้ซื้อต้องเลือกจุดใหม่
  const loadTaken = useCallback(() => {
    fetch(`/api/christmas/state?room=${encodeURIComponent(roomId)}`)
      .then((r) => r.json())
      .then((d: { giants?: { spot: number }[]; holds?: number[] }) => {
        setTaken(new Set((d.giants ?? []).map((g) => g.spot)));
        setHeld(new Set(d.holds ?? []));
      })
      .catch(() => {});
  }, [roomId]);
  useEffect(() => {
    if (view === "giant") loadTaken();
  }, [view, loadTaken]);

  function closeSpotPopup() {
    setSpotPopup(false);
    setSpotPick(null);
    loadTaken();
  }

  function goView(v: View) {
    setStep(0);
    setView(v);
  }

  async function create(kind: "giant" | "message" | "decor", body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/christmas/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, kind, social: social ?? {}, ...body }),
      });
      const data = (await res.json()) as { order?: OrderPreview; error?: string; code?: string };
      // จุดที่เลือกถูกคนอื่นไปก่อน: เด้งให้เลือกใหม่ (ยังไม่ได้ตัดเงิน)
      if (res.status === 409 && data.code === "spot_taken") {
        setSpotPopup(true);
        loadTaken();
        return;
      }
      if (!res.ok || !data.order) throw new Error(data.error ?? "สร้างรายการไม่สำเร็จ");
      setOrderKind(kind);
      setOrder(data.order);
      // จำไว้ในเครื่อง เผื่อลูกค้ารีเฟรชหน้าระหว่างรอชำระ
      rememberPending({ id: data.order.id, room: roomId, kind, amount: data.order.payAmount ? Number(data.order.payAmount) : data.order.amount, name: name.trim(), at: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  function submitGiant(e: FormEvent) {
    e.preventDefault();
    if (!giantChosen) return setError("เลือกหรือกรอกยอดก่อน");
    if (!cfg || !(cfg.presetPrices.includes(giantChosen) || (giantChosen >= cfg.customMin && giantChosen <= cfg.customMax))) return setError(`ยอดต้องอยู่ระหว่าง ฿${cfg?.customMin}–฿${cfg?.customMax}`);
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดงบนป้าย");
    create("giant", { amount: giantChosen, name: name.trim(), message: message.trim(), look: { ...look, tier: giantTier(giantChosen).id }, spot: spotPick });
  }

  function submitMessage(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณาใส่ชื่อผู้ส่ง");
    if (!message.trim()) return setError("กรุณาใส่ข้อความที่จะขึ้นจอ");
    create("message", { name: name.trim(), message: message.trim(), theme: skyStyle.theme, style: skyStyle });
  }

  function submitDecor(e: FormEvent) {
    e.preventDefault();
    if (!decor) return;
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดงบนตุ๊กตา");
    create("decor", { decor: { ...decor.parts, slot: decor.slot }, name: name.trim() });
  }

  const title = {
    menu: "Exclusive",
    giant: "ตั้งบ้านหิมะ Exclusive",
    message: "ข้อความอวยพรขึ้นจอ",
    decor: "วางตุ๊กตาหิมะ Exclusive",
  }[view];


  return (
    <div className="xmas-modal-back" role="presentation" onClick={locked ? undefined : onClose} hidden={hidden}>
      <div className={`xmas-modal xmas-exclusive ${view === "giant" && !order ? "is-giant" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {!locked && (
          <button className="xmas-x" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
        )}

        <p className="xmas-kicker">Exclusive · {roomName}</p>
        <h2>{title}</h2>
        {cfgError && <p className="xmas-msg err">{cfgError}</p>}
        {disabled && <p className="xmas-msg err">ตอนนี้ปิดรับการสนับสนุนชั่วคราว</p>}

        {order && <PaymentPanel order={order} onUpdate={setOrder} onClose={() => onPaid(orderKind, name.trim())} />}

        {spotPopup && (
          <div className="xmas-spot-popup" role="alertdialog" aria-modal="true" aria-labelledby="xmas-spot-popup-title">
            <div className="xmas-spot-popup-card">
              <p id="xmas-spot-popup-title" className="xmas-spot-popup-title">น่าเสียดายจัง</p>
              <p>ช่องนี้มีคนเอาไปแล้ว เลือกช่องใหม่นะ</p>
              <button type="button" className="xmas-submit" onClick={closeSpotPopup}>
                เลือกช่องใหม่
              </button>
            </div>
          </div>
        )}

        {/* เมนู: สองฟีเจอร์แยกการ์ด */}
        {!order && cfg && !disabled && view === "menu" && (
          <div className="xmas-ex-menu">
            <p className="xmas-sup-lead">เลือกฟีเจอร์ที่ต้องการ แต่ละแบบชำระแยกกัน</p>
            <button type="button" className="xmas-ex-card" onClick={() => setView("giant")}>
              <span className="xmas-ex-icon" aria-hidden>
                <Icon name="crown" size={26} />
              </span>
              <span className="xmas-ex-body">
                <b>บ้านหิมะ Exclusive</b>
                <small>4 แพ็กเกจ ตั้งแต่กระท่อมน้อยจนถึงปราสาทหิมะ ยิ่งสนับสนุนมาก บ้านยิ่งอลังการ ของแต่งยิ่งเยอะ</small>
                <em>เริ่มที่ ฿{cfg.presetPrices[0]}</em>
              </span>
              <span className="xmas-ex-arrow" aria-hidden>
                ›
              </span>
            </button>
            <button type="button" className="xmas-ex-card" onClick={() => setView("message")}>
              <span className="xmas-ex-icon" aria-hidden>
                <Icon name="sparkle" size={26} />
              </span>
              <span className="xmas-ex-body">
                <b>ข้อความอวยพรขึ้นจอ</b>
                <small>ข้อความของคุณขึ้นบนท้องฟ้าให้ทุกคนในห้องเห็นพร้อมกัน เลือกธีมการแสดงได้</small>
                <em>฿{cfg.messagePrice}</em>
              </span>
              <span className="xmas-ex-arrow" aria-hidden>
                ›
              </span>
            </button>
          </div>
        )}

        {/* บ้านหิมะ Exclusive: หน้าเดียว ตัวอย่างอยู่บนสุด ด้านล่างทีละขั้น */}
        {!order && cfg && !disabled && view === "giant" && (
          <GiantEditor
            presetPrices={cfg.presetPrices}
            customMin={cfg.customMin}
            customMax={cfg.customMax}
            amount={amount}
            custom={custom}
            setAmount={setAmount}
            setCustom={setCustom}
            look={look}
            setLook={setLook}
            selId={selId}
            setSelId={setSelId}
            spotPick={spotPick}
            setSpotPick={setSpotPick}
            taken={taken}
            held={held}
            onPickOnScene={onPickOnScene ? () => onPickOnScene([...taken], [...held], spotPick) : undefined}
            name={name}
            setName={setName}
            message={message}
            setMessage={setMessage}
            error={error}
            busy={busy}
            onSubmit={submitGiant}
            onBack={() => goView("menu")}
          />
        )}

        {/* ข้อความขึ้นจอ: ซ้ายเลือกธีมและพิมพ์ ขวาดูการแสดงจริงแบบเรียลไทม์ */}
        {!order && cfg && !disabled && view === "message" && (
          <form className="xmas-ex-split" onSubmit={submitMessage}>
            <button type="button" className="xmas-ex-back" onClick={() => goView("menu")}>
              ← กลับไปเลือกฟีเจอร์
            </button>
            <div className="xmas-ex-col">
              <section className="xmas-sec" data-step="0" data-on={step === 0}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">1</span>
                  <h3>ธีมและการเปิดตัว</h3>
                </header>
                <SkyStyleEditor style={skyStyle} onChange={setSkyStyle} part="effect" />
              </section>
              <section className="xmas-sec" data-step="1" data-on={step === 1}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">2</span>
                  <h3>ตัวอักษร สี และกรอบ</h3>
                </header>
                <SkyStyleEditor style={skyStyle} onChange={setSkyStyle} part="look" />
              </section>
              <section className="xmas-sec" data-step="2" data-on={step === 2}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">3</span>
                  <h3>ผู้ส่งและข้อความ</h3>
                </header>
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
            </div>

            <aside className="xmas-ex-col xmas-ex-side">
              <SkyPreview style={skyStyle} text={message.trim() || "ข้อความของคุณจะขึ้นจอให้ทุกคนเห็น"} by={name.trim() || "ชื่อผู้ส่ง"} />
              <p className="xmas-hint">ตัวอย่างนี้คือการแสดงจริงเต็มจอที่ทุกคนในห้องจะเห็นพร้อมกัน นาน 10 วินาที</p>
              <div className="xmas-ex-final" data-step="2" data-on={step === 2}>
                {error && <p className="xmas-msg err">{error}</p>}
                <button className="xmas-submit" disabled={busy}>
                  {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${cfg.messagePrice}`}
                </button>
              </div>
            </aside>
            <WizardNav step={step} last={2} setStep={setStep} />
          </form>
        )}

        {/* ตุ๊กตาที่วางจากฟอร์มตกแต่ง */}
        {!order && cfg && !disabled && view === "decor" && decor && (
          <form className="xmas-decor-pay" onSubmit={submitDecor}>
            <div className="xmas-decor-pay-preview">
              <SnowmanImage parts={decor.parts} view="full" size={256} className="xmas-donate-snow" alt="ตุ๊กตาหิมะของคุณ" />
              <span>ช่อง {decor.slot + 1}</span>
            </div>
            <div className="xmas-decor-pay-form">
              <p className="xmas-hint">ชำระ ฿{cfg.decorPrice} สำหรับตุ๊กตา 1 ตัว วางบนช่องที่เลือกได้ แม้เป็นช่องสงวน</p>
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
