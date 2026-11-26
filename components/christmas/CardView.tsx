"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { CardSpec } from "@/lib/christmas/cardSpec";
import { PropArt } from "./CardProps";
import "./wishcards.css";

// การ์ดหนึ่งใบแบบ 3 มิติ: เอียงตามตำแหน่งเมาส์หรือนิ้ว และมีแสงสะท้อนเคลื่อนที่ตาม
export function CardView({
  spec,
  tilt = true,
  cardRef,
  selected,
  onPropDown,
  className,
}: {
  spec: CardSpec;
  tilt?: boolean;
  cardRef?: RefObject<HTMLDivElement | null>;
  selected?: number | null;
  onPropDown?: (index: number, e: ReactPointerEvent<HTMLDivElement>) => void;
  className?: string;
}) {
  const own = useRef<HTMLDivElement>(null);
  const ref = cardRef ?? own;

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
          <div className="xc-card-title">สุขสันต์วันคริสต์มาส</div>
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
          <div className="xc-card-body">
            <p className="xc-card-wish">{spec.wish}</p>
            <span className="xc-card-sign">— {spec.name}</span>
          </div>
        </div>
        <div className="xc-card-shine" aria-hidden />
      </div>
    </div>
  );
}
