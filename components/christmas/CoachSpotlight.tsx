"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./wishcards.css";

export type SpotStep = { target: string; title: string; body: string };

// คำแนะนำครั้งแรก: ทำให้ทั้งหน้าจอเป็นสีเทาดำ เหลือแค่ปุ่มที่กำลังสอนให้สว่าง
// กดได้เฉพาะปุ่มที่ไฮไลท์ และเมื่อกดแล้วจึงไปขั้นถัดไป
export function CoachSpotlight({ steps, active, onDone }: { steps: readonly SpotStep[]; active: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

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
      setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("resize", measure);
    };
  }, [active, i, steps, onDone]);

  // กดปุ่มที่ไฮไลท์ = ปุ่มนั้นทำงานจริง (เปิดโต๊ะ/โซน/ตุ๊กตา) แล้วไปขั้นถัดไป
  // จับการกดตอน pointerdown: แตะต้นแล้วแผงแขวนจะเปิดตอน pointerup ทำให้ป้ายซ่อนก่อนถึง click
  // ถ้ารอดูตอน click จะพลาดการนับขั้น จึงจำไว้ตั้งแต่ตอนกด
  useEffect(() => {
    if (i >= steps.length) return;
    const target = steps[i].target;
    const hits = (node: EventTarget | null) => {
      const el = document.querySelector(target);
      return !!el && node instanceof Node && el.contains(node);
    };
    let pressed = false;
    const onDown = (e: PointerEvent) => {
      pressed = activeRef.current && hits(e.target);
    };
    const onClick = (e: MouseEvent) => {
      const was = pressed;
      pressed = false;
      if (was && hits(e.target)) setI((n) => n + 1);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
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
  // เป้าที่คลุมทั้งจอ (ขั้นต้นไม้) ไม่มีกรอบให้ไฮไลท์ และป้ายต้องไม่หลุดออกนอกจอ
  const fullScreen = t <= 0 && b >= vh;
  // วางป้ายเหนือเป้าถ้ามีที่ ไม่งั้นวางใต้เป้า ถ้าเป้าคลุมทั้งจอให้ลอยเหนือแถบปุ่มล่าง
  const tipPos: CSSProperties = fullScreen
    ? { bottom: 110 }
    : t >= 170
      ? { bottom: vh - t + 14 }
      : b <= vh - 170
        ? { top: b + 14 }
        : { bottom: 110 };

  return (
    <div className="xc-spot" aria-live="polite">
      <div className="xc-spot-block" style={{ top: 0, left: 0, right: 0, height: Math.max(0, t) }} />
      <div className="xc-spot-block" style={{ top: b, left: 0, right: 0, bottom: 0 }} />
      <div className="xc-spot-block" style={{ top: t, left: 0, width: Math.max(0, l), height: b - t }} />
      <div className="xc-spot-block" style={{ top: t, left: r, right: 0, height: b - t }} />
      {!fullScreen && <div className="xc-spot-ring" style={{ top: t, left: l, width: r - l, height: b - t }} />}
      <div key={i} className="xc-spot-tip" style={{ left: tipLeft, width: tipW, ...tipPos }}>
        <span className="xc-kicker">
          ขั้นที่ {i + 1} จาก {steps.length}
        </span>
        <b>{steps[i].title}</b>
        <p>{steps[i].body}</p>
        <small>{steps[i].target === "[data-tree-scene]" ? "แตะต้นคริสต์มาสเพื่อทำต่อ" : "แตะปุ่มที่ไฮไลท์เพื่อทำต่อ"}</small>
      </div>
    </div>
  );
}
