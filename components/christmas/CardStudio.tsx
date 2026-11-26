"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CARD_THEMES,
  CARDS_PER_PERSON,
  DEFAULT_CARD,
  EFFECT_LABEL,
  ENVELOPES,
  ENVELOPE_LABEL,
  FONT_KEYS,
  FONT_LABEL,
  MAX_ENV_PROPS,
  MAX_PROPS,
  MAX_TEXTS,
  NAME_MAX,
  PROP_LABEL,
  TEXT_COLORS,
  TEXT_EFFECTS,
  TEXT_MAX,
  THEME_LABEL,
  textsOf,
  type CardProp,
  type CardRecord,
  type CardSpec,
  type CardTheme,
  type Envelope,
  type StickerKind,
  type TextEffect,
  type TextItem,
} from "@/lib/christmas/cardSpec";
import type { Social } from "@/lib/christmas/social";
import { getClientId } from "./clientId";
import { CardView } from "./CardView";
import { EnvelopeArt, PropArt } from "./CardProps";
import { Icon } from "./Icon";
import "./wishcards.css";

const STEPS = ["แบบ", "ตกแต่ง", "ข้อความ", "ซอง", "ส่ง"];

// หมวดสติ๊กเกอร์ 52 ชิ้น หมวดละไม่เกิน 14 ชิ้น เพื่อให้พอดีหน้าจอโดยไม่ต้องเลื่อน
const PALETTE: { label: string; kinds: StickerKind[] }[] = [
  { label: "คริสต์มาส", kinds: ["bell", "star", "tree", "bauble", "snowflake", "santa_hat", "reindeer", "sleigh", "stocking", "mitten", "wreath", "holly", "mistletoe", "candle"] },
  { label: "น่ารัก", kinds: ["snowman", "penguin", "bear", "owl", "bunny", "cat", "bird", "butterfly", "mushroom", "flower", "heart", "sparkle", "moon", "snowglobe"] },
  { label: "ขนมและของ", kinds: ["candy", "lollipop", "cookie", "gingerbread", "cupcake", "candy_round", "chocolate", "mug", "house", "gift", "present_blue", "ribbon", "bow", "tag"] },
  { label: "แต่งเพิ่ม", kinds: ["stamp", "seal", "crown", "lantern", "firework", "icicle", "snowball", "pinecone", "cloud", "rainbow"] },
];

const BG_PRESETS = ["#d8b48a", "#0c3026", "#ffffff", "#d6f0fb", "#9f1239", "#0f172a", "#fde68a", "#fbcfe8"];
const WISH_CHIPS = ["ขอให้มีความสุขในวันคริสต์มาส", "Merry Christmas & Happy New Year", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "สุขสันต์วันคริสต์มาสนะ"];

type Drag = { kind: "prop" | "env" | "text"; index?: number; id?: string };

