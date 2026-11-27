"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GUIDE_STEPS } from "./guideSteps";
import "./wishcards.css";

type Box = { top: number; bottom: number; left: number; right: number };

// กรอบไฮไลท์ของแต่ละส่วน: ต้นคริสต์มาสคือฉาก 3 มิติทั้งจอ จึงไฮไลท์เฉพาะคอลัมน์กลางที่มีต้นไม้
// คืน null ถ้าส่วนนั้นซ่อนอยู่หรือยังไม่มีขนาด (เช่น มือถือที่ไม่แสดงปุ่มนั้น)
function boxFor(el: HTMLElement, selector: string): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return null;
  if (selector === "[data-tree-scene]") {
    return {
      left: r.left + r.width * 0.3,
      right: r.left + r.width * 0.7,
      top: r.top + r.height * 0.08,
      bottom: r.top + r.height * 0.9,
    };
  }
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

// มีส่วนใดส่วนหนึ่งของบรรพบุรุษที่ถูกซ่อนด้วย display: none หรือไม่
function hiddenByCss(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (getComputedStyle(n).display === "none") return true;
  }
  return false;
}

// คู่มือการใช้งาน: หรี่หน้าจอ ไฮไลท์ส่วนที่กำลังอธิบาย แล้วมีปุ่มก่อนหน้า ถัดไป และข้าม
// แตะส่วนที่ไฮไลท์ = จำลองให้ดูเฉย ๆ แล้วไปขั้นถัดไป ไม่เปิดแผงหรือทำงานของปุ่มนั้นจริง
export function GuideSpotlight({ active, onDone }: { active: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const steps = GUIDE_STEPS;
  const last = steps.length - 1;

  // ให้ทุกฟังก์ชันที่ใช้ในตัวฟังเหตุการณ์อ่านค่าล่าสุดเสมอ โดยไม่ต้องผูกใหม่ทุกครั้ง
  const activeRef = useRef(active);
  activeRef.current = active;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const advanceRef = useRef<() => void>(() => {});
  advanceRef.current = () => {
    if (i >= last) onDoneRef.current();
    else setI((n) => n + 1);
  };
  const swallowRef = useRef(false);
  const suppressClickRef = useRef(false);

  // เริ่มจากขั้นแรกทุกครั้งที่เปิดคู่มือ
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) setI(0);
    wasActive.current = active;
  }, [active]);

  // วัดตำแหน่งของขั้นนี้ รอให้ส่วนนั้นแสดงผลก่อน ถ้าไม่มีให้เห็นในหน้านี้จะข้ามไปขั้นถัดไป
  useEffect(() => {
    if (!active) return;
    const step = steps[i];
    if (!step) {
      onDoneRef.current();
      return;
    }
    let tries = 0;
    let retry = 0;
    const measure = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      const b = el ? boxFor(el, step.target) : null;
      if (b) {
        setBox(b);
        return;
      }
      // ซ่อนด้วย CSS (เช่น ปุ่มที่มีเฉพาะจอคอม) ข้ามทันที ไม่ต้องรอ
      if (el && hiddenByCss(el)) {
        setI((n) => n + 1);
        return;
      }
      if (tries++ < 15) {
        retry = window.setTimeout(measure, 200);
        return;
      }
      setI((n) => n + 1);
    };
    setBox(null);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("resize", measure);
    };
  }, [active, i, steps]);

  // ดักการแตะที่ส่วนที่ไฮไลท์ที่ capture phase: ไม่ให้ไปถึงปุ่มหรือต้นไม้จริง แล้วไปขั้นถัดไป
  useEffect(() => {
    const step = steps[i];
    if (!step) return;
    const hits = (node: EventTarget | null) => {
      const el = document.querySelector(step.target);
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
      advanceRef.current();
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

  if (!active || !box || i >= steps.length) return null;

  const step = steps[i];
  const pad = 8;
  const t = box.top - pad;
  const b = box.bottom + pad;
  const l = box.left - pad;
  const r = box.right + pad;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const tipW = Math.min(vw * 0.9, 320);
  const tipLeft = Math.max(12, Math.min(vw - tipW - 12, (l + r) / 2 - tipW / 2));
  // ป้ายอยู่เหนือส่วนที่ไฮไลท์ถ้ามีที่ ไม่งั้นอยู่ใต้ ถ้าไม่มีทั้งสองด้านให้ลอยเหนือแถบปุ่มล่าง
  const tipPos: CSSProperties = t >= 230 ? { bottom: vh - t + 14 } : b <= vh - 230 ? { top: b + 14 } : { bottom: 110 };

  return (
    <div className="xg" aria-live="polite">
      <div className="xg-block" style={{ top: 0, left: 0, right: 0, height: Math.max(0, t) }} />
      <div className="xg-block" style={{ top: b, left: 0, right: 0, bottom: 0 }} />
      <div className="xg-block" style={{ top: t, left: 0, width: Math.max(0, l), height: b - t }} />
      <div className="xg-block" style={{ top: t, left: r, right: 0, height: b - t }} />
      <div className="xg-ring" style={{ top: t, left: l, width: r - l, height: b - t }} />
      <div key={i} className="xg-tip" role="dialog" aria-label="คู่มือการใช้งาน" style={{ left: tipLeft, width: tipW, ...tipPos }}>
        <span className="xg-kicker">
          {i + 1} / {steps.length}
        </span>
        <b>{step.title}</b>
        <p>{step.body}</p>
        <small>แตะตรงที่ไฮไลท์เพื่อดูตัวอย่าง หรือกดถัดไป</small>
        <div className="xg-actions">
          <button type="button" className="xg-link" onClick={() => onDoneRef.current()}>
            ข้ามคู่มือ
          </button>
          <span className="xg-spacer" />
          {i > 0 && (
            <button type="button" className="xg-btn" onClick={() => setI(i - 1)}>
              ก่อนหน้า
            </button>
          )}
          <button type="button" className="xg-btn xg-primary" onClick={() => advanceRef.current()}>
            {i === last ? "เสร็จ" : "ถัดไป"}
          </button>
        </div>
      </div>
    </div>
  );
}
