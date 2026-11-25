"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ChristmasState, Ornament, OrnamentColor, OrnamentShape, ShowEvent } from "@/lib/christmas/types";
import { ORNAMENT_COLORS, ORNAMENT_SHAPES } from "@/lib/christmas/types";
import type { Preview, TreeSceneHandle } from "./TreeScene";
import { getRoom, type RoomTheme } from "@/lib/christmas/rooms";
import { useRouter } from "next/navigation";
import { RoomSkyline } from "./RoomSkyline";
import DonateModal from "./DonateModal";
import { DecorInfoCard, DecorModal, InviteModal } from "./SocialModals";
import { getClientId } from "./clientId";
import { Icon } from "./Icon";
import { useDecor } from "./useDecor";
import { FeedPanel, Ticker, useFeed } from "./FeedPanel";
import type { Decor } from "@/lib/christmas/decor";
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

export default function ChristmasExperience({ roomId }: { roomId: string }) {
  const room = getRoom(roomId) as RoomTheme;
  const router = useRouter();
  const [online, setOnline] = useState<{ count: number; capacity: number } | null>(null);
  const serverNow = useServerClock();

  // จำห้องที่เข้าไว้ เพื่อพากลับมาห้องเดิมเมื่อเปิดหน้าใหม่
  useEffect(() => {
    document.cookie = `xmas_room=${roomId}; path=/; max-age=31536000; SameSite=Lax`;
  }, [roomId]);
  const [state, setState] = useState<ChristmasState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [banner, setBanner] = useState<{ id: string; text: string; by: string; color: OrnamentColor } | null>(null);
  const [focus, setFocus] = useState<Ornament | null>(null);
  const [pick, setPick] = useState<{ height: number; angle: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false); // แผงรายการบนมือถือ
  const [local, setLocal] = useState<Ornament[]>([]);
  const [donateOpen, setDonateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [decorOpen, setDecorOpen] = useState(false);
  const [decorFocus, setDecorFocus] = useState<Decor | null>(null);
  const [panelPulse, setPanelPulse] = useState(0);
  const [hintOn, setHintOn] = useState(true);
  const prevOnline = useRef<number | null>(null);
  const [intro, setIntro] = useState(true); // ป๊อปอัปเชิญก่อนเข้าต้นไม้
  const [toast, setToast] = useState<{ id: number; kind: "ok" | "err"; text: string } | null>(null); // ลูกบอลที่เพิ่งแขวนจากเครื่องนี้ แสดงทันทีก่อนเซิร์ฟเวอร์ตอบ

  const treeRef = useRef<TreeSceneHandle | null>(null);
  const feed = useFeed(roomId);
  const { decor, refresh: refreshDecor } = useDecor(roomId);
  const [decorSlot, setDecorSlot] = useState<number | null>(null);
  const [markerSlot, setMarkerSlot] = useState<number | null>(null);
  const played = useRef(new Set<string>());

  // ---------- โหลดสถานะกลางเป็นระยะ ----------
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/api/christmas/state?room=${roomId}`, { cache: "no-store" });
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

  // ---------- แจ้งว่ายังอยู่ในห้อง และรับจำนวนคนออนไลน์ ----------
  useEffect(() => {
    let clientId = "";
    try {
      clientId = localStorage.getItem("xmas-client") ?? "";
      if (!clientId) {
        clientId = crypto.randomUUID();
        localStorage.setItem("xmas-client", clientId);
      }
    } catch {
      clientId = crypto.randomUUID();
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function beat() {
      try {
        const res = await fetch("/api/christmas/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: roomId, clientId }),
        });
        const data = (await res.json()) as { full?: boolean; count?: number; capacity?: number };
        if (data.full) {
          // ห้องเต็ม ส่งไปเลือกห้องอื่น
          router.replace(`/Christmas?full=${roomId}`);
          return;
        }
        if (typeof data.count === "number") {
          // เพื่อนเข้าห้องเพิ่ม: แจ้งเตือนเมื่อจำนวนคนเพิ่มขึ้น (ไม่แจ้งตอนโหลดครั้งแรก)
          if (prevOnline.current !== null && data.count > prevOnline.current) {
            const diff = data.count - prevOnline.current;
            notifyRef.current("ok", diff === 1 ? "มีเพื่อนเข้าห้องเพิ่ม 1 คน" : `มีเพื่อนเข้าห้องเพิ่ม ${diff} คน`);
          }
          prevOnline.current = data.count;
          setOnline({ count: data.count, capacity: data.capacity ?? 150 });
        }
      } catch {
        /* ลองใหม่รอบถัดไป */
      } finally {
        if (!stopped) timer = setTimeout(beat, 20000);
      }
    }
    beat();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [roomId, router]);

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
    treeRef.current?.skyMessage(ev.text, ev.by, ev.color);
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
        body: JSON.stringify({ ...form, ...pick, room: roomId }),
      });
      const data = (await res.json()) as { error?: string; ornament?: Ornament };
      if (!res.ok || !data.ornament) throw new Error(data.error ?? "แขวนไม่สำเร็จ");
      setLocal((l) => [data.ornament!, ...l].slice(0, 20));
      notify("ok", "แขวนคำอวยพรของคุณบนต้นแล้ว");
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
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  return (
    <div
      className={`xmas-stage ${intro ? "" : "is-ready"}`}
      style={{ "--sky-top": room.skyTop, "--sky-bottom": room.skyBottom, "--room-accent": room.accent } as CSSProperties}
    >
      {/* พื้นหลังท้องฟ้าค่ำและดาว */}
      <div className="xmas-sky" aria-hidden />
      <RoomSkyline kind={room.skyline} />

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
          ground={room.ground}
          giant={state?.giant ? { name: state.giant.name, message: state.giant.message } : null}
          decor={decor}
          markerSlot={markerSlot}
          onGroundPick={(slot) => {
            setMarkerSlot(slot);
            setDecorSlot(slot);
            setDecorOpen(true);
          }}
          onDecorClick={(d) => {
            setDecorFocus(d);
            setFocus(null);
          }}
          key={room.id}
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

      {donateOpen && (
        <DonateModal
          roomId={room.id}
          roomName={room.name}
          onClose={() => setDonateOpen(false)}
          onPaid={(name) => notify("ok", `ขอบคุณ ${name} ตุ๊กตาหิมะยักษ์ขึ้นป้ายแล้ว`)}
        />
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
            <Icon name="star" size={20} />
          </span>
          <div>
            <b>ต้นคริสต์มาส{room.name}</b>
            <small>
              {room.region} · ห้องคริสต์มาส
            </small>
          </div>
        </div>
        <div className="xmas-top-right">
          <div className={`xmas-live ${loadError ? "is-off" : ""}`} aria-live="polite">
            <span className="xmas-live-dot" />
            {loadError ? "กำลังเชื่อมต่อใหม่…" : "สด"}
            {online && <span className="xmas-online">{online.count}/{online.capacity} คน</span>}
          </div>
          <a className="xmas-switch" href="/Christmas?pick=1">
            เปลี่ยนห้อง
          </a>
        </div>
      </header>

      {/* เมนูหลัก: แขวน ตกแต่ง ชวนเพื่อน และสนับสนุน (ตุ๊กตาหิมะยักษ์) */}
      <nav className="xmas-actions" aria-label="เมนูกิจกรรม">
        <button
          className="xmas-action"
          onClick={() => {
            setSheetOpen(true);
            setFeedOpen(false);
            setPanelPulse((n) => n + 1);
            setHintOn(true);
          }}
        >
          <Icon name="tree" size={18} /> แขวนคำอวยพร
        </button>
        <button className="xmas-action xmas-action-mobile" onClick={() => {
          setFeedOpen(true);
          setSheetOpen(false);
        }}>
          <Icon name="heart" size={18} /> รายการ
        </button>
        <button className="xmas-action" onClick={() => setDecorOpen(true)}>
          <Icon name="snowman" size={18} /> ตกแต่งตุ๊กตาหิมะ
        </button>
        <button className="xmas-action" onClick={() => setInviteOpen(true)}>
          <Icon name="users" size={18} /> ชวนเพื่อน
        </button>
        <button className="xmas-action is-exclusive" onClick={() => setDonateOpen(true)}>
          <Icon name="sparkle" size={18} /> ตุ๊กตาหิมะยักษ์
        </button>
      </nav>

      {/* แถบข้อความวิ่งด้านบน */}
      <Ticker
        items={[
          ...ornaments.slice(0, 10).map((o) => ({ key: `w-${o.id}`, text: `${o.name}: ${o.wish || "ขอให้มีความสุขในวันคริสต์มาส"}` })),
          ...feed.exclusive.slice(0, 6).map((e) => ({ key: `e-${e.id}`, text: `Exclusive ${e.name}: ${e.message || "ตุ๊กตาหิมะยักษ์"}`, exclusive: true })),
          ...(ornaments.length === 0 && feed.exclusive.length === 0
            ? [{ key: "welcome", text: "ยินดีต้อนรับสู่ต้นคริสต์มาส แขวนคำอวยพรของคุณเป็นคนแรกได้เลย" }]
            : []),
        ]}
      />

      {/* ป้ายบอกให้แตะต้นไม้เพื่อเลือกตำแหน่ง */}
      {hintOn && !pick && (
        <div className="xmas-tap-hint" role="status" onClick={() => setHintOn(false)}>
          <span className="xmas-tap-ring" aria-hidden />
          แตะที่ต้นคริสต์มาสเพื่อเลือกตำแหน่ง
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          roomId={room.id}
          roomName={room.name}
          online={online?.count ?? 0}
          capacity={online?.capacity ?? 150}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {decorOpen && (
        <DecorModal
          roomId={room.id}
          roomName={room.name}
          decor={decor}
          initialSlot={decorSlot}
          onClose={() => {
            setDecorOpen(false);
            setMarkerSlot(null);
          }}
          onPlaced={(d) => {
            setDecorOpen(false);
            setMarkerSlot(null);
            refreshDecor();
            notify("ok", `วางตุ๊กตาหิมะของ ${d.name} รอบต้นแล้ว`);
          }}
        />
      )}

      {decorFocus && (
        <DecorInfoCard
          d={decorFocus}
          onClose={() => setDecorFocus(null)}
          onLiked={(id, likes) => {
            setDecorFocus((f) => (f && f.id === id ? { ...f, likes } : f));
            refreshDecor();
          }}
        />
      )}

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
            <Icon name="close" size={18} />
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
      <section key={panelPulse} className={`xmas-panel glass xmas-wish ${sheetOpen ? "is-open" : ""} ${panelPulse ? "is-pulse" : ""}`} aria-label="แขวนคำอวยพร" onPointerDown={() => setHintOn(true)}>
        <button className="xmas-sheet-toggle" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}>
          {sheetOpen ? "ปิดแผง" : "แขวนคำอวยพรของคุณ"}
        </button>
        <form onSubmit={hang} className="xmas-form">
          <header className="xmas-form-head">
            <button type="button" className="xmas-form-close" onClick={() => setSheetOpen(false)} aria-label="ปิดแผงแขวนคำอวยพร">
              <Icon name="close" size={18} />
            </button>
            <div className="xmas-form-title">
              <span className="xmas-form-icon" aria-hidden>
                <Icon name="tree" size={22} />
              </span>
              <div>
                <h2>แขวนคำอวยพร</h2>
                <p>ลูกบอลของคุณจะปรากฏบนต้นให้ทุกคนเห็น</p>
              </div>
            </div>
            <ol className="xmas-steps" aria-label="ขั้นตอน">
              <li className={pick ? "is-done" : "is-now"}>
                <span>1</span> ตำแหน่ง
              </li>
              <li className={form.name.trim() ? "is-done" : pick ? "is-now" : ""}>
                <span>2</span> ข้อความ
              </li>
              <li className={submitting ? "is-now" : ""}>
                <span>3</span> แขวน
              </li>
            </ol>
          </header>

          <div className={`xmas-place ${pick ? "is-set" : ""}`} role="status">
            <span className="xmas-place-dot" style={{ background: COLOR_CSS[form.color] }} aria-hidden />
            {pick ? (
              <span className="xmas-place-text">
                <b>เลือกตำแหน่งแล้ว</b>
                <small>ความสูง {Math.round(pick.height * 100)}% · ตามแนวรอบต้น</small>
              </span>
            ) : (
              <span className="xmas-place-text">
                <b>ยังไม่ได้เลือกตำแหน่ง</b>
                <small>แตะที่ต้นคริสต์มาสบนฉาก เพื่อเลือกว่าจะแขวนตรงไหน</small>
              </span>
            )}
            {pick && (
              <button type="button" className="xmas-place-clear" onClick={() => setPick(null)}>
                เปลี่ยน
              </button>
            )}
          </div>

          <label className="xmas-field">
            <span className="xmas-field-label">ชื่อเล่น</span>
            <input value={form.name} maxLength={20} required onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ฟ้า" autoComplete="nickname" />
          </label>
          <label className="xmas-field">
            <span className="xmas-field-label">
              คำอวยพร <em>{form.wish.length}/140</em>
            </span>
            <textarea value={form.wish} maxLength={140} rows={3} onChange={(e) => setForm({ ...form, wish: e.target.value })} placeholder="ขอให้ปีนี้…" />
          </label>

          <fieldset className="xmas-group">
            <legend>สีลูกบอล</legend>
            <div className="xmas-swatches">
              {ORNAMENT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={form.color === c ? "is-on" : ""}
                  style={{ "--sw": COLOR_CSS[c] } as CSSProperties}
                  aria-label={COLOR_LABEL[c]}
                  aria-pressed={form.color === c}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="xmas-group">
            <legend>รูปทรง</legend>
            <div className="xmas-shape-grid">
              {ORNAMENT_SHAPES.map((s) => (
                <button type="button" key={s} className={form.shape === s ? "is-on" : ""} aria-pressed={form.shape === s} onClick={() => setForm({ ...form, shape: s })}>
                  {SHAPE_LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>

          <button className="xmas-submit" disabled={submitting}>
            {submitting ? "กำลังแขวน…" : pick ? "แขวนลูกบอลบนต้น" : "เลือกตำแหน่งก่อนแขวน"}
          </button>
          {message && <p className={`xmas-msg ${message.kind}`}>{message.text}</p>}
        </form>
      </section>

      {/* แผงแท็บ: คำอวยพร / Exclusive / สนับสนุนทีม */}
      <FeedPanel
        wishes={ornaments}
        feed={feed}
        onWishClick={(o) => setFocus(o)}
        mobileOpen={feedOpen}
        onMobileClose={() => setFeedOpen(false)}
      />
    </div>
  );
}
