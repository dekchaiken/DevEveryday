"use client";

import { useState } from "react";
import type { Decor } from "@/lib/christmas/decor";
import { HATS, SCARVES, NOSES, ARMS, BODY_COLORS, LEGS, SLOT_COUNT } from "@/lib/christmas/decor";
import { getClientId } from "./clientId";
import "./christmas.css";

const LABEL: Record<string, string> = {
  top: "หมวกทรงสูง",
  beanie: "หมวกไหมพรม",
  santa: "หมวกซานตา",
  crown: "มงกุฎ",
  red: "แดง",
  green: "เขียว",
  gold: "ทอง",
  blue: "ฟ้า",
  carrot: "แครอท",
  button: "กระดุม",
  star: "ดาว",
  sticks: "แขนไม้",
  wings: "ปีก",
  none: "ไม่มี",
  white: "ขาว",
  mint: "มินต์",
  sky: "ฟ้าอ่อน",
  blush: "ชมพู",
  snow: "ฐานหิมะ",
  boots: "รองเท้าบูท",
};

const BODY_HEX: Record<string, string> = { white: "#ffffff", mint: "#d1fae5", sky: "#dbeafe", blush: "#fce7f3" };
const SCARF_HEX: Record<string, string> = { red: "#dc2643", green: "#16a34a", gold: "#f5c542", blue: "#3b82f6" };

// ----- ตัวอย่างตุ๊กตาหิมะแบบ SVG ตามชิ้นส่วนที่เลือก -----
export function SnowmanPreview({ parts }: { parts: { hat: string; scarf: string; nose: string; arms: string; body: string; legs: string } }) {
  const body = BODY_HEX[parts.body] ?? "#ffffff";
  return (
    <svg viewBox="0 0 200 240" className="xmas-snowman" role="img" aria-label="ตัวอย่างตุ๊กตาหิมะ">
      <ellipse cx="100" cy="228" rx="78" ry="8" fill="rgba(0,0,0,0.25)" />
      {parts.legs === "snow" && <ellipse cx="100" cy="206" rx="62" ry="14" fill={body} stroke="#cbd5e1" />}
      {parts.legs === "boots" && (
        <>
          <rect x="72" y="200" width="22" height="24" rx="6" fill="#3f2a1a" />
          <rect x="106" y="200" width="22" height="24" rx="6" fill="#3f2a1a" />
        </>
      )}
      <circle cx="100" cy="170" r="44" fill={body} stroke="#cbd5e1" />
      <circle cx="100" cy="112" r="34" fill={body} stroke="#cbd5e1" />
      <circle cx="100" cy="66" r="26" fill={body} stroke="#cbd5e1" />
      {parts.arms === "sticks" && (
        <>
          <line x1="58" y1="120" x2="22" y2="96" stroke="#6b4423" strokeWidth="6" strokeLinecap="round" />
          <line x1="142" y1="120" x2="178" y2="96" stroke="#6b4423" strokeWidth="6" strokeLinecap="round" />
        </>
      )}
      {parts.arms === "wings" && (
        <>
          <ellipse cx="30" cy="130" rx="16" ry="8" fill={body} stroke="#cbd5e1" />
          <ellipse cx="170" cy="130" rx="16" ry="8" fill={body} stroke="#cbd5e1" />
        </>
      )}
      <circle cx="91" cy="60" r="3.5" fill="#111" />
      <circle cx="109" cy="60" r="3.5" fill="#111" />
      {parts.nose === "button" ? (
        <circle cx="100" cy="72" r="5" fill="#dc2643" />
      ) : parts.nose === "star" ? (
        <polygon points="100,62 103,70 112,70 105,75 108,84 100,78 92,84 95,75 88,70 97,70" fill="#ffd76a" />
      ) : (
        <polygon points="100,70 130,74 100,78" fill="#ff8a1f" />
      )}
      <path d="M 76 92 Q 100 106 124 92" fill="none" stroke={SCARF_HEX[parts.scarf] ?? "#dc2643"} strokeWidth="11" strokeLinecap="round" />
      {parts.hat === "top" && (
        <>
          <rect x="82" y="22" width="36" height="28" rx="3" fill="#1f2937" />
          <rect x="66" y="48" width="68" height="7" rx="3" fill="#1f2937" />
        </>
      )}
      {parts.hat === "santa" && (
        <>
          <path d="M 76 46 Q 100 -4 130 40 L 118 46 Z" fill="#dc2643" />
          <circle cx="130" cy="36" r="7" fill="#fff" />
          <rect x="72" y="42" width="56" height="8" rx="4" fill="#fff" />
        </>
      )}
      {parts.hat === "beanie" && <path d="M 76 52 Q 100 14 124 52 Z" fill={SCARF_HEX[parts.scarf] ?? "#3b82f6"} />}
      {parts.hat === "crown" && <polygon points="76,50 82,22 92,38 100,18 108,38 118,22 124,50" fill="#f5c542" />}
    </svg>
  );
}

