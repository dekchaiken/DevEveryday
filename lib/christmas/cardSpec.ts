// การ์ดอวยพร: ข้อมูลร่วมระหว่างเซิร์ฟเวอร์และเบราว์เซอร์ (ไม่ import อะไรฝั่งเซิร์ฟเวอร์)

import type { Social } from "@/lib/christmas/social";

export const CARD_THEMES = ["kraft", "pine", "candy", "frost", "berry", "night"] as const;
export type CardTheme = (typeof CARD_THEMES)[number];

export const ENVELOPES = ["red", "gold", "green", "white", "pink", "blue"] as const;
export type Envelope = (typeof ENVELOPES)[number];

// สติ๊กเกอร์ของตกแต่ง 52 ชิ้น วาดเองทั้งชุด ใช้ได้ทั้งบนการ์ดและบนซอง
export const STICKER_KINDS = [
  "bell", "star", "candy", "gift", "snowman", "holly", "bow", "tree", "bauble", "snowflake",
  "santa_hat", "reindeer", "sleigh", "stocking", "mitten", "candle", "cookie", "gingerbread", "lollipop", "wreath",
  "pinecone", "mistletoe", "penguin", "bear", "owl", "heart", "sparkle", "moon", "cloud", "snowball",
  "icicle", "ribbon", "tag", "stamp", "seal", "crown", "house", "mug", "bird", "bunny",
  "lantern", "firework", "rainbow", "mushroom", "flower", "snowglobe", "butterfly", "cat", "cupcake", "present_blue",
  "candy_round", "chocolate",
] as const;
export type StickerKind = (typeof STICKER_KINDS)[number];
export type PropKind = StickerKind;
export const PROP_KINDS = STICKER_KINDS;

// ฟอนต์ที่เลือกได้ รองรับทั้งไทยและอังกฤษ ("plex" ใช้ฟอนต์ของแอปที่มีอยู่แล้ว)
export const FONT_KEYS = ["plex", "mitr", "prompt", "kanit", "pattaya", "sriracha", "pacifico", "xmas"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const TEXT_EFFECTS = ["none", "outline", "shadow", "glow"] as const;
export type TextEffect = (typeof TEXT_EFFECTS)[number];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const TEXT_COLORS = ["#1f2b22", "#ffffff", "#b91c3c", "#15803d", "#b9862a", "#1d4ed8", "#7c3aed", "#db2777"] as const;

// ของตกแต่งหนึ่งชิ้น: x,y เป็นสัดส่วน 0..1 ของพื้นที่ r เป็นองศา s เป็นขนาด
export type CardProp = { kind: StickerKind; x: number; y: number; r: number; s: number };

// กล่องข้อความอิสระ วางได้ทุกที่บนการ์ด ปรับฟอนต์ สี ตัวหนา ตัวเอียง และเอฟเฟกต์ได้
export type TextItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  r: number;
  s: number;
  font: FontKey;
  color: string;
  bold: boolean;
  italic: boolean;
  effect: TextEffect;
};

export type CardSpec = {
  theme: CardTheme;
  envelope: Envelope;
  props: CardProp[]; // ของตกแต่งบนการ์ด
  envProps: CardProp[]; // ของตกแต่งบนซอง
  texts: TextItem[];
  name: string;
  bgColor?: string; // สีกระดาษกำหนดเอง (hex) ถ้าไม่ระบุใช้สีของแบบการ์ด
  wish?: string; // ฟิลด์เก่าก่อนมีกล่องข้อความ ใช้แสดงแทนถ้ายังไม่มี texts
};

// การ์ดที่บันทึกแล้วในห้อง พร้อมจำนวนถูกใจ
export type CardRecord = CardSpec & { id: string; room: string; createdAt: number; likes: number; social?: Social };

export const MAX_PROPS = 12;
export const MAX_ENV_PROPS = 6;
export const MAX_TEXTS = 4;
export const TEXT_MAX = 80;
export const NAME_MAX = 20;
export const CARDS_PER_PERSON = 3; // ต่อคนต่อห้อง

export const THEME_LABEL: Record<CardTheme, string> = {
  kraft: "กระดาษคราฟต์",
  pine: "ใบสนคริสต์มาส",
  candy: "ลายขนมไม้",
  frost: "น้ำแข็งใส",
  berry: "ลายเบอร์รี่",
  night: "ท้องฟ้ากลางคืน",
};

export const ENVELOPE_LABEL: Record<Envelope, string> = { red: "แดง", gold: "ทอง", green: "เขียว", white: "ขาว", pink: "ชมพู", blue: "ฟ้า" };

export const FONT_LABEL: Record<FontKey, string> = {
  plex: "มาตรฐาน",
  mitr: "มิตร",
  prompt: "พร้อมท์",
  kanit: "คานิต",
  pattaya: "พัทยา",
  sriracha: "ศรีราชา",
  pacifico: "Pacifico",
  xmas: "Christmas",
};

export const EFFECT_LABEL: Record<TextEffect, string> = { none: "ปกติ", outline: "ขอบ", shadow: "เงา", glow: "เรืองแสง" };

