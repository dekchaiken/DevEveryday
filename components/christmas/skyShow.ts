// การแสดง "ข้อความอวยพรขึ้นจอ" แบบเต็มจอ: เปิดตัว → เอฟเฟกต์ตามธีม → ข้อความค่อย ๆ ปรากฏ → แสงวิ่งผ่าน → ปิดฉาก
// วาดด้วย canvas 2D ล้วน ไม่มีรูปภาพภายนอก
// ความลื่น: กรอบและตัวอักษรวาดครั้งเดียวเก็บเป็นภาพ (เลเยอร์) อนุภาคทุกชิ้นใช้ภาพสำเร็จรูป (sprite) จึงไม่ต้องคำนวณแสงเงาทุกเฟรม
// ทุกอย่างคำนวณจากเวลา t จึงวาดซ้ำได้ตรงกันทุกเครื่องโดยไม่ต้องเก็บสถานะของอนุภาค
import { DEFAULT_SKY_STYLE, type SkyFont, type SkyPalette, type SkyStyle } from "@/lib/christmas/skyStyle";
import { SKY_FONT_CLASSES } from "./skyFonts";

export type SkyShowOpts = { text: string; by: string; style: SkyStyle };

// ---------- ชุดสี ----------
type Pal = { top: string; bot: string; ink: string; accent: string; frameA: string; frameB: string; glow: string; tint: string; parts: string[] };
const PAL: Record<SkyPalette, Pal> = {
  gold: { top: "#134434", bot: "#061a13", ink: "#fff8e6", accent: "#f5d27a", frameA: "#fff3c8", frameB: "#c9a255", glow: "#f5c542", tint: "4,18,13", parts: ["#f5c542", "#fff6d8", "#f08a5d", "#ffe08a", "#ffffff"] },
  ruby: { top: "#9b1c31", bot: "#3d0612", ink: "#fff6ea", accent: "#f9d57a", frameA: "#fff0c2", frameB: "#d4a24a", glow: "#ff6b81", tint: "30,4,10", parts: ["#ff4d6d", "#f9d57a", "#ffffff", "#ff8fa3", "#ffd6a5"] },
  frost: { top: "#1d4670", bot: "#0a1a2e", ink: "#f2fbff", accent: "#bfe8ff", frameA: "#ffffff", frameB: "#8ec5ff", glow: "#9fdcff", tint: "5,14,28", parts: ["#cfeeff", "#ffffff", "#8ec5ff", "#b8f2ff", "#e0e7ff"] },
  rose: { top: "#8a2a5c", bot: "#33091f", ink: "#fff3f8", accent: "#ffc7dd", frameA: "#fff0f6", frameB: "#f0a8c8", glow: "#ff8fc7", tint: "28,6,18", parts: ["#ff8fc7", "#ffc7dd", "#ffffff", "#f9d57a", "#ff5c9a"] },
  emerald: { top: "#0b6b52", bot: "#032119", ink: "#f0fff8", accent: "#a7f3d0", frameA: "#ecfdf5", frameB: "#6ee7b7", glow: "#34d399", tint: "3,20,15", parts: ["#6ee7b7", "#f5d27a", "#ffffff", "#a7f3d0", "#fde68a"] },
  midnight: { top: "#1e2a6b", bot: "#070a1f", ink: "#f5f7ff", accent: "#c7d2fe", frameA: "#eef2ff", frameB: "#a5b4fc", glow: "#818cf8", tint: "5,7,22", parts: ["#c7d2fe", "#ffffff", "#f5d27a", "#a5b4fc", "#e0e7ff"] },
};

// ---------- ฟอนต์ ----------
const FONT: Record<SkyFont, { v: string; fallback: string; weight: number; scale: number }> = {
  plex: { v: "--font-thai", fallback: '"IBM Plex Sans Thai"', weight: 600, scale: 1 },
  kanit: { v: "--font-sky-kanit", fallback: "Kanit", weight: 600, scale: 1 },
  mali: { v: "--font-sky-mali", fallback: "Mali", weight: 700, scale: 1 },
  sriracha: { v: "--font-sky-sriracha", fallback: "Sriracha", weight: 400, scale: 1.08 },
  chonburi: { v: "--font-sky-chonburi", fallback: "Chonburi", weight: 400, scale: 0.94 },
  charm: { v: "--font-sky-charm", fallback: "Charm", weight: 700, scale: 1.14 },
};
let classesOn = false;
const familyCache = new Map<SkyFont, string>();
export function skyFamily(f: SkyFont): string {
  if (typeof document === "undefined") return FONT[f].fallback;
  if (!classesOn) {
    document.documentElement.classList.add(...SKY_FONT_CLASSES);
    classesOn = true;
  }
  let fam = familyCache.get(f);
  if (!fam) {
    const cs = getComputedStyle(document.documentElement);
    const name = cs.getPropertyValue(FONT[f].v).trim() || FONT[f].fallback;
    const thai = cs.getPropertyValue("--font-thai").trim() || '"IBM Plex Sans Thai"';
    fam = `${name}, ${thai}, system-ui, sans-serif`;
    familyCache.set(f, fam);
  }
  return fam;
}
// โหลดฟอนต์ก่อนวาด (canvas ไม่โหลดฟอนต์ให้เอง) คืน true ถ้าพร้อมแล้ว
const fontReady = new Set<string>();
function ensureFont(f: SkyFont, onReady: () => void): boolean {
  const spec = `${FONT[f].weight} 40px ${skyFamily(f)}`;
  if (fontReady.has(spec)) return true;
  if (typeof document === "undefined" || !document.fonts) return true;
  if (document.fonts.check(spec, "สุข")) {
    fontReady.add(spec);
    return true;
  }
  document.fonts.load(spec, "สุขสันต์").then(
    () => {
      fontReady.add(spec);
      onReady();
    },
    () => {
      fontReady.add(spec);
      onReady();
    },
  );
  return false;
}

// ---------- ตัวช่วย ----------
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const easeBack = (x: number) => {
  const c = clamp01(x) - 1;
  return 1 + 2.4 * c * c * c + 1.4 * c * c;
};
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext("2d")!];
}
function setSpacing(g: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}
// ตัดบรรทัดตามคำภาษาไทย (ใช้ตัวตัดคำของเบราว์เซอร์) ถ้าคำเดียวยาวเกินบรรทัดจึงตัดทีละตัวอักษร
// ไม่แยกสระบน/ล่างและวรรณยุกต์ออกจากพยัญชนะ
type Seg = { segment(s: string): Iterable<{ segment: string }> };
let segmenter: Seg | null | undefined;
function words(text: string): string[] {
  if (segmenter === undefined) {
    const I = Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => Seg };
    segmenter = I.Segmenter ? new I.Segmenter("th", { granularity: "word" }) : null;
  }
  if (!segmenter) return graphemes(text);
  // ไม้ยมก (ๆ) และเครื่องหมายวรรคตอนติดกับคำก่อนหน้าเสมอ บรรทัดจึงไม่ขึ้นต้นด้วย ๆ
  const out: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    if (out.length && /^\s*[ๆ!?.,…]+$/.test(segment)) out[out.length - 1] += segment;
    else if (out.length && /^\s+$/.test(segment) && /^\s*ๆ/.test(text.slice(out.join("").length + segment.length))) out[out.length - 1] += segment;
    else out.push(segment);
  }
  return out;
}
function graphemes(text: string): string[] {
  const units: string[] = [];
  for (const ch of [...text]) {
    if (units.length && /[\u0E31\u0E33-\u0E3A\u0E47-\u0E4E]/.test(ch)) units[units.length - 1] += ch;
    else units.push(ch);
  }
  return units;
}
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  const push = (piece: string) => {
    const next = cur + piece;
    if (g.measureText(next).width <= maxW || !cur.trim()) {
      cur = next;
      return;
    }
    lines.push(cur.trimEnd());
    cur = piece.trimStart();
  };
  for (const w of words(text)) {
    if (g.measureText(w).width > maxW) for (const u of graphemes(w)) push(u);
    else push(w);
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.$/u, "") + "…";
    return kept;
  }
  return lines;
}

