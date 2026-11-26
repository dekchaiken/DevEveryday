// การ์ดอวยพร: ข้อมูลร่วมระหว่างเซิร์ฟเวอร์และเบราว์เซอร์ (ไม่ import อะไรฝั่งเซิร์ฟเวอร์)

import type { Social } from "@/lib/christmas/social";

export const CARD_THEMES = ["kraft", "pine", "candy", "frost"] as const;
export type CardTheme = (typeof CARD_THEMES)[number];

export const ENVELOPES = ["red", "gold", "green", "white"] as const;
export type Envelope = (typeof ENVELOPES)[number];

export const PROP_KINDS = ["bell", "star", "candy", "gift", "snowman", "holly", "bow", "tree", "bauble", "snowflake"] as const;
export type PropKind = (typeof PROP_KINDS)[number];

// ของตกแต่งหนึ่งชิ้นบนการ์ด: x,y เป็นสัดส่วน 0..1 ของการ์ด r เป็นองศา s เป็นขนาด
export type CardProp = { kind: PropKind; x: number; y: number; r: number; s: number };

export type CardSpec = {
  theme: CardTheme;
  envelope: Envelope;
  props: CardProp[];
  name: string;
  wish: string;
};

// การ์ดที่บันทึกแล้วในห้อง พร้อมจำนวนถูกใจ
export type CardRecord = CardSpec & { id: string; room: string; createdAt: number; likes: number; social?: Social };

export const MAX_PROPS = 12;
export const NAME_MAX = 20;
export const WISH_MAX = 120;

export const THEME_LABEL: Record<CardTheme, string> = {
  kraft: "กระดาษคราฟต์",
  pine: "ใบสนคริสต์มาส",
  candy: "ลายขนมไม้",
  frost: "น้ำแข็งใส",
};

export const ENVELOPE_LABEL: Record<Envelope, string> = { red: "แดง", gold: "ทอง", green: "เขียว", white: "ขาว" };

export const PROP_LABEL: Record<PropKind, string> = {
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
};

export const DEFAULT_CARD: CardSpec = { theme: "kraft", envelope: "red", props: [], name: "", wish: "" };

function pick<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;
}
const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
};

// ตรวจการ์ดที่ส่งมาจากหน้าเว็บ ค่าที่ไม่รู้จักถูกตัดทิ้งหรือปฏิเสธ
export function parseCard(body: Record<string, unknown>, isBlocked: (s: string) => boolean): { value: CardSpec } | { error: string } {
  const theme = pick(body.theme, CARD_THEMES);
  const envelope = pick(body.envelope, ENVELOPES);
  if (!theme || !envelope) return { error: "เลือกแบบการ์ดและซองให้ครบก่อน" };

  const raw = Array.isArray(body.props) ? body.props.slice(0, MAX_PROPS) : [];
  const props: CardProp[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const kind = pick(o.kind, PROP_KINDS);
    if (!kind) continue;
    props.push({ kind, x: num(o.x, 0, 1, 0.5), y: num(o.y, 0, 1, 0.5), r: num(o.r, -180, 180, 0), s: num(o.s, 0.5, 2, 1) });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX) : "";
  const wish = typeof body.wish === "string" ? body.wish.trim().slice(0, WISH_MAX) : "";
  if (!name) return { error: "กรุณาใส่ชื่อที่จะแสดงบนการ์ด" };
  if (!wish) return { error: "กรุณาเขียนคำอวยพร" };
  if (isBlocked(name) || isBlocked(wish)) return { error: "ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไข" };

  return { value: { theme, envelope, props, name, wish } };
}
