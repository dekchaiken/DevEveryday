"use client";

import { useEffect, useState } from "react";
import { ROOM_CAPACITY, ROOM_REGIONS, ROOMS, type RoomTheme } from "@/lib/christmas/rooms";
import { RoomSkyline } from "./RoomSkyline";
import { consumeJourney, markInternalNav, markJourney, type Journey } from "./skipIntro";
import { JourneyVeil } from "./JourneyVeil";
import "./christmas.css";

type RoomInfo = RoomTheme & { online: number; capacity: number };

// หน้าเลือกห้อง: แต่ละห้องมีฉากและจำนวนคนออนไลน์ของตัวเอง
// ห้องที่เต็มจะกดเข้าไม่ได้ และระบบจะแนะนำห้องที่ว่างที่สุด
export default function RoomPicker({ fullRoom }: { fullRoom: string | null }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("all");
  // การเดินทาง: มาถึงหน้าแผนที่ (เมฆแหวก) และออกเดินทางไปห้องที่เลือก (เมฆปิด)
  const [arrived, setArrived] = useState<Journey | null>(null);
  const [going, setGoing] = useState<{ id: string; name: string } | null>(null);
  const [fromRoom, setFromRoom] = useState<string | undefined>(undefined);
  useEffect(() => {
    const j = consumeJourney();
    setArrived(j);
    setFromRoom(j?.from);
  }, []);
  const go = (e: React.MouseEvent, r: RoomTheme, full: boolean) => {
    e.preventDefault();
    if (full || going) return;
    markInternalNav();
    markJourney({ from: fromRoom, to: r.name });
    setGoing({ id: r.id, name: r.name });
  };

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/christmas/rooms", { cache: "no-store" });
        const data = (await res.json()) as { rooms: RoomInfo[] };
        if (!stopped) {
          setCounts(Object.fromEntries(data.rooms.map((r) => [r.id, r.online])));
          setError(false);
        }
      } catch {
        if (!stopped) setError(true);
      } finally {
        if (!stopped) timer = setTimeout(load, 15000);
      }
    }
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const online = (id: string) => counts?.[id] ?? 0;
  const popular = ROOMS.filter((r) => r.popular).sort((a, b) => (a.popular ?? 0) - (b.popular ?? 0));
  const quietest = counts ? popular.filter((r) => online(r.id) < ROOM_CAPACITY).sort((a, b) => online(a.id) - online(b.id))[0]?.id : undefined;
  const query = q.trim();
  const all = ROOMS.filter((r) => (region === "all" || r.region === region) && (!query || r.name.includes(query) || r.id.includes(query.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name, "th"));

  return (
    <main className="xmas-picker">
      {arrived && !going && <JourneyVeil mode="arrive" to="แผนที่คริสต์มาส" onDone={() => setArrived(null)} />}
      {going && <JourneyVeil mode="leave" from={fromRoom ?? "แผนที่คริสต์มาส"} to={going.name} onDone={() => window.location.assign(`/Christmas?room=${going.id}`)} />}
      <div className="xmas-picker-inner">
        <p className="xmas-kicker">ต้นคริสต์มาสร่วมกัน</p>
        <h1>เลือกห้องที่อยากไปแขวนคำอวยพร</h1>
        <p className="xmas-picker-lead">ทุกจังหวัดมีต้นคริสต์มาสของตัวเอง จังหวัดยอดนิยมมีฉากแลนด์มาร์กเฉพาะ เลือกบ้านเกิดหรือเมืองที่คุณรัก แล้วชวนเพื่อนมาแขวนลูกบอลด้วยกัน</p>

        {fullRoom && <p className="xmas-picker-note">ห้องนั้นเต็มแล้ว ลองเลือกห้องอื่นได้เลย</p>}
        {error && <p className="xmas-picker-note">โหลดจำนวนคนออนไลน์ไม่สำเร็จ ยังเข้าห้องได้ตามปกติ</p>}

        <h2 className="xmas-picker-h">ยอดนิยม</h2>
        <div className="xmas-room-grid">
          {popular.map((r) => {
            const n = online(r.id);
            const full = n >= ROOM_CAPACITY;
            const pct = Math.min(100, Math.round((n / ROOM_CAPACITY) * 100));
            return (
              <a
                key={r.id}
                href={full ? undefined : `/Christmas?room=${r.id}`}
                onClick={(e) => go(e, r, full)}
                aria-disabled={full}
                className={`xmas-room-card ${full ? "is-full" : ""}`}
                style={{ "--sky-top": r.skyTop, "--sky-bottom": r.skyBottom, "--room-accent": r.accent } as React.CSSProperties}
              >
                <div className="xmas-room-art" aria-hidden>
                  <span className="xmas-room-glow" />
                  <span className="xmas-room-rank">#{r.popular}</span>
                  <RoomSkyline kind={r.skyline} />
                </div>
                <div className="xmas-room-body">
                  <div className="xmas-room-head">
                    <b>{r.name}</b>
                    <span>{r.region}</span>
                  </div>
                  <p>{r.blurb}</p>
                  <div className="xmas-room-meter" role="progressbar" aria-valuemin={0} aria-valuemax={ROOM_CAPACITY} aria-valuenow={n}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="xmas-room-foot">
                    <small>{counts ? `${n}/${ROOM_CAPACITY} คนในห้อง` : "กำลังโหลด…"}</small>
                    {full ? <em>เต็มแล้ว</em> : r.id === quietest ? <em className="is-hot">ว่างที่สุด</em> : <span className="xmas-enter">เข้าห้อง →</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <h2 className="xmas-picker-h">ทุกจังหวัด · {ROOMS.length} ห้อง</h2>
        <div className="xmas-prov-tools">
          <input className="xmas-prov-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาจังหวัด เช่น น่าน" aria-label="ค้นหาจังหวัด" />
          <div className="xmas-prov-regions" role="radiogroup" aria-label="ภูมิภาค">
            {["all", ...ROOM_REGIONS].map((g) => (
              <button key={g} type="button" role="radio" aria-checked={region === g} className={region === g ? "is-on" : ""} onClick={() => setRegion(g)}>
                {g === "all" ? "ทั้งหมด" : g}
              </button>
            ))}
          </div>
        </div>
        <div className="xmas-prov-grid">
          {all.map((r) => {
            const n = online(r.id);
            const full = n >= ROOM_CAPACITY;
            return (
              <a
                key={r.id}
                href={full ? undefined : `/Christmas?room=${r.id}`}
                onClick={(e) => go(e, r, full)}
                aria-disabled={full}
                className={`xmas-prov ${full ? "is-full" : ""}`}
                style={{ "--sky-top": r.skyTop, "--sky-bottom": r.skyBottom, "--room-accent": r.accent } as React.CSSProperties}
              >
                <span className="xmas-prov-art" aria-hidden>
                  <RoomSkyline kind={r.skyline} />
                </span>
                <span className="xmas-prov-body">
                  <b>{r.name}</b>
                  <small>
                    {r.region}
                    <span className="xmas-prov-scene"> · {SCENE_LABEL[r.skyline]}</span>
                  </small>
                </span>
                <span className={`xmas-prov-online ${n > 0 ? "is-live" : ""}`}>{full ? "เต็ม" : `${n} คน`}</span>
              </a>
            );
          })}
          {all.length === 0 && <p className="xmas-picker-note">ไม่พบจังหวัดที่ค้นหา</p>}
        </div>
      </div>
    </main>
  );
}

const SCENE_LABEL: Record<string, string> = { city: "ไฟเมือง", hills: "ดอยในหมอก", rice: "ทุ่งนา", sea: "ทะเล", ancient: "เมืองเก่า" };
