"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";

// การ์ดชวนเข้ากิจกรรมคริสต์มาส แสดงจำนวนคนออนไลน์ทุกห้องแบบสด
export function ChristmasPromoCard() {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/christmas/rooms", { cache: "no-store" });
        const data = (await res.json()) as { rooms: { online: number }[] };
        if (!stopped) setOnline(data.rooms.reduce((s, r) => s + r.online, 0));
      } catch {
        /* ไม่แสดงจำนวนถ้าโหลดไม่ได้ */
      } finally {
        if (!stopped) timer = setTimeout(load, 30000);
      }
    }
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <Reveal>
      <a href="/Christmas" className="xpromo" aria-label="เข้าร่วมต้นคริสต์มาสร่วมกัน">
        <div className="xpromo-art" aria-hidden="true">
          <span className="xpromo-snow" />
          <svg viewBox="0 0 120 150" className="xpromo-tree">
            <path d="M60 8 L92 58 L76 58 L104 98 L16 98 L44 58 L28 58 Z" fill="#22c55e" />
            <rect x="54" y="98" width="12" height="18" fill="#8b5a2b" />
            <polygon points="60,0 63,7 70,7 64,11 66,18 60,14 54,18 56,11 50,7 57,7" fill="#f5c542" />
            <circle cx="48" cy="72" r="4" fill="#dc2643" />
            <circle cx="74" cy="84" r="4" fill="#f5c542" />
            <circle cx="60" cy="110" r="4" fill="#60a5fa" />
          </svg>
        </div>
        <div className="xpromo-body">
          <span className="xpromo-badge">
            <span className="xpromo-dot" />
            {online === null ? "กิจกรรมคริสต์มาส" : `ออนไลน์ ${online} คนตอนนี้`}
          </span>
          <h3>ต้นคริสต์มาสร่วมกัน</h3>
          <p>แขวนคำอวยพรบนต้นไม้ 3 มิติ เลือกห้องตามเมืองที่คุณรัก และชวนเพื่อนมาแขวนด้วยกัน</p>
          <span className="xpromo-cta">
            เข้าร่วมเลย <span aria-hidden="true">→</span>
          </span>
        </div>
      </a>
    </Reveal>
  );
}