// ฉากโต๊ะ: เลือกแบบ ตกแต่งการ์ด เขียนข้อความ ตกแต่งซอง แล้วส่งไปโซนคำอวยพร
export function CardStudio({
  roomId,
  roomName,
  defaultName = "",
  social,
  onClose,
  onSent,
  mandatory = false,
  enter = false,
}: {
  roomId: string;
  roomName: string;
  defaultName?: string;
  social?: Social;
  onClose: () => void;
  onSent: (card: CardRecord) => void;
  mandatory?: boolean; // ครั้งแรกหลังตั้งชื่อ: ต้องออกแบบและส่งการ์ดก่อน จึงไม่มีปุ่มปิด
  enter?: boolean; // เล่นแอนิเมชันเข้าโต๊ะ
}) {
  const [spec, setSpec] = useState<CardSpec>({ ...DEFAULT_CARD, name: defaultName, texts: [] });
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<number | null>(null); // ของตกแต่งที่เลือกอยู่ (ตามขั้นตอน)
  const [selText, setSelText] = useState<string | null>(null);
  const [cat, setCat] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState<number | null>(null); // โควตาที่เหลือของผู้ใช้ในห้องนี้
  const cardRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const sendEnvRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState<"paper" | "env">("paper");

  // โหลดโควตาที่เหลือของผู้ใช้ในห้องนี้
  useEffect(() => {
    fetch(`/api/christmas/card?room=${roomId}&clientId=${encodeURIComponent(getClientId())}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { left?: number }) => setLeft(typeof d.left === "number" ? d.left : CARDS_PER_PERSON))
      .catch(() => setLeft(CARDS_PER_PERSON));
  }, [roomId]);

  const texts = textsOf(spec);
  const hasText = texts.some((t) => t.text.trim() !== "");
  const nameOk = spec.name.trim() !== "";
  const canSend = hasText && nameOk && left !== 0;

  function setProps(fn: (ps: CardProp[]) => CardProp[]) {
    setSpec((s) => ({ ...s, props: fn(s.props) }));
  }
  function setEnvProps(fn: (ps: CardProp[]) => CardProp[]) {
    setSpec((s) => ({ ...s, envProps: fn(s.envProps) }));
  }
  function setTexts(fn: (ts: TextItem[]) => TextItem[]) {
    setSpec((s) => ({ ...s, texts: fn(textsOf(s)) }));
  }
  function patchText(id: string, patch: Partial<TextItem>) {
    setTexts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  // เพิ่มสติ๊กเกอร์ลงการ์ดหรือซอง
  function addSticker(kind: StickerKind, target: "card" | "env") {
    const list = target === "card" ? spec.props : spec.envProps;
    const max = target === "card" ? MAX_PROPS : MAX_ENV_PROPS;
    if (list.length >= max) {
      setErr(target === "card" ? `ใส่ของตกแต่งบนการ์ดได้สูงสุด ${MAX_PROPS} ชิ้น` : `ใส่ของตกแต่งบนซองได้สูงสุด ${MAX_ENV_PROPS} ชิ้น`);
      return;
    }
    setErr("");
    const p: CardProp =
      target === "card"
        ? { kind, x: 0.3 + Math.random() * 0.4, y: 0.25 + Math.random() * 0.4, r: Math.round(Math.random() * 30 - 15), s: 1 }
        : { kind, x: 0.3 + Math.random() * 0.4, y: 0.35 + Math.random() * 0.3, r: Math.round(Math.random() * 20 - 10), s: 0.8 };
    if (target === "card") setProps((ps) => [...ps, p]);
    else setEnvProps((ps) => [...ps, p]);
    setSel(list.length);
  }

  function addText() {
    if (texts.length >= MAX_TEXTS) {
      setErr(`เพิ่มข้อความได้สูงสุด ${MAX_TEXTS} กล่อง`);
      return;
    }
    setErr("");
    const id = crypto.randomUUID();
    const t: TextItem = {
      id,
      text: "",
      x: 0.5,
      y: 0.3 + texts.length * 0.14,
      r: 0,
      s: 1,
      font: "plex",
      color: TEXT_COLORS[0],
      bold: false,
      italic: false,
      effect: "none",
    };
    setSpec((s) => ({ ...s, texts: [...textsOf(s), t] }));
    setSelText(id);
  }

  function removeText() {
    if (!selText) return;
    setTexts((ts) => ts.filter((t) => t.id !== selText));
    setSelText(null);
  }

  // ลากของหรือข้อความบนการ์ดหรือซองเพื่อย้ายตำแหน่ง (ปล่อยนิ้วแล้วหยุด)
  function startDrag(d: Drag, e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    if (d.kind === "text" && d.id) setSelText(d.id);
    if ((d.kind === "prop" || d.kind === "env") && d.index !== undefined) setSel(d.index);
    const move = (ev: PointerEvent) => {
      const host = d.kind === "env" ? envRef.current : cardRef.current;
      if (!host) return;
      const r = host.getBoundingClientRect();
      const x = Math.min(0.96, Math.max(0.04, (ev.clientX - r.left) / r.width));
      const y = Math.min(0.96, Math.max(0.04, (ev.clientY - r.top) / r.height));
      if (d.kind === "prop") setProps((ps) => ps.map((p, j) => (j === d.index ? { ...p, x, y } : p)));
      if (d.kind === "env") setEnvProps((ps) => ps.map((p, j) => (j === d.index ? { ...p, x, y } : p)));
      if (d.kind === "text" && d.id) patchText(d.id, { x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // พับการ์ดใส่ซอง ปิดฝา แล้วซองบินไปที่ปุ่มโซนคำอวยพร ก่อนฉากโต๊ะจางไปหน้าต้นคริสต์มาส
  async function playSend() {
    const root = rootRef.current;
    const card = cardRef.current;
    const env = sendEnvRef.current;
    if (!root || !card || !env || typeof card.animate !== "function") return;
    setSending(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const cr = card.getBoundingClientRect();
    const er = env.getBoundingClientRect();
    const dx = er.left + er.width / 2 - (cr.left + cr.width / 2);
    const dy = er.top + er.height / 2 - (cr.top + cr.height / 2);
    env.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
    await card
      .animate(
        [
          { transform: "translate(0,0) scale(1) rotateX(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.2) rotateX(75deg)`, opacity: 0 },
        ],
        { duration: 800, easing: "cubic-bezier(.5,0,.6,1)", fill: "forwards" },
      )
      .finished.catch(() => undefined);
    const flap = env.querySelector(".xc-env-flap") as HTMLElement | null;
    await flap
      ?.animate([{ transform: "rotateX(180deg)" }, { transform: "rotateX(0deg)" }], { duration: 450, easing: "ease-out", fill: "forwards" })
      .finished.catch(() => undefined);
    const zb = document.querySelector("[data-zone-btn]") as HTMLElement | null;
    const tr = zb ? zb.getBoundingClientRect() : ({ left: window.innerWidth / 2, top: window.innerHeight - 60, width: 0, height: 0 } as DOMRect);
    const ex = tr.left + tr.width / 2 - (er.left + er.width / 2);
    const ey = tr.top + tr.height / 2 - (er.top + er.height / 2);
    await env
      .animate(
        [
          { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
          { transform: `translate(${ex}px, ${ey}px) scale(0.3) rotate(-8deg)`, opacity: 0.15 },
        ],
        { duration: 900, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" },
      )
      .finished.catch(() => undefined);
    await root
      .animate([{ opacity: 1, filter: "blur(0px)" }, { opacity: 0, filter: "blur(6px)" }], { duration: 600, easing: "ease", fill: "forwards" })
      .finished.catch(() => undefined);
  }

  async function send() {
    if (!canSend) return setErr(left === 0 ? `ส่งการ์ดครบ ${CARDS_PER_PERSON} ใบในห้องนี้แล้ว` : "กรุณาใส่ชื่อและข้อความอย่างน้อย 1 กล่อง");
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/christmas/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...spec, texts: texts.filter((t) => t.text.trim() !== ""), room: roomId, social: social ?? {}, clientId: getClientId() }),
      });
      const data = (await res.json()) as { card?: CardRecord; error?: string; left?: number };
      if (!res.ok || !data.card) {
        if (res.status === 409) setLeft(0);
        throw new Error(data.error ?? "ส่งการ์ดไม่สำเร็จ");
      }
      setLeft(typeof data.left === "number" ? data.left : null);
      await playSend();
      onSent(data.card);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const selProp = step === 1 && sel !== null ? spec.props[sel] ?? null : null;
  const selEnv = step === 3 && sel !== null ? spec.envProps[sel] ?? null : null;
  const selT = selText ? texts.find((t) => t.id === selText) ?? null : null;

  // ปุ่มปรับสติ๊กเกอร์ที่เลือก (ใช้ร่วมกันทั้งการ์ดและซอง)
  function stickerTools(target: "card" | "env") {
    const patch = (fn: (p: CardProp) => CardProp) => {
      if (sel === null) return;
      if (target === "card") setProps((ps) => ps.map((p, i) => (i === sel ? fn(p) : p)));
      else setEnvProps((ps) => ps.map((p, i) => (i === sel ? fn(p) : p)));
    };
    const remove = () => {
      if (sel === null) return;
      if (target === "card") setProps((ps) => ps.filter((_, i) => i !== sel));
      else setEnvProps((ps) => ps.filter((_, i) => i !== sel));
      setSel(null);
    };
    return (
      <>
        <button type="button" className="xc-tool" onClick={() => patch((p) => ({ ...p, s: Math.max(0.5, +(p.s - 0.15).toFixed(2)) }))} aria-label="เล็กลง">
          <Icon name="minus" size={14} /> เล็ก
        </button>
        <button type="button" className="xc-tool" onClick={() => patch((p) => ({ ...p, s: Math.min(2, +(p.s + 0.15).toFixed(2)) }))} aria-label="ใหญ่ขึ้น">
          <Icon name="plus" size={14} /> ใหญ่
        </button>
        <button type="button" className="xc-tool" onClick={() => patch((p) => ({ ...p, r: Math.max(-180, p.r - 15) }))} aria-label="หมุนซ้าย">
          ↺
        </button>
        <button type="button" className="xc-tool" onClick={() => patch((p) => ({ ...p, r: Math.min(180, p.r + 15) }))} aria-label="หมุนขวา">
          ↻
        </button>
        <button type="button" className="xc-tool is-danger" onClick={remove} aria-label="ลบชิ้นนี้">
          ลบ
        </button>
      </>
    );
  }

  function palette(target: "card" | "env") {
    const group = PALETTE[cat];
    return (
      <div className="xc-palette-wrap">
        <div className="xc-cats" role="tablist" aria-label="หมวดสติ๊กเกอร์">
          {PALETTE.map((g, i) => (
            <button key={g.label} type="button" role="tab" aria-selected={cat === i} className={cat === i ? "is-on" : ""} onClick={() => setCat(i)}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="xc-palette">
          {group.kinds.map((k) => (
            <button key={k} type="button" className="xc-palette-item" onClick={() => addSticker(k, target)} aria-label={`เพิ่ม${PROP_LABEL[k]}`}>
              <span className="xc-palette-art">
                <PropArt kind={k} />
              </span>
              {PROP_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`xc-studio ${enter ? "is-enter" : ""}`} role="dialog" aria-modal="true" aria-label="ออกแบบการ์ดอวยพร">
      <div className="xc-table" aria-hidden>
        <span className="xc-light l1" />
        <span className="xc-light l2" />
        <span className="xc-light l3" />
      </div>

      <header className="xc-studio-top">
        {mandatory ? (
          <span className="xc-icon-spacer" aria-hidden />
        ) : (
          <button type="button" className="xc-icon-btn" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
        )}
        <div className="xc-studio-title">
          <p className="xc-kicker">การ์ดอวยพร · {roomName}</p>
          <h2>ออกแบบการ์ดของคุณ</h2>
        </div>
        <span className="xc-stepcount">
          {step + 1}/{STEPS.length}
          {left !== null && <small> · เหลือ {left} ใบ</small>}
        </span>
      </header>

      <div className="xc-stage">
        {step === 0 && (
          <div className="xc-seg" role="tablist" aria-label="ดูตัวอย่าง">
            <button type="button" role="tab" aria-selected={previewMode === "paper"} className={previewMode === "paper" ? "is-on" : ""} onClick={() => setPreviewMode("paper")}>
              กระดาษ
            </button>
            <button type="button" role="tab" aria-selected={previewMode === "env"} className={previewMode === "env" ? "is-on" : ""} onClick={() => setPreviewMode("env")}>
              ซอง
            </button>
          </div>
        )}
        {step === 3 || (step === 0 && previewMode === "env") ? (
          <div className="xc-env-big" ref={step === 3 ? envRef : undefined}>
            <EnvelopeArt
              envelope={spec.envelope}
              props={spec.envProps}
              selected={step === 3 ? sel : null}
              onPropDown={step === 3 ? (i, e) => startDrag({ kind: "env", index: i }, e) : undefined}
              className="xc-env-hero"
            />
          </div>
        ) : (
          <CardView
            spec={spec}
            cardRef={cardRef}
            selected={step === 1 ? sel : null}
            onPropDown={step === 1 ? (i, e) => startDrag({ kind: "prop", index: i }, e) : undefined}
            selectedText={step === 2 ? selText : null}
            onTextDown={step === 2 ? (id, e) => startDrag({ kind: "text", id }, e) : undefined}
            className="xc-studio-card"
          />
        )}
        {step === 0 && <span className="xc-stage-cap">{previewMode === "paper" ? THEME_LABEL[spec.theme] : `ซอง${ENVELOPE_LABEL[spec.envelope]}`}</span>}
        {step === 1 && <p className="xc-stage-hint">แตะของบนการ์ดเพื่อเลือก แล้วลากเพื่อย้ายที่</p>}
        {step === 2 && <p className="xc-stage-hint">แตะข้อความบนการ์ดเพื่อเลือก ลากเพื่อวางได้ทุกที่</p>}
        {step === 3 && <p className="xc-stage-hint">แตะสติ๊กเกอร์บนซองแล้วลากเพื่อย้ายได้</p>}
        <div ref={sendEnvRef} className={`xc-send-env ${sending ? "is-on" : ""}`} aria-hidden>
          <EnvelopeArt envelope={spec.envelope} props={spec.envProps} />
        </div>
      </div>

      <section className="xc-panel">
        <nav className="xc-steps" aria-label="ขั้นตอนการออกแบบ">
          {STEPS.map((t, i) => (
            <button key={t} type="button" className={i === step ? "is-on" : ""} aria-current={i === step} onClick={() => setStep(i)}>
              <span>{i + 1}</span>
              {t}
            </button>
          ))}
        </nav>

        <div className="xc-panel-body">
          {step === 0 && (
            <div className="xc-pick">
              <h3>แบบการ์ด</h3>
              <div className="xc-theme-grid" role="radiogroup" aria-label="แบบการ์ด">
                {CARD_THEMES.map((t: CardTheme) => (
                  <button key={t} type="button" role="radio" aria-checked={spec.theme === t} className={`xc-theme-opt ${spec.theme === t ? "is-on" : ""}`} onClick={() => setSpec({ ...spec, theme: t })}>
                    <span className={`xc-swatch xc-theme-${t}`} aria-hidden />
                    {THEME_LABEL[t]}
                  </button>
                ))}
              </div>
              <h3>สีกระดาษ</h3>
              <div className="xc-bg-row">
                {BG_PRESETS.map((c) => (
                  <button key={c} type="button" className={`xc-swatch-dot ${spec.bgColor === c ? "is-on" : ""}`} style={{ background: c }} aria-label={`สีกระดาษ ${c}`} onClick={() => setSpec({ ...spec, bgColor: c })} />
                ))}
                <input type="color" className="xc-color-input" value={spec.bgColor ?? "#d8b48a"} onChange={(e) => setSpec({ ...spec, bgColor: e.target.value })} aria-label="สีกระดาษแบบกำหนดเอง" />
                <button type="button" className="xc-chip-btn" onClick={() => setSpec({ ...spec, bgColor: undefined })}>
                  ค่าเริ่มต้น
                </button>
              </div>
              <h3>สีซอง</h3>
              <div className="xc-env-row" role="radiogroup" aria-label="สีซอง">
                {ENVELOPES.map((e: Envelope) => (
                  <button key={e} type="button" role="radio" aria-checked={spec.envelope === e} className={`xc-env-chip xc-env-${e} ${spec.envelope === e ? "is-on" : ""}`} onClick={() => setSpec({ ...spec, envelope: e })}>
                    <EnvelopeArt envelope={e} />
                    <span>{ENVELOPE_LABEL[e]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="xc-pick">
              <div className="xc-row-between">
                <h3>ของตกแต่งการ์ด</h3>
                <span className="xc-count">
                  {spec.props.length}/{MAX_PROPS}
                </span>
              </div>
              {palette("card")}
              <div className={`xc-sel-bar ${selProp ? "is-on" : ""}`}>
                {selProp ? stickerTools("card") : <p className="xc-sel-empty">กดสติ๊กเกอร์ด้านบนเพื่อเพิ่มลงการ์ด แล้วแตะบนการ์ดเพื่อจัดการ</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="xc-pick">
              <div className="xc-row-between">
                <h3>กล่องข้อความ</h3>
                <span className="xc-count">
                  {texts.length}/{MAX_TEXTS}
                </span>
              </div>
              <div className="xc-text-list">
                {texts.map((t, i) => (
                  <button key={t.id} type="button" className={`xc-chip-btn ${selText === t.id ? "is-on" : ""}`} onClick={() => setSelText(t.id)}>
                    ข้อความ {i + 1}
                  </button>
                ))}
                <button type="button" className="xc-chip-btn is-add" onClick={addText} disabled={texts.length >= MAX_TEXTS}>
                  + เพิ่มข้อความ
                </button>
              </div>
              {selT ? (
                <div className="xc-text-edit">
                  <textarea value={selT.text} maxLength={TEXT_MAX} rows={2} placeholder="พิมพ์ได้ทั้งไทยและอังกฤษ" onChange={(e) => patchText(selT.id, { text: e.target.value })} aria-label="ข้อความในกล่องที่เลือก" />
                  <div className="xc-text-row">
                    <select value={selT.font} onChange={(e) => patchText(selT.id, { font: e.target.value as TextItem["font"] })} aria-label="ฟอนต์">
                      {FONT_KEYS.map((f) => (
                        <option key={f} value={f}>
                          {FONT_LABEL[f]}
                        </option>
                      ))}
                    </select>
                    <select value={selT.effect} onChange={(e) => patchText(selT.id, { effect: e.target.value as TextEffect })} aria-label="เอฟเฟกต์">
                      {TEXT_EFFECTS.map((f) => (
                        <option key={f} value={f}>
                          {EFFECT_LABEL[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="xc-swatches" role="radiogroup" aria-label="สีข้อความ">
                    {TEXT_COLORS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={selT.color === c} aria-label={`สี ${c}`} className={`xc-swatch-dot ${selT.color === c ? "is-on" : ""}`} style={{ background: c }} onClick={() => patchText(selT.id, { color: c })} />
                    ))}
                  </div>
                  <label className="xc-color-row">
                    <span>สีอื่น</span>
                    <input type="color" className="xc-color-input" value={selT.color} onChange={(e) => patchText(selT.id, { color: e.target.value })} aria-label="สีข้อความแบบกำหนดเอง" />
                  </label>
                  <div className="xc-sel-bar is-on">
                    <button type="button" className={`xc-tool ${selT.bold ? "is-on" : ""}`} onClick={() => patchText(selT.id, { bold: !selT.bold })} aria-pressed={selT.bold} aria-label="ตัวหนา">
                      <b>B</b>
                    </button>
                    <button type="button" className={`xc-tool ${selT.italic ? "is-on" : ""}`} onClick={() => patchText(selT.id, { italic: !selT.italic })} aria-pressed={selT.italic} aria-label="ตัวเอียง">
                      <i>I</i>
                    </button>
                    <button type="button" className="xc-tool" onClick={() => patchText(selT.id, { s: Math.max(0.5, +(selT.s - 0.15).toFixed(2)) })} aria-label="ตัวเล็กลง">
                      A−
                    </button>
                    <button type="button" className="xc-tool" onClick={() => patchText(selT.id, { s: Math.min(2.5, +(selT.s + 0.15).toFixed(2)) })} aria-label="ตัวใหญ่ขึ้น">
                      A+
                    </button>
                    <button type="button" className="xc-tool" onClick={() => patchText(selT.id, { r: Math.max(-180, selT.r - 10) })} aria-label="หมุนซ้าย">
                      ↺
                    </button>
                    <button type="button" className="xc-tool" onClick={() => patchText(selT.id, { r: Math.min(180, selT.r + 10) })} aria-label="หมุนขวา">
                      ↻
                    </button>
                    <button type="button" className="xc-tool is-danger" onClick={removeText} aria-label="ลบกล่องข้อความ">
                      ลบ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="xc-chips">
                  {WISH_CHIPS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setSpec((s) => {
                          const ts = textsOf(s);
                          if (ts.length === 0) {
                            const id = crypto.randomUUID();
                            return { ...s, texts: [{ id, text: t.slice(0, TEXT_MAX), x: 0.5, y: 0.7, r: 0, s: 1, font: "plex", color: TEXT_COLORS[0], bold: false, italic: false, effect: "none" }] };
                          }
                          const target = ts.find((x) => x.text.trim() === "") ?? ts[0];
                          return { ...s, texts: ts.map((x) => (x.id === target.id ? { ...x, text: t.slice(0, TEXT_MAX) } : x)) };
                        })
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="xc-pick">
              <div className="xc-row-between">
                <h3>ตกแต่งซอง</h3>
                <span className="xc-count">
                  {spec.envProps.length}/{MAX_ENV_PROPS}
                </span>
              </div>
              {palette("env")}
              <div className={`xc-sel-bar ${selEnv ? "is-on" : ""}`}>
                {selEnv ? stickerTools("env") : <p className="xc-sel-empty">เลือกสติ๊กเกอร์ด้านบนเพื่อติดลงซอง ตราประทับหรือโบว์ช่วยให้ซองดูพิเศษ</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="xc-pick xc-review">
              <label className="xc-field">
                <span>ชื่อที่จะแสดงเป็นผู้ส่ง</span>
                <input value={spec.name} maxLength={NAME_MAX} onChange={(e) => setSpec({ ...spec, name: e.target.value })} placeholder="เช่น ฟ้า" />
              </label>
              <p>
                การ์ดแบบ{THEME_LABEL[spec.theme]} ซอง{ENVELOPE_LABEL[spec.envelope]} มี {texts.filter((t) => t.text.trim()).length} กล่องข้อความ และของตกแต่ง {spec.props.length + spec.envProps.length} ชิ้น
              </p>
              <p className="xc-review-note">
                {left === 0
                  ? `ส่งการ์ดครบ ${CARDS_PER_PERSON} ใบในห้องนี้แล้ว ลองไปอวยพรห้องอื่นดูนะ`
                  : `ส่งได้อีก ${left ?? CARDS_PER_PERSON} ใบในห้องนี้ การ์ดจะไปอยู่ที่โซนคำอวยพร ทุกคนเปิดอ่านและกดถูกใจได้`}
              </p>
            </div>
          )}
        </div>

        <footer className="xc-panel-foot">
          {err && <p className="xc-msg">{err}</p>}
          <div className="xc-nav">
            {step === 0 && mandatory ? (
              <span className="xc-btn-spacer" aria-hidden />
            ) : (
              <button type="button" className="xc-btn-ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
                {step === 0 ? "ยกเลิก" : "ย้อนกลับ"}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="xc-btn" onClick={() => setStep(step + 1)}>
                ถัดไป
              </button>
            ) : (
              <button type="button" className="xc-btn is-send" onClick={send} disabled={busy || !canSend}>
                {busy ? "กำลังส่ง…" : left === 0 ? "ส่งครบแล้ว" : !hasText ? "เพิ่มข้อความก่อน" : !nameOk ? "ใส่ชื่อก่อน" : "ส่งการ์ดไปโซนคำอวยพร"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
