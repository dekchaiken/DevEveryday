"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ChristmasState, Ornament, OrnamentColor, OrnamentShape, ShowEvent } from "@/lib/christmas/types";
import { ORNAMENT_COLORS, ORNAMENT_SHAPES } from "@/lib/christmas/types";
import type { Preview, TreeSceneHandle } from "./TreeScene";
import "./christmas.css";

// Three.js โหลดเฉพาะฝั่งเบราว์เซอร์ ไม่ให้กระทบเวลาเปิดหน้าแรก
const TreeScene = dynamic(() => import("./TreeScene").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="xmas-loading">กำลังจุดไฟต้นคริสต์มาส…</div>,
});

const POLL_MS = 3000;
const COLOR_LABEL: Record<OrnamentColor, string> = { gold: "ทอง", red: "แดง", blue: "น้ำเงิน", pink: "ชมพู", white: "ขาว", green: "เขียว" };
const SHAPE_LABEL: Record<OrnamentShape, string> = { ball: "ลูกบอล", star: "ดาว", bell: "ระฆัง", gift: "ของขวัญ" };
const COLOR_CSS: Record<OrnamentColor, string> = { gold: "#f5c542", red: "#dc2643", blue: "#3b82f6", pink: "#f472b6", white: "#f8fafc", green: "#22c55e" };

// ---------- นาฬิกากลาง: แปลงเวลาเครื่องให้ตรงกับเวลาเซิร์ฟเวอร์ ----------
function useServerClock() {
  const offset = useRef(0);
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      let best: { rtt: number; off: number } | null = null;
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        try {
          const res = await fetch("/api/christmas/time", { cache: "no-store" });
          const { now } = (await res.json()) as { now: number };
          const t1 = Date.now();
          const rtt = t1 - t0;
          if (!best || rtt < best.rtt) best = { rtt, off: now - (t0 + t1) / 2 };
        } catch {
          /* ลองใหม่รอบถัดไป */
        }
      }
      if (best && !cancelled) offset.current = best.off;
    }
    sync();
    const id = setInterval(sync, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return useCallback(() => Date.now() + offset.current, []);
}

