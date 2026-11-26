"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MessageTheme, OrderPreview } from "@/lib/christmas/types";
import { GIANT_SPOT_DEFS } from "@/lib/christmas/slots";
import type { Social } from "@/lib/christmas/social";
import {
  DEFAULT_GIANT_LOOK,
  GIANT_ACC,
  GIANT_ARMS,
  GIANT_BODY,
  GIANT_HATS,
  GIANT_LEGS,
  GIANT_NOSES,
  GIANT_SCARVES,
  SIGN_BOARDS,
  type GiantLook,
} from "@/lib/christmas/giant";
import type { SnowParts } from "./SnowmanPreview";
import { SnowmanPreview } from "./SnowmanPreview";
import { Icon } from "./Icon";
import { PaymentPanel, useDonateConfig } from "./PaymentPanel";
import { drawGiantBoard, paintSkyScene, type BoardStyle, type SkyTheme } from "./skyArt";

// ตุ๊กตาหิมะ Exclusive ที่ผู้ใช้ตกแต่งและเลือกช่องไว้แล้ว รอชำระเงินเพื่อวาง
export type DecorDraft = { slot: number; parts: SnowParts; name: string; social?: Social };

const TIER_NAMES = ["ดาวดวงเล็ก", "ระฆังเงิน", "ดาวประจำห้อง"];
const THEMES: { id: MessageTheme; label: string; hint: string; icon: "firework" | "snow" | "sparkle" | "sleigh" }[] = [
  { id: "fireworks", label: "พลุฉลอง", hint: "พลุทองระเบิดเป็นชุดเหนือต้น", icon: "firework" },
  { id: "snow", label: "หิมะโปรยปราย", hint: "หิมะหนาแน่นพร้อมแสงน้ำแข็ง", icon: "snow" },
  { id: "sparkle", label: "ประกายระยิบ", hint: "ประกายทองวิ่งไปตามกรอบ", icon: "sparkle" },
  { id: "sleigh", label: "เลื่อนกวางเรนเดียร์", hint: "เลื่อนซานตามีกวางนำหน้า", icon: "sleigh" },
];
const THANKS_CHIPS = ["ขอบคุณที่ทำให้คริสต์มาสนี้อบอุ่น", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "สุขสันต์วันคริสต์มาสนะ"];

// ชื่อภาษาไทยของชิ้นส่วนแต่ละแบบ
const LABEL: Record<string, string> = {
  top: "หมวกทรงสูง",
  beanie: "หมวกไหมพรม",
  santa: "ซานตา",
  crown: "มงกุฎ",
  pom: "ปอมปอม",
  holly: "พวงฮอลลี่",
  tiara: "ทิอารา",
  antlers: "เขากวาง",
  elf: "หมวกเอลฟ์",
  red: "แดง",
  green: "เขียว",
  gold: "ทอง",
  blue: "น้ำเงิน",
  white: "ขาว",
  plaid: "ลายสก็อต",
  carrot: "แครอท",
  button: "กระดุม",
  star: "ดาว",
  bell: "ระฆัง",
  sticks: "กิ่งไม้",
  wings: "ปีกเล็ก",
  gift: "ของขวัญ",
  none: "ไม่มี",
  snow: "ฐานหิมะ",
  boots: "บู๊ต",
  mint: "มิ้นต์",
  sky: "ฟ้า",
  blush: "ชมพู",
  pearl: "มุก",
  ice: "น้ำแข็ง",
  glasses: "แว่น",
  bow: "โบว์",
  wreath: "พวงมาลัย",
  spruce: "สปรูซ",
  ivory: "งาช้าง",
  berry: "เบอร์รี่",
  pine: "สน",
};

type View = "menu" | "giant" | "message" | "decor";

// แถบถอยกลับ/ถัดไปของขั้นตอน (แสดงเฉพาะบนมือถือ)
function WizardNav({ step, last, setStep }: { step: number; last: number; setStep: (n: number | ((n: number) => number)) => void }) {
  return (
    <nav className="xmas-wiz-nav" aria-label="ขั้นตอน">
      <button type="button" className="xmas-wiz-back" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0}>
        ย้อนกลับ
      </button>
      <span className="xmas-wiz-count">ขั้นที่ {step + 1} จาก {last + 1}</span>
      {step < last ? (
        <button type="button" className="xmas-wiz-next" onClick={() => setStep((n) => Math.min(last, n + 1))}>
          ถัดไป
        </button>
      ) : (
        <span className="xmas-wiz-spacer" />
      )}
    </nav>
  );
}
type GiantKey = keyof GiantLook;