// ---------- ภาพสำเร็จรูปของอนุภาค (สร้างครั้งเดียวต่อสี) ----------
const spriteCache = new Map<string, HTMLCanvasElement>();
function sprite(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  let c = spriteCache.get(key);
  if (!c) {
    const [cv, g] = mk(size, size);
    draw(g, size);
    spriteCache.set(key, cv);
    c = cv;
  }
  return c;
}
const glowDot = (color: string) =>
  sprite(`glow|${color}`, 64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.18, color);
    grd.addColorStop(0.45, color + "55");
    grd.addColorStop(1, color + "00");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
const starSprite = (color: string) =>
  sprite(`star|${color}`, 64, (g, s) => {
    g.translate(s / 2, s / 2);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.3, color + "66");
    grd.addColorStop(1, color + "00");
    g.fillStyle = grd;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 2; i++) {
      g.rotate(Math.PI / 2 * i);
      g.beginPath();
      g.moveTo(0, -s * 0.48);
      g.quadraticCurveTo(s * 0.03, -s * 0.03, s * 0.48, 0);
      g.quadraticCurveTo(s * 0.03, s * 0.03, 0, s * 0.48);
      g.quadraticCurveTo(-s * 0.03, s * 0.03, -s * 0.48, 0);
      g.quadraticCurveTo(-s * 0.03, -s * 0.03, 0, -s * 0.48);
      g.fill();
    }
  });
const flakeSprite = () =>
  sprite("flake", 64, (g, s) => {
    g.translate(s / 2, s / 2);
    g.strokeStyle = "#ffffff";
    g.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i / 6) * Math.PI * 2);
      g.lineWidth = s * 0.05;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -s * 0.42);
      g.moveTo(0, -s * 0.2);
      g.lineTo(s * 0.1, -s * 0.28);
      g.moveTo(0, -s * 0.2);
      g.lineTo(-s * 0.1, -s * 0.28);
      g.stroke();
      g.restore();
    }
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    halo.addColorStop(0, "rgba(255,255,255,0.5)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = halo;
    g.fillRect(-s / 2, -s / 2, s, s);
  });
const heartSprite = (color: string) =>
  sprite(`heart|${color}`, 96, (g, s) => {
    g.translate(s / 2, s * 0.54);
    const k = s * 0.36;
    g.shadowColor = color;
    g.shadowBlur = s * 0.14;
    const grd = g.createLinearGradient(0, -k, 0, k);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.25, color);
    grd.addColorStop(1, color);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, k * 0.75);
    g.bezierCurveTo(-k * 1.3, -k * 0.1, -k * 0.7, -k * 1.15, 0, -k * 0.45);
    g.bezierCurveTo(k * 0.7, -k * 1.15, k * 1.3, -k * 0.1, 0, k * 0.75);
    g.fill();
  });
// โคมลอย: กระดาษทรงสอบ มีไฟอุ่นข้างใน
const lanternSprite = () =>
  sprite("lantern", 128, (g, s) => {
    const cx = s / 2;
    const halo = g.createRadialGradient(cx, s * 0.55, 0, cx, s * 0.55, s * 0.5);
    halo.addColorStop(0, "rgba(255,190,90,0.55)");
    halo.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, s, s);
    const body = g.createLinearGradient(0, s * 0.25, 0, s * 0.78);
    body.addColorStop(0, "#ffe3a3");
    body.addColorStop(0.6, "#ffb347");
    body.addColorStop(1, "#ff8a2a");
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(cx - s * 0.17, s * 0.26);
    g.quadraticCurveTo(cx, s * 0.2, cx + s * 0.17, s * 0.26);
    g.lineTo(cx + s * 0.12, s * 0.74);
    g.quadraticCurveTo(cx, s * 0.78, cx - s * 0.12, s * 0.74);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(160,70,20,0.35)";
    g.lineWidth = s * 0.01;
    for (const f of [-0.06, 0, 0.06]) {
      g.beginPath();
      g.moveTo(cx + f * s * 1.5, s * 0.25);
      g.lineTo(cx + f * s, s * 0.75);
      g.stroke();
    }
    const flame = g.createRadialGradient(cx, s * 0.7, 0, cx, s * 0.7, s * 0.09);
    flame.addColorStop(0, "#ffffff");
    flame.addColorStop(0.4, "#ffe08a");
    flame.addColorStop(1, "rgba(255,140,40,0)");
    g.fillStyle = flame;
    g.fillRect(cx - s * 0.1, s * 0.6, s * 0.2, s * 0.2);
  });
const streakSprite = (color: string) =>
  sprite(`streak|${color}`, 256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, s, 0);
    grd.addColorStop(0, color + "00");
    grd.addColorStop(0.85, color + "aa");
    grd.addColorStop(1, "#ffffff");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, s / 2);
    g.lineTo(s * 0.97, s / 2 - s * 0.018);
    g.arc(s * 0.97, s / 2, s * 0.018, -Math.PI / 2, Math.PI / 2);
    g.closePath();
    g.fill();
    const head = g.createRadialGradient(s * 0.96, s / 2, 0, s * 0.96, s / 2, s * 0.05);
    head.addColorStop(0, "#ffffff");
    head.addColorStop(1, color + "00");
    g.fillStyle = head;
    g.fillRect(s * 0.9, s / 2 - s * 0.05, s * 0.1, s * 0.1);
  });
// รังสีแสงด้านหลังข้อความ
const raysSprite = (color: string) =>
  sprite(`rays|${color}`, 512, (g, s) => {
    g.translate(s / 2, s / 2);
    for (let i = 0; i < 14; i++) {
      g.rotate((Math.PI * 2) / 14);
      const grd = g.createLinearGradient(0, 0, s / 2, 0);
      grd.addColorStop(0, color + "88");
      grd.addColorStop(1, color + "00");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(s / 2, -s * 0.05);
      g.lineTo(s / 2, s * 0.05);
      g.closePath();
      g.fill();
    }
  });
