"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { MessageTheme, OrderPreview } from "@/lib/christmas/types";
import type { Social } from "@/lib/christmas/social";
import { DEFAULT_GIANT_LOOK, DIORAMA_BASES, DIORAMA_KINDS, freeSpot, makeItem, MAX_ITEMS, PALETTE, partsFor, SIGN_BOARDS, specFor, type DioramaItem, type GiantLook, type PaletteKey } from "@/lib/christmas/giant";
import { CELL, LAND_R, TREE_CORE_R } from "@/lib/christmas/grid";
import { GIANT_POSITIONS, ZONE, ZONE_GATE } from "@/lib/christmas/slots";
import type { SnowParts } from "./SnowmanPreview";
import { SnowmanPreview } from "./SnowmanPreview";
import { DioramaViewer } from "./DioramaViewer";
import { rememberPending } from "./pendingOrders";
import { Icon } from "./Icon";
import { PaymentPanel, useDonateConfig } from "./PaymentPanel";
import { paintSkyScene, type SkyTheme } from "./skyArt";

// ตุ๊กตาหิมะ Exclusive ที่ผู้ใช้ตกแต่งและเลือกช่องไว้แล้ว รอชำระเงินเพื่อวาง
export type DecorDraft = { slot: number; parts: SnowParts; name: string; social?: Social };

const TIER_NAMES = ["ดาวดวงเล็ก", "ระฆังเงิน", "ดาวประจำห้อง"];
const THEMES: { id: MessageTheme; label: string; hint: string; icon: "firework" | "snow" | "sparkle" | "sleigh" }[] = [
  { id: "fireworks", label: "พลุฉลอง", hint: "พลุทองระเบิดเป็นชุดเหนือต้น", icon: "firework" },
  { id: "snow", label: "หิมะโปรยปราย", hint: "หิมะหนาแน่นพร้อมแสงน้ำแข็ง", icon: "snow" },
  { id: "sparkle", label: "ประกายระยิบ", hint: "ประกายทองวิ่งไปตามกรอบ", icon: "sparkle" },
  { id: "sleigh", label: "เลื่อนกวางเรนเดียร์", hint: "เลื่อนซานตามีกวางนำหน้า", icon: "sleigh" },
];
const THANKS_CHIPS = ["ขอบคุณที่ทำให้คริสต์มาสนี้อบอุ่น", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "สุขสันต์วันคริสต์มาสนะ"];

// ชื่อภาษาไทยของชิ้นส่วนแต่ละแบบ
const LABEL: Record<string, string> = {
  top: "หมวกทรงสูง",
  beanie: "หมวกไหมพรม",
  santa: "ซานตา",
  crown: "มงกุฎ",
  pom: "ปอมปอม",
  holly: "พวงฮอลลี่",
  tiara: "ทิอารา",
  antlers: "เขากวาง",
  elf: "หมวกเอลฟ์",
  red: "แดง",
  green: "เขียว",
  gold: "ทอง",
  blue: "น้ำเงิน",
  white: "ขาว",
  plaid: "ลายสก็อต",
  carrot: "แครอท",
  button: "กระดุม",
  bell: "ระฆัง",
  sticks: "กิ่งไม้",
  wings: "ปีกเล็ก",
  gift: "ของขวัญ",
  none: "ไม่มี",
  snow: "ฐานหิมะ",
  boots: "บู๊ต",
  mint: "มิ้นต์",
  sky: "ฟ้า",
  blush: "ชมพู",
  pearl: "มุก",
  ice: "น้ำแข็ง",
  glasses: "แว่น",
  bow: "โบว์",
  wreath: "พวงมาลัย",
  spruce: "สปรูซ",
  ivory: "งาช้าง",
  berry: "เบอร์รี่",
  pine: "ต้นสน",
  snowman: "ตุ๊กตาหิมะ",
  candy: "ไม้เท้าขนม",
  lantern: "โคมไฟ",
  star: "ดาวดวงใหญ่",
  cream: "ครีม",
  multi: "หลากสี",
  pink: "ชมพูอ่อน",
  forest: "เขียวเข้ม",
  frost: "เขียวหิมะ",
  tree: "ต้นสน",
  navy: "น้ำเงินเข้ม",
  orange: "ส้ม",
  warm: "แสงอุ่น",
  purple: "ม่วง",
  silver: "เงิน",
  black: "ดำ",
  wood: "ไม้",
};

