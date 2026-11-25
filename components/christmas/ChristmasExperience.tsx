"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ChristmasState, Ornament, OrnamentColor, OrnamentShape, ShowEvent } from "@/lib/christmas/types";
import { ORNAMENT_COLORS, ORNAMENT_SHAPES } from "@/lib/christmas/types";
import type { Preview, TreeSceneHandle } from "./TreeScene";
import { getRoom, type RoomTheme } from "@/lib/christmas/rooms";
import { useRouter } from "next/navigation";
import { RoomSkyline } from "./RoomSkyline";
import { Backdrop } from "./Crowd";
import DonateModal from "./DonateModal";
import { DecorInfoCard, DecorModal, InviteModal } from "./SocialModals";
import { getClientId } from "./clientId";
import { Icon } from "./Icon";
import { isMusicPlaying, startMusic, stopMusic } from "./music";
import { OrnamentPreview } from "./OrnamentPreview";
import { useDecor } from "./useDecor";
import { markInternalNav } from "./skipIntro";
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
  // เมื่อเลือกคำอวยพร กล้องจะเคลื่อนไปที่ลูกบอลนั้นแบบมุมมองบุคคลที่หนึ่ง
  useEffect(() => {
    treeRef.current?.focusOrnament(focus?.id ?? null);
  }, [focus]);
  const [pick, setPick] = useState<{ height: number; angle: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false); // แผงรายการบนมือถือ
  const [local, setLocal] = useState<Ornament[]>([]);
  const [donateOpen, setDonateOpen] = useState(false);
  // นับถอยหลังถึงวันคริสต์มาส (เวลาท้องถิ่นของผู้ใช้) คำนวณหลังโหลดเพื่อไม่ให้ต่างกันตอน SSR
  const [xmasDays, setXmasDays] = useState<number | null>(null);
  useEffect(() => {
    const now = new Date();
    const y = now.getMonth() === 11 && now.getDate() > 26 ? now.getFullYear() + 1 : now.getFullYear();
    const target = new Date(y, 11, 25).getTime();
    setXmasDays(Math.ceil((target - now.getTime()) / 86400000));
  }, []);
  // เปิด/ปิดหิมะตก จำค่าไว้ในเบราว์เซอร์ของผู้ใช้ (ถ้าเข้าไม่ได้ก็ใช้ค่าเริ่มต้น)
  const [snowOn, setSnowOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("xmas-snow") === "off") setSnowOn(false);
    } catch {
      /* ไม่มีที่เก็บค่า ใช้ค่าเริ่มต้น */
    }
  }, []);
  // เพลงคลอ: เปิดไว้เป็นค่าเริ่มต้น แต่เบราว์เซอร์จะเล่นเสียงได้เมื่อผู้ใช้แตะหน้าจอครั้งแรก
  const [musicOn, setMusicOn] = useState(false);
  useEffect(() => {
    let wantMusic = true;
    try {
      wantMusic = localStorage.getItem("xmas-music") !== "off";
    } catch {
      /* ไม่มีที่เก็บค่า ใช้ค่าเริ่มต้น */
    }
    if (!wantMusic) return;
    const start = () => {
      if (isMusicPlaying()) return;
      startMusic();
      setMusicOn(true);
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);
  function toggleMusic() {
    const next = !isMusicPlaying();
    if (next) startMusic();
    else stopMusic();
    setMusicOn(next);
    try {
      localStorage.setItem("xmas-music", next ? "on" : "off");
    } catch {
      /* ไม่มีที่เก็บค่า */
    }
  }
  function toggleSnow() {
    setSnowOn((v) => {
      const next = !v;
      try {
        localStorage.setItem("xmas-snow", next ? "on" : "off");
      } catch {
        /* ไม่มีที่เก็บค่า */
      }
      return next;
    });
  }
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
  const { decor, refresh: refreshDecor, loaded: decorLoaded } = useDecor(roomId);
  // ตุ๊กตาหิมะที่เพิ่งมาถึงห้อง (ของคนอื่นหรือของเราเอง) จะมีแสงและแจ้งเตือนให้ทุกคนเห็น
  const seenDecor = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!decorLoaded) return;
    if (seenDecor.current === null) {
      seenDecor.current = new Set(decor.map((d) => d.id));
      return;
    }
    const fresh = decor.filter((d) => !seenDecor.current!.has(d.id));
    if (fresh.length === 0) return;
    fresh.forEach((d) => seenDecor.current!.add(d.id));
    fresh.slice(0, 3).forEach((d) => treeRef.current?.highlightDecor(d.slot));
    notifyRef.current(
      "ok",
      fresh.length === 1 ? `${fresh[0].name} วางตุ๊กตาหิมะที่ช่อง ${fresh[0].slot + 1} แล้ว` : `มีตุ๊กตาหิมะใหม่ ${fresh.length} ตัวในห้องนี้`,
    );
  }, [decor, decorLoaded]);
  const [decorSlot, setDecorSlot] = useState<number | null>(null);
  const [markerSlot, setMarkerSlot] = useState<number | null>(null);
  const [coach, setCoach] = useState(false); // คำแนะนำครั้งแรกใต้เมนู
  const [coachStep, setCoachStep] = useState(0);
  useEffect(() => {
    try {
      if (!localStorage.getItem("xmas-coach-v1")) setCoach(true);
    } catch {
      /* ไม่เป็นไร */
    }
  }, []);
  const dismissCoach = () => {
    setCoach(false);
    try {
      localStorage.setItem("xmas-coach-v1", "1");
    } catch {
      /* ไม่เป็นไร */
    }
  };
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
          markInternalNav();
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
    treeRef.current?.skyMessage(ev.text, ev.by, ev.color, ev.theme ?? "fireworks");
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
  const [wishTab, setWishTab] = useState<"color" | "shape" | "text">("color");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // รูปทรงที่แขวนไปแล้วในรอบนี้ (รีเฟรชหน้าเพื่อเริ่มรอบใหม่) รูปทรงละ 1 ครั้ง
  const [usedShapes, setUsedShapes] = useState<OrnamentShape[]>([]);
  const shapesLeft = ORNAMENT_SHAPES.filter((s) => !usedShapes.includes(s));
  const allShapesUsed = shapesLeft.length === 0;

  const previewData: Preview = pick ? { ...pick, color: form.color, shape: form.shape } : null;

  async function hang(e: FormEvent) {
    e.preventDefault();
    if (allShapesUsed) {
      setMessage({ kind: "err", text: "แขวนครบทุกรูปทรงในรอบนี้แล้ว รีเฟรชหน้าเพื่อเริ่มรอบใหม่" });
      return;
    }
    if (usedShapes.includes(form.shape)) {
      setWishTab("shape");
      setMessage({ kind: "err", text: `รูปทรง${SHAPE_LABEL[form.shape]}ใช้ไปแล้ว เลือกรูปทรงอื่น` });
      return;
    }
    if (!form.name.trim()) {
      setWishTab("text");
      setMessage({ kind: "err", text: "กรุณาใส่ชื่อที่จะแสดงบนลูกบอล" });
      return;
    }
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
      const nextUsed = [...usedShapes, form.shape];
      setUsedShapes(nextUsed);
      setPick(null);
      // เลื่อนไปรูปทรงที่ยังเหลือ เพื่อให้แขวนรอบถัดไปได้ทันที
      setForm((f) => ({ ...f, wish: "", shape: ORNAMENT_SHAPES.find((s) => !nextUsed.includes(s)) ?? f.shape }));
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
      <Backdrop />

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
          giant={state?.giant ? { name: state.giant.name, message: state.giant.message, spot: state.giant.spot ?? 0 } : null}
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
          snowing={snowOn}
          crowd={{ count: online?.count ?? 0, seed: room.id }}
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
          onPreview={(p) => {
            setDonateOpen(false);
            treeRef.current?.previewGiant(p.spot, p.name, p.message || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส");
            treeRef.current?.skyMessage(p.message || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส", p.name, "gold", p.theme);
          }}
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
              <span className="xmas-region">{room.region}</span>
              {xmasDays !== null && (
                <span className="xmas-countdown">{xmasDays > 0 ? ` · อีก ${xmasDays} วันถึงคริสต์มาส` : xmasDays === 0 ? " · สุขสันต์วันคริสต์มาส" : ""}</span>
              )}{" "}
              ·{" "}
              <a href="/Christmas?pick=1" className="xmas-switch-link" onClick={() => markInternalNav()}>
                เปลี่ยนห้อง
              </a>
            </small>
          </div>
        </div>
        <div className="xmas-top-right">
          <div className={`xmas-live ${loadError ? "is-off" : ""}`} aria-live="polite">
            <span className="xmas-live-dot" />
            {loadError ? "กำลังเชื่อมต่อใหม่…" : null}
            {online && (
              <span className="xmas-online">
                {online.count}/{online.capacity} คน
              </span>
            )}
          </div>
          <button type="button" className={`xmas-music-toggle ${musicOn ? "is-on" : ""}`} aria-pressed={musicOn} aria-label={musicOn ? "ปิดเพลงคลอ" : "เปิดเพลงคลอ"} onClick={toggleMusic}>
            <Icon name="music" size={15} />
            <span className="xmas-music-bars" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </button>
          <button type="button" className={`xmas-snow-toggle ${snowOn ? "is-on" : ""}`} role="switch" aria-checked={snowOn} aria-label="หิมะตก" onClick={toggleSnow}>
            <span className="xmas-snow-track" aria-hidden>
              <span className="xmas-snow-knob">
                <Icon name="snow" size={13} />
              </span>
            </span>
            <span className="xmas-snow-label">หิมะ</span>
          </button>
          <button type="button" className="xmas-switch is-donate" onClick={() => setDonateOpen(true)}>
            สนับสนุน
          </button>
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
          <Icon name="bauble" size={18} /> แขวนคำอวยพร
        </button>
        <button className="xmas-action" data-tip="สร้างตุ๊กตาหิมะแล้ววางรอบต้น" onClick={() => setDecorOpen(true)}>
          <Icon name="snowman" size={18} /> ตกแต่งตุ๊กตาหิมะ
        </button>
        <button className="xmas-action" onClick={() => setInviteOpen(true)}>
          <Icon name="users" size={18} /> ชวนเพื่อน
        </button>
        <button className="xmas-action is-exclusive" onClick={() => setDonateOpen(true)}>
          <Icon name="crown" size={18} /> Exclusive
        </button>
        <button className="xmas-action is-donate-phone xmas-action-phone" onClick={() => setDonateOpen(true)}>
          <Icon name="sparkle" size={18} /> สนับสนุน
        </button>
        <button className="xmas-action xmas-action-mobile" onClick={() => {
          setFeedOpen(true);
          setSheetOpen(false);
        }}>
          <Icon name="heart" size={18} /> ประวัติล่าสุด
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

      {coach && (
        <div className="xmas-coach" role="note">
          <div className="xmas-coach-step">
            <span>{coachStep + 1}/2</span>
            <button type="button" className="xmas-coach-x" onClick={dismissCoach} aria-label="ปิดคำแนะนำ">
              <Icon name="close" size={14} />
            </button>
          </div>
          {coachStep === 0 ? (
            <>
              <b>เริ่มจาก "แขวนคำอวยพร"</b>
              <span>เลือกสีและรูปทรงลูกบอล เขียนคำอวยพร แล้วแตะที่ต้นคริสต์มาสเพื่อเลือกตำแหน่งแขวน</span>
            </>
          ) : (
            <>
              <b>ตกแต่งตุ๊กตาหิมะ และกดถูกใจ</b>
              <span>สร้างตุ๊กตาหิมะของคุณแล้ววางรอบต้น แตะตุ๊กตาของคนอื่นเพื่อดูว่าใครวาง และกดถูกใจได้</span>
            </>
          )}
          <button type="button" className="xmas-coach-next" onClick={() => (coachStep === 0 ? setCoachStep(1) : dismissCoach())}>
            {coachStep === 0 ? "ถัดไป" : "เข้าใจแล้ว"}
          </button>
        </div>
      )}

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
          onPickOnMap={() => {
            setDecorOpen(false);
            notify("ok", "แตะพื้นหิมะบนฉากเพื่อเลือกช่อง");
          }}
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

      {/* ปุ่มซูมบนฉาก: ซูมเข้า ออก และกลับมุมมองเริ่มต้น (มือถือกดหรือบีบนิ้วได้ คอมใช้ลูกล้อเมาส์) */}
      <div className="xmas-zoom" role="group" aria-label="ซูมภาพ">
        <button type="button" onClick={() => treeRef.current?.zoomBy(0.8)} aria-label="ซูมเข้า">
          <Icon name="plus" size={18} />
        </button>
        <button type="button" onClick={() => treeRef.current?.zoomBy(1.25)} aria-label="ซูมออก">
          <Icon name="minus" size={18} />
        </button>
        <button type="button" onClick={() => treeRef.current?.resetView()} aria-label="กลับมุมมองเริ่มต้น">
          <Icon name="reset" size={17} />
        </button>
      </div>

      {/* การ์ดคำอวยพรของลูกบอลที่คลิก กล้องจะเลื่อนไปดูลูกบอลนั้นใกล้ ๆ */}
      {focus && (
        <div className="xmas-focus glass" role="dialog" aria-label="คำอวยพร">
          <button className="xmas-x" onClick={() => setFocus(null)} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
          <span className="xmas-focus-tag">
            <span className="xmas-chip" style={{ background: COLOR_CSS[focus.color] }} />
            {SHAPE_LABEL[focus.shape]} · {COLOR_LABEL[focus.color]}
          </span>
          <b>{focus.name}</b>
          <blockquote className="xmas-focus-wish">{focus.wish || "ขอให้มีความสุขในวันคริสต์มาส"}</blockquote>
          <div className="xmas-focus-foot">
            <small>แขวนเมื่อ {new Date(focus.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</small>
            <button type="button" className="xmas-chip-btn" onClick={() => setFocus(null)}>
              กลับมุมมองเดิม
            </button>
          </div>
        </div>
      )}

      {/* แผงแขวนลูกบอล */}
      <section key={panelPulse} className={`xmas-panel glass xmas-wish ${sheetOpen ? "is-open" : ""} ${panelPulse ? "is-pulse" : ""}`} aria-label="แขวนคำอวยพร" onPointerDown={() => setHintOn(true)}>
        <button className="xmas-sheet-toggle" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}>
          {sheetOpen ? "ปิดแผง" : "แขวนคำอวยพรของคุณ"}
        </button>
        <form onSubmit={hang} className="xmas-form xmas-wish-form">
          <div className="xmas-build-top">
            <button type="button" className="xmas-form-close" onClick={() => setSheetOpen(false)} aria-label="ปิดแผงแขวนคำอวยพร">
              <Icon name="close" size={18} />
            </button>
            <p className="xmas-kicker">แขวนคำอวยพร</p>
            <div className="xmas-build-preview xmas-ornament-preview">
              <OrnamentPreview color={form.color} shape={form.shape} />
            </div>
            <p className={`xmas-build-slot ${pick ? "is-set" : ""}`}>
              {pick ? `เลือกตำแหน่งแล้ว · ความสูง ${Math.round(pick.height * 100)}%` : "แตะที่ต้นคริสต์มาสเพื่อเลือกตำแหน่ง"}
            </p>
          </div>

          <div className="xmas-part-tabs" role="tablist" aria-label="หมวดลูกบอล">
            {(
              [
                ["color", "สีลูกบอล"],
                ["shape", "รูปทรง"],
                ["text", "ข้อความ"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={wishTab === id} className={wishTab === id ? "is-on" : ""} onClick={() => setWishTab(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="xmas-part-body" role="tabpanel">
            {wishTab === "color" && (
              <>
                <p className="xmas-part-title">สีลูกบอล</p>
                <div className="xmas-part-grid">
                  {ORNAMENT_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={form.color === c ? "is-on" : ""}
                      aria-pressed={form.color === c}
                      onClick={() => setForm({ ...form, color: c })}
                    >
                      <span className="xmas-dot" style={{ background: COLOR_CSS[c] }} aria-hidden />
                      {COLOR_LABEL[c]}
                    </button>
                  ))}
                </div>
              </>
            )}

            {wishTab === "shape" && (
              <>
                <p className="xmas-part-title">
                  รูปทรง <em className="xmas-part-hint">เหลือ {shapesLeft.length}/{ORNAMENT_SHAPES.length} รูปทรง</em>
                </p>
                <div className="xmas-part-grid">
                  {ORNAMENT_SHAPES.map((sh) => {
                    const used = usedShapes.includes(sh);
                    return (
                      <button
                        type="button"
                        key={sh}
                        disabled={used}
                        className={`${form.shape === sh && !used ? "is-on" : ""} ${used ? "is-used" : ""}`}
                        aria-pressed={form.shape === sh}
                        onClick={() => setForm({ ...form, shape: sh })}
                      >
                        {SHAPE_LABEL[sh]}
                        {used && <small>ใช้แล้ว</small>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {wishTab === "text" && (
              <div className="xmas-wish-text">
                <label className="xmas-field">
                  <span className="xmas-field-label">ชื่อที่จะแสดงบนลูกบอล</span>
                  <input value={form.name} maxLength={20} required onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ฟ้า" autoComplete="nickname" />
                </label>
                <label className="xmas-field">
                  <span className="xmas-field-label">
                    คำอวยพร <em>{form.wish.length}/140</em>
                  </span>
                  <textarea value={form.wish} maxLength={140} rows={4} onChange={(e) => setForm({ ...form, wish: e.target.value })} placeholder="ขอให้ปีนี้…" />
                </label>
                <button
                  type="button"
                  className="xmas-preview-btn"
                  onClick={() =>
                    setFocus({ id: "preview", name: form.name.trim() || "ชื่อของคุณ", wish: form.wish.trim(), color: form.color, shape: form.shape, height: 0.5, angle: 0, createdAt: Date.now() })
                  }
                >
                  ดูตัวอย่างการ์ดคำอวยพร
                </button>
              </div>
            )}
          </div>

          <div className="xmas-build-foot">
            {message && <p className={`xmas-msg ${message.kind}`}>{message.text}</p>}
            <button className="xmas-submit" disabled={submitting || allShapesUsed}>
              {submitting ? "กำลังแขวน…" : allShapesUsed ? "แขวนครบทุกรูปทรงแล้ว" : pick ? "แขวนลูกบอลบนต้น" : "เลือกตำแหน่งก่อนแขวน"}
            </button>
          </div>
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