// เลื่อนซานตาเงาดำขอบทอง มีกวางสามตัว
const sleighSprite = (color: string) =>
  sprite(`sleigh|${color}`, 512, (g, s) => {
    const k = s / 512;
    g.save();
    g.scale(k, k);
    g.translate(0, 120);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.shadowColor = color;
    g.shadowBlur = 14;
    // กวางสามตัว
    for (let i = 0; i < 3; i++) {
      const x = 300 + i * 66;
      const y = 120 - i * 14;
      g.beginPath();
      g.ellipse(x, y, 26, 11, -0.15, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 4;
      for (const [a, b] of [[-16, -26], [-8, -10], [12, 20], [20, 32]]) {
        g.beginPath();
        g.moveTo(x + a, y + 6);
        g.lineTo(x + b, y + 22);
        g.stroke();
      }
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(x + 20, y - 4);
      g.quadraticCurveTo(x + 30, y - 18, x + 36, y - 28);
      g.stroke();
      g.beginPath();
      g.ellipse(x + 40, y - 31, 9, 6, 0.4, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(x + 36, y - 36);
      g.quadraticCurveTo(x + 30, y - 52, x + 42, y - 58);
      g.moveTo(x + 34, y - 44);
      g.lineTo(x + 24, y - 52);
      g.moveTo(x + 40, y - 38);
      g.quadraticCurveTo(x + 46, y - 54, x + 56, y - 56);
      g.stroke();
    }
    // สายบังเหียน
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(232, 128);
    g.quadraticCurveTo(300, 140, 420, 96);
    g.stroke();
    // ตัวเลื่อนโค้ง
    g.beginPath();
    g.moveTo(90, 100);
    g.quadraticCurveTo(96, 150, 140, 152);
    g.lineTo(212, 152);
    g.quadraticCurveTo(236, 150, 236, 118);
    g.quadraticCurveTo(222, 126, 206, 126);
    g.lineTo(140, 126);
    g.quadraticCurveTo(120, 116, 118, 96);
    g.closePath();
    g.fill();
    // ซานตาและถุงของขวัญ
    g.beginPath();
    g.arc(170, 104, 18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(180, 80, 10, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(172, 72);
    g.quadraticCurveTo(186, 56, 200, 68);
    g.lineTo(190, 74);
    g.fill();
    g.beginPath();
    g.ellipse(128, 100, 20, 18, 0.2, 0, Math.PI * 2);
    g.fill();
    // คันเลื่อน
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(80, 170);
    g.lineTo(220, 170);
    g.quadraticCurveTo(252, 168, 250, 140);
    g.stroke();
    g.lineWidth = 3;
    for (const x of [120, 170, 210]) {
      g.beginPath();
      g.moveTo(x, 152);
      g.lineTo(x, 170);
      g.stroke();
    }
    g.restore();
  });

// ---------- กรอบข้อความ (วาดครั้งเดียว) ----------
type Layout = { W: number; H: number; px: number; py: number; pw: number; ph: number; portrait: boolean };
type Layers = {
  key: string;
  frame: HTMLCanvasElement;
  text: HTMLCanvasElement;
  hi: HTMLCanvasElement;
  pad: number;
  lines: { x: number; y: number; w: number; h: number }[];
  byBox: { x: number; y: number; w: number; h: number };
  bulbs: { x: number; y: number }[];
};

// กรอบข้อความขนาดพอดี อยู่ช่วงบนกลางจอ (ไม่บังทั้งฉาก)
function layoutFor(W: number, H: number): Layout {
  const portrait = W / H < 1.05;
  let pw: number;
  let ph: number;
  let cy: number;
  if (portrait) {
    pw = W * 0.88;
    ph = Math.min(pw * 0.56, H * 0.27);
    cy = H * 0.3;
  } else {
    pw = Math.min(W * 0.5, H * 1.05);
    ph = pw * 0.38;
    cy = H * 0.3;
  }
  return { W, H, pw, ph, px: (W - pw) / 2, py: cy - ph / 2, portrait };
}

function buildLayers(L: Layout, o: SkyShowOpts): Layers {
  const p = PAL[o.style.palette] ?? PAL.gold;
  const frameKind = o.style.frame;
  const pad = Math.round(L.ph * 0.35);
  const fw = L.pw + pad * 2;
  const fh = L.ph + pad * 2;
  const [frame, fg] = mk(fw, fh);
  const x = pad;
  const y = pad;
  const w = L.pw;
  const h = L.ph;
  const u = Math.min(w, h * 2.2) / 100; // หน่วยอ้างอิงขนาด
  const bulbs: { x: number; y: number }[] = [];

  if (frameKind === "glass") {
    const r = u * 9;
    fg.save();
    fg.shadowColor = p.glow;
    fg.shadowBlur = u * 9;
    rr(fg, x, y, w, h, r);
    const bg = fg.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, "rgba(255,255,255,0.26)");
    bg.addColorStop(1, "rgba(255,255,255,0.08)");
    fg.fillStyle = bg;
    fg.fill();
    fg.restore();
    rr(fg, x, y, w, h, r);
    const tint = fg.createLinearGradient(0, y, 0, y + h);
    tint.addColorStop(0, p.top + "dd");
    tint.addColorStop(1, p.bot + "ee");
    fg.fillStyle = tint;
    fg.fill();
    fg.lineWidth = u * 0.5;
    fg.strokeStyle = "rgba(255,255,255,0.75)";
    fg.stroke();
    // แสงสะท้อนกระจกด้านบน
    fg.save();
    rr(fg, x, y, w, h, r);
    fg.clip();
    const sheen = fg.createLinearGradient(x, y, x + w * 0.6, y + h);
    sheen.addColorStop(0, "rgba(255,255,255,0.32)");
    sheen.addColorStop(0.35, "rgba(255,255,255,0.05)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    fg.fillStyle = sheen;
    fg.fillRect(x, y, w, h * 0.55);
    // เกล็ดน้ำแข็งเกาะมุม
    fg.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 70; i++) {
      const corner = i % 4;
      const d = Math.pow(hash(i * 3.3), 2) * u * 16;
      const a = hash(i * 7.7) * Math.PI * 0.5;
      const cx = corner % 2 ? x + w - Math.cos(a) * d : x + Math.cos(a) * d;
      const cy = corner > 1 ? y + h - Math.sin(a) * d : y + Math.sin(a) * d;
      fg.globalAlpha = 0.25 + hash(i) * 0.5;
      fg.beginPath();
      fg.arc(cx, cy, u * (0.25 + hash(i * 1.9) * 0.6), 0, Math.PI * 2);
      fg.fill();
    }
    fg.restore();
  } else if (frameKind === "neon") {
    const r = u * 7;
    rr(fg, x, y, w, h, r);
    const bg = fg.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, "rgba(8,6,20,0.86)");
    bg.addColorStop(1, "rgba(4,3,12,0.9)");
    fg.fillStyle = bg;
    fg.fill();
    for (const [inset, col, lw] of [
      [0, p.glow, 1.1],
      [u * 2.4, p.accent, 0.6],
    ] as [number, string, number][]) {
      fg.save();
      fg.shadowColor = col;
      fg.shadowBlur = u * 4;
      fg.strokeStyle = col;
      fg.lineWidth = u * lw;
      rr(fg, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(2, r - inset));
      fg.stroke();
      fg.shadowBlur = u * 1.2;
      fg.strokeStyle = "#ffffff";
      fg.lineWidth = u * lw * 0.35;
      fg.stroke();
      fg.restore();
    }
    // หลอดไฟรอบกรอบ (กระพริบวิ่งตอนแสดง)
    const n = Math.round((w + h) / (u * 6.5));
    const per = 2 * (w + h);
    for (let i = 0; i < n * 2; i++) {
      let d = (i / (n * 2)) * per;
      const m = -u * 1.6;
      let bx: number;
      let by: number;
      if (d < w) [bx, by] = [x + d, y + m];
      else if ((d -= w) < h) [bx, by] = [x + w - m, y + d];
      else if ((d -= h) < w) [bx, by] = [x + w - d, y + h - m];
      else {
        d -= w;
        [bx, by] = [x + m, y + h - d];
      }
      bulbs.push({ x: bx - x + L.px, y: by - y + L.py });
    }
  } else if (frameKind === "ribbon") {
    const r = u * 6;
    fg.save();
    fg.shadowColor = "rgba(0,0,0,0.5)";
    fg.shadowBlur = u * 8;
    fg.shadowOffsetY = u * 2;
    rr(fg, x, y, w, h, r);
    const bg = fg.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, "#fffaf0");
    bg.addColorStop(1, "#f3e6c8");
    fg.fillStyle = bg;
    fg.fill();
    fg.restore();
    // ลายกระดาษจาง ๆ และขอบทอง
    fg.strokeStyle = p.frameB;
    fg.lineWidth = u * 0.8;
    rr(fg, x + u * 2, y + u * 2, w - u * 4, h - u * 4, r * 0.7);
    fg.stroke();
    fg.setLineDash([u * 1.2, u * 1.2]);
    fg.lineWidth = u * 0.3;
    rr(fg, x + u * 3.4, y + u * 3.4, w - u * 6.8, h - u * 6.8, r * 0.5);
    fg.stroke();
    fg.setLineDash([]);
    // ริบบิ้นพาดบน (ชื่อผู้ส่งอยู่บนริบบิ้น)
    const rbH = Math.max(u * 9, h * 0.2);
    const rbY = y - rbH * 0.45;
    const rbW = Math.min(w * 0.72, u * 70);
    const rbX = x + (w - rbW) / 2;
    const ribbon = fg.createLinearGradient(0, rbY, 0, rbY + rbH);
    ribbon.addColorStop(0, "#e5405f");
    ribbon.addColorStop(1, "#8e1029");
    // หางริบบิ้นพับสองข้าง
    fg.fillStyle = "#7a0c22";
    for (const s of [-1, 1]) {
      const ex = s < 0 ? rbX : rbX + rbW;
      fg.beginPath();
      fg.moveTo(ex, rbY + rbH * 0.25);
      fg.lineTo(ex + s * rbH * 0.9, rbY + rbH * 0.25);
      fg.lineTo(ex + s * rbH * 0.6, rbY + rbH * 0.75);
      fg.lineTo(ex + s * rbH * 0.9, rbY + rbH * 1.25);
      fg.lineTo(ex, rbY + rbH * 1.25);
      fg.closePath();
      fg.fill();
    }
    fg.save();
    fg.shadowColor = "rgba(0,0,0,0.35)";
    fg.shadowBlur = u * 3;
    fg.fillStyle = ribbon;
    fg.fillRect(rbX, rbY, rbW, rbH);
    fg.restore();
    fg.strokeStyle = "#f9d57a";
    fg.lineWidth = u * 0.4;
    fg.strokeRect(rbX + u, rbY + u * 0.9, rbW - u * 2, rbH - u * 1.8);
    // โบว์มุมขวาบน
    const bx = x + w - u * 7;
    const byy = y + u * 7;
    fg.fillStyle = "#c41e3a";
    for (const s of [-1, 1]) {
      fg.beginPath();
      fg.ellipse(bx + s * u * 4, byy - u * 1.5, u * 4.6, u * 2.6, s * -0.5, 0, Math.PI * 2);
      fg.fill();
      fg.beginPath();
      fg.moveTo(bx, byy);
      fg.lineTo(bx + s * u * 4, byy + u * 7);
      fg.lineTo(bx + s * u * 1.5, byy + u * 6);
      fg.closePath();
      fg.fill();
    }
    fg.fillStyle = "#f9d57a";
    fg.beginPath();
    fg.arc(bx, byy - u * 0.5, u * 1.8, 0, Math.PI * 2);
    fg.fill();
  } else {
    // ornate: กระดาษสปรูซโปร่งแสง ขอบฟอยล์สองชั้น มุมประดับ
    const r = h * 0.2;
    fg.save();
    fg.shadowColor = "rgba(0,0,0,0.55)";
    fg.shadowBlur = h * 0.28;
    fg.shadowOffsetY = h * 0.06;
    rr(fg, x, y, w, h, r);
    const bg = fg.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, p.top + "f0");
    bg.addColorStop(1, p.bot + "f2");
    fg.fillStyle = bg;
    fg.fill();
    fg.restore();
    const foil = fg.createLinearGradient(x, y, x + w, y + h);
    foil.addColorStop(0, p.frameA);
    foil.addColorStop(0.5, p.frameB);
    foil.addColorStop(1, p.frameA);
    fg.strokeStyle = foil;
    fg.lineWidth = Math.max(3, h * 0.026);
    rr(fg, x, y, w, h, r);
    fg.stroke();
    fg.globalAlpha = 0.55;
    fg.lineWidth = Math.max(1.5, h * 0.009);
    rr(fg, x + h * 0.07, y + h * 0.07, w - h * 0.14, h - h * 0.14, r * 0.7);
    fg.stroke();
    fg.globalAlpha = 1;
    fg.fillStyle = p.accent;
    const cs = h * 0.065;
    for (const [cx, cy] of [
      [x + h * 0.19, y + h * 0.19],
      [x + w - h * 0.19, y + h * 0.19],
      [x + h * 0.19, y + h - h * 0.19],
      [x + w - h * 0.19, y + h - h * 0.19],
    ]) {
      fg.beginPath();
      fg.moveTo(cx, cy - cs);
      fg.lineTo(cx + cs * 0.6, cy);
      fg.lineTo(cx, cy + cs);
      fg.lineTo(cx - cs * 0.6, cy);
      fg.closePath();
      fg.fill();
    }
    // ช่อฮอลลี่กลางขอบบน
    const hx = x + w / 2;
    const hy = y;
    fg.fillStyle = "#1f7a4a";
    for (const s of [-1, 1]) {
      fg.beginPath();
      fg.ellipse(hx + s * u * 3.6, hy, u * 4, u * 1.6, s * 0.35, 0, Math.PI * 2);
      fg.fill();
    }
    fg.fillStyle = "#e5405f";
    for (const [dx, dy] of [[-1.2, -0.6], [1.2, -0.6], [0, 0.9]]) {
      fg.beginPath();
      fg.arc(hx + dx * u, hy + dy * u, u * 1.25, 0, Math.PI * 2);
      fg.fill();
    }
  }

  // ---------- ตัวอักษร: ชื่อผู้ส่ง และข้อความหลัก ----------
  const [text, tg] = mk(fw, fh);
  const [hi, hg] = mk(fw, fh);
  const fam = skyFamily(o.style.font);
  const fdef = FONT[o.style.font];
  const light = frameKind === "ribbon";
  const ink = light ? "#3a1a10" : p.ink;
  const byColor = light ? "#fff4d6" : p.accent;
  const cx = x + w / 2;
  // ชื่อผู้ส่ง
  const byPx = Math.round((light ? Math.max(u * 9, h * 0.2) * 0.5 : h * 0.11) * 1);
  const byY = light ? y - Math.max(u * 9, h * 0.2) * 0.45 + Math.max(u * 9, h * 0.2) / 2 : y + h * 0.22;
  const byText = `จาก ${o.by.slice(0, 20)}`;
  for (const [g, col, glow] of [
    [tg, byColor, false],
    [hg, "#ffffff", true],
  ] as [CanvasRenderingContext2D, string, boolean][]) {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `600 ${byPx}px ${skyFamily("plex")}`;
    setSpacing(g, Math.round(byPx * 0.08));
    g.fillStyle = col;
    if (glow) {
      g.shadowColor = "#ffffff";
      g.shadowBlur = byPx * 0.5;
    }
    g.fillText(byText, cx, byY);
    g.restore();
  }
  tg.font = `600 ${byPx}px ${skyFamily("plex")}`;
  setSpacing(tg, Math.round(byPx * 0.08));
  const byW = tg.measureText(byText).width + byPx * 2;
  setSpacing(tg, 0);
  const byBox = { x: cx - byW / 2, y: byY - byPx * 0.8, w: byW, h: byPx * 1.6 };

  // ข้อความหลัก: หาขนาดใหญ่สุดที่พอดีกรอบ
  const maxLines = 3;
  const areaW = w * (L.portrait ? 0.84 : 0.8);
  const areaTop = light ? y + h * 0.16 : y + h * 0.34;
  const areaH = (y + h * (light ? 0.9 : 0.88)) - areaTop;
  const msg = (o.text || " ").slice(0, 80);
  let px = Math.round(areaH * (L.portrait ? 0.42 : 0.62) * fdef.scale);
  let lines: string[] = [];
  let lineH = 0;
  // ใช้ขนาดใหญ่สุดที่ข้อความทั้งหมดพอดีกรอบโดยไม่ต้องตัดทิ้ง
  for (; px >= 12; px -= 2) {
    tg.font = `${fdef.weight} ${px}px ${fam}`;
    lines = wrap(tg, msg, areaW, 99);
    lineH = px * 1.62; // เผื่อสระบนและวรรณยุกต์ภาษาไทย
    if (lines.length <= maxLines && lines.length * lineH <= areaH) break;
  }
  if (lines.length > maxLines) lines = wrap(tg, msg, areaW, maxLines);
  const boxes: Layers["lines"] = [];
  const startY = areaTop + (areaH - lines.length * lineH) / 2 + lineH / 2;
  for (const [g, col, glow] of [
    [tg, ink, !light],
    [hg, "#ffffff", true],
  ] as [CanvasRenderingContext2D, string, boolean][]) {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `${fdef.weight} ${px}px ${fam}`;
    g.fillStyle = col;
    if (glow) {
      g.shadowColor = g === hg ? "#ffffff" : p.glow;
      g.shadowBlur = px * (g === hg ? 0.5 : 0.3);
    }
    lines.forEach((ln, i) => g.fillText(ln, cx, startY + i * lineH));
    g.restore();
  }
  tg.font = `${fdef.weight} ${px}px ${fam}`;
  lines.forEach((ln, i) => {
    const lw = tg.measureText(ln).width;
    // บรรทัดแรกและบรรทัดสุดท้ายเผื่อขอบบน/ล่างเพิ่ม ให้แสงเรืองและหางอักษรไม่ถูกตัด
    const top = startY + i * lineH - lineH / 2 - (i === 0 ? px * 0.4 : 0);
    const bot = startY + i * lineH + lineH / 2 + (i === lines.length - 1 ? px * 0.4 : 0);
    boxes.push({ x: cx - lw / 2 - px * 0.5, y: top, w: lw + px, h: bot - top });
  });

  // แปลงกรอบบรรทัดจากพิกัดในเลเยอร์เป็นพิกัดบนจอ (ตอนวาดจะลบค่าชดเชยออกเพื่อหาตำแหน่งในเลเยอร์)
  const offX = L.px - pad;
  const offY = L.py - pad;
  for (const b of boxes) {
    b.x += offX;
    b.y += offY;
  }
  byBox.x += offX;
  byBox.y += offY;
  return { key: "", frame, text, hi, pad, lines: boxes, byBox, bulbs };
}