// ----- ชวนเพื่อน: ลิงก์ห้อง คัดลอกหรือแชร์ -----
export function InviteModal({ roomId, roomName, online, capacity, onClose }: { roomId: string; roomName: string; online: number; capacity: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/Christmas?room=${roomId}` : `/Christmas?room=${roomId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* เบราว์เซอร์ไม่อนุญาต ผู้ใช้คัดลอกเองได้จากช่องข้อความ */
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "ต้นคริสต์มาสร่วมกัน", text: `มาแขวนคำอวยพรบนต้นคริสต์มาส${roomName}ด้วยกัน`, url });
      } catch {
        /* ผู้ใช้ยกเลิก */
      }
    } else {
      copy();
    }
  }

  return (
    <div className="xmas-modal-back" role="presentation" onClick={onClose}>
      <div className="xmas-modal glass" role="dialog" aria-modal="true" aria-label="ชวนเพื่อน" onClick={(e) => e.stopPropagation()}>
        <button className="xmas-x" onClick={onClose} aria-label="ปิด">
          ×
        </button>
        <p className="xmas-kicker">ชวนเพื่อนเข้าห้อง{roomName}</p>
        <h2>มาแขวนคำอวยพรด้วยกัน</h2>
        <p className="xmas-hint">ส่งลิงก์นี้ให้เพื่อน เมื่อเพื่อนเข้ามา คุณจะเห็นจำนวนคนในห้องเพิ่มขึ้นทันที</p>
        <p className="xmas-live-count">
          ตอนนี้มี <b>{online}</b> / {capacity} คนในห้อง
        </p>
        <div className="xmas-copy-row">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="ลิงก์ชวนเพื่อน" />
          <button className="xmas-chip-btn" onClick={copy}>
            {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
          </button>
        </div>
        <button className="xmas-submit" onClick={share}>
          แชร์ลิงก์ให้เพื่อน
        </button>
      </div>
    </div>
  );
}

