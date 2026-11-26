"use client";

import { useEffect, useState } from "react";
import type { CardSpec } from "@/lib/christmas/cardSpec";
import { CardView } from "./CardView";
import { Icon } from "./Icon";
import "./wishcards.css";

// รายการในโซนคำอวยพร: การ์ดที่ผู้ใช้ทำ หรือคำอวยพรแบบลูกบอลเดิม (แสดงเป็นการ์ดแบบเรียบ)
export type ZoneItem = { id: string; spec: CardSpec; createdAt: number; likes: number };

const BELLS = 12;
const LIGHTS = 22;

// โซนคำอวยพร: รั้วที่มีกระดิ่งและไฟกระพริบ ซองการ์ดแขวนอยู่บนรั้ว แตะเพื่อแกะซองอ่าน
export function WishZone({
  items,
  liked,
  loading,
  onLike,
  onClose,
}: {
  items: ZoneItem[];
  liked: Set<string>;
  loading: boolean;
  onLike: (id: string) => void;
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"shake" | "open" | "out" | "show">("shake");
  const open = items.find((i) => i.id === openId) ?? null;

  // ลำดับแอนิเมชัน: สั่นซอง → เปิดฝา → การ์ดเลื่อนออก → แสดงผล
  useEffect(() => {
    if (!openId) return;
    setPhase("shake");
    const t1 = setTimeout(() => setPhase("open"), 520);
    const t2 = setTimeout(() => setPhase("out"), 1150);
    const t3 = setTimeout(() => setPhase("show"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [openId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openId) setOpenId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, onClose]);

  return (
    <div className="xz-zone" role="dialog" aria-modal="true" aria-label="โซนคำอวยพร">
      <div className="xz-sky" aria-hidden>
        <i className="xz-moon" />
        {Array.from({ length: 26 }).map((_, i) => (
          <i key={i} className="xz-star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 48}%`, animationDelay: `${(i % 6) * 0.5}s` }} />
        ))}
      </div>
      <div className="xz-lights" aria-hidden>
        {Array.from({ length: LIGHTS }).map((_, i) => (
          <span key={i} className={`xz-light c${i % 4}`} style={{ left: `${(i / (LIGHTS - 1)) * 100}%`, animationDelay: `${(i % 5) * 0.3}s` }} />
        ))}
      </div>

      <header className="xz-head">
        <div>
          <p className="xz-kicker">โซนคำอวยพร</p>
          <h2>การ์ดจากทุกคนในห้อง</h2>
          <span className="xz-count">{loading && items.length === 0 ? "กำลังโหลด…" : `${items.length} ใบ`}</span>
        </div>
        <button type="button" className="xz-close" onClick={onClose} aria-label="ปิดโซนคำอวยพร">
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="xz-area">
        <div className="xz-bells" aria-hidden>
          {Array.from({ length: BELLS }).map((_, i) => (
            <svg key={i} viewBox="0 0 24 30" className="xz-bell" style={{ left: `${(i / (BELLS - 1)) * 96 + 2}%`, animationDelay: `${(i % 4) * 0.45}s` }}>
              <path d="M12 3c-3.6 0-6 2.8-6 7.2V16l-2.2 3h16.4L18 16v-5.8C18 5.8 15.6 3 12 3z" fill={i % 2 ? "#f5c542" : "#dc2643"} />
              <circle cx="12" cy="24" r="2" fill="#7a4a10" />
            </svg>
          ))}
        </div>
        <div className="xz-fence" aria-hidden>
          <span className="xz-rail" />
          <span className="xz-rail r2" />
        </div>

        <ul className="xz-grid">
          {items.map((it, i) => (
            <li key={it.id}>
              <button type="button" className="xz-hang" style={{ animationDelay: `${(i % 7) * 0.35}s` }} onClick={() => setOpenId(it.id)} aria-label={`เปิดการ์ดของ ${it.spec.name}`}>
                <span className="xz-string" aria-hidden />
                <span className={`xz-env-mini xz-env-${it.spec.envelope}`}>
                  <span className="xz-seal" aria-hidden />
                  <span className="xz-to">{it.spec.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {!loading && items.length === 0 && <p className="xz-empty">ยังไม่มีการ์ดในโซนนี้ เป็นคนแรกที่ส่งการ์ดอวยพรเลย</p>}
      </div>

      {open && (
        <div
          className={`xz-open is-${phase}`}
          role="dialog"
          aria-modal="true"
          aria-label={`การ์ดจาก ${open.spec.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && phase === "show") setOpenId(null);
          }}
        >
          <div className="xz-letter">
            <div className={`xz-envelope xz-env-${open.spec.envelope}`}>
              <div className="xz-env-back" aria-hidden />
              <div className="xz-card-slot">
                <CardView spec={open.spec} tilt={phase === "show"} />
              </div>
              <div className="xz-env-front" aria-hidden />
              <span className="xz-flap" aria-hidden />
            </div>

            {phase === "show" && (
              <div className="xz-reveal">
                <p className="xz-from">จาก {open.spec.name}</p>
                <div className="xz-reveal-row">
                  <button type="button" className={`xz-like ${liked.has(open.id) ? "is-on" : ""}`} onClick={() => onLike(open.id)} disabled={liked.has(open.id)}>
                    <Icon name="heart" size={18} />
                    {liked.has(open.id) ? "ถูกใจแล้ว" : "ถูกใจการ์ดนี้"}
                    <b>{open.likes}</b>
                  </button>
                  <button type="button" className="xz-done" onClick={() => setOpenId(null)}>
                    ปิด
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