// ---------- เอฟเฟกต์ตามธีม ----------
type Ctx = { g: CanvasRenderingContext2D; W: number; H: number; t: number; env: number; p: Pal; L: Layout; u: number };
// ชั้นหน้าที่ลอยผ่านกรอบข้อความให้จางลง ข้อความจึงอ่านออกตลอด
function overText(c: Ctx, x: number, y: number) {
  const { L } = c;
  return x > L.px - 10 && x < L.px + L.pw + 10 && y > L.py - 10 && y < L.py + L.ph + 10 ? 0.22 : 1;
}

function fireworks(c: Ctx, front: boolean) {
  if (front) return;
  const { g, W, H, t, p, u } = c;
  const period = 0.62;
  for (let k = Math.floor((t - 2.6) / period); k <= Math.floor(t / period); k++) {
    if (k < 0) continue;
    const born = k * period;
    const age = t - born;
    if (age < 0) continue;
    // จุดระเบิดอยู่รอบกรอบข้อความ (บน ล่าง ซ้าย ขวา) ไม่ซ่อนอยู่หลังกรอบ
    const { L } = c;
    const zone = Math.floor(hash(k * 8.8) * 4);
    let ox: number;
    let oy: number;
    if (zone === 0 || (zone >= 2 && L.px < W * 0.12)) {
      ox = W * (0.1 + hash(k * 3.1) * 0.8);
      oy = Math.max(H * 0.06, (L.py - H * 0.02) * (0.3 + hash(k * 5.7) * 0.7));
    } else if (zone === 1) {
      ox = W * (0.1 + hash(k * 3.1) * 0.8);
      oy = L.py + L.ph + (H * 0.85 - L.py - L.ph) * (0.25 + hash(k * 5.7) * 0.6);
    } else {
      const side = zone === 2 ? -1 : 1;
      ox = side < 0 ? L.px * (0.3 + hash(k * 3.1) * 0.6) : W - L.px * (0.3 + hash(k * 3.1) * 0.6);
      oy = H * (0.15 + hash(k * 5.7) * 0.6);
    }
    const rise = 0.55;
    const col = p.parts[Math.floor(hash(k * 9.3) * p.parts.length)];
    const col2 = p.parts[Math.floor(hash(k * 4.1) * p.parts.length)];
    if (age < rise) {
      // จรวดพุ่งขึ้นพร้อมหางประกาย
      const f = easeOut(age / rise);
      const sx = ox + (hash(k) - 0.5) * W * 0.05;
      const yy = H * 1.02 + (oy - H * 1.02) * f;
      const xx = sx + (ox - sx) * f;
      for (let j = 0; j < 6; j++) {
        const ty = yy + j * u * 2.2;
        g.globalAlpha = (1 - j / 6) * 0.9;
        const s = u * (2.4 - j * 0.3);
        g.drawImage(glowDot(col), xx - s, ty - s, s * 2, s * 2);
      }
      continue;
    }
    const a2 = age - rise;
    if (a2 > 2.0) continue;
    const life = 1 - a2 / 2.0;
    if (a2 < 0.25) {
      g.globalAlpha = (1 - a2 / 0.25) * 0.55;
      const s = u * 7;
      g.drawImage(glowDot("#fff6d8"), ox - s, oy - s, s * 2, s * 2);
    }
    const n = 64;
    const ring = hash(k * 2.2) > 0.5;
    const reach = (0.8 + hash(k * 6.6) * 0.5) * Math.min(W, H) * 0.3;
    // แสงเรืองของทั้งดอก
    g.globalAlpha = life * life * 0.16;
    const hs = reach * 0.75;
    g.drawImage(glowDot(col), ox - hs, oy - hs, hs * 2, hs * 2);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + hash(k + i) * 0.2;
      const sp = ring ? 0.92 + hash(k * 17 + i) * 0.08 : 0.4 + hash(k * 17 + i) * 0.6;
      const tw = 0.7 + 0.3 * Math.sin(t * 30 + i);
      const s = u * (0.8 + life * 1.0);
      // หัวประกาย และหางสามจุดไล่จาง
      for (let j = 0; j < 4; j++) {
        const back = j * 0.05;
        const aa = Math.max(0, a2 - back);
        const d = reach * sp * (1 - Math.exp(-aa * 3.2));
        const xx = ox + Math.cos(ang) * d;
        const yy = oy + Math.sin(ang) * d + u * 10 * aa * aa;
        g.globalAlpha = life * tw * (j === 0 ? 1 : 0.45 - j * 0.1);
        const ss = s * (1 - j * 0.2);
        g.drawImage(glowDot(i % 3 ? col : col2), xx - ss, yy - ss, ss * 2, ss * 2);
      }
    }
  }
}

