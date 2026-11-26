"use client";

import { useEffect, useState } from "react";
import "./wishcards.css";

export type SpotStep = { target: string; title: string; body: string };

// คำแนะนำครั้งแรก: ทำให้ทั้งหน้าจอเป็นสีเทาดำ เหลือแค่ปุ่มที่กำลังสอนให้สว่าง
// กดได้เฉพาะปุ่มที่ไฮไลท์ และเมื่อกดแล้วจึงไปขั้นถัดไป
export function CoachSpotlight({ steps, active, onDone }: { steps: readonly SpotStep[]; active: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // วัดตำแหน่งปุ่มของขั้นนี้ ถ้าไม่มีปุ่มบนหน้าจอให้ข้ามไป
  useEffect(() => {
    if (!active) return;
    if (i >= steps.length) {
      onDone();
      return;
    }
    const measure = () => {
      const el = document.querySelector(steps[i].target) as HTMLElement | null;
      if (!el) {
        setI((n) => n + 1);
        return;
      }
      setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, i, steps, onDone]);

  // กดปุ่มที่ไฮไลท์ = เรียนรู้ขั้นนี้แล้ว
  useEffect(() => {
    if (!active || i >= steps.length) return;
    const target = steps[i].target;
    // กดปุ่มที่ไฮไลท์ = ไปขั้นถัดไปของการสอน โดยไม่ทำงานของปุ่มนั้นจริง
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(target);
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setI((n) => n + 1);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [active, i, steps]);

  if (!active || !rect || i >= steps.length) return null;

  const pad = 8;
  const t = rect.top - pad;
  const b = rect.bottom + pad;
  const l = rect.left - pad;
  const r = rect.right + pad;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const tipW = Math.min(vw * 0.86, 300);
  const tipLeft = Math.max(12, Math.min(vw - tipW - 12, (l + r) / 2 - tipW / 2));
  const bottom = (typeof window !== "undefined" ? window.innerHeight : 800) - t + 14;

  return (
    <div className="xc-spot" aria-live="polite">
      <div className="xc-spot-block" style={{ top: 0, left: 0, right: 0, height: Math.max(0, t) }} />
      <div className="xc-spot-block" style={{ top: b, left: 0, right: 0, bottom: 0 }} />
      <div className="xc-spot-block" style={{ top: t, left: 0, width: Math.max(0, l), height: b - t }} />
      <div className="xc-spot-block" style={{ top: t, left: r, right: 0, height: b - t }} />
      <div className="xc-spot-ring" style={{ top: t, left: l, width: r - l, height: b - t }} />
      <div className="xc-spot-tip" style={{ left: tipLeft, width: tipW, bottom }}>
        <span className="xc-kicker">
          ขั้นที่ {i + 1} จาก {steps.length}
        </span>
        <b>{steps[i].title}</b>
        <p>{steps[i].body}</p>
        <small>แตะปุ่มที่ไฮไลท์เพื่อทำต่อ</small>
      </div>
    </div>
  );
}
