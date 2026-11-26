"use client";

import { useEffect, useState } from "react";
import type { Decor } from "@/lib/christmas/decor";
import { ACCESSORIES, HATS, SCARVES, NOSES, ARMS, BODY_COLORS, LEGS, SLOT_COUNT } from "@/lib/christmas/decor";
import { isReservedSlot, SLOT_POSITIONS } from "@/lib/christmas/slots";
import { SnowmanPreview } from "./SnowmanPreview";
import type { DecorDraft } from "./DonateModal";
import { getClientId } from "./clientId";
import type { Social } from "@/lib/christmas/social";
import { SocialLinks } from "./ProfileCard";
import { Icon } from "./Icon";
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
  gift: "ของขวัญ",
  pom: "หมวกปอมปอม",
  holly: "พวงฮอลลี",
  plaid: "ลายตาราง",
  bell: "กระดิ่ง",
  glasses: "แว่นตา",
  bow: "โบว์",
};

const BODY_HEX: Record<string, string> = { white: "#ffffff", mint: "#d1fae5", sky: "#dbeafe", blush: "#fce7f3" };
const SCARF_HEX: Record<string, string> = { red: "#dc2643", green: "#16a34a", gold: "#f5c542", blue: "#3b82f6" };

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
      <div className="xmas-modal xmas-invite" role="dialog" aria-modal="true" aria-label="ชวนเพื่อน" onClick={(e) => e.stopPropagation()}>
        <button className="xmas-x" onClick={onClose} aria-label="ปิด">
          <Icon name="close" size={18} />
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
            {copied ? <><Icon name="check" size={16} /> คัดลอกแล้ว</> : <><Icon name="copy" size={16} /> คัดลอก</>}
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
type PartKey = "hat" | "scarf" | "nose" | "arms" | "body" | "legs" | "acc";
const PART_TABS: { key: PartKey; label: string; list: readonly string[] }[] = [
  { key: "hat", label: "หัว", list: HATS },
  { key: "scarf", label: "ผ้าพันคอ", list: SCARVES },
  { key: "nose", label: "จมูก", list: NOSES },
  { key: "arms", label: "แขน", list: ARMS },
  { key: "body", label: "ตัว", list: BODY_COLORS },
  { key: "legs", label: "ฐาน", list: LEGS },
  { key: "acc", label: "เครื่องประดับ", list: ACCESSORIES },
];

// ตัวสร้างตุ๊กตาหิมะ: ตัวอย่างอยู่ด้านบนแบบเรียลไทม์ ส่วนด้านล่างเลือกทีละหมวด
// จำไว้ในเบราว์เซอร์ว่าวางตุ๊กตาฟรีของห้องนี้แล้ว (เซิร์ฟเวอร์เป็นตัวตัดสินจริง)
const FREE_KEY = (room: string) => `xmas-free-decor:${room}`;
function markFreePlaced(room: string) {
  try {
    window.localStorage.setItem(FREE_KEY(room), "1");
  } catch {
    /* ไม่เป็นไร */
  }
}
function hasFreePlaced(room: string): boolean {
  try {
    return window.localStorage.getItem(FREE_KEY(room)) === "1";
  } catch {
    return false;
  }
}

// ช่องว่างที่ไม่สงวน แบบสุ่ม (ใช้ตอนเปิดฟอร์มโดยยังไม่ได้เลือกช่อง)
function randomFreeSlot(decor: Decor[]): number | null {
  const taken = new Set(decor.map((d) => d.slot));
  for (let t = 0; t < 5000; t++) {
    const i = Math.floor(Math.random() * SLOT_COUNT);
    if (!taken.has(i) && !isReservedSlot(i)) return i;
  }
  return null;
}

