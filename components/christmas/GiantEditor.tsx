"use client";

// หน้าตั้งบ้านหิมะ Exclusive แบบหน้าเดียว: ตัวอย่าง 3 มิติอยู่บนสุดตลอด ด้านล่างเป็นทีละขั้น (แพ็กเกจ → ตกแต่ง → ป้ายชื่อ)
// ระดับของบ้านขึ้นกับยอดสนับสนุน ตัวเลือกที่เกินสิทธิ์แสดงเป็นแม่กุญแจพร้อมปุ่มอัปเกรด
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BASE_LABEL,
  BOARD_LABEL,
  clampLook,
  FENCE_LABEL,
  FENCES,
  fits,
  freeSpot,
  GIANT_TIERS,
  giantTier,
  HOUSE_LABEL,
  HOUSE_ROOFS,
  HOUSE_STYLES,
  HOUSE_WALLS,
  DIORAMA_BASES,
  DIORAMA_KINDS,
  makeItem,
  PALETTE,
  partsFor,
  randomLook,
  SIGN_BOARDS,
  specFor,
  tierLook,
  type DioramaItem,
  type GiantLook,
  type GiantTier,
  type PaletteKey,
} from "@/lib/christmas/giant";
import { CELL, LAND_R, TREE_CORE_R } from "@/lib/christmas/grid";
import { DECOR_SPOTS, GIANT_POSITIONS, ZONE, ZONE_GATE } from "@/lib/christmas/slots";
import { DioramaViewer } from "./DioramaViewer";

const COLOR_LABEL: Record<string, string> = {
  cream: "ครีม", red: "แดง", mint: "มิ้นต์", sky: "ฟ้า", pink: "ชมพู", wood: "ไม้", white: "ขาว", forest: "เขียวเข้ม", navy: "กรมท่า", berry: "เบอร์รี่", black: "ดำ", gold: "ทอง",
  green: "เขียว", blue: "น้ำเงิน", purple: "ม่วง", orange: "ส้ม", silver: "เงิน", warm: "อุ่น",
};
const THANKS_CHIPS = ["ขอบคุณที่ทำให้คริสต์มาสนี้อบอุ่น", "ขอให้ปีใหม่มีแต่รอยยิ้ม", "สุขสันต์วันคริสต์มาสนะ"];
const hexOf = (k: string) => (k in PALETTE ? `#${PALETTE[k as PaletteKey].toString(16).padStart(6, "0")}` : undefined);

