"use client";

import { useEffect, useState } from "react";
import type { CardRecord } from "@/lib/christmas/cardSpec";
import { CardView } from "./CardView";
import { EnvelopeArt } from "./CardProps";
import { Icon } from "./Icon";
import "./wishcards.css";

const BELLS = 12;
const LIGHTS = 22;

// ลิงก์ส่วนตัวของการ์ดหนึ่งใบ เพื่อนที่เปิดลิงก์จะเห็นการ์ดใบนี้ก่อนเข้าร่วม
export function cardLink(room: string, id: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/Christmas?room=${encodeURIComponent(room)}&card=${encodeURIComponent(id)}`;
}

// แกะซองการ์ด: สั่นซอง เปิดฝา การ์ดเลื่อนออกมา แล้วแสดงปุ่มถูกใจและแชร์
// ใช้ทั้งในโซนคำอวยพรและตอนเพื่อนเปิดลิงก์แชร์
export function CardReveal({
  card,
  liked,
  onLike,
  onClose,
  room,
  autoStart = true,
}: {
  card: CardRecord;
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
  room: string;
  autoStart?: boolean;
}) {
  const [phase, setPhase] = useState<"shake" | "open" | "out" | "show">("shake");
  const [copied, setCopied] = useState(false);

  // ลำดับแอนิเมชัน: สั่นซอง → เปิดฝา → การ์ดเลื่อนออก → แสดงผล
  useEffect(() => {
    if (!autoStart) return;
    setPhase("shake");
    const t1 = setTimeout(() => setPhase("open"), 520);
    const t2 = setTimeout(() => setPhase("out"), 1150);
    const t3 = setTimeout(() => setPhase("show"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [card.id, autoStart]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "show") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  async function share() {
    const url = cardLink(room, card.id);
    const text = `${card.name} ส่งการ์ดอวยพรมาให้คุณ`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "การ์ดอวยพรคริสต์มาส", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ผู้ใช้ยกเลิกหรือเบราว์เซอร์ไม่อนุญาต */
    }
  }

  return (
    <div
      className={`xz-open is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label={`การ์ดจาก ${card.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase === "show") onClose();
      }}
    >
      <div className="xz-letter">
        <div className="xz-envelope-wrap">
          <div className="xz-card-slot">
            <CardView spec={card} tilt={phase === "show"} />
          </div>
          <EnvelopeArt envelope={card.envelope} props={card.envProps} className="xz-env-reveal" />
        </div>

        {phase === "show" && (
          <div className="xz-reveal">
            <p className="xz-from">จาก {card.name}</p>
            <div className="xz-reveal-row">
              <button type="button" className={`xz-like ${liked ? "is-on" : ""}`} onClick={onLike} disabled={liked}>
                <Icon name="heart" size={18} />
                {liked ? "ถูกใจแล้ว" : "ถูกใจการ์ดนี้"}
                <b>{card.likes}</b>
              </button>
              <button type="button" className="xz-done" onClick={share}>
                {copied ? "คัดลอกลิงก์แล้ว" : "แชร์การ์ดนี้"}
              </button>
              <button type="button" className="xz-done" onClick={onClose}>
                ปิด
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// โซนคำอวยพร: รั้วที่มีกระดิ่งและไฟกระพริบ ซองการ์ดแขวนอยู่บนรั้ว แตะเพื่อแกะซองอ่าน
export function WishZone({
  cards,
  liked,
  loading,
  room,
  onLike,
  onClose,
}: {
  cards: CardRecord[];
  liked: Set<string>;
  loading: boolean;
  room: string;
  onLike: (id: string) => void;
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = cards.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || openId) return;
      onClose();
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
          <span className="xz-count">{loading && cards.length === 0 ? "กำลังโหลด…" : `${cards.length} ใบ`}</span>
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
          {cards.map((c, i) => (
            <li key={c.id}>
              <button type="button" className="xz-hang" style={{ animationDelay: `${(i % 7) * 0.35}s` }} onClick={() => setOpenId(c.id)} aria-label={`เปิดการ์ดของ ${c.name}`}>
                <span className="xz-string" aria-hidden />
                <span className="xz-zone-env">
                  <EnvelopeArt envelope={c.envelope} props={c.envProps} className="xz-env-zone-art" />
                  <span className="xz-to">{c.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {!loading && cards.length === 0 && <p className="xz-empty">ยังไม่มีการ์ดในโซนนี้ เป็นคนแรกที่ส่งการ์ดอวยพรเลย</p>}
      </div>

      {open && (
        <CardReveal
          key={open.id}
          card={open}
          room={room}
          liked={liked.has(open.id)}
          onLike={() => onLike(open.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
