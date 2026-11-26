"use client";

import { useEffect, useState } from "react";
import type { Ornament } from "@/lib/christmas/types";
import type { Decor } from "@/lib/christmas/decor";
import { Icon } from "./Icon";
import { SocialLinks } from "./ProfileCard";
import type { Social } from "@/lib/christmas/social";

export type FeedEntry = { id: string; name: string; message: string; amount: number; paidAt: number | null; social?: Social };
export type FeedData = { exclusive: FeedEntry[]; supporters: FeedEntry[] };

// ดึงข้อมูลสาธารณะของห้อง (Exclusive และผู้สนับสนุนทีม) เป็นระยะ
export function useFeed(roomId: string): FeedData {
  const [data, setData] = useState<FeedData>({ exclusive: [], supporters: [] });
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch(`/api/christmas/feed?room=${roomId}`, { cache: "no-store" });
        const d = (await res.json()) as FeedData;
        if (!stopped) setData(d);
      } catch {
        /* ลองใหม่รอบถัดไป */
      } finally {
        if (!stopped) timer = setTimeout(load, 15000);
      }
    }
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [roomId]);
  return data;
}

type Tab = "recent" | "wishes" | "exclusive" | "team";

// แผงแท็บด้านขวา: คำอวยพรล่าสุด / Exclusive (บ้านหิมะ Exclusiveของห้อง) / สนับสนุนทีม DevEveryday
// เวลาแบบอ่านง่าย เช่น "5 นาทีที่แล้ว"
function ago(t: number) {
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  if (m < 1440) return `${Math.floor(m / 60)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(m / 1440)} วันที่แล้ว`;
}

export function FeedPanel({
  wishes,
  decor,
  feed,
  onWishClick,
  mobileOpen,
  onMobileClose,
}: {
  wishes: Ornament[];
  decor: Decor[];
  feed: FeedData;
  onWishClick: (o: Ornament) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("recent");
  // ประวัติรวมของโซน: ลูกบอลและตุ๊กตาหิมะเรียงจากล่าสุด
  const recent = [
    ...wishes.map((o) => ({ key: `o-${o.id}`, at: o.createdAt, kind: "wish" as const, name: o.name, text: o.wish || "ขอให้มีความสุขในวันคริสต์มาส", ornament: o })),
    ...decor.map((d) => ({ key: `d-${d.id}`, at: d.createdAt, kind: "snowman" as const, name: d.name, text: `วางตุ๊กตาหิมะที่ช่อง ${d.slot + 1}${d.likes ? ` · ถูกใจ ${d.likes}` : ""}`, ornament: undefined })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 60);
  const tabs: { id: Tab; label: string; icon: "heart" | "star" | "gift" | "sparkle"; count: number }[] = [
    { id: "recent", label: "ล่าสุด", icon: "sparkle", count: recent.length },
    { id: "wishes", label: "คำอวยพร", icon: "heart", count: wishes.length },
    { id: "exclusive", label: "Exclusive", icon: "star", count: feed.exclusive.length },
    { id: "team", label: "สนับสนุนทีม", icon: "gift", count: feed.supporters.length },
  ];

  return (
    <aside className={`xmas-feed glass ${mobileOpen ? "is-open" : ""}`} aria-label="ประวัติล่าสุดของโซนนี้">
      <div className="xmas-sheet-head">
        <b>ประวัติล่าสุด</b>
        <button type="button" className="xmas-form-close xmas-feed-close" onClick={onMobileClose} aria-label="ปิดประวัติ">
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="xmas-tabs" role="tablist" aria-label="หมวดรายการ">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`xmas-tab ${tab === t.id ? "is-on" : ""} ${t.id === "exclusive" ? "is-exclusive" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={15} />
            <span>{t.label}</span>
            <em>{t.count}</em>
          </button>
        ))}
      </div>

      <div className="xmas-tab-panel" role="tabpanel">
        {tab === "recent" && (
          <ul>
            {recent.map((r) => (
              <li key={r.key}>
                <button type="button" onClick={() => r.ornament && onWishClick(r.ornament)} disabled={!r.ornament}>
                  <span className={`xmas-timeline-dot is-${r.kind}`} aria-hidden>
                    <Icon name={r.kind === "wish" ? "bauble" : "snowman"} size={15} />
                  </span>
                  <span className="xmas-entry">
                    <b>
                      {r.name} <small>{ago(r.at)}</small>
                    </b>
                    <em>{r.text}</em>
                  </span>
                </button>
              </li>
            ))}
            {recent.length === 0 && <li className="xmas-empty">ยังไม่มีความเคลื่อนไหวในโซนนี้ เป็นคนแรกที่เริ่มได้เลย</li>}
          </ul>
        )}

        {tab === "wishes" && (
          <ul>
            {wishes.slice(0, 40).map((o) => (
              <li key={o.id}>
                <button onClick={() => onWishClick(o)}>
                  <span className="xmas-chip" style={{ background: "var(--room-accent, #f5c542)" }} />
                  <span className="xmas-entry">
                    <b>{o.name}</b>
                    <em>{o.wish || "ขอให้มีความสุขในวันคริสต์มาส"}</em>
                  </span>
                </button>
              </li>
            ))}
            {wishes.length === 0 && <li className="xmas-empty">ยังไม่มีคำอวยพรบนต้น เป็นคนแรกที่แขวนได้เลย</li>}
          </ul>
        )}

        {tab === "exclusive" && (
          <ul>
            {feed.exclusive.map((e) => (
              <li key={e.id} className="is-exclusive-item">
                <div className="xmas-entry-row">
                  <Icon name="star" size={18} />
                  <span className="xmas-entry">
                    <b>
                      {e.name} <small>฿{e.amount}</small>
                    </b>
                    <em>{e.message || "บ้านหิมะ Exclusiveของห้องนี้"}</em>
                    <SocialLinks social={e.social} />
                  </span>
                </div>
              </li>
            ))}
            {feed.exclusive.length === 0 && (
              <li className="xmas-empty">ยังไม่มีบ้านหิมะ Exclusiveในห้องนี้ ตั้งป้ายแรกได้เลย</li>
            )}
          </ul>
        )}

        {tab === "team" && (
          <ul>
            {feed.supporters.map((s) => (
              <li key={s.id}>
                <div className="xmas-entry-row">
                  <Icon name="gift" size={18} />
                  <span className="xmas-entry">
                    <b>
                      {s.name} <small>฿{s.amount}</small>
                    </b>
                    <em>{s.message || "ขอบคุณทีม DevEveryday"}</em>
                  </span>
                </div>
              </li>
            ))}
            {feed.supporters.length === 0 && <li className="xmas-empty">ขอบคุณทุกการสนับสนุนที่ช่วยให้ทีมทำงานต่อได้</li>}
          </ul>
        )}
      </div>

    </aside>
  );
}

// แถบข้อความวิ่งด้านบน: คำอวยพรล่าสุดและข้อความ Exclusive
export function Ticker({ items }: { items: { key: string; text: string; exclusive?: boolean }[] }) {
  if (items.length === 0) return null;
  const row = items.map((it) => (
    <span key={it.key} className={`xmas-tick-item ${it.exclusive ? "is-exclusive" : ""}`}>
      {it.exclusive && <Icon name="star" size={14} />}
      {it.text}
    </span>
  ));
  return (
    <div className="xmas-ticker" role="marquee" aria-label="คำอวยพรล่าสุด">
      <div className="xmas-ticker-track">
        <div className="xmas-ticker-group">{row}</div>
        <div className="xmas-ticker-group" aria-hidden="true">
          {row}
        </div>
      </div>
    </div>
  );
}
