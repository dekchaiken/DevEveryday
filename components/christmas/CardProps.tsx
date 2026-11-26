"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { STICKER_SVG } from "@/lib/christmas/stickerArt";
import type { CardProp, Envelope, StickerKind } from "@/lib/christmas/cardSpec";

// สติ๊กเกอร์หนึ่งชิ้น (ข้อความ SVG คงที่จาก stickerArt ไม่มีข้อมูลจากผู้ใช้)
export function PropArt({ kind }: { kind: StickerKind }) {
  return <svg viewBox="0 0 40 40" className="xc-prop-svg" aria-hidden dangerouslySetInnerHTML={{ __html: STICKER_SVG[kind] }} />;
}

// ซองการ์ดแบบ flat ใช้ตัวแปรสี --env ของคลาส xc-env-* และรองรับสติ๊กเกอร์บนซอง
export function EnvelopeArt({
  envelope,
  className,
  props,
  selected,
  onPropDown,
}: {
  envelope: Envelope;
  className?: string;
  props?: CardProp[];
  selected?: number | null;
  onPropDown?: (index: number, e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <span className={`xc-env-art xc-env-${envelope} ${className ?? ""}`} aria-hidden={!props}>
      <span className="xc-env-body" />
      <span className="xc-env-pocket" />
      {props && props.length > 0 && (
        <span className="xc-env-props">
          {props.map((p, i) => (
            <span
              key={i}
              className={`xc-prop ${selected === i ? "is-sel" : ""} ${onPropDown ? "is-drag" : ""}`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `translate(-50%, -50%) rotate(${p.r}deg) scale(${p.s})` }}
              onPointerDown={onPropDown ? (e) => onPropDown(i, e as unknown as ReactPointerEvent<HTMLDivElement>) : undefined}
            >
              <PropArt kind={p.kind} />
            </span>
          ))}
        </span>
      )}
      <span className="xc-env-flap" />
    </span>
  );
}