function snow(c: Ctx, front: boolean) {
  const { g, W, H, t, u } = c;
  const fl = flakeSprite();
  const n = front ? 26 : 110;
  for (let i = 0; i < n; i++) {
    const seed = i + (front ? 500 : 0);
    const depth = front ? 0.8 + hash(seed * 2.3) * 0.2 : hash(seed * 2.3) * 0.75;
    const speed = 0.05 + depth * 0.1;
    const s = u * (front ? 3.2 + depth * 2.6 : 0.9 + depth * 2.4);
    const x = ((hash(seed * 7.1) * W + Math.sin(t * 0.7 + seed) * (u * 3 + depth * u * 6)) % W + W) % W;
    const y = ((hash(seed * 4.9) + t * speed) % 1) * (H + s * 4) - s * 2;
    g.globalAlpha = (0.35 + depth * 0.6) * (front ? 0.85 * overText(c, x, y) : 1);
    if (s > u * 2) g.drawImage(fl, x - s, y - s, s * 2, s * 2);
    else g.drawImage(glowDot("#ffffff"), x - s, y - s, s * 2, s * 2);
  }
}

function sparkle(c: Ctx, front: boolean) {
  const { g, W, H, t, p, L, u } = c;
  const cx = L.px + L.pw / 2;
  const cy = L.py + L.ph / 2;
  if (!front) {
    // ฝุ่นทองหมุนวนเป็นวงรีรอบข้อความ
    for (let i = 0; i < 90; i++) {
      const r = 0.55 + hash(i * 3.3) * 0.35;
      const sp = 0.25 + hash(i * 1.7) * 0.4;
      const a = hash(i * 9.1) * Math.PI * 2 + t * sp * (i % 2 ? 1 : -1);
      const x = cx + Math.cos(a) * (L.pw / 2 + u * 8) * r * 1.3;
      const y = cy + Math.sin(a) * (L.ph / 2 + u * 10) * r * 1.5;
      const tw = 0.5 + 0.5 * Math.sin(t * 5 + i);
      g.globalAlpha = 0.35 + tw * 0.6;
      const s = u * (0.8 + hash(i * 5.5) * 1.8);
      g.drawImage(glowDot(p.parts[i % p.parts.length]), x - s, y - s, s * 2, s * 2);
    }
    for (let i = 0; i < 40; i++) {
      const tw = Math.max(0, Math.sin(t * 2.2 + i * 1.3));
      g.globalAlpha = tw * 0.8;
      const s = u * (1.5 + hash(i * 2.9) * 2.5) * tw;
      g.drawImage(starSprite(p.accent), hash(i * 3.7) * W - s, hash(i * 1.9) * H - s, s * 2, s * 2);
    }
  } else {
    // ประกายดาววิ่งตามขอบกรอบ
    const per = 2 * (L.pw + L.ph);
    for (let i = 0; i < 6; i++) {
      let d = ((hash(i) + t * 0.12) % 1) * per;
      let x: number;
      let y: number;
      if (d < L.pw) [x, y] = [L.px + d, L.py];
      else if ((d -= L.pw) < L.ph) [x, y] = [L.px + L.pw, L.py + d];
      else if ((d -= L.ph) < L.pw) [x, y] = [L.px + L.pw - d, L.py + L.ph];
      else {
        d -= L.pw;
        [x, y] = [L.px, L.py + L.ph - d];
      }
      const s = u * (4 + 1.5 * Math.sin(t * 7 + i));
      g.globalAlpha = 0.95;
      g.drawImage(starSprite(p.accent), x - s, y - s, s * 2, s * 2);
    }
  }
}

