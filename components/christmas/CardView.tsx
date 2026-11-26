"use client";

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { textsOf, type CardSpec, type FontKey } from "@/lib/christmas/cardSpec";
import { PropArt } from "./CardProps";
import "./cardfonts.css";
import "./wishcards.css";

// ฟอนต์ของกล่องข้อความ: มาตรฐานใช้ฟอนต์ของแอป ฟอนต์อื่นมีสำรองเป็นฟอนต์ไทยเสมอ
export const FONT_CSS: Record<FontKey, string> = {
  plex: "var(--font-thai), 'IBM Plex Sans Thai', system-ui, sans-serif",
  mitr: "'Mitr', 'IBM Plex Sans Thai', sans-serif",
  prompt: "'Prompt', 'IBM Plex Sans Thai', sans-serif",
  kanit: "'Kanit', 'IBM Plex Sans Thai', sans-serif",
  pattaya: "'Pattaya', 'Mitr', sans-serif",
  sriracha: "'Sriracha', 'Mitr', cursive",
  pacifico: "'Pacifico', 'Mitr', cursive",
  xmas: "'Mountains of Christmas', 'Mitr', cursive",
};

// การ์ดหนึ่งใบแบบ 3 มิติ: เอียงตามเมาส์หรือนิ้ว ของตกแต่งและข้อความวางได้อิสระ
export function CardView({
  spec,
  tilt = true,
  cardRef,
  selected,
  onPropDown,
  selectedText,
  onTextDown,
  className,
}: {
  spec: CardSpec;
  tilt?: boolean;
  cardRef?: RefObject<HTMLDivElement | null>;
  selected?: number | null;
  onPropDown?: (index: number, e: ReactPointerEvent<HTMLDivElement>) => void;
  selectedText?: string | null;
  onTextDown?: (id: string, e: ReactPointerEvent<HTMLDivElement>) => void;
  className?: string;
}) {
  const own = useRef<HTMLDivElement>(null);
  const ref = cardRef ?? own;
  const texts = textsOf(spec);

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!tilt || !el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 12).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 16).toFixed(2)}deg`);
    el.style.setProperty("--shine", `${Math.round((px + 0.5) * 100)}%`);
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div className={`xc-card-wrap ${className ?? ""}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div ref={ref} className={`xc-card xc-theme-${spec.theme} xc-env-${spec.envelope}`}>
        <div className="xc-card-face">
          <div className="xc-card-frame" aria-hidden />
          <div className="xc-card-props">
            {spec.props.map((p, i) => (
              <div
                key={i}
                className={`xc-prop ${selected === i ? "is-sel" : ""} ${onPropDown ? "is-drag" : ""}`}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `translate(-50%, -50%) rotate(${p.r}deg) scale(${p.s})` }}
                onPointerDown={onPropDown ? (e) => onPropDown(i, e) : undefined}
              >
                <PropArt kind={p.kind} />
              </div>
            ))}
          </div>
          {texts.map((t) => (
            <div
              key={t.id}
              className={`xc-text ${t.effect !== "none" ? `fx-${t.effect}` : ""} ${selectedText === t.id ? "is-sel" : ""} ${onTextDown ? "is-drag" : ""} ${t.text ? "" : "is-empty"}`}
              style={
                {
                  left: `${t.x * 100}%`,
                  top: `${t.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${t.r}deg) scale(${t.s})`,
                  fontFamily: FONT_CSS[t.font],
                  color: t.color,
                  fontWeight: t.bold ? 700 : 400,
                  fontStyle: t.italic ? "italic" : "normal",
                  "--tc": t.color,
                } as CSSProperties
              }
              onPointerDown={onTextDown ? (e) => onTextDown(t.id, e) : undefined}
            >
              {t.text || "ข้อความ"}
            </div>
          ))}
          {spec.name && <span className="xc-card-sign">— {spec.name}</span>}
        </div>
        <div className="xc-card-shine" aria-hidden />
      </div>
    </div>
  );
}
