"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ChristmasState, Ornament, OrnamentColor, OrnamentShape, ShowEvent } from "@/lib/christmas/types";
import { ORNAMENT_COLORS, ORNAMENT_SHAPES, TREE_CAPACITY } from "@/lib/christmas/types";
import type { Preview, TreeSceneHandle } from "./TreeScene";
import { getRoom, type RoomTheme } from "@/lib/christmas/rooms";
import { useRouter } from "next/navigation";
import { RoomSkyline } from "./RoomSkyline";
import { Backdrop } from "./Crowd";
import ExclusiveModal, { type DecorDraft } from "./ExclusiveModal";
import SupportModal from "./SupportModal";
import { DecorInfoCard, DecorModal, InviteModal } from "./SocialModals";
import { getClientId } from "./clientId";
import { useBoard } from "./useBoard";
import { RankPanel } from "./RankPanel";
import { Icon } from "./Icon";
import { isMusicPlaying, startMusic, stopMusic } from "./music";
import { useDecor } from "./useDecor";
import { markInternalNav } from "./skipIntro";
import { FeedPanel, Ticker, useFeed } from "./FeedPanel";
import { ShareCardModal } from "./ShareCard";
import { SkyOverlay, type SkyShow } from "./SkyOverlay";
import type { SkyTheme } from "./skyArt";
import { ProfileCard, SocialLinks } from "./ProfileCard";
import { loadProfile, saveProfile, type Profile } from "./profile";
import type { Decor } from "@/lib/christmas/decor";
import type { CardRecord, CardSpec, PropKind } from "@/lib/christmas/cardSpec";
import { CardStudio } from "./CardStudio";
import { CardReveal, WishZone } from "./WishZone";
import { GuideSpotlight } from "./GuideSpotlight";
import { myCardIds, rememberMyCard } from "./myCards";
import { OrnamentPreview } from "./OrnamentPreview";
import { CARDS_PER_PERSON } from "@/lib/christmas/cardSpec";
import { GIANT_POSITIONS, SLOT_POSITIONS, ZONE_CAPACITY } from "@/lib/christmas/slots";
import "./wishcards.css";
import "./christmas.css";
import { PendingOrdersWatch } from "./PendingOrdersWatch";
import { GiantBanner, type GiantInfo } from "./GiantCard";

// คำอธิบายที่ลอยข้างโมเดลเมื่อแตะบ้านหรือตุ๊กตา (กดปุ่มในนั้นจึงจะเปิดป้ายหรือรายละเอียด)
type TipState = { kicker: string; title: string; cta: string; x: number; y: number; z: number; open: () => void; close: () => void };

// Three.js โหลดเฉพาะฝั่งเบราว์เซอร์ ไม่ให้กระทบเวลาเปิดหน้าแรก
const TreeScene = dynamic(() => import("./TreeScene").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="xmas-loading">กำลังจุดไฟต้นคริสต์มาส…</div>,
});