function sleigh(c: Ctx, front: boolean) {
  const { g, W, H, t, p, u } = c;
  if (!front) {
    for (let i = 0; i < 50; i++) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + i * 2.1));
      g.globalAlpha = tw * 0.7;
      const s = u * (0.6 + hash(i * 4.2) * 1.2);
      g.drawImage(glowDot("#ffffff"), hash(i * 3.1) * W - s, hash(i * 7.3) * H * 0.8 - s, s * 2, s * 2);
    }
    return;
  }
  // บินผ่านสองรอบ: ซ้ายไปขวาสูง แล้วขวาไปซ้ายต่ำ เส้นทางเป็นคลื่น
  const sw = Math.min(W * 0.42, u * 120);
  const img = sleighSprite(p.accent);
  for (const [start, dir, yy] of [
    [0.4, 1, 0.16],
    [5.2, -1, 0.74],
  ] as [number, number, number][]) {
    const f = (t - start) / 4.2;
    if (f < -0.05 || f > 1.05) continue;
    const pathX = (q: number) => (dir > 0 ? -sw + (W + sw * 2) * q : W + sw - (W + sw * 2) * q);
    const pathY = (q: number) => H * yy + Math.sin(q * Math.PI * 2) * H * 0.04 - q * H * 0.05;
    // หางประกายไล่หลัง
    for (let j = 0; j < 42; j++) {
      const q = f - j * 0.008;
      if (q < 0) break;
      const tx = pathX(q) - dir * sw * 0.45;
      const ty = pathY(q) + sw * 0.05 + Math.sin(j * 1.7 + t * 6) * u * 1.2;
      g.globalAlpha = (1 - j / 42) * 0.9;
      const s = u * (2.4 - j * 0.04);
      g.drawImage(glowDot(p.parts[j % p.parts.length]), tx - s, ty - s, s * 2, s * 2);
    }
    const x = pathX(f);
    const y = pathY(f);
    g.globalAlpha = 1;
    g.save();
    g.translate(x, y);
    if (dir < 0) g.scale(-1, 1);
    g.rotate(Math.cos(f * Math.PI * 2) * 0.12 - 0.05);
    g.drawImage(img, -sw / 2, -sw / 2, sw, sw);
    g.restore();
  }
}

function aurora(c: Ctx, front: boolean) {
  const { g, W, H, t, p, u } = c;
  if (front) return;
  // ม่านแสงเหนือ: ริบบิ้นโค้งหลายชั้นพลิ้วตามเวลา ขอบบนชัด ขอบล่างจางลงเหมือนม่าน
  const cols = [p.glow, "#7cf5c8", p.accent, "#b28dff"];
  const N = 48;
  for (let b = 0; b < 4; b++) {
    const base = H * (0.01 + b * 0.06);
    const thick = H * (0.26 - b * 0.03);
    const sp = 0.35 + b * 0.12;
    const yAt = (q: number) => base + Math.sin(q * 4.2 + t * sp + b * 1.7) * H * 0.06 + Math.sin(q * 9.1 - t * sp * 1.6 + b) * H * 0.02;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const q = i / N;
      const x = q * W;
      if (i === 0) g.moveTo(x, yAt(q));
      else g.lineTo(x, yAt(q));
    }
    for (let i = N; i >= 0; i--) {
      const q = i / N;
      g.lineTo(q * W, yAt(q) + thick * (0.75 + 0.25 * Math.sin(q * 6 + t * 0.8 + b)));
    }
    g.closePath();
    const grd = g.createLinearGradient(0, base - H * 0.08, 0, base + thick + H * 0.06);
    grd.addColorStop(0, cols[b] + "00");
    grd.addColorStop(0.18, cols[b] + "aa");
    grd.addColorStop(0.45, cols[b] + "55");
    grd.addColorStop(1, cols[b] + "00");
    g.globalAlpha = 0.5 + 0.25 * Math.sin(t * 0.9 + b * 2);
    g.fillStyle = grd;
    g.fill();
  }
  for (let i = 0; i < 46; i++) {
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i * 2.7));
    g.globalAlpha = tw * 0.8;
    const s = u * (0.5 + hash(i * 6.2) * 1.1);
    g.drawImage(glowDot("#ffffff"), hash(i * 2.1) * W - s, hash(i * 8.3) * H * 0.9 - s, s * 2, s * 2);
  }
}

function lanterns(c: Ctx, front: boolean) {
  const { g, W, H, t, u } = c;
  const img = lanternSprite();
  const n = front ? 5 : 26;
  for (let i = 0; i < n; i++) {
    const seed = i + (front ? 300 : 0);
    const depth = front ? 0.85 + hash(seed) * 0.15 : hash(seed * 1.3) * 0.8;
    const s = u * (front ? 16 : 5 + depth * 10);
    const speed = 0.04 + depth * 0.05;
    const prog = (hash(seed * 5.1) + t * speed) % 1;
    const x = hash(seed * 2.7) * W + Math.sin(t * 0.6 + seed) * u * 4;
    const y = H + s - prog * (H + s * 2);
    const flick = 0.85 + 0.15 * Math.sin(t * 9 + seed * 3);
    g.globalAlpha = (0.55 + depth * 0.45) * flick * Math.min(1, prog * 6) * (front ? overText(c, x, y) : 1);
    g.drawImage(img, x - s / 2, y - s / 2, s, s);
  }
}

function hearts(c: Ctx, front: boolean) {
  const { g, W, H, t, p, u } = c;
  const n = front ? 8 : 30;
  for (let i = 0; i < n; i++) {
    const seed = i + (front ? 700 : 0);
    const depth = front ? 0.9 : hash(seed * 1.3) * 0.8 + 0.1;
    const s = u * (front ? 5.5 : 2.5 + depth * 4.5) * (1 + 0.08 * Math.sin(t * 6 + seed));
    const prog = (hash(seed * 5.1) + t * (0.06 + depth * 0.06)) % 1;
    const x = hash(seed * 2.7) * W + Math.sin(t * 1.4 + seed) * u * 5;
    const y = H + s - prog * (H + s * 2);
    g.globalAlpha = (0.5 + depth * 0.5) * Math.min(1, (1 - prog) * 4) * (front ? overText(c, x, y) : 1);
    g.drawImage(heartSprite(i % 3 === 0 ? p.accent : p.glow), x - s, y - s, s * 2, s * 2);
  }
  if (!front)
    for (let i = 0; i < 30; i++) {
      const tw = Math.max(0, Math.sin(t * 2.5 + i * 1.7));
      g.globalAlpha = tw * 0.8;
      const s = u * 2 * tw;
      g.drawImage(starSprite("#ffffff"), hash(i * 3.3) * W - s, hash(i * 9.9) * H - s, s * 2, s * 2);
    }
}

function confetti(c: Ctx, front: boolean) {
  const { g, W, H, t, p, u } = c;
  const n = front ? 60 : 110;
  for (let i = 0; i < n; i++) {
    const seed = i + (front ? 900 : 0);
    const side = i % 2 ? 1 : -1;
    const burstAt = 0.3 + (i % 3) * 1.6 + hash(seed) * 0.2;
    const age = t - burstAt;
    if (age < 0) continue;
    // ยิงจากมุมล่างซ้าย/ขวา พุ่งขึ้นแล้วร่วงช้า ๆ พลิ้วไปมา
    const ang = side < 0 ? -1.0 - hash(seed * 2) * 0.55 : -Math.PI + 1.0 + hash(seed * 2) * 0.55;
    const v = (0.9 + hash(seed * 3) * 0.6) * H;
    const drag = 1 - Math.exp(-age * 2.2);
    const x0 = side < 0 ? -u * 2 : W + u * 2;
    let x = x0 + (Math.cos(ang) * v * drag) / 2.2;
    let y = H * 0.95 + (Math.sin(ang) * v * drag) / 2.2 + u * 5 * age * age * 0.9;
    x += Math.sin(age * 3 + seed) * u * 4 * Math.min(1, age);
    if (y > H + u * 10) continue;
    const s = u * (front ? 2.2 : 1.4);
    g.globalAlpha = Math.min(1, (6 - age) / 1.5) * (front ? overText(c, x, y) : 1);
    g.save();
    g.translate(x, y);
    g.rotate(age * (4 + hash(seed) * 6) + seed);
    g.scale(1, Math.cos(age * (5 + hash(seed * 4) * 5)));
    g.fillStyle = p.parts[seed % p.parts.length];
    g.fillRect(-s, -s * 0.5, s * 2, s);
    g.restore();
  }
}