export function DecorModal({
  roomId,
  roomName,
  decor,
  initialSlot,
  onClose,
  onPlaced,
  onPickOnMap,
  defaultName = "",
  social,
  onExclusive,
}: {
  roomId: string;
  roomName: string;
  decor: Decor[];
  initialSlot: number | null;
  onClose: () => void;
  onPlaced: (d: Decor) => void;
  onPickOnMap?: () => void;
  defaultName?: string;
  social?: Social;
  onExclusive?: (d: DecorDraft) => void; // วางแบบ Exclusive (จ่ายต่อตัว วางได้ไม่จำกัด วางช่องสงวนได้)
}) {
  // ราคาตุ๊กตา Exclusive จากการตั้งค่า แสดงปุ่มเฉพาะเมื่อเปิดรับการสนับสนุนอยู่
  const [exclusivePrice, setExclusivePrice] = useState<number | null>(null);
  const hasExclusive = Boolean(onExclusive);
  useEffect(() => {
    if (!hasExclusive) return;
    fetch("/api/christmas/config")
      .then((r) => r.json())
      .then((d: { enabled?: boolean; decorPrice?: number }) => {
        if (d.enabled && typeof d.decorPrice === "number") setExclusivePrice(d.decorPrice);
      })
      .catch(() => {
        /* ไม่แสดงปุ่ม Exclusive ถ้าโหลดค่าไม่ได้ */
      });
  }, [hasExclusive]);
  const [parts, setParts] = useState({ hat: "top", scarf: "red", nose: "carrot", arms: "sticks", body: "white", legs: "snow", acc: "none" });
  const [tab, setTab] = useState<PartKey | "slot">("hat");
  const [name, setName] = useState(defaultName);
  const [alreadyFree] = useState(() => hasFreePlaced(roomId));
  const [slot, setSlot] = useState<number | null>(() => initialSlot ?? randomFreeSlot(decor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taken = new Map(decor.map((d) => [d.slot, d]));
  const slotTaken = slot !== null && taken.has(slot);
  const slotReserved = slot !== null && isReservedSlot(slot);
  const slotBlocked = slotTaken || slotReserved;
  const current = PART_TABS.find((t) => t.key === tab);

  function nearestFree(from: number): number | null {
    const p = SLOT_POSITIONS[from];
    let best: number | null = null;
    let bestD = Infinity;
    for (let i = 0; i < SLOT_POSITIONS.length; i++) {
      if (taken.has(i) || isReservedSlot(i)) continue;
      const q = SLOT_POSITIONS[i];
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  // สุ่มจากทุกช่องที่ว่าง รวมช่องสงวน (ใช้กับการวางแบบ Exclusive)
  function randomAny() {
    for (let tries = 0; tries < 5000; tries++) {
      const i = Math.floor(Math.random() * SLOT_COUNT);
      if (!taken.has(i)) return setSlot(i);
    }
  }

  function buyExclusive() {
    if (!onExclusive || slot === null || slotTaken) return;
    if (!name.trim()) return setError("กรุณาใส่ชื่อ");
    setError("");
    onExclusive({ slot, parts, name: name.trim(), social });
  }

  function randomFree() {
    for (let tries = 0; tries < 5000; tries++) {
      const i = Math.floor(Math.random() * SLOT_COUNT);
      if (!taken.has(i) && !isReservedSlot(i)) return setSlot(i);
    }
    const free = nearestFree(0);
    if (free !== null) setSlot(free);
  }

  async function place() {
    if (alreadyFree) return setError("คุณวางตุ๊กตาฟรีของห้องนี้ไปแล้ว 1 ตัว ให้โอกาสคนอื่นได้วางบ้าง");
    if (slot === null) return setError("เลือกช่องที่จะวางก่อน");
    if (slotReserved) return setError("ช่องนี้สงวนไว้สำหรับป้ายประจำห้อง เลือกช่องอื่น");
    if (slotTaken) return setError("ช่องนี้มีคนวางแล้ว เลือกช่องว่างอื่น");
    if (!name.trim()) return setError("กรุณาใส่ชื่อ");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/christmas/deco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, slot, name, ...parts, social: social ?? {}, clientId: getClientId() }),
      });
      const data = (await res.json()) as { decor?: Decor; error?: string };
      if (!res.ok || !data.decor) {
        if (res.status === 409 && data.error?.includes("ตุ๊กตาฟรี")) markFreePlaced(roomId);
        throw new Error(data.error ?? "วางไม่สำเร็จ");
      }
      markFreePlaced(roomId);
      onPlaced(data.decor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="xmas-modal-back" role="presentation" onClick={onClose}>
      <div className="xmas-modal xmas-build" role="dialog" aria-modal="true" aria-label="ตกแต่งตุ๊กตาหิมะ" onClick={(e) => e.stopPropagation()}>
        <div className="xmas-build-top">
          <button className="xmas-x" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
          <p className="xmas-kicker">ตกแต่งตุ๊กตาหิมะ · {roomName}</p>
          <div className="xmas-build-preview">
            <SnowmanPreview parts={{ ...parts, acc: parts.acc }} />
          </div>
          <p className="xmas-build-slot">{slot === null ? "ยังไม่ได้เลือกช่อง" : `ช่องที่ ${slot + 1}${slotReserved ? " (สงวนไว้)" : slotTaken ? " (มีคนวางแล้ว)" : ""}`}</p>
        </div>

        <div className="xmas-build-main">
        <div className="xmas-part-tabs" role="tablist" aria-label="หมวดชิ้นส่วน">
          {PART_TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-on" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="xmas-part-body" role="tabpanel">
          {current && (
            <>
              <p className="xmas-part-title">{current.label}</p>
              <div className="xmas-part-grid">
                {current.list.map((v) => (
                  <button
                    type="button"
                    key={v}
                    className={parts[current.key] === v ? "is-on" : ""}
                    aria-pressed={parts[current.key] === v}
                    onClick={() => setParts({ ...parts, [current.key]: v })}
                  >
                    {LABEL[v] ?? v}
                  </button>
                ))}
              </div>
            </>
          )}

        </div>
        </div>

        <div className="xmas-build-foot">
          <div className="xmas-foot-slot">
            <label className="xmas-slot-input">
              <span>ช่องวาง (1–{SLOT_COUNT})</span>
              <input
                inputMode="numeric"
                value={slot === null ? "" : String(slot + 1)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setSlot(n >= 1 && n <= SLOT_COUNT ? n - 1 : null);
                }}
                placeholder="เลขช่อง"
              />
            </label>
            <button type="button" className="xmas-chip-btn" onClick={randomFree}>
              สุ่มช่อง
            </button>
            {onExclusive && exclusivePrice !== null && (
              <button type="button" className="xmas-chip-btn" onClick={randomAny}>
                สุ่มทุกช่อง
              </button>
            )}
            <button type="button" className="xmas-chip-btn" onClick={() => onPickOnMap?.()}>
              เลือกบนฉาก
            </button>
          </div>
          <p className={`xmas-slot-status ${slotBlocked || slot === null ? "is-warn" : "is-ok"}`}>
            {slot === null
              ? "เลือกช่องก่อนวาง: กรอกเลข สุ่ม หรือแตะพื้นหิมะบนฉาก"
              : slotReserved
                ? `ช่อง ${slot + 1} สงวนไว้สำหรับป้ายประจำห้อง วางได้เฉพาะแบบ Exclusive`
                : slotTaken
                  ? `ช่อง ${slot + 1} มี ${taken.get(slot)?.name} วางแล้ว`
                  : `ช่อง ${slot + 1} ว่าง พร้อมวาง`}
            {slotBlocked && slot !== null && (
              <button type="button" className="xmas-link-btn" onClick={() => setSlot(nearestFree(slot))}>
                ไปช่องว่างใกล้ที่สุด
              </button>
            )}
          </p>
          <p className="xmas-build-note">{alreadyFree ? "คุณวางตุ๊กตาฟรีของห้องนี้ไปแล้ว 1 ตัว" : "ตุ๊กตาฟรีวางได้คนละ 1 ตัวต่อห้อง"}</p>
          <label className="xmas-field">
            <span className="xmas-field-label">ชื่อที่จะแสดงบนตุ๊กตา</span>
            <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
          </label>
          {onExclusive && exclusivePrice !== null && (
            <button type="button" className="xmas-submit xmas-exclusive-buy" onClick={buyExclusive} disabled={slot === null || slotTaken}>
              วางแบบ Exclusive{` ฿${exclusivePrice}`} · วางได้ไม่จำกัด
            </button>
          )}
          <button className="xmas-submit" onClick={place} disabled={busy || slotBlocked || slot === null || alreadyFree}>
            {busy ? "กำลังวาง…" : alreadyFree ? "วางตุ๊กตาฟรีไปแล้ว" : slot === null ? "เลือกช่องก่อนวาง" : slotReserved ? "ช่องนี้สงวนไว้" : slotTaken ? "ช่องนี้มีคนวางแล้ว" : "วางตุ๊กตาหิมะรอบต้น"}
          </button>
          {error && <p className="xmas-msg err">{error}</p>}
        </div>
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
        <Icon name="close" size={18} />
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
      <SocialLinks social={d.social} />
      <button className={`xmas-like ${liked ? "is-liked" : ""}`} onClick={like} disabled={busy || liked}>
        <Icon name="heart" size={18} /> ถูกใจ <span>{d.likes}</span>
      </button>
    </div>
  );
}