// ----- ตกแต่งตุ๊กตาหิมะ: เลือกชิ้นส่วน เลือกช่อง แล้ววาง -----
export function DecorModal({ roomId, roomName, decor, onClose, onPlaced }: { roomId: string; roomName: string; decor: Decor[]; onClose: () => void; onPlaced: (d: Decor) => void }) {
  const [parts, setParts] = useState({ hat: "top", scarf: "red", nose: "carrot", arms: "sticks", body: "white", legs: "snow" });
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taken = new Map(decor.map((d) => [d.slot, d]));

  async function place() {
    if (slot === null) return setError("เลือกช่องที่จะวางก่อน");
    if (!name.trim()) return setError("กรุณาใส่ชื่อ");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/christmas/deco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, slot, name, ...parts }),
      });
      const data = (await res.json()) as { decor?: Decor; error?: string };
      if (!res.ok || !data.decor) throw new Error(data.error ?? "วางไม่สำเร็จ");
      onPlaced(data.decor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const options: { key: keyof typeof parts; title: string; list: readonly string[] }[] = [
    { key: "hat", title: "หมวก (ส่วนหัว)", list: HATS },
    { key: "scarf", title: "ผ้าพันคอ", list: SCARVES },
    { key: "nose", title: "จมูก", list: NOSES },
    { key: "arms", title: "แขน", list: ARMS },
    { key: "body", title: "สีตัว", list: BODY_COLORS },
    { key: "legs", title: "ฐาน (ขา)", list: LEGS },
  ];

  return (
    <div className="xmas-modal-back" role="presentation" onClick={onClose}>
      <div className="xmas-modal xmas-modal-wide glass" role="dialog" aria-modal="true" aria-label="ตกแต่งตุ๊กตาหิมะ" onClick={(e) => e.stopPropagation()}>
        <button className="xmas-x" onClick={onClose} aria-label="ปิด">
          ×
        </button>
        <p className="xmas-kicker">ตกแต่งตุ๊กตาหิมะ · {roomName}</p>
        <h2>สร้างตุ๊กตาหิมะของคุณ</h2>
        <div className="xmas-decor-layout">
          <div className="xmas-decor-preview">
            <SnowmanPreview parts={parts} />
          </div>
          <div className="xmas-decor-options">
            {options.map((o) => (
              <fieldset key={o.key}>
                <legend>{o.title}</legend>
                <div className="xmas-shapes">
                  {o.list.map((v) => (
                    <button
                      type="button"
                      key={v}
                      className={parts[o.key] === v ? "is-on" : ""}
                      aria-pressed={parts[o.key] === v}
                      onClick={() => setParts({ ...parts, [o.key]: v })}
                    >
                      {LABEL[v] ?? v}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <fieldset>
          <legend>เลือกช่องรอบต้นคริสต์มาส</legend>
          <div className="xmas-slots">
            {Array.from({ length: SLOT_COUNT }).map((_, i) => {
              const t = taken.get(i);
              return (
                <button
                  type="button"
                  key={i}
                  disabled={Boolean(t)}
                  className={`xmas-slot ${slot === i ? "is-on" : ""}`}
                  onClick={() => setSlot(i)}
                  aria-label={t ? `ช่อง ${i + 1} มี ${t.name} วางแล้ว` : `ช่อง ${i + 1} ว่าง`}
                >
                  <span>{i + 1}</span>
                  <small>{t ? t.name : "ว่าง"}</small>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="xmas-field">
          ชื่อที่จะแสดงบนตุ๊กตา
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
        </label>
        <button className="xmas-submit" onClick={place} disabled={busy}>
          {busy ? "กำลังวาง…" : "วางตุ๊กตาหิมะรอบต้น"}
        </button>
        {error && <p className="xmas-msg err">{error}</p>}
      </div>
    </div>
  );
}

// ----- การ์ดข้อมูลของตุ๊กตาหิมะที่คลิก: ของใคร ใครวาง และกดถูกใจ -----
export function DecorInfoCard({ d, onClose, onLiked }: { d: Decor; onClose: () => void; onLiked: (id: string, likes: number) => void }) {
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function like() {
    if (liked || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/christmas/deco/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: d.room, id: d.id, clientId: getClientId() }),
      });
      const data = (await res.json()) as { likes?: number };
      if (res.ok && typeof data.likes === "number") {
        setLiked(true);
        onLiked(d.id, data.likes);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="xmas-focus glass xmas-decor-info" role="dialog" aria-label="ตุ๊กตาหิมะ">
      <button className="xmas-x" onClick={onClose} aria-label="ปิด">
        ×
      </button>
      <div className="xmas-decor-info-row">
        <div className="xmas-decor-thumb">
          <SnowmanPreview parts={d} />
        </div>
        <div>
          <b>ตุ๊กตาของ {d.name}</b>
          <small>
            วางเมื่อ {new Date(d.createdAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} · ช่อง {d.slot + 1}
          </small>
          <small>
            {LABEL[d.hat]} · {LABEL[d.scarf]} · {LABEL[d.nose]}
          </small>
        </div>
      </div>
      <button className={`xmas-like ${liked ? "is-liked" : ""}`} onClick={like} disabled={busy || liked}>
        ♥ ถูกใจ <span>{d.likes}</span>
      </button>
    </div>
  );
}