// ปุ่มเลือกชิ้นส่วนแบบแถวเดียว ใช้ทั้งตุ๊กตายักษ์และข้อความ
function PickRow({ title, options, value, onChange }: { title: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="xmas-pick-row">
      <span className="xmas-pick-title">{title}</span>
      <div className="xmas-pick-chips" role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? "is-on" : ""} onClick={() => onChange(o)}>
            {LABEL[o] ?? o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ป้ายตุ๊กตายักษ์ วาดด้วยงานศิลป์ร่วมให้ตรงกับที่แสดงบนฉากจริง
function BoardCanvas({ name, message, style }: { name: string; message: string; style: BoardStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    drawGiantBoard(g, 14, 14, cv.width - 28, cv.height - 28, { name, message, style });
  }, [name, message, style]);
  return <canvas ref={ref} width={1024} height={640} className="xmas-board-canvas" aria-label="ตัวอย่างป้ายตุ๊กตายักษ์" />;
}

// ท้องฟ้าตัวอย่าง วาดต่อเนื่องด้วยเวลาจริง (ถ้าผู้ใช้ตั้งค่าลดการเคลื่อนไหวจะหยุดนิ่ง)
function SkyCanvas({ theme, text, by }: { theme: SkyTheme; text: string; by: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ theme, text, by });
  latest.current = { theme, text, by };
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      const t = reduced ? 4 : (performance.now() - start) / 1000;
      paintSkyScene(g, cv.width, cv.height, t, latest.current);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={960} height={540} className="xmas-sky-canvas" aria-label="ตัวอย่างการแสดงบนท้องฟ้า" />;
}

