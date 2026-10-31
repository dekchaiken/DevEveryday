"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// เสื้อหนึ่งตัวบนราว
// - การหมุน: บีบความกว้างตาม cos/sin ของมุม แล้วสลับระหว่างด้านหน้ากับด้านข้างแบบค่อยๆ จาง
// - การแกว่ง: ลูกตุ้มสปริง-ดิมพ์ ถูกกระตุ้นด้วยการหมุน ทำให้ตัวเสื้อโยกตามแรงเหวี่ยง
// - ไม้แขวนอยู่หลังตัวเสื้อ เห็นเฉพาะส่วนที่โผล่ผ่านคอเสื้อ
// ขับด้วย requestAnimationFrame และเขียนค่าลง DOM โดยตรง ไม่ผ่าน state ของ React
export function HangingGarment({ product: p, shift, live = false }: { product: Product; shift: number; live?: boolean }) {
  const swing = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const aim = useRef<number | null>(null); // มุมที่เมาส์ชี้ (องศา) หรือ null เมื่อไม่ได้ชี้
  const phys = useRef({ theta: 0, tv: 0, phi: 0, pv: 0 });

  const hook = p.hook ?? { x: 50, y: 10 };
  const hookStyle = { "--hx": `${hook.x}%`, "--hy": `${hook.y}%` } as CSSProperties;

  useEffect(() => {
    if (!live) return;
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const s = phys.current;

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;

      // มุมหมุน: ตามเมาส์ถ้าชี้อยู่บนชิ้นนี้ ถ้าไม่ก็หมุนช้าๆ ไปมาเอง
      const target = aim.current ?? 62 * Math.sin(t * 0.75);
      const aT = 40 * (target - s.theta) - 7.5 * s.tv;
      s.tv += aT * dt;
      s.theta = clamp(s.theta + s.tv * dt, -84, 84);

      // การแกว่งของลูกตุ้ม: แรงเหวี่ยงจากการหมุน + สปริงดึงกลับ + แรงหน่วง
      const aP = -24 * s.phi - 2.6 * s.pv - 0.22 * s.tv;
      s.pv += aP * dt;
      s.phi = clamp(s.phi + s.pv * dt, -12, 12);

      // ด้านหน้ากับด้านข้างสลับกันด้วยการบีบความกว้างตามมุม
      // หมุนทั้งการ์ดรอบแกนดิ่งเดียวกับไม้แขวน ไม้แขวนจึงหมุนไปพร้อมตัวเสื้อ
      if (card.current) card.current.style.transform = `rotateY(${s.theta.toFixed(3)}deg)`;
      if (swing.current) {
        const flutter = 0.9 * Math.sin(t * 3.1) * Math.min(1, Math.abs(s.tv) / 80);
        swing.current.style.transform = `rotate(${(s.phi + flutter).toFixed(3)}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  function move(e: ReactPointerEvent<HTMLSpanElement>) {
    if (!live || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    aim.current = ((e.clientX - r.left) / r.width - 0.5) * 140;
  }

  return (
    <span className="hg" style={{ ...hookStyle, translate: `${shift}px 0` }} onPointerMove={move} onPointerLeave={() => (aim.current = null)}>
      <span className="hg-swing" ref={swing}>
        <span className="hg-card" ref={card}>
          <svg className="hg-hanger" viewBox="0 0 60 30" aria-hidden="true">
            <path d="M30 15 L30 8 A 5 5 0 1 1 25 3" fill="none" stroke="#9a9aa3" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M30 15 L8 26 Q5 28 8 28 L52 28 Q55 28 52 26 Z" fill="none" stroke="#9a9aa3" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
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