function starfall(c: Ctx, front: boolean) {
  const { g, W, H, t, p, u } = c;
  if (front) return;
  for (let i = 0; i < 70; i++) {
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + i * 1.9));
    g.globalAlpha = tw * 0.8;
    const s = u * (0.5 + hash(i * 6.2) * 1.2);
    g.drawImage(glowDot("#ffffff"), hash(i * 2.1) * W - s, hash(i * 8.3) * H - s, s * 2, s * 2);
  }
  const period = 0.45;
  for (let k = Math.floor((t - 1.2) / period); k <= Math.floor(t / period); k++) {
    if (k < 0) continue;
    const age = t - k * period;
    if (age < 0 || age > 1.2) continue;
    const f = age / 1.2;
    const len = Math.min(W, H) * (0.25 + hash(k * 3) * 0.2);
    const ang = 0.5 + hash(k * 7) * 0.35;
    const sx = W * (0.1 + hash(k * 1.1) * 1.0);
    const sy = -H * 0.05 + hash(k * 5.5) * H * 0.4;
    const x = sx - Math.cos(ang) * f * W * 0.6;
    const y = sy + Math.sin(ang) * f * W * 0.6;
    g.globalAlpha = Math.sin(f * Math.PI);
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI - ang);
    const img = streakSprite(p.parts[k % p.parts.length]);
    g.drawImage(img, -len, -len / 2, len, len);
    g.restore();
    void u;
  }
}

const THEME_FX: Record<string, (c: Ctx, front: boolean) => void> = { fireworks, snow, sparkle, sleigh, aurora, lanterns, hearts, confetti, starfall };