// ประตูเปลี่ยนห้อง: โหลดเฉพาะตอนกด ไม่กระทบเวลาเปิดหน้า
const DoorTransition = dynamic(() => import("./DoorTransition").then((m) => m.default), { ssr: false });

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
  const [giantCard, setGiantCard] = useState<GiantInfo | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // วางคำอธิบายให้ตามตำแหน่งโมเดลบนจอทุกเฟรม (กล้องบินหรือหมุนก็ยังอยู่ข้างโมเดล)
  useEffect(() => {
    if (!tip) return;
    let raf = 0;
    const loop = () => {
      const el = tipRef.current;
      const h = treeRef.current;
      if (el && h) {
        const p = h.project(tip.x, tip.y, tip.z);
        el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, calc(-100% - 14px))`;
        el.style.opacity = p.visible ? "1" : "0";
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [tip]);
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
  const [focus, setFocus] = useState<Ornament | null>(null);
  // เมื่อเลือกคำอวยพร กล้องจะเคลื่อนไปที่ลูกบอลนั้นแบบมุมมองบุคคลที่หนึ่ง
  useEffect(() => {
    treeRef.current?.focusOrnament(focus?.id ?? null);
  }, [focus]);
  const [feedOpen, setFeedOpen] = useState(false); // แผงประวัติล่าสุด (เปิดจากปุ่มมุมขวาหรือแถบเมนู)
  const [rankOpen, setRankOpen] = useState(false); // แผงอันดับถูกใจ
  const [studioOpen, setStudioOpen] = useState(false); // โต๊ะออกแบบการ์ดอวยพร
    const [pick, setPick] = useState<{ height: number; angle: number } | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [panelPulse, setPanelPulse] = useState(0);
  const [chooseOpen, setChooseOpen] = useState(false);
  const [sharedCard, setSharedCard] = useState<CardRecord | null>(null); // การ์ดจากลิงก์แชร์ของเพื่อน
 // เลือกระหว่างการ์ดกับการแขวนลูกบอล
  const [zoneOpen, setZoneOpen] = useState(false); // โซนคำอวยพร
  const [away, setAway] = useState(false); // กล้องอยู่นอกมุมเดิม (ไปดูตุ๊กตาหรือโซน)
  const [zoneReveal, setZoneReveal] = useState<CardRecord | null>(null); // การ์ดที่แตะบนรั้วในฉาก
  const [zoneList, setZoneList] = useState(false); // รายการการ์ดทั้งหมดในโซน
  const [tipX, setTipX] = useState<number | null>(null); // ตำแหน่งแนวนอนของป้ายให้ตรงปุ่มโซนคำอวยพร
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  // รายการในโซนแบบแบ่งหน้า (รองรับการ์ดจำนวนมาก) และจำนวนการ์ดทั้งหมดของห้อง
  const [zoneAll, setZoneAll] = useState<CardRecord[]>([]);
  const [zonePage, setZonePage] = useState(0);
  const [zoneTotal, setZoneTotal] = useState(0);
  const [doorGo, setDoorGo] = useState(false); // กำลังเล่นประตูเปลี่ยนห้อง
  const [mineIds, setMineIds] = useState<Set<string>>(() => new Set()); // การ์ดที่เครื่องนี้ส่ง
  const [zoneStop, setZoneStop] = useState<{ index: number; total: number } | null>(null); // กำแพงที่กำลังชมในหมู่บ้าน
  const [zonePins, setZonePins] = useState<{ id: string; x: number; y: number; visible: boolean; angle: number }[]>([]);
  useEffect(() => {
    setMineIds(myCardIds());
  }, []);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [studioEnter, setStudioEnter] = useState(false); // เล่นแอนิเมชันเข้าโต๊ะ
  const [studioMandatory, setStudioMandatory] = useState(false); // ครั้งแรก: ต้องออกแบบการ์ดก่อน
  const [leavingOnboard, setLeavingOnboard] = useState(false); // หน้าโปรไฟล์กำลังจางออกไปโต๊ะ
  const [local, setLocal] = useState<Ornament[]>([]);
  const [supportOpen, setSupportOpen] = useState(false); // หน้าต่างสนับสนุนทีมงานอย่างเดียว
  const [exclusiveOpen, setExclusiveOpen] = useState(false); // หน้าต่าง Exclusive (ป้ายยักษ์ / ข้อความขึ้นจอ)
  const [skyShow, setSkyShow] = useState<SkyShow | null>(null); // ข้อความขึ้นจอที่กำลังแสดงเหนือต้น
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
  const prevOnline = useRef<number | null>(null);
  // โปรไฟล์ผู้เยี่ยมชม: undefined = ยังอ่านจากเครื่องไม่เสร็จ, null = ยังไม่เคยกรอก
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [profileEdit, setProfileEdit] = useState(false);
  useEffect(() => {
    setProfile(loadProfile());
  }, []);
  const [toast, setToast] = useState<{ id: number; kind: "ok" | "err"; text: string } | null>(null); // ลูกบอลที่เพิ่งแขวนจากเครื่องนี้ แสดงทันทีก่อนเซิร์ฟเวอร์ตอบ

  const treeRef = useRef<TreeSceneHandle | null>(null);
  const feed = useFeed(roomId);
  const { decor, refresh: refreshDecor, loaded: decorLoaded } = useDecor(roomId);
  // อันดับถูกใจของห้อง และการกดถูกใจคำอวยพร (กดได้ครั้งเดียวต่อคนต่อชิ้น)
  const { board, refresh: refreshBoard } = useBoard(roomId);
  const [likedWishes, setLikedWishes] = useState<Set<string>>(new Set());
  async function likeWish(id: string) {
    setLikedWishes((s) => new Set(s).add(id));
    try {
      await fetch("/api/christmas/ornament/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, id, clientId: getClientId() }),
      });
    } catch {
      /* ลองใหม่ภายหลัง */
    }
    refreshBoard();
  }
  // ตุ๊กตาหิมะที่เพิ่งมาถึงห้อง (ของคนอื่นหรือของเราเอง) จะมีแสงและแจ้งเตือนให้ทุกคนเห็น
  const seenDecor = useRef<Set<string> | null>(null);
  // ตุ๊กตาที่ผู้ใช้เพิ่งชำระเงิน: เมื่อขึ้นบนฉากจะพากล้องไปหาและชี้ให้เห็น
  const pendingLocate = useRef<{ kind: "decor" | "giant"; name: string; at: number } | null>(null);
  const seenGiants = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!decorLoaded) return;
    if (seenDecor.current === null) {
      seenDecor.current = new Set(decor.map((d) => d.id));
      return;
    }
    const fresh = decor.filter((d) => !seenDecor.current!.has(d.id));
    fresh.forEach((d) => seenDecor.current!.add(d.id));
    const want = pendingLocate.current;
    if (want?.kind === "decor") {
      const mine = decor
        .filter((d) => d.name === want.name && d.createdAt >= want.at - 120000)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (mine) {
        treeRef.current?.locate({ kind: "decor", slot: mine.slot });
        pendingLocate.current = null;
      }
    }
    if (fresh.length === 0) return;
    fresh.slice(0, 3).forEach((d) => treeRef.current?.highlightDecor(d.slot));
    notifyRef.current(
      "ok",
      fresh.length === 1 ? `${fresh[0].name} วางตุ๊กตาหิมะที่ช่อง ${fresh[0].slot + 1} แล้ว` : `มีตุ๊กตาหิมะใหม่ ${fresh.length} ตัวในห้องนี้`,
    );
  }, [decor, decorLoaded]);
  // ตุ๊กตายักษ์ที่เพิ่งขึ้นป้ายในห้อง: ถ้าเป็นของผู้ใช้ที่เพิ่งชำระ พากล้องไปหา
  useEffect(() => {
    if (!state) return;
    const keyOf = (g: { spot: number; paidAt: number }) => `${g.spot}:${g.paidAt}`;
    if (seenGiants.current === null) {
      seenGiants.current = new Set(state.giants.map(keyOf));
      return;
    }
    const fresh = state.giants.filter((g) => !seenGiants.current!.has(keyOf(g)));
    fresh.forEach((g) => seenGiants.current!.add(keyOf(g)));
    const want = pendingLocate.current;
    if (want?.kind === "giant") {
      const mine = state.giants
        .filter((g) => g.name === want.name && g.paidAt >= want.at - 120000)
        .sort((a, b) => b.paidAt - a.paidAt)[0];
      if (mine) {
        treeRef.current?.locate({ kind: "giant", spot: mine.spot });
        pendingLocate.current = null;
      }
    }
  }, [state]);
  const [decorSlot, setDecorSlot] = useState<number | null>(null);
  const [markerSlot, setMarkerSlot] = useState<number | null>(null);
  // โหมดเลือกช่องวางตุ๊กตาบนฉาก (เปิดจากปุ่ม "บนฉาก" ในหน้าตกแต่ง) และข้อความสถานะของช่องที่แตะ
  const [pickMode, setPickMode] = useState(false);
  const [pickNote, setPickNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // แผงแขวนลูกบอลเปิดได้เฉพาะตอนเลือกแขวน ปิดเองเมื่อเข้าโซนหรือโต๊ะการ์ด
  useEffect(() => {
    if (zoneOpen || studioOpen) setSheetOpen(false);
  }, [zoneOpen, studioOpen]);
  // ลูกศรซ้าย/ขวาบนคีย์บอร์ดเลื่อนชมกำแพงในหมู่บ้าน
  useEffect(() => {
    if (!zoneOpen) {
      setZoneStop(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") treeRef.current?.zoneStep(1);
      if (e.key === "ArrowLeft") treeRef.current?.zoneStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoneOpen]);
  // ป้ายชี้การ์ดในโซนตามตำแหน่งบนจอ อัปเดตระหว่างกล้องบินไปที่โซน
  useEffect(() => {
    if (!zoneOpen) {
      setZonePins([]);
      return;
    }
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      // การ์ดในหมู่บ้านแตะเปิดได้โดยตรง ป้ายบนจอจึงมีเฉพาะการ์ดของเรา (ชี้ทางเมื่ออยู่นอกจอ)
      const list = treeRef.current?.zoneSlots(mineIds) ?? [];
      const key = list.map((p) => `${Math.round(p.x)},${Math.round(p.y)},${p.visible ? 1 : 0}`).join("|");
      if (key !== lastKey) {
        lastKey = key;
        setZonePins(list);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [zoneOpen, cards, mineIds]);
  const [exclusiveDraft, setExclusiveDraft] = useState<DecorDraft | null>(null); // ตุ๊กตา Exclusive ที่รอชำระเงิน
  const [shareOf, setShareOf] = useState<Ornament | null>(null); // การ์ดคำอวยพรที่กำลังแชร์
  // คู่มือการใช้งาน: เปิดอัตโนมัติครั้งแรกหลังของขวัญเปิดและตั้งชื่อแล้ว เปิดซ้ำได้จากปุ่ม "?"
  const [guideOn, setGuideOn] = useState(false);
  const [giftDone, setGiftDone] = useState(false);
  const [sceneReady, setSceneReady] = useState(false); // ฉาก 3 มิติพร้อมรับคำสั่ง (เช่น ฉลอง)
  const [celebrateOpen, setCelebrateOpen] = useState(false); // หน้าต่างฉลองต้นครบ 999 คำอวยพร
  const [celebrateMsg, setCelebrateMsg] = useState("");
  useEffect(() => {
    if (document.documentElement.dataset.giftDone === "1") setGiftDone(true);
    const on = () => setGiftDone(true);
    window.addEventListener("xmas-gift-done", on);
    return () => window.removeEventListener("xmas-gift-done", on);
  }, []);
  useEffect(() => {
    if (!giftDone || !profile) return;
    try {
      if (localStorage.getItem("xmas-guide-v1") !== "1") setGuideOn(true);
    } catch {
      /* ไม่เป็นไร */
    }
  }, [giftDone, profile]);
  const finishGuide = useCallback(() => {
    setGuideOn(false);
    try {
      localStorage.setItem("xmas-guide-v1", "1");
    } catch {
      /* ไม่เป็นไร */
    }
  }, []);
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
    // ข้อความขึ้นจอแสดงเพียงที่เดียวเหนือต้นไม้ (ไม่ซ้ำกับแถบข้อความ)
    setSkyShow({ id: ev.id, text: ev.text, by: ev.by, theme: (ev.theme ?? "fireworks") as SkyTheme, duration: Math.max(ev.duration, 4000) });
  }, []);

  // ---------- รวมลูกบอลจากเซิร์ฟเวอร์กับที่เพิ่งแขวนเอง ----------
  const ornaments = useMemo(() => {
    const map = new Map<string, Ornament>();
    for (const o of state?.ornaments ?? []) map.set(o.id, o);
    for (const o of local) map.set(o.id, o);
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [state, local]);

  // ---------- จำนวนคำอวยพรบนต้น (0–999) ออร่าบนต้นไต่ขึ้นตามเปอร์เซ็นต์นี้ ----------
  const hung = Math.min(ornaments.length, TREE_CAPACITY);
  const hungPct = Math.floor((hung / TREE_CAPACITY) * 100);
  // ต้นครบ 999 คำอวยพร: ฉลองทั้งห้อง (แต่ละเครื่องเห็นครั้งเดียว) พร้อมข้อความจากแอดมิน
  useEffect(() => {
    if (hung < TREE_CAPACITY || !giftDone || !sceneReady) return;
    const key = `xmas-celebrated-${roomId}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      /* ไม่เป็นไร */
    }
    // เห็นพลุและออร่าพุ่งรอบต้นก่อน แล้วข้อความจากแอดมินค่อยขึ้นตามมา
    treeRef.current?.celebrate();
    window.setTimeout(() => setCelebrateOpen(true), 3200);
    fetch("/api/christmas/config")
      .then((r) => r.json())
      .then((c: { celebrateMessage?: string }) => setCelebrateMsg(c.celebrateMessage ?? ""))
      .catch(() => {});
  }, [hung, giftDone, sceneReady, roomId]);


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

  // ชื่อในฟอร์มเริ่มจากโปรไฟล์ ถ้ายังไม่ได้พิมพ์เอง
  useEffect(() => {
    if (profile?.name) setForm((f) => (f.name ? f : { ...f, name: profile.name }));
  }, [profile]);
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
        body: JSON.stringify({ ...form, ...pick, room: roomId, social: profile?.social ?? {} }),
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

  // แตะต้นคริสต์มาสตรงไหนก็เปิดหน้าแขวนคำอวยพรทันที ไม่ต้องกดปุ่มก่อน
  const onPick = useCallback((height: number, angle: number) => {
    setPick({ height, angle });
    setFocus(null);
    setSheetOpen(true);
  }, []);

  // ---------- การ์ดอวยพร: โต๊ะออกแบบ โซนคำอวยพร ----------
  function saveProfileAndClose(p: Profile) {
    const first = profile === null; // ตั้งชื่อครั้งแรก: จางไปโต๊ะออกแบบการ์ดต่อทันที
    saveProfile(p);
    setProfile(p);
    setProfileEdit(false);
    if (!first) return;
    setLeavingOnboard(true);
    setTimeout(() => {
      setLeavingOnboard(false);
      setStudioMandatory(true);
      setStudioEnter(true);
      setStudioOpen(true);
    }, 620);
  }

  // ลิงก์แชร์การ์ด: ?card=<id> เปิดการ์ดนั้นก่อนเข้าร่วมห้อง
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("card");
    if (!id) return;
    fetch(`/api/christmas/card?room=${roomId}&id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { card?: CardRecord } | null) => {
        if (d?.card) setSharedCard(d.card);
      })
      .catch(() => undefined);
  }, [roomId]);

  // การ์ดใหม่สุด (ที่แขวนบนรั้วในฉาก) และจำนวนทั้งหมดของห้อง
  const refreshCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      // หมู่บ้านแขวนได้มากกว่า 1,000 ใบ แต่ API ส่งได้หน้าละ 300 ใบ จึงโหลดต่อกันจนครบที่แขวนได้
      const PAGE = 300;
      const all: CardRecord[] = [];
      let total = 0;
      for (let page = 1; page <= Math.ceil(ZONE_CAPACITY / PAGE); page++) {
        const res = await fetch(`/api/christmas/card?room=${roomId}&size=${PAGE}&page=${page}`, { cache: "no-store" });
        const data = (await res.json()) as { cards?: CardRecord[]; total?: number };
        if (typeof data.total === "number") total = data.total;
        all.push(...(data.cards ?? []));
        if (!data.cards || data.cards.length < PAGE || all.length >= Math.min(total, ZONE_CAPACITY)) break;
      }
      setCards(all.slice(0, ZONE_CAPACITY));
      setZoneTotal(total);
    } catch {
      /* ลองใหม่รอบถัดไป */
    } finally {
      setCardsLoading(false);
    }
  }, [roomId]);
  useEffect(() => {
    refreshCards();
  }, [refreshCards]);

  // รายการทั้งหมดในโซน: โหลดทีละ 60 ใบ ตามที่ผู้ใช้กดขอเพิ่ม
  const loadZone = useCallback(
    async (page: number) => {
      setZoneBusy(true);
      try {
        const res = await fetch(`/api/christmas/card?room=${roomId}&size=60&page=${page}`, { cache: "no-store" });
        const data = (await res.json()) as { cards?: CardRecord[]; total?: number };
        if (data.cards) {
          const incoming = data.cards;
          setZoneAll((prev) => (page === 1 ? incoming : [...prev, ...incoming.filter((c) => !prev.some((p) => p.id === c.id))]));
          setZonePage(page);
        }
        if (typeof data.total === "number") setZoneTotal(data.total);
      } catch {
        /* ลองกดอีกครั้ง */
      } finally {
        setZoneBusy(false);
      }
    },
    [roomId],
  );
  useEffect(() => {
    if (zoneList) loadZone(1);
  }, [zoneList, loadZone]);
  // ขณะเปิดโซนคำอวยพรให้รีเฟรชรายการทุก 15 วินาที
  useEffect(() => {
    if (!zoneOpen) return;
    refreshCards();
    const t = setInterval(refreshCards, 15000);
    return () => clearInterval(t);
  }, [zoneOpen, refreshCards]);

  async function likeCard(id: string) {
    if (likedWishes.has(id)) return;
    setLikedWishes((set) => new Set(set).add(id));
    setCards((list) => list.map((c) => (c.id === id ? { ...c, likes: c.likes + 1 } : c)));
    setZoneAll((list) => list.map((c) => (c.id === id ? { ...c, likes: c.likes + 1 } : c)));
    try {
      await fetch("/api/christmas/card/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, id, clientId: getClientId() }),
      });
    } catch {
      /* ไม่เป็นไร ครั้งหน้าลองใหม่ได้ */
    }
  }

  // การ์ดที่แสดงในโซนคำอวยพร (เฉพาะการ์ดที่ผู้ใช้ส่ง ลูกบอลบนต้นแยกต่างหาก)

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
      className="xmas-stage"
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
            setSceneReady(true);
          }}
          ornaments={ornaments}
          preview={previewData}
          reducedMotion={reduced}
          onPick={onPick}
          onOrnamentClick={(o) => setFocus(o)}
          onError={() => setWebglOk(false)}
          ground={room.ground}
          giants={(state?.giants ?? []).map((g) => ({ name: g.name, message: g.message, spot: g.spot ?? 0, look: g.look, social: g.social }))}
          onGiantClick={(g) => {
            const def = GIANT_POSITIONS[g.spot] ?? GIANT_POSITIONS[0];
            const info: GiantInfo = { name: g.name, message: g.message, spot: g.spot, social: g.social, look: g.look };
            setTip({
              kicker: "บ้านหิมะ Exclusive",
              title: g.name,
              cta: "ดูป้าย",
              x: def.x,
              y: 1.6,
              z: def.z,
              open: () => setGiantCard(info),
              close: () => treeRef.current?.focusGiant(null),
            });
          }}
          decor={decor}
          markerSlot={markerSlot}
          zoneCards={cards}
          onZoneCardClick={(id) => {
            const c = cards.find((x) => x.id === id);
            if (c) setZoneReveal(c);
          }}
          onAwayChange={setAway}
          onZoneStop={(index, total) => setZoneStop({ index, total })}
          pickMode={pickMode}
          onGroundPick={(slot) => {
            if (slot === null) {
              setPickNote({ tone: "warn", text: "ตรงนี้วางไม่ได้ (ทางเดิน โซน หรือของตกแต่ง) ลองแตะช่องสีเขียว" });
              return;
            }
            const owner = decor.find((d) => d.slot === slot);
            if (owner) {
              setPickNote({ tone: "warn", text: `ช่อง ${slot + 1} มี ${owner.name} วางแล้ว เลือกช่องสีเขียว` });
              return;
            }
            setMarkerSlot(slot);
            setDecorSlot(slot);
            setPickNote({ tone: "ok", text: `ช่อง ${slot + 1} ว่าง` });
          }}
          onDecorClick={(d) => {
            const pos = SLOT_POSITIONS[d.slot] ?? SLOT_POSITIONS[0];
            // กล้องบินไปหาตุ๊กตาทันทีเหมือนเดิม แล้วคำอธิบายลอยข้างตุ๊กตา
            treeRef.current?.focusDecor(d);
            setTip({
              kicker: "ตุ๊กตาหิมะ",
              title: d.name,
              cta: "ดูรายละเอียด",
              x: pos.x,
              y: 1.0,
              z: pos.z,
              open: () => {
                setDecorFocus(d);
                setFocus(null);
              },
              close: () => treeRef.current?.focusDecor(null),
            });
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

      {shareOf && <ShareCardModal ornament={shareOf} roomName={room.name} onClose={() => setShareOf(null)} />}

      {/* โปรไฟล์: ครั้งแรกหลังเปิดของขวัญ แสดงบนฉากโต๊ะ แล้วจางเข้าสู่โต๊ะออกแบบการ์ด */}
      {(profile === null || leavingOnboard) && (
        <div className={`xc-onboard ${leavingOnboard ? "is-leaving" : ""}`}>
          <div className="xc-table" aria-hidden>
            <span className="xc-light l1" />
            <span className="xc-light l2" />
            <span className="xc-light l3" />
          </div>
          <ProfileCard initial={profile ?? null} editing={false} onSave={saveProfileAndClose} submitLabel="บันทึกแล้วไปโต๊ะออกแบบการ์ด" />
        </div>
      )}
      {profileEdit && profile && (
        <ProfileCard initial={profile} editing onSave={saveProfileAndClose} onCancel={() => setProfileEdit(false)} />
      )}

      {supportOpen && (
        <SupportModal
          roomId={room.id}
          onClose={() => setSupportOpen(false)}
          defaultName={profile?.name ?? ""}
          social={profile?.social}
          onPaid={(name) => {
            setSupportOpen(false);
            notify("ok", `ขอบคุณ ${name} สำหรับการสนับสนุนทีมงาน`);
          }}
        />
      )}

      {exclusiveOpen && (
        <ExclusiveModal
          roomId={room.id}
          roomName={room.name}
          onClose={() => setExclusiveOpen(false)}
          defaultName={profile?.name ?? ""}
          social={profile?.social}
          onPaid={(kind, name) => {
            setExclusiveOpen(false);
            if (kind === "giant") {
              pendingLocate.current = { kind: "giant", name, at: Date.now() };
              notify("ok", `ขอบคุณ ${name} บ้านหิมะ Exclusiveขึ้นป้ายแล้ว`);
            }
            if (kind === "message") notify("ok", `ขอบคุณ ${name} ข้อความของคุณกำลังขึ้นบนท้องฟ้า`);
          }}
        />
      )}


      {skyShow && <SkyOverlay key={skyShow.id} show={skyShow} onDone={() => setSkyShow(null)} />}

      {/* ข้อความแจ้งเตือนชั่วคราว */}
      <PendingOrdersWatch roomId={room.id} notify={notify} />
      {giantCard && (
        <GiantBanner
          info={giantCard}
          onClose={() => {
            setGiantCard(null);
            treeRef.current?.focusGiant(null);
          }}
        />
      )}
      {tip && (
        <div ref={tipRef} className="xmas-tip" role="dialog" aria-label="ข้อมูลที่แตะ">
          <span className="xmas-tip-kicker">{tip.kicker}</span>
          <b>{tip.title}</b>
          <div className="xmas-tip-actions">
            <button
              type="button"
              onClick={() => {
                const open = tip.open;
                setTip(null);
                open();
              }}
            >
              {tip.cta}
            </button>
            <button
              type="button"
              className="xmas-tip-x"
              onClick={() => {
                const close = tip.close;
                setTip(null);
                close();
              }}
              aria-label="ปิดคำอธิบาย"
            >
              ×
            </button>
          </div>
        </div>
      )}


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
              <a href="/Christmas?pick=1" className="xmas-switch-link" onClick={(e) => { e.preventDefault(); markInternalNav(); setDoorGo(true); }}>
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
          <div className="xmas-tools" role="group" aria-label="ประวัติและอันดับ">
            <button
              type="button"
              className={`xmas-tool ${feedOpen ? "is-on" : ""}`}
              aria-pressed={feedOpen}
              onClick={() => {
                setFeedOpen((v) => !v);
                setRankOpen(false);
              }}
            >
              <Icon name="clock" size={15} />
              <span>ประวัติ</span>
            </button>
            <button
              type="button"
              className={`xmas-tool ${rankOpen ? "is-on" : ""}`}
              aria-pressed={rankOpen}
              onClick={() => {
                setRankOpen((v) => !v);
                setFeedOpen(false);
              }}
            >
              <Icon name="trophy" size={15} />
              <span>อันดับ</span>
            </button>
          </div>
          <button type="button" className="xmas-guide-btn" aria-label="ดูคู่มือการใช้งาน" title="ดูคู่มือการใช้งาน" onClick={() => setGuideOn(true)}>
            ?
          </button>
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
          <button type="button" className="xmas-switch is-donate" onClick={() => setSupportOpen(true)}>
            สนับสนุน
          </button>
        </div>
      </header>

      {/* เมนูหลัก: แขวน ตกแต่ง ชวนเพื่อน และสนับสนุน (บ้านหิมะ Exclusive) */}
      <nav className="xmas-actions" aria-label="เมนูกิจกรรม">
        <button className="xmas-action" data-studio-btn onClick={() => { setFeedOpen(false); setChooseOpen(true); }}>
          <Icon name="bauble" size={18} /> คำอวยพร
        </button>
        <button className="xmas-action" data-zone-btn onClick={() => { setZoneOpen(true); treeRef.current?.flyToZone(); }}>
          <Icon name="sparkle" size={18} /> โซนคำอวยพร
        </button>
        <button
          className="xmas-action"
          data-decor-btn
          data-tip="สร้างตุ๊กตาหิมะแล้ววางรอบต้น"
          onClick={() => {
            setDecorSlot(null); // เปิดจากเมนูให้เริ่มช่องใหม่ ไม่ค้างช่องที่เพิ่งวาง
            setDecorOpen(true);
          }}
        >
          <Icon name="snowman" size={18} /> ตกแต่งตุ๊กตาหิมะ
        </button>
        <button className="xmas-action" data-invite-btn onClick={() => setInviteOpen(true)}>
          <Icon name="users" size={18} /> ชวนเพื่อน
        </button>
        <button className="xmas-action is-exclusive" data-exclusive-btn onClick={() => setExclusiveOpen(true)}>
          <Icon name="crown" size={18} /> Exclusive
        </button>
        <button className="xmas-action is-donate-phone xmas-action-phone" onClick={() => setSupportOpen(true)}>
          <Icon name="heart" size={18} /> สนับสนุน
        </button>
        <button className="xmas-action xmas-action-mobile" onClick={() => {
          setFeedOpen(true);
          setRankOpen(false);
        }}>
          <Icon name="clock" size={18} /> ประวัติล่าสุด
        </button>
      </nav>

      {/* ตัวนับคำอวยพรบนต้น 0/999 และแถบความคืบหน้า */}
      {!zoneOpen && (
        <div className={`xmas-tree-count ${hung >= TREE_CAPACITY ? "is-full" : ""}`} role="status" aria-live="polite" title="จำนวนคำอวยพรที่แขวนบนต้นนี้">
          <span className="xmas-tree-count-label">{hung >= TREE_CAPACITY ? "ต้นเต็มแล้ว" : "แขวนแล้ว"}</span>
          <b>{hung.toLocaleString("th-TH")}</b>
          <span className="xmas-tree-count-max">/ {TREE_CAPACITY}</span>
          <span className="xmas-tree-count-bar" aria-hidden>
            <i style={{ width: `${Math.max(hungPct, hung > 0 ? 1 : 0)}%` }} />
          </span>
          <span className="xmas-tree-count-pct">{hung > 0 && hungPct === 0 ? "<1%" : `${hungPct}%`}</span>
        </div>
      )}

      {/* ฉลองต้นครบ 999 คำอวยพร */}
      {celebrateOpen && (
        <div className="xmas-celebrate" role="dialog" aria-modal="true" aria-labelledby="xmas-celebrate-title" onClick={() => setCelebrateOpen(false)}>
          <div className="xmas-celebrate-confetti" aria-hidden>
            {Array.from({ length: 36 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.35}s`, background: ["#f2d98c", "#dc2643", "#7dd3fc", "#86efac", "#f9a8d4", "#ffffff"][i % 6] }} />
            ))}
          </div>
          <div className="xmas-celebrate-card" onClick={(e) => e.stopPropagation()}>
            <p className="xmas-celebrate-kicker">ต้นคริสต์มาส{room.name}</p>
            <h2 id="xmas-celebrate-title">ครบ 999 คำอวยพรแล้ว!</h2>
            <p className="xmas-celebrate-sub">ทุกคนช่วยกันแขวนจนต้นเต็ม 100% ขอบคุณที่มาร่วมส่งความสุขด้วยกัน</p>
            <blockquote className="xmas-celebrate-msg">
              <p>{celebrateMsg || "ขอบคุณทุกคำอวยพร ขอให้ทุกคนมีความสุขมาก ๆ ในเทศกาลนี้"}</p>
              <cite>— ADMIN</cite>
            </blockquote>
            <button type="button" className="xmas-celebrate-btn" onClick={() => setCelebrateOpen(false)} autoFocus>
              ฉลองด้วยกัน
            </button>
          </div>
        </div>
      )}

      {/* แถบข้อความวิ่งด้านบน */}
      <Ticker
        items={[
          ...ornaments.slice(0, 10).map((o) => ({ key: `w-${o.id}`, text: `${o.name}: ${o.wish || "ขอให้มีความสุขในวันคริสต์มาส"}` })),
          ...feed.exclusive.slice(0, 6).map((e) => ({ key: `e-${e.id}`, text: `Exclusive ${e.name}: ${e.message || "บ้านหิมะ Exclusive"}`, exclusive: true })),
          ...(ornaments.length === 0 && feed.exclusive.length === 0
            ? [{ key: "welcome", text: "ยินดีต้อนรับสู่ต้นคริสต์มาส แขวนคำอวยพรของคุณเป็นคนแรกได้เลย" }]
            : []),
        ]}
      />

      {doorGo && <DoorTransition onDone={() => window.location.assign("/Christmas?pick=1")} />}

      <GuideSpotlight
        active={guideOn && giftDone && !!profile && !studioOpen && !chooseOpen && !sheetOpen && !zoneOpen && !inviteOpen && !decorOpen && !exclusiveOpen && !supportOpen && !profileEdit && !feedOpen && !rankOpen && !focus && !shareOf && !sharedCard && !exclusiveDraft}
        onDone={finishGuide}
      />

      {inviteOpen && (
        <InviteModal
          roomId={room.id}
          roomName={room.name}
          online={online?.count ?? 0}
          capacity={online?.capacity ?? 150}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {/* แถบเลือกช่องบนฉาก: แตะช่องสีเขียวบนพื้น แล้วกดใช้ช่องนี้ */}
      {pickMode && (
        <div className="xz-pick" role="group" aria-label="เลือกช่องวางตุ๊กตาบนฉาก">
          <span className={`xz-pick-note is-${pickNote?.tone ?? "idle"}`}>{pickNote?.text ?? "แตะช่องสีเขียวบนพื้นเพื่อเลือกที่วางตุ๊กตา"}</span>
          <div className="xz-pick-actions">
            <button
              type="button"
              className="xz-hud-btn"
              disabled={pickNote?.tone !== "ok"}
              onClick={() => {
                setPickMode(false);
                setDecorOpen(true);
              }}
            >
              ใช้ช่องนี้
            </button>
            <button
              type="button"
              className="xz-hud-btn is-ghost"
              onClick={() => {
                setPickMode(false);
                setDecorOpen(true);
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {decorOpen && (
        <DecorModal
          roomId={room.id}
          roomName={room.name}
          decor={decor}
          initialSlot={decorSlot}
          defaultName={profile?.name ?? ""}
          social={profile?.social}
          onExclusive={(d) => {
            setExclusiveDraft(d);
            setDecorOpen(false);
            setMarkerSlot(null);
          }}
          onPickOnMap={() => {
            setDecorOpen(false);
            setPickNote(null);
            setPickMode(true);
          }}
          onClose={() => {
            setDecorOpen(false);
            setMarkerSlot(null);
          }}
          onPlaced={(d) => {
            setDecorOpen(false);
            setMarkerSlot(null);
            setDecorSlot(null);
            refreshDecor();
            treeRef.current?.locate({ kind: "decor", slot: d.slot });
            notify("ok", `วางตุ๊กตาหิมะของ ${d.name} รอบต้นแล้ว`);
          }}
        />
      )}

      {exclusiveDraft && (
        <ExclusiveModal
          decor={exclusiveDraft}
          roomId={room.id}
          roomName={room.name}
          onClose={() => setExclusiveDraft(null)}
          onPaid={(kind, name) => {
            setExclusiveDraft(null);
            if (kind === "decor") {
              pendingLocate.current = { kind: "decor", name, at: Date.now() };
              refreshDecor();
              notify("ok", `${name} วางตุ๊กตาหิมะ Exclusive บนต้นแล้ว`);
            }
          }}
          defaultName={profile?.name ?? ""}
          social={profile?.social}
        />
      )}

      {decorFocus && (
        <DecorInfoCard
          d={decorFocus}
          onClose={() => {
            setDecorFocus(null);
            treeRef.current?.focusDecor(null);
          }}
          onLiked={(id, likes) => {
            setDecorFocus((f) => (f && f.id === id ? { ...f, likes } : f));
            refreshDecor();
          }}
        />
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
          <SocialLinks social={focus.social} />
          <blockquote className="xmas-focus-wish">{focus.wish || "ขอให้มีความสุขในวันคริสต์มาส"}</blockquote>
          <button
            type="button"
            className={`xmas-like-wish ${likedWishes.has(focus.id) ? "is-on" : ""}`}
            aria-pressed={likedWishes.has(focus.id)}
            onClick={() => likeWish(focus.id)}
            disabled={likedWishes.has(focus.id)}
          >
            <Icon name="heart" size={15} />
            {likedWishes.has(focus.id) ? "ถูกใจแล้ว" : "ถูกใจคำอวยพรนี้"}
            <span>{(board.counts[focus.id] ?? 0) + (likedWishes.has(focus.id) && !board.counts[focus.id] ? 1 : 0)}</span>
          </button>
          <button type="button" className="xmas-chip-btn xmas-share-open" onClick={() => setShareOf(focus)}>
            แชร์เป็นการ์ด
          </button>
          <div className="xmas-focus-foot">
            <small>แขวนเมื่อ {new Date(focus.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</small>
            <button type="button" className="xmas-chip-btn" onClick={() => setFocus(null)}>
              กลับมุมมองเดิม
            </button>
          </div>
        </div>
      )}

      {chooseOpen && (
        <div className="xc-choose-back" role="presentation" onClick={() => setChooseOpen(false)}>
          <div className="xc-choose" role="dialog" aria-modal="true" aria-label="เลือกแบบคำอวยพร" onClick={(e) => e.stopPropagation()}>
            <p className="xc-kicker">คำอวยพร · {room.name}</p>
            <h2>อยากอวยพรแบบไหน</h2>
            <button
              type="button"
              className="xc-choose-opt"
              onClick={() => {
                setChooseOpen(false);
                setStudioMandatory(false);
                setStudioEnter(false);
                setStudioOpen(true);
              }}
            >
              <span className="xc-choose-ico" aria-hidden>
                <Icon name="bauble" size={26} />
              </span>
              <span>
                <b>ทำการ์ดอวยพร</b>
                <small>ออกแบบการ์ด ตกแต่งซอง เขียนข้อความได้หลายกล่อง แล้วส่งไปโซนคำอวยพร ส่งได้ {CARDS_PER_PERSON} ใบต่อห้อง</small>
              </span>
            </button>
            <button
              type="button"
              className="xc-choose-opt"
              onClick={() => {
                setChooseOpen(false);
                setSheetOpen(true);
                setFeedOpen(false);
                setPanelPulse((n) => n + 1);
              }}
            >
              <span className="xc-choose-ico" aria-hidden>
                <Icon name="tree" size={26} />
              </span>
              <span>
                <b>แขวนคำอวยพร</b>
                <small>แขวนลูกบอลบนต้นคริสต์มาส เขียนคำอวยพรสั้น ๆ ไม่ต้องตกแต่งการ์ด</small>
              </span>
            </button>
          </div>
        </div>
      )}

      {sharedCard && (
        <CardReveal
          key={sharedCard.id}
          card={sharedCard}
          room={roomId}
          liked={likedWishes.has(sharedCard.id)}
          onLike={() => likeCard(sharedCard.id)}
          onClose={() => {
            setSharedCard(null);
            try {
              const u = new URL(window.location.href);
              u.searchParams.delete("card");
              window.history.replaceState(null, "", u.toString());
            } catch {
              /* ไม่เป็นไร */
            }
          }}
        />
      )}

      {studioOpen && (
        <CardStudio
          roomId={roomId}
          roomName={room.name}
          defaultName={profile?.name ?? ""}
          social={profile?.social}
          mandatory={studioMandatory}
          enter={studioEnter}
          onClose={() => setStudioOpen(false)}
          onSent={(card) => {
            setStudioOpen(false);
            setStudioMandatory(false);
            setStudioEnter(false);
            setCards((list) => [card, ...list.filter((c) => c.id !== card.id)]);
            rememberMyCard(card.id);
            setMineIds(myCardIds());
            notify("ok", "การ์ดของคุณถูกส่งไปโซนคำอวยพรแล้ว");
            refreshCards();
          }}
        />
      )}

      {/* โซนคำอวยพรอยู่บนแผนที่: แถบควบคุมด้านล่างเมื่อกล้องไปที่โซน */}
      {zoneOpen && !zoneList && (
        <div className="xz-hud" role="toolbar" aria-label="โซนคำอวยพร">
          <span className="xz-hud-count">
            โซนคำอวยพร · {zoneTotal} ใบ
            <span className="xz-hud-hint-text">{zoneTotal === 0 ? " · ยังไม่มีการ์ดในโซนนี้" : " · แตะซองบนกำแพงเพื่อเปิดการ์ด"}</span>
          </span>
          <button type="button" className={`xz-hud-btn ${zoneTotal > 0 ? "is-hint" : ""}`} onClick={() => setZoneList(true)} disabled={zoneTotal === 0}>
            ดูรายการ
          </button>
          {zonePins.some((p) => mineIds.has(p.id)) && (
            <button
              type="button"
              className="xz-hud-btn"
              onClick={() => {
                const mine = zonePins.find((p) => mineIds.has(p.id));
                if (mine) treeRef.current?.focusZoneCard(mine.id);
              }}
            >
              การ์ดของฉัน
            </button>
          )}
          <button
            type="button"
            className="xz-hud-btn is-ghost"
            onClick={() => {
              setZoneList(false);
              setZoneOpen(false);
              treeRef.current?.returnView();
            }}
          >
            กลับมุมเดิม
          </button>
        </div>
      )}
      {/* เลื่อนชมทีละกำแพง: ทุกหน้ากำแพงมีจุดยืนมองตรง ๆ จึงเห็นซองครบทุกใบ ไม่มีใบไหนถูกบัง */}
      {zoneOpen && !zoneList && zoneStop && zoneTotal > 0 && (
        <div className="xz-nav" role="group" aria-label="เลื่อนชมกำแพงการ์ด">
          <button type="button" className="xz-nav-btn" aria-label="กำแพงก่อนหน้า" onClick={() => treeRef.current?.zoneStep(-1)}>
            ‹
          </button>
          <span className="xz-nav-label">
            กำแพง {zoneStop.index + 1}/{zoneStop.total}
          </span>
          <button type="button" className="xz-nav-btn" aria-label="กำแพงถัดไป" onClick={() => treeRef.current?.zoneStep(1)}>
            ›
          </button>
        </div>
      )}
      {zoneOpen && !zoneList && zonePins.length > 0 && (
        <div className="xz-pins">
          {zonePins.map((p) => {
            const mine = mineIds.has(p.id);
            if (!mine) return null;
            // การ์ดนอกจอ: แสดงเฉพาะการ์ดของเราเป็นลูกศรที่ขอบจอ แตะแล้วกล้องบินไปหา
            if (!p.visible) {
              if (!mine) return null;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="xz-pin is-mine is-edge"
                  style={{ left: p.x, top: p.y }}
                  aria-label="การ์ดของคุณอยู่นอกจอ แตะเพื่อไป"
                  onClick={() => treeRef.current?.focusZoneCard(p.id)}
                >
                  <span className="xz-pin-arrow" style={{ transform: `rotate(${p.angle}deg)` }} aria-hidden>
                    ➜
                  </span>
                  <span className={`xz-pin-label xz-pin-label-edge ${p.x < window.innerWidth / 2 ? "at-left" : "at-right"}`}>การ์ดของคุณ</span>
                </button>
              );
            }
            return (
              <button
                key={p.id}
                type="button"
                className={`xz-pin ${mine ? "is-mine" : ""}`}
                style={{ left: p.x, top: p.y }}
                aria-label={mine ? "การ์ดของคุณ" : "ซองคำอวยพร"}
                title={mine ? "การ์ดของคุณ" : "ดูคำอวยพร"}
                onClick={() => {
                  const c = cards.find((x) => x.id === p.id);
                  if (c) setZoneReveal(c);
                }}
              >
                {mine && <span className="xz-pin-label">การ์ดของคุณ</span>}
              </button>
            );
          })}
        </div>
      )}
      {zoneOpen && zoneList && (
        <WishZone
          cards={zoneAll}
          total={zoneTotal}
          hasMore={zoneAll.length < zoneTotal}
          liked={likedWishes}
          loading={zoneBusy}
          room={roomId}
          onLoadMore={() => loadZone(zonePage + 1)}
          onLike={(id) => likeCard(id)}
          onClose={() => setZoneList(false)}
        />
      )}
      {!zoneOpen && away && (
        <div className="xz-hud" role="toolbar" aria-label="กลับมุมเดิม">
          <button type="button" className="xz-hud-btn is-ghost" onClick={() => treeRef.current?.returnView()}>
            กลับมุมเดิม
          </button>
        </div>
      )}
      {zoneReveal && (
        <CardReveal
          key={zoneReveal.id}
          card={zoneReveal}
          room={roomId}
          liked={likedWishes.has(zoneReveal.id)}
          onLike={() => likeCard(zoneReveal.id)}
          onClose={() => setZoneReveal(null)}
        />
      )}

      {/* แผงแขวนลูกบอล */}
      {sheetOpen && (
      <section key={panelPulse} className={`xmas-panel glass xmas-wish ${sheetOpen ? "is-open" : ""} ${panelPulse ? "is-pulse" : ""}`} aria-label="แขวนคำอวยพร">
        <button className="xmas-sheet-toggle" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}>
          {sheetOpen ? "ปิดแผง" : "แขวนคำอวยพรของคุณ"}
        </button>
        <form onSubmit={hang} className={`xmas-form xmas-wish-form ${wishTab === "text" ? "is-text-tab" : ""}`}>
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
                <button type="button" className="xmas-link-btn xmas-profile-edit" onClick={() => setProfileEdit(true)}>
                  {profile?.social && Object.keys(profile.social).length > 0 ? "แก้ไขชื่อและโซเชียล" : "เพิ่มลิงก์ Instagram / Facebook"}
                </button>
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
      )}

      {/* แผงแท็บ: คำอวยพร / Exclusive / สนับสนุนทีม */}
      <FeedPanel
        wishes={ornaments}
        decor={decor}
        feed={feed}
        onWishClick={(o) => setFocus(o)}
        mobileOpen={feedOpen}
        onMobileClose={() => setFeedOpen(false)}
      />
      <RankPanel
        board={board}
        wishes={ornaments}
        open={rankOpen}
        onClose={() => setRankOpen(false)}
        onWishClick={(o) => {
          setRankOpen(false);
          setFocus(o);
        }}
      />
    </div>
  );
}
