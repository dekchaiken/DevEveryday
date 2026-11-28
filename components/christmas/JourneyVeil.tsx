"use client";

import { useEffect, useRef } from "react";

// การเดินทางระหว่างห้อง: ออกเดินทาง (กล้องลอยขึ้น หิมะพุ่งผ่าน เมฆลอยขึ้นปิดจอ พร้อมตั๋วเดินทาง)
// และมาถึง (เมฆแหวกออกเผยฉากใหม่ พร้อมป้ายยินดีต้อนรับ) ใช้ CSS ล้วนที่ทำงานบนการ์ดจอ จึงลื่นทุกเครื่อง
export type JourneyMode = "leave" | "arrive";

const LEAVE_MS = 2800;
const ARRIVE_MS = 1900;

export function JourneyVeil({ mode, from, to, onDone, hold = false }: { mode: JourneyMode; from?: string; to?: string; onDone: () => void; hold?: boolean }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  // hold: ฉากใหม่ยังโหลดไม่เสร็จ เมฆยังปิดอยู่ก่อน แล้วค่อยแหวกเมื่อพร้อม
  useEffect(() => {
    if (hold) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 500 : mode === "leave" ? LEAVE_MS : ARRIVE_MS;
    const id = window.setTimeout(() => doneRef.current(), ms);
    return () => window.clearTimeout(id);
  }, [mode, hold]);

  return (
    <div className={`xj xj-${mode} ${hold ? "is-hold" : ""}`} role="status" aria-live="polite" aria-label={mode === "leave" ? `กำลังออกจาก${from ?? ""}` : `ยินดีต้อนรับสู่${to ?? ""}`}>
      <div className="xj-night" />
      <div className="xj-streaks" />
      <div className="xj-clouds">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={`xj-cloud c${i}`} />
        ))}
      </div>
      <div className="xj-ticket">
        <span className="xj-ticket-kicker">{mode === "leave" ? "ตั๋วเดินทางคริสต์มาส" : "ถึงแล้ว"}</span>
        {mode === "leave" ? (
          <div className="xj-route">
            <b>{from}</b>
            <i aria-hidden>
              <svg viewBox="0 0 64 16" width="64" height="16">
                <path d="M2 8 H52" stroke="currentColor" strokeWidth="2" strokeDasharray="3 4" fill="none" />
                <path d="M50 2 L62 8 L50 14 Z" fill="currentColor" />
              </svg>
            </i>
            <b>{to ?? "จุดหมายใหม่"}</b>
          </div>
        ) : (
          <div className="xj-welcome">
            <small>ยินดีต้อนรับสู่</small>
            <b>{to}</b>
          </div>
        )}
        <span className="xj-ticket-foot">{mode === "leave" ? "กำลังลอยข้ามเมฆ…" : "สุขสันต์วันคริสต์มาส"}</span>
      </div>
    </div>
  );
}