// ---------- แผนที่ลาน (มองจากด้านบน) ----------
const MAP_PX = 360;
function SpotMap({ taken, held, value, onPick }: { taken: Set<number>; held: Set<number>; value: number | null; onPick: (i: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = MAP_PX / (LAND_R * 2 + 4);
  const toPx = (x: number, z: number) => [MAP_PX / 2 + x * scale, MAP_PX / 2 + z * scale] as const;
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, MAP_PX, MAP_PX);
    g.beginPath();
    g.arc(...toPx(0, 0), LAND_R * scale, 0, Math.PI * 2);
    g.fillStyle = "#f4f8fc";
    g.fill();
    g.strokeStyle = "rgba(40,110,70,0.35)";
    g.lineWidth = 2;
    g.stroke();
    const [gx, gz] = toPx(ZONE_GATE.x, ZONE_GATE.z);
    g.beginPath();
    g.moveTo(...toPx(0, 0));
    g.lineTo(gx, gz);
    g.strokeStyle = "rgba(120,110,100,0.6)";
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = "rgba(20,90,60,0.18)";
    if (ZONE.round) {
      g.beginPath();
      g.arc(...toPx(ZONE.x, ZONE.z), ZONE.half * scale, 0, Math.PI * 2);
      g.fill();
    } else {
      const [zx, zz] = toPx(ZONE.x - ZONE.half, ZONE.z - ZONE.half);
      g.fillRect(zx, zz, ZONE.half * 2 * scale, ZONE.half * 2 * scale);
    }
    for (const d of DECOR_SPOTS) {
      g.beginPath();
      g.arc(...toPx(d.x, d.z), Math.max(d.r * scale, 1.5), 0, Math.PI * 2);
      g.fillStyle = d.kind === "grove" ? "rgba(21,83,45,0.35)" : "rgba(180,140,60,0.55)";
      g.fill();
    }
    g.fillStyle = "rgba(20,70,50,0.7)";
    g.font = "600 11px sans-serif";
    g.textAlign = "center";
    g.fillText("โซนคำอวยพร", ...toPx(ZONE.x, ZONE.z));
    g.beginPath();
    g.arc(...toPx(0, 0), TREE_CORE_R * scale, 0, Math.PI * 2);
    g.fillStyle = "#14532d";
    g.fill();
    const side = 2 * CELL * scale;
    GIANT_POSITIONS.forEach((p, i) => {
      if (p.blocked) return;
      const [px, pz] = toPx(p.x, p.z);
      g.fillStyle = i === value ? "#facc15" : taken.has(i) ? "#ef4444" : held.has(i) ? "#f59e0b" : "#22c55e";
      g.fillRect(px - side / 2, pz - side / 2, side, side);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, held, value, scale]);
  function pick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cv = ref.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = (((e.clientX - rect.left) * MAP_PX) / rect.width - MAP_PX / 2) / scale;
    const z = (((e.clientY - rect.top) * MAP_PX) / rect.height - MAP_PX / 2) / scale;
    let best = -1;
    let bestD = Infinity;
    GIANT_POSITIONS.forEach((p, i) => {
      if (p.blocked) return;
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
    <div className="xgh-map">
      <canvas ref={ref} width={MAP_PX} height={MAP_PX} onClick={pick} role="img" aria-label="แผนที่ลาน เลือกจุดตั้งบ้านหิมะ" />
      <p className="xmas-hint">เขียว = ว่าง · ส้ม = มีคนกำลังจอง · แดง = ซื้อแล้ว · ทอง = ที่คุณเลือก</p>
    </div>
  );
}

// ---------- แถวตัวเลือกเลื่อนแนวนอน (ไม่ต้องเลื่อนหน้าขึ้นลง) ----------
// ตัวเลือกที่เกินสิทธิ์ของระดับแสดงแม่กุญแจ กดแล้วบอกว่าต้องอัปเกรดเป็นระดับไหน
function Row({ title, options, value, allowed, onPick, onLocked, labels, swatch = false }: { title: string; options: readonly string[]; value: string; allowed: readonly string[]; onPick: (v: string) => void; onLocked: (v: string) => void; labels?: Record<string, string>; swatch?: boolean }) {
  return (
    <div className="xgh-row">
      <span className="xgh-row-title">{title}</span>
      <div className="xgh-chips" role="radiogroup" aria-label={title}>
        {[...options.filter((o) => allowed.includes(o)), ...options.filter((o) => !allowed.includes(o))].map((o) => {
          const ok = allowed.includes(o);
          return (
            <button key={o} type="button" role="radio" aria-checked={value === o} className={`${value === o ? "is-on" : ""} ${ok ? "" : "is-locked"}`} onClick={() => (ok ? onPick(o) : onLocked(o))}>
              {swatch && hexOf(o) && <i className="xgh-dot" style={{ background: hexOf(o) }} aria-hidden />}
              {labels?.[o] ?? COLOR_LABEL[o] ?? o}
              {!ok && <span aria-label="ล็อก"> 🔒</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Tab = "house" | "color" | "base" | "items";
const TABS: { id: Tab; label: string }[] = [
  { id: "house", label: "บ้าน" },
  { id: "color", label: "สี" },
  { id: "base", label: "รั้วและฐาน" },
  { id: "items", label: "ของแต่ง" },
];

export type GiantEditorProps = {
  presetPrices: readonly number[];
  customMin: number;
  customMax: number;
  amount: number | null;
  custom: string;
  setAmount: (v: number | null) => void;
  setCustom: (v: string) => void;
  look: GiantLook;
  setLook: (fn: (l: GiantLook) => GiantLook) => void;
  selId: string | null;
  setSelId: (id: string | null) => void;
  spotPick: number | null;
  setSpotPick: (v: number | null) => void;
  taken: Set<number>;
  held: Set<number>;
  onPickOnScene?: () => void;
  name: string;
  setName: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  error: string;
  busy: boolean;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
};

export function GiantEditor(p: GiantEditorProps) {
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<Tab>("house");
  const [note, setNote] = useState<{ text: string; upgrade?: GiantTier } | null>(null);
  const [alert, setAlert] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const touched = useRef(false);
  const chosen = p.amount ?? (p.custom ? Number(p.custom) : null);
  const validAmount = chosen !== null && Number.isInteger(chosen) && (p.presetPrices.includes(chosen) || (chosen >= p.customMin && chosen <= p.customMax));
  const tier = giantTier(validAmount ? (chosen as number) : 0);
  const priceOf = (t: GiantTier) => Math.max(t.min, p.customMin);

  // ระดับเปลี่ยน: ยังไม่ได้แต่งเองใช้บ้านตั้งต้นของระดับใหม่ แต่งแล้วเก็บไว้แต่ตัดส่วนที่เกินสิทธิ์
  const lastTier = useRef(-1);
  useEffect(() => {
    if (lastTier.current === tier.id) return;
    lastTier.current = tier.id;
    p.setLook((l) => (touched.current ? clampLook(l, tier) : tierLook(tier)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier.id]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4200);
    return () => clearTimeout(t);
  }, [note]);

  const edit = (fn: (l: GiantLook) => GiantLook) => {
    touched.current = true;
    p.setLook(fn);
  };
  const locked = (what: string, need: (t: GiantTier) => boolean) => {
    const up = GIANT_TIERS.find((t) => t.id > tier.id && need(t));
    setNote({ text: up ? `${what} สำหรับแพ็กเกจ ${up.name} (฿${priceOf(up)} ขึ้นไป)` : `${what} ยังไม่เปิดให้เลือก`, upgrade: up });
  };
  function choose(t: GiantTier) {
    p.setAmount(priceOf(t));
    p.setCustom("");
    setAlert(false);
  }
  function setHouse(house: string) {
    edit((l) => {
      const kept: DioramaItem[] = [];
      for (const it of l.items) {
        if (fits(kept, it, undefined, house)) kept.push(it);
        else {
          const spot = freeSpot(kept, it.kind, house);
          if (spot) kept.push({ ...it, ...spot });
        }
      }
      return { ...l, house, items: kept };
    });
  }
  function addItem(kind: string) {
    const l = p.look;
    if (l.items.length >= tier.maxItems) return setNote({ text: `แพ็กเกจนี้วางของได้ ${tier.maxItems} ชิ้น`, upgrade: GIANT_TIERS[tier.id + 1] });
    const spot = freeSpot(l.items, kind, l.house);
    if (!spot) return setNote({ text: "พื้นที่บนฐานเต็มแล้ว ลองย้ายหรือเอาชิ้นอื่นออกก่อน" });
    const item = makeItem(Math.random().toString(36).slice(2, 10), kind, spot.x, spot.z);
    edit((x) => ({ ...x, items: [...x.items, item] }));
    p.setSelId(item.id);
  }
  function shuffle() {
    touched.current = true;
    p.setLook(() => randomLook(tier));
    p.setSelId(null);
  }
  const sel = p.look.items.find((it) => it.id === p.selId) ?? null;
  const patchSel = (patch: Partial<DioramaItem>) => sel && edit((l) => ({ ...l, items: l.items.map((it) => (it.id === sel.id ? { ...it, ...patch } : it)) }));
  const deg = sel ? Math.round((((sel.r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI)) % 360 : 0;

  function next() {
    if (step === 0 && !validAmount) {
      setAlert(true);
      setNote({ text: chosen ? `ยอดต้องอยู่ระหว่าง ฿${p.customMin}–฿${p.customMax}` : "เลือกแพ็กเกจหรือกรอกยอดก่อน แล้วค่อยกดถัดไป" });
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  }

  const hasHouse = p.look.house && p.look.house !== "none";
  let body: ReactNode = null;
  if (step === 0) {
    body = (
      <>
        <div className={`xgh-tiers ${alert ? "is-alert" : ""}`} role="radiogroup" aria-label="แพ็กเกจ">
          {GIANT_TIERS.map((t) => {
            const on = validAmount && tier.id === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} className={`xgh-tier t${t.id} ${on ? "is-on" : ""}`} onClick={() => choose(t)}>
                <b>฿{priceOf(t)}{t.id === 3 ? "+" : ""}</b>
                <span>{t.name}</span>
                <small>{t.blurb}</small>
              </button>
            );
          })}
        </div>
        <label className="xgh-custom">
          <span>หรือกรอกยอดเอง</span>
          <b>฿</b>
          <input
            inputMode="numeric"
            value={p.custom}
            placeholder={`${p.customMin}–${p.customMax}`}
            onChange={(e) => {
              p.setCustom(e.target.value.replace(/\D/g, "").slice(0, 6));
              p.setAmount(null);
              setAlert(false);
            }}
          />
          {validAmount && <em>ได้แพ็กเกจ {tier.name}</em>}
        </label>
        <div className="xgh-spot">
          <div className="xgh-spot-info">
            <span>ตำแหน่งบนลาน</span>
            <b>{p.spotPick === null ? "ระบบเลือกให้ตอนชำระ" : `จุด ${p.spotPick + 1}`}</b>
          </div>
          {p.onPickOnScene && (
            <button type="button" className="xgh-btn is-gold" onClick={p.onPickOnScene}>
              เลือกบนฉาก
            </button>
          )}
          <button type="button" className="xgh-btn" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
            {showMap ? "ซ่อนแผนที่" : "แผนที่"}
          </button>
          {p.spotPick !== null && (
            <button type="button" className="xgh-btn is-ghost" onClick={() => p.setSpotPick(null)}>
              ให้ระบบเลือก
            </button>
          )}
        </div>
        {showMap && <SpotMap taken={p.taken} held={p.held} value={p.spotPick} onPick={(i) => p.setSpotPick(i)} />}
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <div className="xgh-tabs" role="tablist" aria-label="หมวดการตกแต่ง">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <button type="button" className="xgh-dice" onClick={shuffle} title="สุ่มแต่งทั้งหลังตามแพ็กเกจ">
            🎲 สุ่ม
          </button>
        </div>
        <div className="xgh-panel" role="tabpanel">
          {tab === "house" && (
            <>
              <Row title="แบบบ้าน" options={HOUSE_STYLES} value={p.look.house ?? "none"} allowed={tier.houses} labels={HOUSE_LABEL} onPick={setHouse} onLocked={(v) => locked(HOUSE_LABEL[v] ?? v, (t) => t.houses.includes(v))} />
              <p className="xgh-tierline">
                แพ็กเกจ <b>{tier.name}</b> · {tier.title}
              </p>
            </>
          )}
          {tab === "color" && (
            <>
              {hasHouse && <Row title={p.look.house === "igloo" ? "สีน้ำแข็ง" : p.look.house === "gingerbread" ? "สีลูกกวาด" : "สีผนัง"} options={HOUSE_WALLS} value={p.look.wall ?? "cream"} allowed={tier.walls} swatch onPick={(v) => edit((l) => ({ ...l, wall: v }))} onLocked={(v) => locked(`สี${COLOR_LABEL[v] ?? v}`, (t) => t.walls.includes(v))} />}
              {hasHouse && p.look.house !== "igloo" && <Row title="สีหลังคา" options={HOUSE_ROOFS} value={p.look.roof ?? "red"} allowed={tier.roofs} swatch onPick={(v) => edit((l) => ({ ...l, roof: v }))} onLocked={(v) => locked(`สี${COLOR_LABEL[v] ?? v}`, (t) => t.roofs.includes(v))} />}
              <Row title="สีป้ายชื่อ" options={SIGN_BOARDS} value={p.look.board} allowed={tier.boards} labels={BOARD_LABEL} onPick={(v) => edit((l) => ({ ...l, board: v }))} onLocked={(v) => locked(`ป้าย${BOARD_LABEL[v] ?? v}`, (t) => t.boards.includes(v))} />
            </>
          )}
          {tab === "base" && (
            <>
              <Row title="รั้วรอบฐาน" options={FENCES} value={p.look.fence ?? "none"} allowed={tier.fences} labels={FENCE_LABEL} onPick={(v) => edit((l) => ({ ...l, fence: v }))} onLocked={(v) => locked(FENCE_LABEL[v] ?? v, (t) => t.fences.includes(v))} />
              <Row title="ลายฐาน" options={DIORAMA_BASES} value={p.look.base} allowed={tier.bases} labels={BASE_LABEL} onPick={(v) => edit((l) => ({ ...l, base: v }))} onLocked={(v) => locked(`ฐาน${BASE_LABEL[v] ?? v}`, (t) => t.bases.includes(v))} />
            </>
          )}
          {tab === "items" && (
            <>
              <Row
                title={`เพิ่มของ (${p.look.items.length}/${tier.maxItems})`}
                options={DIORAMA_KINDS}
                value=""
                allowed={tier.kinds}
                labels={Object.fromEntries(DIORAMA_KINDS.map((k) => [k, `+ ${specFor(k)?.label ?? k}`]))}
                onPick={addItem}
                onLocked={(v) => locked(specFor(v)?.label ?? v, (t) => t.kinds.includes(v))}
              />
              {p.look.items.length > 0 && (
                <div className="xgh-row">
                  <span className="xgh-row-title">ของบนฐาน · แตะเพื่อแต่งสี หรือลากในตัวอย่างเพื่อย้าย</span>
                  <div className="xgh-chips">
                    {p.look.items.map((it, i) => (
                      <button key={it.id} type="button" className={it.id === p.selId ? "is-on" : ""} onClick={() => p.setSelId(it.id === p.selId ? null : it.id)}>
                        {i + 1}. {specFor(it.kind)?.label ?? it.kind}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sel && (
                <div className="xgh-sel">
                  {partsFor(sel.kind).map((part) => (
                    <Row key={part.key} title={part.label} options={part.options} value={sel.parts[part.key] ?? part.options[0]} allowed={part.options} swatch onPick={(v) => patchSel({ parts: { ...sel.parts, [part.key]: v } })} onLocked={() => {}} />
                  ))}
                  <div className="xgh-sel-tools">
                    <label className="xgh-rot">
                      หมุน <em>{deg}°</em>
                      <input type="range" min={0} max={359} value={deg} onChange={(e) => patchSel({ r: (Number(e.target.value) * Math.PI) / 180 })} />
                    </label>
                    <button
                      type="button"
                      className="xgh-btn is-danger"
                      onClick={() => {
                        edit((l) => ({ ...l, items: l.items.filter((it) => it.id !== sel.id) }));
                        p.setSelId(null);
                      }}
                    >
                      เอาออก
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <label className="xgh-field">
          <span>ชื่อบนป้าย</span>
          <input value={p.name} maxLength={20} onChange={(e) => p.setName(e.target.value)} placeholder="เช่น ฟ้า" />
        </label>
        <label className="xgh-field">
          <span>
            ข้อความบนป้าย <em>{p.message.length}/80</em>
          </span>
          <textarea value={p.message} maxLength={80} rows={2} onChange={(e) => p.setMessage(e.target.value)} placeholder="เขียนสิ่งที่อยากบอกทุกคนในห้อง" />
        </label>
        <div className="xgh-chips">
          {THANKS_CHIPS.map((t) => (
            <button type="button" key={t} onClick={() => p.setMessage(t)}>
              {t}
            </button>
          ))}
        </div>
        {p.error && <p className="xmas-msg err">{p.error}</p>}
        <button className="xmas-submit xgh-pay" disabled={p.busy}>
          {p.busy ? "กำลังสร้างรายการ…" : `ชำระ ฿${chosen} · แพ็กเกจ ${tier.name}`}
        </button>
      </>
    );
  }

  return (
    <form className="xgh" onSubmit={p.onSubmit}>
      <div className={`xgh-preview t${tier.id}`}>
        <DioramaViewer
          look={p.look}
          name={p.name.trim() || "ชื่อของคุณ"}
          message={p.message.trim() || "ข้อความของคุณจะขึ้นตรงนี้"}
          selectedId={p.selId}
          onSelect={p.setSelId}
          onMove={(id, x, z) => edit((l) => ({ ...l, items: l.items.map((it) => (it.id === id ? { ...it, x, z } : it)) }))}
        />
        {validAmount && <span className={`xgh-badge t${tier.id}`}>{tier.name}</span>}
      </div>
      <ol className="xgh-steps" aria-label="ขั้นตอน">
        {["แพ็กเกจ", "ตกแต่ง", "ป้ายชื่อ"].map((s, i) => (
          <li key={s} className={i === step ? "is-on" : i < step ? "is-done" : ""}>
            <button type="button" onClick={() => (i <= step || validAmount ? setStep(i) : next())}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="xgh-body">{body}</div>
      {note && (
        <div className="xgh-note" role="alert">
          <span>{note.text}</span>
          {note.upgrade && (
            <button
              type="button"
              onClick={() => {
                choose(note.upgrade!);
                setNote(null);
              }}
            >
              อัปเกรดเป็น ฿{priceOf(note.upgrade)}
            </button>
          )}
        </div>
      )}
      <nav className="xgh-nav" aria-label="ขั้นตอน">
        <button type="button" className="xgh-btn is-ghost" onClick={() => (step === 0 ? p.onBack() : setStep(step - 1))}>
          {step === 0 ? "← เมนู" : "ย้อนกลับ"}
        </button>
        <span className="xgh-count">ขั้นที่ {step + 1}/3</span>
        {step < 2 ? (
          <button type="button" className={`xgh-btn is-primary ${step === 0 && !validAmount ? "is-wait" : ""}`} onClick={next}>
            ถัดไป
          </button>
        ) : (
          <span />
        )}
      </nav>
    </form>
  );
}
