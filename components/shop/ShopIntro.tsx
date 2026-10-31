"use client";

import { useEffect, useState, type CSSProperties } from "react";

// หน้าจอโหลดของร้าน: ราวแขวนค่อยๆ ขึ้นมา เสื้อหย่อนลงทีละตัว แล้วชื่อร้านพิมพ์ขึ้น
export function ShopIntro({ name, count }: { name: string; count: number }) {
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduce ? 200 : 2100;
    const t1 = window.setTimeout(() => setDone(true), wait);
    const t2 = window.setTimeout(() => setGone(true), wait + 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`shop-intro ${done ? "is-done" : ""}`} role="status" aria-label="กำลังเปิดร้าน">
      <div className="intro-rail">
        {Array.from({ length: Math.max(count, 4) }).map((_, i) => (
          <span key={i} className="intro-hanger" style={{ "--d": `${0.25 + i * 0.16}s` } as CSSProperties} />
        ))}
      </div>
      <div className="intro-name" aria-hidden="true">
        {name.split("").map((ch, i) => (
          <span key={i} style={{ "--d": `${0.9 + i * 0.05}s` } as CSSProperties}>
            {ch === " " ? " " : ch}
          </span>
        ))}
      </div>
      <div className="intro-sub">กำลังจัดราวแขวนให้คุณ…</div>
    </div>
  );
}