export const PROP_LABEL: Record<StickerKind, string> = {
  bell: "กระดิ่ง",
  star: "ดาว",
  candy: "ขนมไม้",
  gift: "ของขวัญ",
  snowman: "ตุ๊กตาหิมะ",
  holly: "ฮอลลี่",
  bow: "โบว์",
  tree: "ต้นสน",
  bauble: "ลูกบอล",
  snowflake: "เกล็ดหิมะ",
  santa_hat: "หมวกซานตา",
  reindeer: "กวางเรนเดียร์",
  sleigh: "เลื่อน",
  stocking: "ถุงเท้า",
  mitten: "ถุงมือ",
  candle: "เทียน",
  cookie: "คุกกี้",
  gingerbread: "ขนมจิงเจอร์",
  lollipop: "ลอลลี่ป็อป",
  wreath: "พวงหรีด",
  pinecone: "ลูกสน",
  mistletoe: "มิสเซิลโท",
  penguin: "เพนกวิน",
  bear: "หมี",
  owl: "นกฮูก",
  heart: "หัวใจ",
  sparkle: "ประกาย",
  moon: "พระจันทร์",
  cloud: "เมฆ",
  snowball: "ลูกหิมะ",
  icicle: "น้ำแข็งย้อย",
  ribbon: "ริบบิ้น",
  tag: "ป้ายแท็ก",
  stamp: "แสตมป์",
  seal: "ตราซีล",
  crown: "มงกุฎ",
  house: "บ้านขนม",
  mug: "แก้วโกโก้",
  bird: "นก",
  bunny: "กระต่าย",
  lantern: "โคมไฟ",
  firework: "พลุ",
  rainbow: "รุ้ง",
  mushroom: "เห็ด",
  flower: "ดอกไม้",
  snowglobe: "ลูกแก้วหิมะ",
  butterfly: "ผีเสื้อ",
  cat: "แมว",
  cupcake: "คัพเค้ก",
  present_blue: "ของขวัญฟ้า",
  candy_round: "ลูกอม",
  chocolate: "ช็อกโกแลต",
};

export const DEFAULT_CARD: CardSpec = { theme: "kraft", envelope: "red", props: [], envProps: [], texts: [], name: "" };

// ข้อความของการ์ด รวมฟิลด์เก่า (wish) ถ้ายังไม่มีกล่องข้อความ
export function textsOf(spec: Pick<CardSpec, "texts" | "wish">): TextItem[] {
  if (spec.texts && spec.texts.length) return spec.texts;
  if (spec.wish) return [{ id: "legacy", text: spec.wish, x: 0.5, y: 0.72, r: 0, s: 1, font: "plex", color: "#1f2b22", bold: false, italic: false, effect: "none" }];
  return [];
}

function pick<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;
}
const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
};

function parseStickers(list: unknown, max: number): CardProp[] {
  const raw = Array.isArray(list) ? list.slice(0, max) : [];
  const out: CardProp[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const kind = pick(o.kind, STICKER_KINDS);
    if (!kind) continue;
    out.push({ kind, x: num(o.x, 0, 1, 0.5), y: num(o.y, 0, 1, 0.5), r: num(o.r, -180, 180, 0), s: num(o.s, 0.5, 2, 1) });
  }
  return out;
}

// ตรวจการ์ดที่ส่งมาจากหน้าเว็บ ค่าที่ไม่รู้จักถูกตัดทิ้งหรือปฏิเสธ
export function parseCard(body: Record<string, unknown>, isBlocked: (s: string) => boolean): { value: CardSpec } | { error: string } {
  const theme = pick(body.theme, CARD_THEMES);
  const envelope = pick(body.envelope, ENVELOPES);
  if (!theme || !envelope) return { error: "เลือกแบบการ์ดและซองให้ครบก่อน" };

  const props = parseStickers(body.props, MAX_PROPS);
  const envProps = parseStickers(body.envProps, MAX_ENV_PROPS);

  const rawTexts = Array.isArray(body.texts) ? body.texts.slice(0, MAX_TEXTS) : [];
  const texts: TextItem[] = [];
  for (const t of rawTexts) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim().slice(0, TEXT_MAX) : "";
    if (!text) continue;
    const color = typeof o.color === "string" && HEX_RE.test(o.color) ? o.color : TEXT_COLORS[0];
    texts.push({
      id: typeof o.id === "string" ? o.id.slice(0, 40) : crypto.randomUUID(),
      text,
      x: num(o.x, 0, 1, 0.5),
      y: num(o.y, 0, 1, 0.5),
      r: num(o.r, -180, 180, 0),
      s: num(o.s, 0.5, 2.5, 1),
      font: pick(o.font, FONT_KEYS) ?? "plex",
      color,
      bold: o.bold === true,
      italic: o.italic === true,
      effect: pick(o.effect, TEXT_EFFECTS) ?? "none",
    });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX) : "";
  const bgColor = typeof body.bgColor === "string" && HEX_RE.test(body.bgColor) ? body.bgColor : undefined;
  if (!name) return { error: "กรุณาใส่ชื่อที่จะแสดงบนการ์ด" };
  if (texts.length === 0) return { error: "เพิ่มข้อความอวยพรอย่างน้อย 1 กล่อง" };
  if (isBlocked(name) || texts.some((t) => isBlocked(t.text))) return { error: "ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไข" };

  return { value: { theme, envelope, props, envProps, texts, name, ...(bgColor ? { bgColor } : {}) } };
}