export default function ExclusiveModal({
  roomId,
  roomName,
  takenSpots = [],
  onClose,
  onPaid,
  defaultName = "",
  social,
  decor,
}: {
  roomId: string;
  roomName: string;
  takenSpots?: number[]; // ตำแหน่งตุ๊กตายักษ์ที่มีคนซื้อไปแล้ว
  onClose: () => void;
  onPaid: (kind: "giant" | "message" | "decor", name: string) => void;
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
  const [look, setLook] = useState<GiantLook>(DEFAULT_GIANT_LOOK);
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

  function goView(v: View) {
    setStep(0);
    setView(v);
  }

  function setPart(key: GiantKey, value: string) {
    setLook((l) => ({ ...l, [key]: value }));
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
    create("giant", { amount: giantChosen, name: name.trim(), message: message.trim(), spot, look });
  }

  function submitMessage(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณาใส่ชื่อผู้ส่ง");
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
    giant: "ตั้งตุ๊กตาหิมะยักษ์",
    message: "ข้อความอวยพรขึ้นจอ",
    decor: "วางตุ๊กตาหิมะ Exclusive",
  }[view];

  const themeOptions = (
    <div className="xmas-theme-list" role="radiogroup" aria-label="ธีมการแสดง">
      {THEMES.map((t) => (
        <button type="button" key={t.id} role="radio" aria-checked={theme === t.id} className={`xmas-theme-opt ${theme === t.id ? "is-on" : ""}`} onClick={() => setTheme(t.id)}>
          <span className="xmas-theme-ico">
            <Icon name={t.icon} size={22} />
          </span>
          <span>
            <b>{t.label}</b>
            <small>{t.hint}</small>
          </span>
        </button>
      ))}
    </div>
  );

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

        {order && <PaymentPanel order={order} onUpdate={setOrder} onClose={() => onPaid(orderKind, name.trim())} />}

        {/* เมนู: สองฟีเจอร์แยกการ์ด */}
        {!order && cfg && !disabled && view === "menu" && (
          <div className="xmas-ex-menu">
            <p className="xmas-sup-lead">เลือกฟีเจอร์ที่ต้องการ แต่ละแบบชำระแยกกัน</p>
            <button type="button" className="xmas-ex-card" onClick={() => setView("giant")}>
              <span className="xmas-ex-icon" aria-hidden>
                <Icon name="crown" size={26} />
              </span>
              <span className="xmas-ex-body">
                <b>ตุ๊กตาหิมะยักษ์</b>
                <small>ตกแต่งได้อิสระกว่าตุ๊กตาฟรี ถือป้ายข้อความของคุณไว้บนลาน</small>
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

        {/* ตุ๊กตาหิมะยักษ์: ซ้ายเลือกและพิมพ์ ขวาดูตุ๊กตาและป้ายแบบเรียลไทม์ */}
        {!order && cfg && !disabled && view === "giant" && (
          <form className="xmas-ex-split" onSubmit={submitGiant}>
            <button type="button" className="xmas-ex-back" onClick={() => goView("menu")}>
              ← กลับไปเลือกฟีเจอร์
            </button>
            <div className="xmas-ex-col">
              <section className="xmas-sec" data-step="0" data-on={step === 0}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">1</span>
                  <h3>ตำแหน่งบนลาน</h3>
                </header>
                <div className="xmas-spot-grid is-wide">
                  {GIANT_SPOT_DEFS.map((d, i) => {
                    const used = takenSpots.includes(i);
                    return (
                      <button
                        type="button"
                        key={d.label}
                        className={spot === i ? "is-on" : used ? "is-used" : ""}
                        aria-pressed={spot === i}
                        disabled={used}
                        onClick={() => setSpot(i)}
                        title={used ? "ตำแหน่งนี้มีตุ๊กตายักษ์แล้ว" : d.label}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="xmas-sec" data-step="0" data-on={step === 0}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">2</span>
                  <h3>ยอดที่ชำระ</h3>
                </header>
                <div className="xmas-tier-grid">
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
                      <b>฿{p}</b>
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

              <section className="xmas-sec" data-step="1" data-on={step === 1}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">3</span>
                  <h3>ตกแต่ง · หัวและตัว</h3>
                </header>
                <PickRow title="หมวก" options={GIANT_HATS} value={look.hat} onChange={(v) => setPart("hat", v)} />
                <PickRow title="ผ้าพันคอ" options={GIANT_SCARVES} value={look.scarf} onChange={(v) => setPart("scarf", v)} />
                <PickRow title="สีตัว" options={GIANT_BODY} value={look.body} onChange={(v) => setPart("body", v)} />
                <PickRow title="จมูก" options={GIANT_NOSES} value={look.nose} onChange={(v) => setPart("nose", v)} />
              </section>

              <section className="xmas-sec" data-step="2" data-on={step === 2}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">4</span>
                  <h3>ตกแต่ง · แขน ฐาน และป้าย</h3>
                </header>
                <PickRow title="แขน" options={GIANT_ARMS} value={look.arms} onChange={(v) => setPart("arms", v)} />
                <PickRow title="ฐาน" options={GIANT_LEGS} value={look.legs} onChange={(v) => setPart("legs", v)} />
                <PickRow title="ของประดับ" options={GIANT_ACC} value={look.acc} onChange={(v) => setPart("acc", v)} />
                <PickRow title="สีป้าย" options={SIGN_BOARDS} value={look.board} onChange={(v) => setPart("board", v)} />
              </section>

              <section className="xmas-sec" data-step="3" data-on={step === 3}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">5</span>
                  <h3>ชื่อและข้อความบนป้าย</h3>
                </header>
                <label className="xmas-sup-field">
                  <span>ชื่อที่จะแสดง</span>
                  <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
                </label>
                <label className="xmas-sup-field">
                  <span>
                    ข้อความบนป้าย <em>{message.length}/80</em>
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
            </div>

            <aside className="xmas-ex-col xmas-ex-side">
              <div className="xmas-sign-stage">
                <SnowmanPreview parts={look} className="xmas-sign-snow" />
                <BoardCanvas name={name.trim() || "ชื่อของคุณ"} message={message.trim() || "ข้อความของคุณจะขึ้นตรงนี้"} style={look.board as BoardStyle} />
              </div>
              <p className="xmas-hint">ตัวอย่างนี้อัปเดตตามที่เลือกและพิมพ์ ตุ๊กตาจะถือป้ายนี้ไว้บนลานตรงตำแหน่งที่เลือก</p>
              <div className="xmas-ex-final" data-step="3" data-on={step === 3}>
                {error && <p className="xmas-msg err">{error}</p>}
                <button className="xmas-submit" disabled={busy}>
                  {busy ? "กำลังสร้างรายการ…" : giantChosen ? `ชำระ ฿${giantChosen}` : "เลือกยอดก่อน"}
                </button>
              </div>
            </aside>
            <WizardNav step={step} last={3} setStep={setStep} />
          </form>
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
                  <h3>ธีมการแสดง</h3>
                </header>
                {themeOptions}
              </section>
              <section className="xmas-sec" data-step="1" data-on={step === 1}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">2</span>
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
              <SkyCanvas theme={theme} text={message.trim() || "ข้อความของคุณจะขึ้นบนท้องฟ้า"} by={name.trim() || "ชื่อผู้ส่ง"} />
              <p className="xmas-hint">ตัวอย่างนี้คือการแสดงจริงที่ทุกคนในห้องจะเห็นพร้อมกัน</p>
              <div className="xmas-ex-final" data-step="1" data-on={step === 1}>
                {error && <p className="xmas-msg err">{error}</p>}
                <button className="xmas-submit" disabled={busy}>
                  {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${cfg.messagePrice}`}
                </button>
              </div>
            </aside>
            <WizardNav step={step} last={1} setStep={setStep} />
          </form>
        )}

        {/* ตุ๊กตาที่วางจากฟอร์มตกแต่ง */}
        {!order && cfg && !disabled && view === "decor" && decor && (
          <form className="xmas-decor-pay" onSubmit={submitDecor}>
            <div className="xmas-decor-pay-preview">
              <SnowmanPreview parts={decor.parts} className="xmas-donate-snow" />
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
