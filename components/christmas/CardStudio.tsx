"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CARD_THEMES,
  DEFAULT_CARD,
  ENVELOPES,
  ENVELOPE_LABEL,
  MAX_PROPS,
  NAME_MAX,
  PROP_KINDS,
  PROP_LABEL,
  THEME_LABEL,
  WISH_MAX,
  type CardProp,
  type CardRecord,
  type CardSpec,
  type CardTheme,
  type Envelope,
  type PropKind,
} from "@/lib/christmas/cardSpec";
import type { Social } from "@/lib/christmas/social";
import { getClientId } from "./clientId";
import { CardView } from "./CardView";
import { EnvelopeArt, PropArt } from "./CardProps";
import { Icon } from "./Icon";
import "./wishcards.css";

const STEPS = ["แบบการ์ด", "ตกแต่ง", "คำอวยพร", "ส่ง"];
const WISH_CHIPS = ["ขอให้มีความสุขในวันคริสต์มาส", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "ขอบคุณที่เป็นเพื่อนกันเสมอ", "สุขสันต์วันคริสต์มาสนะ"];

// ฉากโต๊ะ: เลือกแบบการ์ด ตกแต่งด้วยของน่ารัก เขียนคำอวยพร แล้วส่งไปโซนคำอวยพร
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
  const [spec, setSpec] = useState<CardSpec>({ ...DEFAULT_CARD, name: defaultName });
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const wishReady = spec.name.trim() !== "" && spec.wish.trim() !== "";

  function setProps(fn: (props: CardProp[]) => CardProp[]) {
    setSpec((s) => ({ ...s, props: fn(s.props) }));
  }

  function addProp(kind: PropKind) {
    if (spec.props.length >= MAX_PROPS) {
      setErr(`ใส่ของตกแต่งได้สูงสุด ${MAX_PROPS} ชิ้น`);
      return;
    }
    setErr("");
    const p: CardProp = { kind, x: 0.3 + Math.random() * 0.4, y: 0.25 + Math.random() * 0.4, r: Math.round(Math.random() * 30 - 15), s: 1 };
    setProps((ps) => [...ps, p]);
    setSel(spec.props.length);
  }

  function patchSel(fn: (p: CardProp) => CardProp) {
    if (sel === null) return;
    setProps((ps) => ps.map((p, i) => (i === sel ? fn(p) : p)));
  }

  function removeSel() {
    if (sel === null) return;
    setProps((ps) => ps.filter((_, i) => i !== sel));
    setSel(null);
  }

  // ลากของบนการ์ดเพื่อย้ายตำแหน่ง (ปล่อยนิ้วแล้วหยุด)
  function onPropDown(i: number, e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    setSel(i);
    const move = (ev: PointerEvent) => {
      const el = cardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(0.96, Math.max(0.04, (ev.clientX - r.left) / r.width));
      const y = Math.min(0.96, Math.max(0.04, (ev.clientY - r.top) / r.height));
      setProps((ps) => ps.map((p, j) => (j === i ? { ...p, x, y } : p)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // การ์ดบินลงไปที่ปุ่มโซนคำอวยพรก่อนปิดหน้า
  async function flyToZone() {
    const el = cardRef.current;
    const target = document.querySelector("[data-zone-btn]") as HTMLElement | null;
    if (!el || !target || typeof el.animate !== "function") return;
    const a = el.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = el.animate(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 90}px) scale(0.8) rotate(-10deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.1) rotate(14deg)`, opacity: 0.1, offset: 1 },
      ],
      { duration: 950, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" },
    );
    await anim.finished.catch(() => undefined);
  }

  async function send() {
    if (!wishReady) return setErr("กรุณาใส่ชื่อและคำอวยพรก่อนส่ง");
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/christmas/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...spec, room: roomId, social: social ?? {}, clientId: getClientId() }),
      });
      const data = (await res.json()) as { card?: CardRecord; error?: string };
      if (!res.ok || !data.card) throw new Error(data.error ?? "ส่งการ์ดไม่สำเร็จ");
      await flyToZone();
      onSent(data.card);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const selProp = sel !== null ? spec.props[sel] : null;

  return (
    <div className={`xc-studio ${enter ? "is-enter" : ""}`} role="dialog" aria-modal="true" aria-label="ออกแบบการ์ดอวยพร">
      <div className="xc-table" aria-hidden>
        <span className="xc-light l1" />
        <span className="xc-light l2" />
        <span className="xc-light l3" />
      </div>

      <header className="xc-studio-top">
        {mandatory ? <span className="xc-icon-spacer" aria-hidden /> : (
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
        </span>
      </header>

      <div className={`xc-stage ${step === 0 ? "has-env" : ""}`}>
        <CardView spec={spec} cardRef={cardRef} selected={step === 1 ? sel : null} onPropDown={step === 1 ? onPropDown : undefined} className="xc-studio-card" />
        {step === 0 && (
          <div className="xc-env-stage">
            <EnvelopeArt envelope={spec.envelope} />
            <span>ซอง{ENVELOPE_LABEL[spec.envelope]}</span>
          </div>
        )}
        {step === 1 && <p className="xc-stage-hint">แตะของบนการ์ดเพื่อเลือก แล้วลากเพื่อย้ายที่</p>}
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
              <h3>เลือกแบบการ์ด</h3>
              <div className="xc-theme-grid" role="radiogroup" aria-label="แบบการ์ด">
                {CARD_THEMES.map((t: CardTheme) => (
                  <button key={t} type="button" role="radio" aria-checked={spec.theme === t} className={`xc-theme-opt ${spec.theme === t ? "is-on" : ""}`} onClick={() => setSpec({ ...spec, theme: t })}>
                    <span className={`xc-swatch xc-theme-${t}`} aria-hidden />
                    {THEME_LABEL[t]}
                  </button>
                ))}
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
                <h3>ของตกแต่ง</h3>
                <span className="xc-count">
                  {spec.props.length}/{MAX_PROPS}
                </span>
              </div>
              <div className="xc-palette">
                {PROP_KINDS.map((k) => (
                  <button key={k} type="button" className="xc-palette-item" onClick={() => addProp(k)} aria-label={`เพิ่ม${PROP_LABEL[k]}`}>
                    <span className="xc-palette-art">
                      <PropArt kind={k} />
                    </span>
                    {PROP_LABEL[k]}
                  </button>
                ))}
              </div>
              <div className={`xc-sel-bar ${selProp ? "is-on" : ""}`}>
                {selProp ? (
                  <>
                    <button type="button" className="xc-tool" onClick={() => patchSel((p) => ({ ...p, s: Math.max(0.5, +(p.s - 0.15).toFixed(2)) }))} aria-label="เล็กลง">
                      <Icon name="minus" size={16} /> เล็กลง
                    </button>
                    <button type="button" className="xc-tool" onClick={() => patchSel((p) => ({ ...p, s: Math.min(2, +(p.s + 0.15).toFixed(2)) }))} aria-label="ใหญ่ขึ้น">
                      <Icon name="plus" size={16} /> ใหญ่ขึ้น
                    </button>
                    <button type="button" className="xc-tool" onClick={() => patchSel((p) => ({ ...p, r: Math.max(-180, p.r - 15) }))} aria-label="หมุนซ้าย">
                      ↺ หมุนซ้าย
                    </button>
                    <button type="button" className="xc-tool" onClick={() => patchSel((p) => ({ ...p, r: Math.min(180, p.r + 15) }))} aria-label="หมุนขวา">
                      ↻ หมุนขวา
                    </button>
                    <button type="button" className="xc-tool is-danger" onClick={removeSel} aria-label="ลบชิ้นนี้">
                      ลบ
                    </button>
                  </>
                ) : (
                  <p className="xc-sel-empty">กดชิ้นส่วนด้านบนเพื่อเพิ่มลงการ์ด จากนั้นแตะบนการ์ดเพื่อจัดการ</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="xc-pick">
              <label className="xc-field">
                <span>ชื่อที่จะแสดงบนการ์ด</span>
                <input value={spec.name} maxLength={NAME_MAX} onChange={(e) => setSpec({ ...spec, name: e.target.value })} placeholder="เช่น ฟ้า" />
              </label>
              <label className="xc-field">
                <span>
                  คำอวยพร <em>{spec.wish.length}/{WISH_MAX}</em>
                </span>
                <textarea value={spec.wish} maxLength={WISH_MAX} rows={4} onChange={(e) => setSpec({ ...spec, wish: e.target.value })} placeholder="เขียนสิ่งที่อยากบอกทุกคนในห้อง" />
              </label>
              <div className="xc-chips">
                {WISH_CHIPS.map((t) => (
                  <button key={t} type="button" onClick={() => setSpec({ ...spec, wish: t })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="xc-pick xc-review">
              <h3>พร้อมส่งแล้ว</h3>
              <p>
                การ์ดแบบ{THEME_LABEL[spec.theme]} ซอง{ENVELOPE_LABEL[spec.envelope]} มีของตกแต่ง {spec.props.length} ชิ้น
              </p>
              <p className="xc-review-note">การ์ดจะถูกส่งไปโซนคำอวยพร ทุกคนในห้องเปิดอ่านและกดถูกใจได้ ส่วนของตกแต่งแก้ไขได้ก่อนส่งเท่านั้น</p>
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
              <button type="button" className="xc-btn" onClick={() => setStep(step + 1)} disabled={step === 2 && !wishReady}>
                {step === 2 && !wishReady ? "กรอกชื่อและคำอวยพร" : "ถัดไป"}
              </button>
            ) : (
              <button type="button" className="xc-btn is-send" onClick={send} disabled={busy || !wishReady}>
                {busy ? "กำลังส่ง…" : "ส่งการ์ดไปโซนคำอวยพร"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
