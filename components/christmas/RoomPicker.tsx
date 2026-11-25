"use client";

import { useEffect, useState } from "react";
import type { RoomTheme } from "@/lib/christmas/rooms";
import { RoomSkyline } from "./RoomSkyline";
import { markInternalNav } from "./skipIntro";
import "./christmas.css";

type RoomInfo = RoomTheme & { online: number; capacity: number };

// หน้าเลือกห้อง: แต่ละห้องมีฉากและจำนวนคนออนไลน์ของตัวเอง
// ห้องที่เต็มจะกดเข้าไม่ได้ และระบบจะแนะนำห้องที่ว่างที่สุด
export default function RoomPicker({ fullRoom }: { fullRoom: string | null }) {
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/christmas/rooms", { cache: "no-store" });
        const data = (await res.json()) as { rooms: RoomInfo[] };
        if (!stopped) {
          setRooms(data.rooms);
          setError(false);
        }
      } catch {
        if (!stopped) setError(true);
      } finally {
        if (!stopped) timer = setTimeout(load, 10000);
      }
    }
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const quietest = rooms
    ? rooms.filter((r) => r.online < r.capacity).sort((a, b) => a.online - b.online)[0]?.id
    : undefined;

  return (
    <main className="xmas-picker">
      <div className="xmas-picker-inner">
        <p className="xmas-kicker">ต้นคริสต์มาสร่วมกัน</p>
        <h1>เลือกห้องที่อยากไปแขวนคำอวยพร</h1>
        <p className="xmas-picker-lead">
          แต่ละห้องมีต้นคริสต์มาสและฉากของตัวเอง เลือกเมืองที่คุณรัก แล้วชวนเพื่อนมาแขวนลูกบอลด้วยกันได้เลย
        </p>

        {fullRoom && <p className="xmas-picker-note">ห้องนั้นเต็มแล้ว ลองเลือกห้องอื่นได้เลย</p>}
        {error && <p className="xmas-picker-note">โหลดจำนวนคนออนไลน์ไม่สำเร็จ ยังเข้าห้องได้ตามปกติ</p>}

        <div className="xmas-room-grid">
          {(rooms ?? placeholder).map((r) => {
            const full = rooms ? r.online >= r.capacity : false;
            const pct = rooms ? Math.min(100, Math.round((r.online / r.capacity) * 100)) : 0;
            return (
              <a
                key={r.id}
                href={full ? undefined : `/Christmas?room=${r.id}`}
                onClick={() => markInternalNav()}
                aria-disabled={full}
                className={`xmas-room-card ${full ? "is-full" : ""}`}
                style={{ "--sky-top": r.skyTop, "--sky-bottom": r.skyBottom, "--room-accent": r.accent } as React.CSSProperties}
              >
                <div className="xmas-room-art" aria-hidden>
                  <span className="xmas-room-glow" />
                  <RoomSkyline kind={r.skyline} />
                </div>
                <div className="xmas-room-body">
                  <div className="xmas-room-head">
                    <b>{r.name}</b>
                    <span>{r.region}</span>
                  </div>
                  <p>{r.blurb}</p>
                  <div className="xmas-room-meter" role="progressbar" aria-valuemin={0} aria-valuemax={r.capacity} aria-valuenow={r.online}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="xmas-room-foot">
                    <small>{rooms ? `${r.online}/${r.capacity} คนในห้อง` : "กำลังโหลด…"}</small>
                    {full ? <em>เต็มแล้ว</em> : r.id === quietest ? <em className="is-hot">ว่างที่สุด</em> : <span className="xmas-enter">เข้าห้อง →</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// ตัวยึดตำแหน่งระหว่างรอข้อมูลห้อง
const placeholder = [
  { id: "bangkok", name: "กรุงเทพฯ", region: "ภาคกลาง", blurb: "", skyTop: "#06101d", skyBottom: "#1a1636", ground: "", accent: "#f5c542", skyline: "city", online: 0, capacity: 150 },
  { id: "chiang-mai", name: "เชียงใหม่", region: "ภาคเหนือ", blurb: "", skyTop: "#071a22", skyBottom: "#0f2b33", ground: "", accent: "#7ee7b0", skyline: "hills", online: 0, capacity: 150 },
  { id: "khon-kaen", name: "ขอนแก่น", region: "ภาคอีสาน", blurb: "", skyTop: "#0c1a10", skyBottom: "#2a2412", ground: "", accent: "#f59e0b", skyline: "rice", online: 0, capacity: 150 },
  { id: "phuket", name: "ภูเก็ต", region: "ภาคใต้", blurb: "", skyTop: "#041a2b", skyBottom: "#0b3a4a", ground: "", accent: "#38bdf8", skyline: "sea", online: 0, capacity: 150 },
] as RoomInfo[];
