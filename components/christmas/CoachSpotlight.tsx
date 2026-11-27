"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./wishcards.css";

export type SpotStep = { target: string; title: string; body: string };

type Box = { top: number; bottom: number; left: number; right: number };

// กรอบไฮไลท์: ต้นคริสต์มาสคือฉาก 3 มิติทั้งจอ จึงไฮไลท์เฉพาะคอลัมน์กลางที่มีต้นไม้ยืนอยู่
function highlightOf(el: HTMLElement, target: string): Box {
  const r = el.getBoundingClientRect();
  if (target !== "[data-tree-scene]") return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  return {
    left: r.left + r.width * 0.3,
    right: r.left + r.width * 0.7,
    top: r.top + r.height * 0.08,
    bottom: r.top + r.height * 0.9,
  };
}

// คำแนะนำครั้งแรก: ทำให้ทั้งหน้าจอเป็นสีเทาดำ เหลือแค่ปุ่มที่กำลังสอนให้สว่าง
// กดได้เฉพาะปุ่มที่ไฮไลท์ และเมื่อกดแล้วจึงไปขั้นถัดไป
export function CoachSpotlight({ steps, active, onDone }: { steps: readonly SpotStep[]; active: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Box | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const swallowRef = useRef(false);
  const suppressClickRef = useRef(false);

  // วัดตำแหน่งของขั้นนี้ รอให้ส่วนนั้นโหลดเสร็จก่อน (ฉาก 3 มิติโหลดทีหลัง) ถ้ารอนานเกินไปค่อยข้ามไป
  useEffect(() => {
    if (!active) return;
    if (i >= steps.length) {
      onDone();
      return;
    }
    let tries = 0;
    let retry = 0;
    const measure = () => {
      const el = document.querySelector(steps[i].target) as HTMLElement | null;
      if (!el) {
        if (tries++ < 30) retry = window.setTimeout(measure, 200);
        else setI((n) => n + 1);
        return;
      }
      setRect(highlightOf(el, steps[i].target));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("resize", measure);
    };
  }, [active, i, steps, onDone]);

  // แตะปุ่มที่ไฮไลท์ = จำลองให้ดูเฉย ๆ แล้วไปขั้นถัดไป ไม่เปิดแผงหรือทำงานของปุ่มนั้นจริง
  // ดักที่ capture phase ของ window: ทั้ง pointerdown, pointerup และ click ไม่ไปถึงต้นไม้หรือปุ่มจริง
  useEffect(() => {
    if (i >= steps.length) return;
    const target = steps[i].target;
    const hits = (node: EventTarget | null) => {
      const el = document.querySelector(target);
      return !!el && node instanceof Node && el.contains(node);
    };
    const onDown = (e: PointerEvent) => {
      suppressClickRef.current = false;
      if (!activeRef.current || !hits(e.target)) return;
      swallowRef.current = true;
      e.stopPropagation();
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (!swallowRef.current) return;
      swallowRef.current = false;
      if (!hits(e.target)) return;
      suppressClickRef.current = true;
      e.stopPropagation();
      e.preventDefault();
      setI((n) => n + 1);
    };
    const onClick = (e: MouseEvent) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [i, steps]);

  if (!active || !rect || i >= steps.length) return null;

  const pad = 8;
  const t = rect.top - pad;
  const b = rect.bottom + pad;
  const l = rect.left - pad;
  const r = rect.right + pad;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const tipW = Math.min(vw * 0.86, 300);
  const tipLeft = Math.max(12, Math.min(vw - tipW - 12, (l + r) / 2 - tipW / 2));
  // วางป้ายเหนือเป้าถ้ามีที่ ไม่งั้นวางใต้เป้า ถ้าไม่มีที่ทั้งสองด้านให้ลอยเหนือแถบปุ่มล่าง
  const tipPos: CSSProperties = t >= 170 ? { bottom: vh - t + 14 } : b <= vh - 170 ? { top: b + 14 } : { bottom: 110 };

  return (
    <div className="xc-spot" aria-live="polite">
      <div className="xc-spot-block" style={{ top: 0, left: 0, right: 0, height: Math.max(0, t) }} />
      <div className="xc-spot-block" style={{ top: b, left: 0, right: 0, bottom: 0 }} />
      <div className="xc-spot-block" style={{ top: t, left: 0, width: Math.max(0, l), height: b - t }} />
      <div className="xc-spot-block" style={{ top: t, left: r, right: 0, height: b - t }} />
      <div className="xc-spot-ring" style={{ top: t, left: l, width: r - l, height: b - t }} />
      <div key={i} className="xc-spot-tip" style={{ left: tipLeft, width: tipW, ...tipPos }}>
        <span className="xc-kicker">
          ขั้นที่ {i + 1} จาก {steps.length}
        </span>
        <b>{steps[i].title}</b>
        <p>{steps[i].body}</p>
        <small>แตะเพื่อดูตัวอย่าง แล้วไปขั้นถัดไป</small>
      </div>
    </div>
  );
}
