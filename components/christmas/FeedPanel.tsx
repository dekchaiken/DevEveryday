"use client";

import { useEffect, useState } from "react";
import type { Ornament } from "@/lib/christmas/types";
import { Icon } from "./Icon";

export type FeedEntry = { id: string; name: string; message: string; amount: number; paidAt: number | null };
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

type Tab = "wishes" | "exclusive" | "team";

// แผงแท็บด้านขวา: คำอวยพรล่าสุด / Exclusive (ตุ๊กตาหิมะยักษ์ของห้อง) / สนับสนุนทีม DevEveryday
export function FeedPanel({
  wishes,
  feed,
  onWishClick,
}: {
  wishes: Ornament[];
  feed: FeedData;
  onWishClick: (o: Ornament) => void;
}) {
  const [tab, setTab] = useState<Tab>("wishes");
  const tabs: { id: Tab; label: string; icon: "heart" | "star" | "gift"; count: number }[] = [
    { id: "wishes", label: "คำอวยพร", icon: "heart", count: wishes.length },
    { id: "exclusive", label: "Exclusive", icon: "star", count: feed.exclusive.length },
    { id: "team", label: "สนับสนุนทีม", icon: "gift", count: feed.supporters.length },
  ];

  return (
    <aside className="xmas-feed glass" aria-label="รายการในห้อง">
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
                    <em>{e.message || "ตุ๊กตาหิมะยักษ์ของห้องนี้"}</em>
                  </span>
                </div>
              </li>
            ))}
            {feed.exclusive.length === 0 && (
              <li className="xmas-empty">ยังไม่มีตุ๊กตาหิมะยักษ์ในห้องนี้ ตั้งป้ายแรกได้เลย</li>
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
