"use client";

import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Product } from "@/lib/shop";

// เสื้อด้านหน้าแบบ placeholder เมื่อยังไม่มีรูป วาดด้วยสีของสินค้า
function FrontPlaceholder({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 130" className="hg-img" aria-hidden="true">
      <path d="M40 8 L16 22 L4 48 L22 56 L26 44 L26 124 L94 124 L94 44 L98 56 L116 48 L104 22 L80 8 Q60 22 40 8 Z" fill={color} />
      <path d="M40 8 Q60 26 80 8" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
    </svg>
  );
}

// ด้านข้างแบบ placeholder: แคบกว่าด้านหน้า
function SidePlaceholder({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 130" className="hg-img" aria-hidden="true">
      <path d="M46 8 L36 14 L30 40 L38 46 L40 124 L80 124 L82 46 L90 40 L84 14 L74 8 Q60 20 46 8 Z" fill={color} />
      <path d="M46 8 Q60 20 74 8" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
    </svg>
  );
}

// เสื้อหนึ่งตัวบนราว: ห่วงไม้แขวนอยู่ตรงจุดยอดของการ์ด เสื้อแกว่งรอบจุดนั้น และหมุนไปมาตามตำแหน่งเมาส์
export function HangingGarment({ product: p, shift, live = false }: { product: Product; shift: number; live?: boolean }) {
  const [turn, setTurn] = useState(0);
  const [hover, setHover] = useState(false);

  const hook = p.hook ?? { x: 50, y: 10 };
  const hookStyle = { "--hx": `${hook.x}%`, "--hy": `${hook.y}%` } as CSSProperties;

  function move(e: ReactPointerEvent<HTMLSpanElement>) {
    if (!live || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    setTurn(Math.round((x - 0.5) * 120)); // -60..60 องศา
  }

  return (
    <span
      className="hg"
      style={{ ...hookStyle, translate: `${shift}px 0` }}
      onPointerEnter={() => setHover(true)}
      onPointerMove={move}
      onPointerLeave={() => {
        setHover(false);
        setTurn(0);
      }}
    >
      <svg className="hg-hanger" viewBox="0 0 60 30" aria-hidden="true">
        <path d="M30 2 Q30 0 32 0 Q34 0 34 3 Q34 6 30 10 L30 14" fill="none" stroke="#9a9aa3" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 14 L6 26 Q4 28 7 28 L53 28 Q56 28 54 26 Z" fill="none" stroke="#9a9aa3" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className={`hg-swing ${hover ? "still" : ""}`}>
        <span className="hg-card" style={{ transform: `rotateY(${turn}deg)` }}>
          <span className="hg-face front">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={p.name} className="hg-img" draggable={false} />
            ) : (
              <FrontPlaceholder color={p.color} />
            )}
          </span>
          <span className="hg-face side">
            {p.side ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.side} alt="" className="hg-img" draggable={false} />
            ) : (
              <SidePlaceholder color={p.color} />
            )}
          </span>
        </span>
      </span>
    </span>
  );
}