export default function ChristmasExperience() {
  const serverNow = useServerClock();
  const [state, setState] = useState<ChristmasState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [banner, setBanner] = useState<{ id: string; text: string; by: string; color: OrnamentColor } | null>(null);
  const [focus, setFocus] = useState<Ornament | null>(null);
  const [pick, setPick] = useState<{ height: number; angle: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [local, setLocal] = useState<Ornament[]>([]);
  const [intro, setIntro] = useState(true); // ป๊อปอัปเชิญก่อนเข้าต้นไม้
  const [toast, setToast] = useState<{ id: number; kind: "ok" | "err"; text: string } | null>(null); // ลูกบอลที่เพิ่งแขวนจากเครื่องนี้ แสดงทันทีก่อนเซิร์ฟเวอร์ตอบ

  const treeRef = useRef<TreeSceneHandle | null>(null);
  const played = useRef(new Set<string>());

  // ---------- โหลดสถานะกลางเป็นระยะ ----------
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch("/api/christmas/state", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        setState((await res.json()) as ChristmasState);
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        if (!stopped) timer = setTimeout(poll, document.hidden ? POLL_MS * 4 : POLL_MS);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  // ---------- เล่นคิวพลุและข้อความให้ทุกคนพร้อมกัน ----------
  useEffect(() => {
    const id = setInterval(() => {
      if (!state) return;
      const now = serverNow();
      for (const ev of state.events) {
        if (played.current.has(ev.id)) continue;
        const end = ev.startAt + ev.duration;
        if (now >= end) {
          played.current.add(ev.id); // พลาดคิวไปแล้ว ข้ามไป
          continue;
        }
        if (now < ev.startAt) continue;
        played.current.add(ev.id);
        playEvent(ev);
      }
    }, 200);
    return () => clearInterval(id);
    // playEvent ใช้ ref เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, serverNow]);

  const playEvent = useCallback((ev: ShowEvent) => {
    if (ev.kind === "firework") {
      treeRef.current?.launchFirework(ev.color);
      return;
    }
    setBanner({ id: ev.id, text: ev.text, by: ev.by, color: ev.color });
    setTimeout(() => setBanner((b) => (b?.id === ev.id ? null : b)), Math.max(ev.duration - 400, 2000));
  }, []);

  // ---------- รวมลูกบอลจากเซิร์ฟเวอร์กับที่เพิ่งแขวนเอง ----------
  const ornaments = useMemo(() => {
    const map = new Map<string, Ornament>();
    for (const o of state?.ornaments ?? []) map.set(o.id, o);
    for (const o of local) map.set(o.id, o);
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [state, local]);

  // ---------- ฟอร์มแขวนลูกบอล ----------
  const [form, setForm] = useState<{ name: string; wish: string; color: OrnamentColor; shape: OrnamentShape }>({
    name: "",
    wish: "",
    color: "gold",
    shape: "ball",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const previewData: Preview = pick ? { ...pick, color: form.color, shape: form.shape } : null;

  async function hang(e: FormEvent) {
    e.preventDefault();
    if (!pick) {
      setMessage({ kind: "err", text: "แตะที่ต้นคริสต์มาสเพื่อเลือกตำแหน่งก่อน" });
      notify("err", "แตะที่ต้นคริสต์มาสเพื่อเลือกตำแหน่งก่อน");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/christmas/ornament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...pick }),
      });
      const data = (await res.json()) as { error?: string; ornament?: Ornament };
      if (!res.ok || !data.ornament) throw new Error(data.error ?? "แขวนไม่สำเร็จ");
      setLocal((l) => [data.ornament!, ...l].slice(0, 20));
      notify("ok", "แขวนคำอวยพรของคุณบนต้นแล้ว ✨");
      setPick(null);
      setForm((f) => ({ ...f, wish: "" }));
      setMessage({ kind: "ok", text: "แขวนลูกบอลของคุณแล้ว" });
      setSheetOpen(false);
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" });
      notify("err", err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  const onPick = useCallback((height: number, angle: number) => {
    setPick({ height, angle });
    setFocus(null);
  }, []);

  // แสดงข้อความแจ้งเตือนชั่วคราว
  const notify = useCallback((kind: "ok" | "err", text: string) => {
    const id = Date.now();
    setToast({ id, kind, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2800);
  }, []);

  return (
    <div className={`xmas-stage ${intro ? "" : "is-ready"}`}>
      {/* พื้นหลังท้องฟ้าค่ำและดาว */}
      <div className="xmas-sky" aria-hidden />

      {webglOk ? (
        <TreeScene
          onReady={(h) => {
            treeRef.current = h;
          }}
          ornaments={ornaments}
          preview={previewData}
          reducedMotion={reduced}
          onPick={onPick}
          onOrnamentClick={(o) => setFocus(o)}
          onError={() => setWebglOk(false)}
        />
      ) : (
        <div className="xmas-fallback" role="note">
          เบราว์เซอร์นี้แสดงภาพ 3 มิติไม่ได้ แต่ยังดูคำอวยพรได้ทางด้านขวา
        </div>
      )}

      {/* ป๊อปอัปเชิญเข้าร่วม */}
      {intro && (
        <div className="xmas-intro" role="dialog" aria-modal="true" aria-labelledby="xmas-intro-title">
          <div className="xmas-intro-card">
            <div className="xmas-intro-orb" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="xmas-intro-kicker">คุณได้รับเชิญ</p>
            <h1 id="xmas-intro-title">มาแขวนคำอวยพรบนต้นคริสต์มาสด้วยกัน</h1>
            <p className="xmas-intro-text">เลือกลูกบอล เขียนความปรารถนา แล้วแขวนขึ้นต้น ทุกคนจะได้เห็นพร้อมกัน</p>
            <button className="xmas-intro-btn" onClick={() => setIntro(false)} autoFocus>
              <span>เข้าสู่ต้นคริสต์มาส</span>
            </button>
          </div>
        </div>
      )}

      {/* ข้อความแจ้งเตือนชั่วคราว */}
      {toast && (
        <div key={toast.id} className={`xmas-toast ${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}

      {/* แถบบน */}
      <header className="xmas-top">
        <div className="xmas-brand">
          <span className="xmas-brand-star" aria-hidden>
            ★
          </span>
          <div>
            <b>ต้นคริสต์มาสร่วมกัน</b>
            <small>DevEveryday</small>
          </div>
        </div>
        <div className={`xmas-live ${loadError ? "is-off" : ""}`} aria-live="polite">
          <span className="xmas-live-dot" />
          {loadError ? "กำลังเชื่อมต่อใหม่…" : "สด"}
        </div>
      </header>

      {/* ข้อความที่ถูกส่งขึ้นจอให้ทุกคนเห็น */}
      {banner && (
        <div className="xmas-banner" role="status" key={banner.id} style={{ "--c": COLOR_CSS[banner.color] } as CSSProperties}>
          <span className="xmas-banner-by">จาก {banner.by}</span>
          <p>{banner.text}</p>
        </div>
      )}

      {/* การ์ดคำอวยพรของลูกบอลที่คลิก */}
      {focus && (
        <div className="xmas-focus glass" role="dialog" aria-label="คำอวยพร">
          <button className="xmas-x" onClick={() => setFocus(null)} aria-label="ปิด">
            ×
          </button>
          <span className="xmas-chip" style={{ background: COLOR_CSS[focus.color] }} />
          <b>{focus.name}</b>
          <p>{focus.wish || "ขอให้มีความสุขในวันคริสต์มาส"}</p>
          <small>
            {SHAPE_LABEL[focus.shape]} · {COLOR_LABEL[focus.color]}
          </small>
        </div>
      )}

      {/* แผงแขวนลูกบอล */}
      <section className={`xmas-panel glass ${sheetOpen ? "is-open" : ""}`} aria-label="แขวนลูกบอล">
        <button className="xmas-sheet-toggle" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}>
          {sheetOpen ? "ปิดแผง" : "แขวนลูกบอลของคุณ"}
        </button>
        <form onSubmit={hang} className="xmas-form">
          <h2>แขวนคำอวยพร</h2>
          <p className="xmas-hint">{pick ? "ตำแหน่งที่เลือกแล้ว เติมข้อความแล้วกดแขวนได้เลย" : "แตะที่ต้นคริสต์มาสเพื่อเลือกตำแหน่ง"}</p>

          <label>
            ชื่อเล่น
            <input value={form.name} maxLength={20} required onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ฟ้า" />
          </label>
          <label>
            คำอวยพร
            <textarea value={form.wish} maxLength={140} rows={2} onChange={(e) => setForm({ ...form, wish: e.target.value })} placeholder="ขอให้…" />
          </label>

          <fieldset>
            <legend>สีลูกบอล</legend>
            <div className="xmas-swatches">
              {ORNAMENT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={form.color === c ? "is-on" : ""}
                  style={{ background: COLOR_CSS[c] }}
                  aria-label={COLOR_LABEL[c]}
                  aria-pressed={form.color === c}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>รูปทรง</legend>
            <div className="xmas-shapes">
              {ORNAMENT_SHAPES.map((s) => (
                <button type="button" key={s} className={form.shape === s ? "is-on" : ""} aria-pressed={form.shape === s} onClick={() => setForm({ ...form, shape: s })}>
                  {SHAPE_LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>

          <button className="xmas-submit" disabled={submitting}>
            {submitting ? "กำลังแขวน…" : "แขวนลูกบอล"}
          </button>
          {message && <p className={`xmas-msg ${message.kind}`}>{message.text}</p>}
        </form>
      </section>

      {/* ฟีดคำอวยพรล่าสุด */}
      <aside className="xmas-feed glass" aria-label="คำอวยพรล่าสุด">
        <h2>คำอวยพรล่าสุด</h2>
        <ul>
          {ornaments.slice(0, 40).map((o) => (
            <li key={o.id}>
              <button onClick={() => setFocus(o)}>
                <span className="xmas-chip" style={{ background: COLOR_CSS[o.color] }} />
                <span>
                  <b>{o.name}</b>
                  <em>{o.wish || "ขอให้มีความสุขในวันคริสต์มาส"}</em>
                </span>
              </button>
            </li>
          ))}
          {ornaments.length === 0 && <li className="xmas-empty">ยังไม่มีลูกบอลบนต้น เป็นคนแรกที่แขวนได้เลย</li>}
        </ul>
      </aside>
    </div>
  );
}