type View = "menu" | "giant" | "message" | "decor";

// แถบถอยกลับ/ถัดไปของขั้นตอน (แสดงเฉพาะบนมือถือ)
function WizardNav({ step, last, setStep }: { step: number; last: number; setStep: (n: number | ((n: number) => number)) => void }) {
  return (
    <nav className="xmas-wiz-nav" aria-label="ขั้นตอน">
      <button type="button" className="xmas-wiz-back" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0}>
        ย้อนกลับ
      </button>
      <span className="xmas-wiz-count">ขั้นที่ {step + 1} จาก {last + 1}</span>
      {step < last ? (
        <button type="button" className="xmas-wiz-next" onClick={() => setStep((n) => Math.min(last, n + 1))}>
          ถัดไป
        </button>
      ) : (
        <span className="xmas-wiz-spacer" />
      )}
    </nav>
  );
}
type GiantKey = keyof GiantLook;

// ปุ่มเลือกชิ้นส่วนแบบแถวเดียว ใช้ทั้งตุ๊กตายักษ์และข้อความ
function hexOf(key: string): string | null {
  return key in PALETTE ? `#${PALETTE[key as PaletteKey].toString(16).padStart(6, "0")}` : null;
}

function PickRow({ title, options, value, onChange, swatch = false }: { title: string; options: readonly string[]; value: string; onChange: (v: string) => void; swatch?: boolean }) {
  return (
    <div className="xmas-pick-row">
      <span className="xmas-pick-title">{title}</span>
      <div className="xmas-pick-chips" role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? "is-on" : ""} onClick={() => onChange(o)}>
            {swatch && hexOf(o) && <i className="xmas-chip-dot" style={{ background: hexOf(o) ?? undefined }} aria-hidden />}
            {LABEL[o] ?? o}
          </button>
        ))}
      </div>
    </div>
  );
}

// แผนที่ลานมองจากด้านบน: จุดเขียวว่าง จุดแดงมีคนจองแล้ว จุดทองคือที่ที่คุณเลือก (ไม่เลือกก็ได้ ระบบจัดให้)
const MAP_PX = 360;
function SpotMap({ taken, held, value, onPick }: { taken: Set<number>; held: Set<number>; value: number | null; onPick: (i: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = MAP_PX / (LAND_R * 2 + 4);
  const toPx = (x: number, z: number) => [MAP_PX / 2 + x * scale, MAP_PX / 2 + z * scale] as const;

  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    g.clearRect(0, 0, MAP_PX, MAP_PX);
    // ลาน
    g.beginPath();
    g.arc(...toPx(0, 0), LAND_R * scale, 0, Math.PI * 2);
    g.fillStyle = "#f4f8fc";
    g.fill();
    g.strokeStyle = "rgba(40,110,70,0.35)";
    g.lineWidth = 2;
    g.stroke();
    // ทางเดินไปโซนและโซนคำอวยพร
    const [gx, gz] = toPx(ZONE_GATE.x, ZONE_GATE.z);
    g.beginPath();
    g.moveTo(...toPx(0, 0));
    g.lineTo(gx, gz);
    g.strokeStyle = "rgba(120,110,100,0.6)";
    g.lineWidth = 4;
    g.stroke();
    const [zx, zz] = toPx(ZONE.x - ZONE.half, ZONE.z - ZONE.half);
    g.fillStyle = "rgba(20,90,60,0.18)";
    g.fillRect(zx, zz, ZONE.half * 2 * scale, ZONE.half * 2 * scale);
    g.fillStyle = "rgba(20,70,50,0.7)";
    g.font = "600 11px sans-serif";
    g.textAlign = "center";
    g.fillText("โซนคำอวยพร", ...toPx(ZONE.x, ZONE.z));
    // ต้นคริสต์มาส
    g.beginPath();
    g.arc(...toPx(0, 0), TREE_CORE_R * scale, 0, Math.PI * 2);
    g.fillStyle = "#14532d";
    g.fill();
    // จุดตั้ง Exclusive: ขนาด 2×2 ช่อง
    const side = 2 * CELL * scale;
    GIANT_POSITIONS.forEach((p, i) => {
      const [px, pz] = toPx(p.x, p.z);
      g.fillStyle = i === value ? "#facc15" : taken.has(i) ? "#ef4444" : held.has(i) ? "#f59e0b" : "#22c55e";
      g.fillRect(px - side / 2, pz - side / 2, side, side);
    });
  }, [taken, held, value, scale]);

  function pick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cv = ref.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) * MAP_PX) / rect.width;
    const wz = ((e.clientY - rect.top) * MAP_PX) / rect.height;
    const x = (wx - MAP_PX / 2) / scale;
    const z = (wz - MAP_PX / 2) / scale;
    let best = -1;
    let bestD = Infinity;
    GIANT_POSITIONS.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0 || bestD > (CELL * 1.6) ** 2 || taken.has(best) || held.has(best)) return;
    onPick(best);
  }

  return (
    <div className="xmas-spot-map">
      <canvas ref={ref} width={MAP_PX} height={MAP_PX} onClick={pick} role="img" aria-label="แผนที่ลาน เลือกจุดตั้งบ้านหิมะ" />
      <p className="xmas-hint">เขียว = ว่าง · ส้ม = มีคนกำลังจอง (รอชำระ) · แดง = ซื้อไปแล้ว · ทอง = ที่คุณเลือก{value === null ? " · ยังไม่ได้เลือก ระบบจะจัดให้ตอนชำระเงิน" : ""}</p>
    </div>
  );
}