// ---------- ตัววาดหนึ่งชุด (เก็บเลเยอร์ไว้ใช้ซ้ำ) ----------
export function createSkyPainter() {
  let layers: Layers | null = null;
  let dirty = true;
  return {
    invalidate() {
      dirty = true;
    },
    // t = วินาทีนับจากเริ่ม, dur = ความยาวทั้งหมด (วินาที), backdrop = มืดฉากหลังเพื่อให้ข้อความเด่น
    paint(g: CanvasRenderingContext2D, W: number, H: number, t: number, dur: number, opts: SkyShowOpts, backdrop = true, panel = true) {
      const style = opts.style ?? DEFAULT_SKY_STYLE;
      const p = PAL[style.palette] ?? PAL.gold;
      const L = layoutFor(W, H);
      const key = `${W}x${H}|${opts.text}|${opts.by}|${style.font}|${style.palette}|${style.frame}`;
      const fontOk = ensureFont(style.font, () => (dirty = true));
      if (!layers || layers.key !== key || dirty) {
        if (fontOk || !layers) {
          layers = buildLayers(L, opts);
          layers.key = key;
          dirty = !fontOk;
        }
      }
      const Ls = layers;
      const u = Math.min(W, H * 1.6) / 100;
      // ช่วงของการแสดง
      const intro = style.intro;
      const outT = dur - 0.9;
      const env = clamp01(t / 0.6) * clamp01((dur - t) / 0.7);
      const outF = clamp01((t - outT) / 0.9);

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      // ฉากหลังมืดลงและมีแสงตามสีธีม
      if (backdrop) {
        const v = g.createRadialGradient(W / 2, L.py + L.ph / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
        v.addColorStop(0, `rgba(${p.tint},${0.12 * env})`);
        v.addColorStop(1, `rgba(${p.tint},${0.5 * env})`);
        g.fillStyle = v;
        g.fillRect(0, 0, W, H);
      }
      const ctx: Ctx = { g, W, H, t, env, p, L, u };
      const fx = THEME_FX[style.theme] ?? fireworks;
      g.globalCompositeOperation = "lighter";
      // รังสีแสงหมุนช้า ๆ หลังกรอบ
      const rayIn = easeOut((t - 0.2) / 1.2) * (1 - outF);
      if (rayIn > 0) {
        g.save();
        g.globalAlpha = 0.28 * rayIn;
        g.translate(W / 2, L.py + L.ph / 2);
        g.rotate(t * 0.12);
        const rs = L.pw * 2.1;
        g.drawImage(raysSprite(p.glow), -rs / 2, -rs / 2, rs, rs);
        g.restore();
      }
      g.globalAlpha = 1;
      fx(ctx, false);
      g.globalCompositeOperation = "source-over";

      // ---------- กรอบและข้อความ ----------
      let alpha = 1;
      let scaleX = 1;
      let scaleY = 1;
      let dy = 0;
      let reveal = 1; // 0..1 ของความยาวข้อความ
      let soft = true;
      const cx = W / 2;
      const cy = L.py + L.ph / 2;
      if (intro === "burst") {
        const k = (t - 0.35) / 0.75;
        alpha = clamp01(k * 3);
        const s = k < 0 ? 0.3 : easeBack(k) * 0.92 + 0.08;
        scaleX = scaleY = Math.max(0.3, s);
        reveal = clamp01((t - 0.75) / 0.9);
      } else if (intro === "type") {
        alpha = clamp01((t - 0.2) / 0.5);
        dy = (1 - easeOut((t - 0.2) / 0.6)) * u * 3;
        const total = Ls.lines.reduce((a, b) => a + b.w, 0);
        reveal = clamp01((t - 0.8) / Math.max(1.2, Math.min(3.2, total / (u * 26))));
        soft = false;
      } else if (intro === "unfurl") {
        const k = easeInOut((t - 0.25) / 1.0);
        alpha = clamp01((t - 0.2) / 0.25);
        scaleX = Math.max(0.03, k);
        reveal = clamp01((t - 1.0) / 1.4);
      } else {
        const k = (t - 0.25) / 0.9;
        alpha = clamp01(k * 1.4);
        dy = (1 - easeBack(k)) * u * 8;
        scaleX = scaleY = 0.94 + 0.06 * easeOut(k);
        reveal = clamp01((t - 0.75) / 1.5);
      }
      if (outF > 0) {
        alpha *= 1 - outF;
        scaleX *= 1 + outF * 0.05;
        scaleY *= 1 + outF * 0.05;
        dy -= outF * u * 5;
      }
      if (panel && alpha > 0.001) {
        g.save();
        g.globalAlpha = alpha;
        g.translate(cx, cy + dy);
        g.scale(scaleX, scaleY);
        g.translate(-cx, -cy);
        const ox = L.px - Ls.pad;
        const oy = L.py - Ls.pad;
        g.drawImage(Ls.frame, ox, oy);
        // ไม้ม้วนสองข้างตอนคลี่ผ้า
        if (intro === "unfurl" && scaleX < 0.995) {
          g.restore();
          g.save();
          g.globalAlpha = alpha * (1 - outF);
          const half = (L.pw / 2) * scaleX;
          for (const s of [-1, 1]) {
            const rx = cx + s * half;
            const grd = g.createLinearGradient(rx - u * 1.6, 0, rx + u * 1.6, 0);
            grd.addColorStop(0, p.frameB);
            grd.addColorStop(0.5, p.frameA);
            grd.addColorStop(1, p.frameB);
            g.fillStyle = grd;
            rr(g, rx - u * 1.6, L.py - u * 3, u * 3.2, L.ph + u * 6, u * 1.6);
            g.fill();
          }
          g.restore();
          g.save();
          g.globalAlpha = alpha;
          g.translate(cx, cy + dy);
          g.scale(scaleX, scaleY);
          g.translate(-cx, -cy);
        }
        // ชื่อผู้ส่งค่อย ๆ ชัด
        const bb = Ls.byBox;
        g.globalAlpha = alpha * clamp01((t - 0.5) / 0.6);
        g.drawImage(Ls.text, bb.x - ox, bb.y - oy, bb.w, bb.h, bb.x, bb.y, bb.w, bb.h);
        // ข้อความหลักเผยทีละบรรทัดจากซ้ายไปขวา
        const total = Ls.lines.reduce((a, b) => a + b.w, 0);
        let left = reveal * total;
        let headX = -1;
        let headY = 0;
        g.globalAlpha = alpha;
        for (const ln of Ls.lines) {
          if (left <= 0) break;
          const wv = Math.min(ln.w, left);
          left -= wv;
          if (soft && wv < ln.w) {
            // ขอบนุ่ม: วาดส่วนที่เผยแล้ว แล้วไล่จางช่วงปลาย
            const edge = Math.min(wv, u * 6);
            g.drawImage(Ls.text, ln.x - ox, ln.y - oy, wv - edge, ln.h, ln.x, ln.y, wv - edge, ln.h);
            const steps = 5;
            for (let s = 0; s < steps; s++) {
              const sx = ln.x + wv - edge + (edge / steps) * s;
              g.globalAlpha = alpha * (1 - (s + 0.5) / steps);
              g.drawImage(Ls.text, sx - ox, ln.y - oy, edge / steps + 0.5, ln.h, sx, ln.y, edge / steps + 0.5, ln.h);
            }
            g.globalAlpha = alpha;
          } else g.drawImage(Ls.text, ln.x - ox, ln.y - oy, wv, ln.h, ln.x, ln.y, wv, ln.h);
          if (wv < ln.w) {
            headX = ln.x + wv;
            headY = ln.y + ln.h / 2;
          }
        }
        // แสงวิ่งผ่านตัวอักษรเป็นระยะ (ใช้เลเยอร์ตัวอักษรสว่างเฉพาะแถบแคบ ๆ)
        if (reveal >= 1) {
          const sweepT = ((t - 2.2) % 2.6) / 1.1;
          if (sweepT >= 0 && sweepT <= 1) {
            const sw = u * 9;
            const sx = L.px - sw + (L.pw + sw * 2) * easeInOut(sweepT);
            const x0 = Math.max(L.px, sx);
            const x1 = Math.min(L.px + L.pw, sx + sw);
            if (x1 > x0) {
              const steps = 6;
              for (let s = 0; s < steps; s++) {
                const a0 = x0 + ((x1 - x0) / steps) * s;
                const mid = (s + 0.5) / steps;
                g.globalAlpha = alpha * Math.sin(mid * Math.PI) * 0.85;
                g.drawImage(Ls.hi, a0 - ox, L.py - oy, (x1 - x0) / steps + 0.5, L.ph, a0, L.py, (x1 - x0) / steps + 0.5, L.ph);
              }
            }
          }
        }
        g.restore();
        // หัวที่กำลังเขียน: ประกายดาว (หรือเคอร์เซอร์ตอนพิมพ์)
        if (headX >= 0) {
          g.save();
          g.translate(cx, cy + dy);
          g.scale(scaleX, scaleY);
          g.translate(-cx, -cy);
          g.globalCompositeOperation = "lighter";
          if (soft) {
            const s = u * 5;
            g.globalAlpha = alpha;
            g.drawImage(starSprite(p.accent), headX - s, headY - s, s * 2, s * 2);
          } else if (Math.floor(t * 4) % 2 === 0) {
            g.globalAlpha = alpha;
            g.fillStyle = p.accent;
            g.fillRect(headX, headY - u * 3.5, u * 0.6, u * 7);
          }
          g.restore();
        }
        // หลอดไฟนีออนกระพริบวิ่ง
        if (Ls.bulbs.length) {
          g.save();
          g.translate(cx, cy + dy);
          g.scale(scaleX, scaleY);
          g.translate(-cx, -cy);
          g.globalCompositeOperation = "lighter";
          const step = Math.floor(t * 8);
          Ls.bulbs.forEach((b, i) => {
            const on = (i + step) % 3 === 0;
            g.globalAlpha = alpha * (on ? 1 : 0.35);
            const s = u * (on ? 2.2 : 1.4);
            g.drawImage(glowDot(i % 2 ? p.glow : p.accent), b.x - s, b.y - s, s * 2, s * 2);
          });
          g.restore();
        }
      }

      // ---------- เอฟเฟกต์เปิดตัวพิเศษ ----------
      g.globalCompositeOperation = "lighter";
      if (intro === "burst" && t < 1.6) {
        const k = (t - 0.3) / 1.2;
        if (k > 0) {
          // แสงวาบ + วงคลื่นกระแทก + ประกายกระจาย
          g.globalAlpha = Math.max(0, 1 - k * 2.2) * 0.9;
          const fs = Math.max(W, H) * 0.5 * (0.4 + k);
          g.drawImage(glowDot("#ffffff"), cx - fs, cy - fs, fs * 2, fs * 2);
          g.globalAlpha = Math.max(0, 1 - k) * 0.8;
          g.strokeStyle = p.accent;
          g.lineWidth = u * 1.2 * (1 - k);
          g.beginPath();
          g.ellipse(cx, cy, L.pw * 0.2 + k * W * 0.6, L.ph * 0.25 + k * H * 0.5, 0, 0, Math.PI * 2);
          g.stroke();
          for (let i = 0; i < 46; i++) {
            const a = (i / 46) * Math.PI * 2;
            const d = easeOut(k) * Math.max(W, H) * (0.3 + hash(i) * 0.4);
            g.globalAlpha = Math.max(0, 1 - k);
            const s = u * 2;
            g.drawImage(glowDot(p.parts[i % p.parts.length]), cx + Math.cos(a) * d - s, cy + Math.sin(a) * d * 0.7 - s, s * 2, s * 2);
          }
        }
      }
      // ปิดฉาก: ประกายแตกออกจากกรอบ
      if (outF > 0) {
        for (let i = 0; i < 40; i++) {
          const a = hash(i * 3.3) * Math.PI * 2;
          const d = easeOut(outF) * Math.min(W, H) * (0.3 + hash(i) * 0.3);
          g.globalAlpha = (1 - outF) * 0.9;
          const s = u * 1.8;
          g.drawImage(glowDot(p.parts[i % p.parts.length]), cx + Math.cos(a) * (L.pw * 0.35 + d) - s, cy + Math.sin(a) * (L.ph * 0.4 + d * 0.6) - s, s * 2, s * 2);
        }
      }
      g.globalAlpha = 1;
      fx(ctx, true);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
    },
  };
}

// ภาพนิ่งตัวอย่างของแต่ละธีม (ใช้บนปุ่มเลือกธีม) วาดครั้งเดียวแล้วจำไว้
const thumbCache = new Map<string, string>();
export function skyThumb(style: SkyStyle, w = 160, h = 96): string {
  const key = JSON.stringify(style) + w + h;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const [c, g] = mk(w, h);
  const painter = createSkyPainter();
  // ภาพตัวอย่างแสดงเฉพาะเอฟเฟกต์ ณ จังหวะที่เห็นชัดที่สุดของแต่ละธีม
  const at: Record<string, number> = { fireworks: 4.3, sleigh: 2.3, confetti: 1.1, starfall: 3.1, lanterns: 6, hearts: 6 };
  painter.paint(g, w, h, at[style.theme] ?? 4, 10, { text: " ", by: " ", style }, true, false);
  g.globalCompositeOperation = "destination-over";
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#071a14");
  bg.addColorStop(1, "#14402f");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";
  const url = c.toDataURL("image/png");
  thumbCache.set(key, url);
  return url;
}

// ตอนพัฒนา: วาดหนึ่งเฟรมเป็นรูปจากคอนโซล เพื่อตรวจเลย์เอาต์ของทุกธีม
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __skyPaint?: unknown }).__skyPaint = (style: Partial<SkyStyle>, W = 430, H = 932, t = 5, text = "ขอให้ทุกคนมีความสุขมาก ๆ ในวันคริสต์มาสปีนี้") => {
    const [c, g] = mk(W, H);
    const p = createSkyPainter();
    const st = { ...DEFAULT_SKY_STYLE, ...style };
    p.paint(g, W, H, t, 10, { text, by: "ทดสอบ", style: st });
    const L = layoutFor(W, H);
    const lay = buildLayers(L, { text, by: "ทดสอบ", style: st });
    return { url: c.toDataURL(), lines: lay.lines, L };
  };
  // วัดเวลาวาดต่อเฟรม (ms) ของแต่ละธีมที่ขนาดจอจริง
  (window as unknown as { __skyBench?: unknown }).__skyBench = (theme: string, W = 1920, H = 1080, frames = 120) => {
    const [, g] = mk(W, H);
    const p = createSkyPainter();
    const st = { ...DEFAULT_SKY_STYLE, theme: theme as SkyStyle["theme"], intro: "burst" as const, frame: "neon" as const };
    p.paint(g, W, H, 0.1, 10, { text: "ขอให้ทุกคนมีความสุขมาก ๆ", by: "ทดสอบ", style: st });
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) p.paint(g, W, H, 0.5 + (i / frames) * 8.5, 10, { text: "ขอให้ทุกคนมีความสุขมาก ๆ", by: "ทดสอบ", style: st });
    g.getImageData(0, 0, 1, 1);
    return Math.round(((performance.now() - t0) / frames) * 100) / 100;
  };
}