// ตัวจัดของบนฐาน: เพิ่มชิ้นใหม่ เลือกชิ้น แต่งสีทีละส่วน หมุน และเอาออก ส่วนตำแหน่งลากได้ในตัวอย่างด้านขวา
function newItemId() {
  return Math.random().toString(36).slice(2, 10);
}

function DioramaStudio({ items, selectedId, onSelect, onChange }: { items: DioramaItem[]; selectedId: string | null; onSelect: (id: string | null) => void; onChange: (items: DioramaItem[]) => void }) {
  const [note, setNote] = useState("");
  const selected = items.find((it) => it.id === selectedId) ?? null;
  const deg = selected ? Math.round((((selected.r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI)) % 360 : 0;

  function add(kind: string) {
    if (items.length >= MAX_ITEMS) return setNote(`ใส่ได้สูงสุด ${MAX_ITEMS} ชิ้นต่อฐาน`);
    const spot = freeSpot(items, kind);
    if (!spot) return setNote("พื้นที่บนฐานเต็มแล้ว ลองย้ายหรือเอาชิ้นอื่นออกก่อน");
    const item = makeItem(newItemId(), kind, spot.x, spot.z);
    setNote("");
    onChange([...items, item]);
    onSelect(item.id);
  }
  function patch(p: Partial<DioramaItem>) {
    if (!selected) return;
    onChange(items.map((it) => (it.id === selected.id ? { ...it, ...p } : it)));
  }
  function setPart(key: string, value: string) {
    if (!selected) return;
    patch({ parts: { ...selected.parts, [key]: value } });
  }
  function remove() {
    if (!selected) return;
    onChange(items.filter((it) => it.id !== selected.id));
    onSelect(null);
  }

  return (
    <div className="xmas-studio">
      <div className="xmas-studio-add">
        <span className="xmas-pick-title">เพิ่มของลงบนฐาน</span>
        <div className="xmas-pick-chips">
          {DIORAMA_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => add(k)}>
              + {specFor(k)?.label ?? k}
            </button>
          ))}
        </div>
      </div>
      {note && <p className="xmas-msg err">{note}</p>}
      {items.length > 0 && (
        <div className="xmas-studio-list">
          <span className="xmas-pick-title">ของบนฐาน ({items.length})</span>
          <div className="xmas-pick-chips" role="radiogroup" aria-label="ของบนฐาน">
            {items.map((it, i) => (
              <button key={it.id} type="button" role="radio" aria-checked={it.id === selectedId} className={it.id === selectedId ? "is-on" : ""} onClick={() => onSelect(it.id)}>
                {i + 1}. {specFor(it.kind)?.label ?? it.kind}
              </button>
            ))}
          </div>
        </div>
      )}
      {selected ? (
        <div className="xmas-dio-pick">
          <span className="xmas-pick-title">แต่งสี {specFor(selected.kind)?.label}</span>
          {partsFor(selected.kind).map((part) => (
            <PickRow key={part.key} title={part.label} options={part.options} value={selected.parts[part.key] ?? part.options[0]} onChange={(v) => setPart(part.key, v)} swatch />
          ))}
          <label className="xmas-rot">
            <span>
              หมุนชิ้นนี้ <em>{deg}°</em>
            </span>
            <input type="range" min={0} max={359} step={1} value={deg} onChange={(e) => patch({ r: (Number(e.target.value) * Math.PI) / 180 })} />
          </label>
          <button type="button" className="xmas-studio-del" onClick={remove}>
            เอาชิ้นนี้ออก
          </button>
        </div>
      ) : (
        <p className="xmas-hint">แตะชิ้นในรายการหรือแตะชิ้นบนฐานในตัวอย่างเพื่อเลือก แล้วลากชิ้นนั้นเพื่อย้ายไปวางตรงไหนก็ได้</p>
      )}
    </div>
  );
}

// ท้องฟ้าตัวอย่าง วาดต่อเนื่องด้วยเวลาจริง (ถ้าผู้ใช้ตั้งค่าลดการเคลื่อนไหวจะหยุดนิ่ง)
function SkyCanvas({ theme, text, by }: { theme: SkyTheme; text: string; by: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ theme, text, by });
  latest.current = { theme, text, by };
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      const t = reduced ? 4 : (performance.now() - start) / 1000;
      paintSkyScene(g, cv.width, cv.height, t, latest.current);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={960} height={540} className="xmas-sky-canvas" aria-label="ตัวอย่างการแสดงบนท้องฟ้า" />;
}

export default function ExclusiveModal({
  roomId,
  roomName,
  onClose,
  onPaid,
  defaultName = "",
  social,
  decor,
}: {
  roomId: string;
  roomName: string;
  onClose: () => void;
  onPaid: (kind: "giant" | "message" | "decor", name: string) => void;
  defaultName?: string;
  social?: Social;
  decor?: DecorDraft;
}) {
  const { cfg, error: cfgError } = useDonateConfig();
  const [view, setView] = useState<View>(decor ? "decor" : "menu");
  const [name, setName] = useState(decor?.name ?? defaultName);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<MessageTheme>("fireworks");
  const [look, setLook] = useState<GiantLook>(DEFAULT_GIANT_LOOK);
  const [selId, setSelId] = useState<string | null>(null);
  const [spotPick, setSpotPick] = useState<number | null>(null);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [spotPopup, setSpotPopup] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const [orderKind, setOrderKind] = useState<"giant" | "message" | "decor">("giant");
  // บนมือถือแสดงทีละขั้น (บนคอมแสดงทุกขั้นพร้อมกัน)
  const [step, setStep] = useState(0);

  const locked = order !== null && order.status !== "paid";
  const disabled = cfg !== null && !cfg.enabled;
  const giantChosen = amount ?? (custom ? Number(custom) : null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  // โหลดจุดที่มีคนจองแล้ว: ตอนเปิดฟอร์มตุ๊กตายักษ์ และตอนที่ผู้ซื้อต้องเลือกจุดใหม่
  const loadTaken = useCallback(() => {
    fetch(`/api/christmas/state?room=${encodeURIComponent(roomId)}`)
      .then((r) => r.json())
      .then((d: { giants?: { spot: number }[]; holds?: number[] }) => {
        setTaken(new Set((d.giants ?? []).map((g) => g.spot)));
        setHeld(new Set(d.holds ?? []));
      })
      .catch(() => {});
  }, [roomId]);
  useEffect(() => {
    if (view === "giant") loadTaken();
  }, [view, loadTaken]);

  function closeSpotPopup() {
    setSpotPopup(false);
    setSpotPick(null);
    loadTaken();
  }

  function goView(v: View) {
    setStep(0);
    setView(v);
  }

  function setPart(key: GiantKey, value: string) {
    setLook((l) => ({ ...l, [key]: value }));
  }
  function setItems(items: DioramaItem[]) {
    setLook((l) => ({ ...l, items }));
  }

  async function create(kind: "giant" | "message" | "decor", body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/christmas/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, kind, social: social ?? {}, ...body }),
      });
      const data = (await res.json()) as { order?: OrderPreview; error?: string; code?: string };
      // จุดที่เลือกถูกคนอื่นไปก่อน: เด้งให้เลือกใหม่ (ยังไม่ได้ตัดเงิน)
      if (res.status === 409 && data.code === "spot_taken") {
        setSpotPopup(true);
        loadTaken();
        return;
      }
      if (!res.ok || !data.order) throw new Error(data.error ?? "สร้างรายการไม่สำเร็จ");
      setOrderKind(kind);
      setOrder(data.order);
      // จำไว้ในเครื่อง เผื่อลูกค้ารีเฟรชหน้าระหว่างรอชำระ
      if (data.order.status === "awaiting_payment") rememberPending({ id: data.order.id, room: roomId, kind, amount: data.order.payAmount ? Number(data.order.payAmount) : data.order.amount, at: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  function submitGiant(e: FormEvent) {
    e.preventDefault();
    if (!giantChosen) return setError("เลือกหรือกรอกยอดก่อน");
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดงบนป้าย");
    create("giant", { amount: giantChosen, name: name.trim(), message: message.trim(), look, spot: spotPick });
  }

  function submitMessage(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณาใส่ชื่อผู้ส่ง");
    if (!message.trim()) return setError("กรุณาใส่ข้อความที่จะขึ้นจอ");
    create("message", { name: name.trim(), message: message.trim(), theme });
  }

  function submitDecor(e: FormEvent) {
    e.preventDefault();
    if (!decor) return;
    if (!name.trim()) return setError("กรุณาใส่ชื่อที่จะแสดงบนตุ๊กตา");
    create("decor", { decor: { ...decor.parts, slot: decor.slot }, name: name.trim() });
  }

  const title = {
    menu: "Exclusive",
    giant: "ตั้งบ้านหิมะ Exclusive",
    message: "ข้อความอวยพรขึ้นจอ",
    decor: "วางตุ๊กตาหิมะ Exclusive",
  }[view];

  const themeOptions = (
    <div className="xmas-theme-list" role="radiogroup" aria-label="ธีมการแสดง">
      {THEMES.map((t) => (
        <button type="button" key={t.id} role="radio" aria-checked={theme === t.id} className={`xmas-theme-opt ${theme === t.id ? "is-on" : ""}`} onClick={() => setTheme(t.id)}>
          <span className="xmas-theme-ico">
            <Icon name={t.icon} size={22} />
          </span>
          <span>
            <b>{t.label}</b>
            <small>{t.hint}</small>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="xmas-modal-back" role="presentation" onClick={locked ? undefined : onClose}>
      <div className="xmas-modal xmas-exclusive" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {!locked && (
          <button className="xmas-x" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
        )}

        <p className="xmas-kicker">Exclusive · {roomName}</p>
        <h2>{title}</h2>
        {cfgError && <p className="xmas-msg err">{cfgError}</p>}
        {disabled && <p className="xmas-msg err">ตอนนี้ปิดรับการสนับสนุนชั่วคราว</p>}

        {order && <PaymentPanel order={order} onUpdate={setOrder} onClose={() => onPaid(orderKind, name.trim())} />}

        {spotPopup && (
          <div className="xmas-spot-popup" role="alertdialog" aria-modal="true" aria-labelledby="xmas-spot-popup-title">
            <div className="xmas-spot-popup-card">
              <p id="xmas-spot-popup-title" className="xmas-spot-popup-title">น่าเสียดายจัง</p>
              <p>ช่องนี้มีคนเอาไปแล้ว เลือกช่องใหม่นะ</p>
              <button type="button" className="xmas-submit" onClick={closeSpotPopup}>
                เลือกช่องใหม่
              </button>
            </div>
          </div>
        )}

        {/* เมนู: สองฟีเจอร์แยกการ์ด */}
        {!order && cfg && !disabled && view === "menu" && (
          <div className="xmas-ex-menu">
            <p className="xmas-sup-lead">เลือกฟีเจอร์ที่ต้องการ แต่ละแบบชำระแยกกัน</p>
            <button type="button" className="xmas-ex-card" onClick={() => setView("giant")}>
              <span className="xmas-ex-icon" aria-hidden>
                <Icon name="crown" size={26} />
              </span>
              <span className="xmas-ex-body">
                <b>บ้านหิมะ Exclusive</b>
                <small>บ้านโมเดลหิมะหลังใหญ่ เลือกสีผนังและป้ายข้อความของคุณได้ ตั้งไว้บนลาน</small>
                <em>เริ่มที่ ฿{cfg.presetPrices[0]}</em>
              </span>
              <span className="xmas-ex-arrow" aria-hidden>
                ›
              </span>
            </button>
            <button type="button" className="xmas-ex-card" onClick={() => setView("message")}>
              <span className="xmas-ex-icon" aria-hidden>
                <Icon name="sparkle" size={26} />
              </span>
              <span className="xmas-ex-body">
                <b>ข้อความอวยพรขึ้นจอ</b>
                <small>ข้อความของคุณขึ้นบนท้องฟ้าให้ทุกคนในห้องเห็นพร้อมกัน เลือกธีมการแสดงได้</small>
                <em>฿{cfg.messagePrice}</em>
              </span>
              <span className="xmas-ex-arrow" aria-hidden>
                ›
              </span>
            </button>
          </div>
        )}

        {/* บ้านหิมะ Exclusive: ซ้ายเลือกและพิมพ์ ขวาดูตุ๊กตาและป้ายแบบเรียลไทม์ */}
        {!order && cfg && !disabled && view === "giant" && (
          <form className="xmas-ex-split" onSubmit={submitGiant}>
            <button type="button" className="xmas-ex-back" onClick={() => goView("menu")}>
              ← กลับไปเลือกฟีเจอร์
            </button>
            <div className="xmas-ex-col">
              <section className="xmas-sec" data-step="0" data-on={step === 0}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">1</span>
                  <h3>ยอดที่ชำระ</h3>
                </header>
                <div className="xmas-tier-grid">
                  {cfg.presetPrices.map((p, i) => (
                    <button
                      type="button"
                      key={p}
                      className={amount === p ? "is-on" : ""}
                      aria-pressed={amount === p}
                      onClick={() => {
                        setAmount(p);
                        setCustom("");
                      }}
                    >
                      <b>฿{p}</b>
                      {TIER_NAMES[i] && <small>{TIER_NAMES[i]}</small>}
                    </button>
                  ))}
                </div>
                <label className="xmas-sup-custom">
                  <span>หรือกรอกจำนวนเอง</span>
                  <div>
                    <b>฿</b>
                    <input
                      inputMode="numeric"
                      value={custom}
                      placeholder={`${cfg.customMin}–${cfg.customMax}`}
                      onChange={(e) => {
                        setCustom(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setAmount(null);
                      }}
                    />
                  </div>
                </label>
                <div className="xmas-sup-field">
                  <span>ตำแหน่งบนลาน</span>
                  <SpotMap taken={taken} held={held} value={spotPick} onPick={(i) => setSpotPick(i)} />
                  {spotPick !== null && (
                    <button type="button" className="xmas-studio-del" onClick={() => setSpotPick(null)}>
                      ให้ระบบเลือกให้
                    </button>
                  )}
                </div>
              </section>

              <section className="xmas-sec" data-step="1" data-on={step === 1}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">2</span>
                  <h3>ตกแต่ง · ฐานและของบนฐาน</h3>
                </header>
                <PickRow title="ลายฐาน" options={DIORAMA_BASES} value={look.base} onChange={(v) => setPart("base", v)} />
                <DioramaStudio items={look.items} selectedId={selId} onSelect={setSelId} onChange={setItems} />
              </section>

              <section className="xmas-sec" data-step="2" data-on={step === 2}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">3</span>
                  <h3>ตกแต่ง · ป้ายชื่อเล็ก</h3>
                </header>
                <PickRow title="สีป้าย" options={SIGN_BOARDS} value={look.board} onChange={(v) => setPart("board", v)} />
              </section>

              <section className="xmas-sec" data-step="3" data-on={step === 3}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">4</span>
                  <h3>ชื่อและข้อความบนป้าย</h3>
                </header>
                <label className="xmas-sup-field">
                  <span>ชื่อที่จะแสดง</span>
                  <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
                </label>
                <label className="xmas-sup-field">
                  <span>
                    ข้อความบนป้าย <em>{message.length}/80</em>
                  </span>
                  <textarea value={message} maxLength={80} rows={2} onChange={(e) => setMessage(e.target.value)} placeholder="เขียนสิ่งที่อยากบอกทุกคนในห้อง" />
                </label>
                <div className="xmas-sup-chips">
                  {THANKS_CHIPS.map((t) => (
                    <button type="button" key={t} onClick={() => setMessage(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <aside className="xmas-ex-col xmas-ex-side">
              <div className="xmas-sign-stage">
                <DioramaViewer
                  look={look}
                  name={name.trim() || "ชื่อของคุณ"}
                  message={message.trim() || "ข้อความของคุณจะขึ้นตรงนี้"}
                  selectedId={selId}
                  onSelect={setSelId}
                  onMove={(id, x, z) => setLook((l) => ({ ...l, items: l.items.map((it) => (it.id === id ? { ...it, x, z } : it)) }))}
                />
              </div>
              <p className="xmas-hint">ตัวอย่างนี้อัปเดตตามที่เลือกและพิมพ์ ลากชิ้นของบนฐานเพื่อจัดตำแหน่งได้อิสระ ลากพื้นที่ว่างเพื่อหมุนดู</p>
              <div className="xmas-ex-final" data-step="3" data-on={step === 3}>
                {error && <p className="xmas-msg err">{error}</p>}
                <button className="xmas-submit" disabled={busy}>
                  {busy ? "กำลังสร้างรายการ…" : giantChosen ? `ชำระ ฿${giantChosen}` : "เลือกยอดก่อน"}
                </button>
              </div>
            </aside>
            <WizardNav step={step} last={3} setStep={setStep} />
          </form>
        )}

        {/* ข้อความขึ้นจอ: ซ้ายเลือกธีมและพิมพ์ ขวาดูการแสดงจริงแบบเรียลไทม์ */}
        {!order && cfg && !disabled && view === "message" && (
          <form className="xmas-ex-split" onSubmit={submitMessage}>
            <button type="button" className="xmas-ex-back" onClick={() => goView("menu")}>
              ← กลับไปเลือกฟีเจอร์
            </button>
            <div className="xmas-ex-col">
              <section className="xmas-sec" data-step="0" data-on={step === 0}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">1</span>
                  <h3>ธีมการแสดง</h3>
                </header>
                {themeOptions}
              </section>
              <section className="xmas-sec" data-step="1" data-on={step === 1}>
                <header className="xmas-sec-head">
                  <span className="xmas-sup-num">2</span>
                  <h3>ผู้ส่งและข้อความ</h3>
                </header>
                <label className="xmas-sup-field">
                  <span>ชื่อผู้ส่ง</span>
                  <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
                </label>
                <label className="xmas-sup-field">
                  <span>
                    ข้อความที่จะขึ้นจอ <em>{message.length}/80</em>
                  </span>
                  <textarea value={message} maxLength={80} rows={3} onChange={(e) => setMessage(e.target.value)} placeholder="ขอให้ทุกคนมีความสุขในวันคริสต์มาส" />
                </label>
                <div className="xmas-sup-chips">
                  {THANKS_CHIPS.map((t) => (
                    <button type="button" key={t} onClick={() => setMessage(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <aside className="xmas-ex-col xmas-ex-side">
              <SkyCanvas theme={theme} text={message.trim() || "ข้อความของคุณจะขึ้นบนท้องฟ้า"} by={name.trim() || "ชื่อผู้ส่ง"} />
              <p className="xmas-hint">ตัวอย่างนี้คือการแสดงจริงที่ทุกคนในห้องจะเห็นพร้อมกัน</p>
              <div className="xmas-ex-final" data-step="1" data-on={step === 1}>
                {error && <p className="xmas-msg err">{error}</p>}
                <button className="xmas-submit" disabled={busy}>
                  {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${cfg.messagePrice}`}
                </button>
              </div>
            </aside>
            <WizardNav step={step} last={1} setStep={setStep} />
          </form>
        )}

        {/* ตุ๊กตาที่วางจากฟอร์มตกแต่ง */}
        {!order && cfg && !disabled && view === "decor" && decor && (
          <form className="xmas-decor-pay" onSubmit={submitDecor}>
            <div className="xmas-decor-pay-preview">
              <SnowmanPreview parts={decor.parts} className="xmas-donate-snow" />
              <span>ช่อง {decor.slot + 1}</span>
            </div>
            <div className="xmas-decor-pay-form">
              <p className="xmas-hint">ชำระ ฿{cfg.decorPrice} สำหรับตุ๊กตา 1 ตัว วางบนช่องที่เลือกได้ แม้เป็นช่องสงวน</p>
              <label className="xmas-sup-field">
                <span>ชื่อที่จะแสดงบนตุ๊กตา</span>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" />
              </label>
              {error && <p className="xmas-msg err">{error}</p>}
              <button className="xmas-submit" disabled={busy}>
                {busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${cfg.decorPrice}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
