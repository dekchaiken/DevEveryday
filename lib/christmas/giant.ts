// ลุคของ Exclusive: ฐานกลมลายขนมหวาน วางของตกแต่งได้อย่างอิสระด้วยพิกัด (x, z) และการหมุน (r)
// แต่ละชิ้นแต่งสีแยกเป็นส่วน ๆ ได้ (เช่น หมวกกับผ้าพันคอของตุ๊กตาหิมะ) ตามที่กำหนดใน ITEM_SPECS
// ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์ จึงไม่มี Three.js หรือ Redis ในไฟล์นี้

export const BASE_R = 1.35; // รัศมีฐาน (หน่วยโลก)
export const MAX_ITEMS = 24;
export const DIORAMA_BASES = ["pink", "mint", "red", "blue", "frost", "royal"] as const; // ลายแถบของฐาน
export const SIGN_BOARDS = ["spruce", "ivory", "berry", "gold"] as const; // สีป้ายชื่อเล็ก
// บ้านหิมะกลางฐาน (จุดเด่นของ Exclusive) สีผนัง สีหลังคา และรั้วรอบฐาน
export const HOUSE_STYLES = ["cottage", "cabin", "gingerbread", "igloo", "chalet", "castle", "none"] as const;
export const HOUSE_WALLS = ["cream", "red", "mint", "sky", "pink", "wood", "white"] as const;
export const HOUSE_ROOFS = ["red", "forest", "navy", "berry", "black", "gold"] as const;
export const FENCES = ["candy", "picket", "lights", "hedge", "ice", "royal", "none"] as const;
export const HOUSE_LABEL: Record<string, string> = { cottage: "บ้านไม้หิมะ", cabin: "กระท่อมซุง", gingerbread: "บ้านขนมปังขิง", igloo: "อิกลูน้ำแข็ง", chalet: "ชาเล่ต์สองชั้น", castle: "ปราสาทหิมะ", none: "ไม่มีบ้าน" };
export const FENCE_LABEL: Record<string, string> = { candy: "รั้วไม้เท้าขนม", picket: "รั้วไม้ขาว", lights: "เสาไฟประดับ", hedge: "พุ่มสนเตี้ย", ice: "กำแพงน้ำแข็ง", royal: "รั้วทองโคมไฟ", none: "ไม่มีรั้ว" };
export const BASE_LABEL: Record<string, string> = { pink: "ชมพู", mint: "มิ้นต์", red: "แดง", blue: "ฟ้า", frost: "น้ำแข็ง", royal: "ทองหลวง" };
export const BOARD_LABEL: Record<string, string> = { spruce: "เขียวสน", ivory: "งาช้าง", berry: "แดงเบอร์รี่", gold: "ทอง" };
// บ้านตั้งค่อนไปด้านหลังฐาน (ด้านหน้าว่างให้วางของ) ของชิ้นอื่นห้ามทับพื้นที่นี้
export const HOUSE_SPOT = { x: 0, z: -0.42, r: 0.66 };
// บ้านหลังใหญ่ (ชาเล่ต์ ปราสาท) กินพื้นที่มากกว่า
export function houseSpot(house?: string) {
  if (house === "castle") return { x: 0, z: -0.36, r: 0.8 };
  if (house === "chalet") return { x: 0, z: -0.4, r: 0.7 };
  return HOUSE_SPOT;
}

// สีกลางที่ทุกชิ้นใช้ร่วมกัน (ตัวเลขคือสีจริงบนฉาก)
export const PALETTE = {
  red: 0xdc2643,
  green: 0x22a35a,
  forest: 0x1f7a4d,
  mint: 0x52c293,
  blue: 0x3b82f6,
  navy: 0x1e3a8a,
  sky: 0x8ec5ff,
  pink: 0xf472b6,
  berry: 0xbe185d,
  purple: 0x8b5cf6,
  orange: 0xf59e0b,
  gold: 0xf5c542,
  silver: 0xc9d3dc,
  white: 0xffffff,
  cream: 0xf6ead2,
  black: 0x2a2a33,
  wood: 0x7a4a24,
  warm: 0xffd28a,
} as const;
export type PaletteKey = keyof typeof PALETTE;

// สีของฐานแต่ละลาย (สองสี สลับกันเป็นแถบ)
export const BASE_HEX: Record<string, { a: number; b: number }> = {
  pink: { a: 0xf9a8c4, b: 0xffffff },
  mint: { a: 0x86e0b8, b: 0xffffff },
  red: { a: 0xe0465a, b: 0xffffff },
  blue: { a: 0x8ec5ff, b: 0xffffff },
  frost: { a: 0xbfe6ff, b: 0xf2fbff },
  royal: { a: 0xd8a93b, b: 0xfff3d1 },
};

type Part = { readonly key: string; readonly label: string; readonly options: readonly PaletteKey[] };
type Spec = { readonly label: string; readonly r: number; readonly parts: readonly Part[] };

// ของตกแต่งทั้งหมด: ชื่อ รัศมีกันทับ และส่วนที่แต่งสีได้ (ตัวแรกของ options คือค่าเริ่มต้น)
export const ITEM_SPECS = {
  snowman: {
    label: "ตุ๊กตาหิมะ",
    r: 0.2,
    parts: [
      { key: "hat", label: "หมวก", options: ["black", "red", "green", "blue", "gold"] },
      { key: "scarf", label: "ผ้าพันคอ", options: ["red", "green", "blue", "pink", "gold", "mint", "orange"] },
    ],
  },
  pine: {
    label: "ต้นสน",
    r: 0.22,
    parts: [
      { key: "leaf", label: "ใบสน", options: ["forest", "mint", "green"] },
      { key: "ball", label: "ลูกประดับ", options: ["red", "gold", "blue", "pink", "silver", "white", "purple"] },
      { key: "top", label: "ดาวยอด", options: ["gold", "silver", "white", "red"] },
    ],
  },
  gift: {
    label: "ของขวัญ",
    r: 0.2,
    parts: [
      { key: "box", label: "กล่อง", options: ["red", "green", "blue", "pink", "gold", "silver", "purple", "navy"] },
      { key: "ribbon", label: "ริบบิ้น", options: ["gold", "white", "red", "green", "blue", "pink", "silver"] },
    ],
  },
  candy: {
    label: "ไม้เท้าขนม",
    r: 0.12,
    parts: [
      { key: "stripe", label: "ลาย", options: ["red", "green", "blue", "pink", "purple", "orange"] },
      { key: "base", label: "ตัวไม้", options: ["white", "cream", "silver"] },
    ],
  },
  bauble: {
    label: "ลูกแก้ว",
    r: 0.13,
    parts: [
      { key: "ball", label: "ลูกแก้ว", options: ["red", "gold", "blue", "pink", "silver", "green", "purple", "navy"] },
      { key: "cap", label: "ฝาครอบ", options: ["gold", "silver", "white", "black"] },
    ],
  },
  lantern: {
    label: "โคมไฟ",
    r: 0.14,
    parts: [
      { key: "frame", label: "โครง", options: ["gold", "silver", "black", "red", "green"] },
      { key: "glow", label: "แสง", options: ["warm", "white", "pink", "sky", "mint", "orange"] },
    ],
  },
  star: {
    label: "ดาวประดับ",
    r: 0.14,
    parts: [{ key: "star", label: "ดาว", options: ["gold", "white", "pink", "sky", "mint", "orange"] }],
  },
  bell: {
    label: "กระดิ่ง",
    r: 0.14,
    parts: [
      { key: "bell", label: "กระดิ่ง", options: ["gold", "silver", "red"] },
      { key: "ribbon", label: "โบว์", options: ["red", "green", "blue", "pink", "gold", "white"] },
    ],
  },
  wreath: {
    label: "พวงมาลัย",
    r: 0.22,
    parts: [
      { key: "leaf", label: "ใบ", options: ["forest", "mint", "green"] },
      { key: "bow", label: "โบว์", options: ["red", "gold", "blue", "pink", "white"] },
    ],
  },
  reindeer: {
    label: "กวางเรนเดียร์",
    r: 0.22,
    parts: [
      { key: "body", label: "ตัว", options: ["wood", "cream", "white", "gold"] },
      { key: "nose", label: "จมูก", options: ["red", "gold", "black", "pink"] },
      { key: "scarf", label: "ผ้าพันคอ", options: ["red", "green", "blue", "gold", "pink"] },
    ],
  },
  sled: {
    label: "เลื่อนหิมะ",
    r: 0.24,
    parts: [
      { key: "body", label: "ตัวเลื่อน", options: ["red", "forest", "navy", "wood", "gold"] },
      { key: "gift", label: "ของบนเลื่อน", options: ["gold", "red", "green", "blue", "pink", "white"] },
    ],
  },
  lamppost: {
    label: "เสาไฟถนน",
    r: 0.12,
    parts: [
      { key: "frame", label: "เสา", options: ["black", "gold", "forest", "red"] },
      { key: "glow", label: "แสง", options: ["warm", "white", "pink", "sky"] },
    ],
  },
  nutcracker: {
    label: "ทหารนัทแครกเกอร์",
    r: 0.14,
    parts: [
      { key: "coat", label: "เสื้อ", options: ["red", "navy", "forest", "purple", "gold"] },
      { key: "hat", label: "หมวก", options: ["black", "red", "navy", "gold"] },
    ],
  },
  giftstack: {
    label: "กองของขวัญ",
    r: 0.22,
    parts: [
      { key: "box", label: "กล่องใหญ่", options: ["red", "green", "blue", "gold", "pink", "purple", "navy"] },
      { key: "box2", label: "กล่องเล็ก", options: ["gold", "white", "red", "green", "blue", "pink"] },
      { key: "ribbon", label: "ริบบิ้น", options: ["gold", "white", "red", "silver"] },
    ],
  },
  bench: {
    label: "ม้านั่งไม้",
    r: 0.22,
    parts: [
      { key: "wood", label: "ไม้", options: ["wood", "red", "forest", "white"] },
      { key: "pillow", label: "หมอนอิง", options: ["red", "gold", "green", "blue", "pink"] },
    ],
  },
  icesculpture: {
    label: "รูปปั้นน้ำแข็ง",
    r: 0.2,
    parts: [
      { key: "ice", label: "น้ำแข็ง", options: ["sky", "white", "mint", "pink"] },
      { key: "glow", label: "ไฟส่อง", options: ["sky", "warm", "pink", "mint"] },
    ],
  },
  bigtree: {
    label: "ต้นคริสต์มาสใหญ่",
    r: 0.28,
    parts: [
      { key: "leaf", label: "ใบสน", options: ["forest", "green", "white"] },
      { key: "ball", label: "ลูกประดับ", options: ["red", "gold", "silver", "blue", "pink", "purple"] },
      { key: "top", label: "ดาวยอด", options: ["gold", "silver", "white"] },
    ],
  },
  fountain: {
    label: "น้ำพุน้ำแข็ง",
    r: 0.28,
    parts: [
      { key: "stone", label: "หิน", options: ["white", "cream", "silver", "gold"] },
      { key: "glow", label: "แสง", options: ["sky", "warm", "pink", "mint"] },
    ],
  },
  icearch: {
    label: "ซุ้มประตูน้ำแข็ง",
    r: 0.3,
    parts: [
      { key: "ice", label: "น้ำแข็ง", options: ["sky", "white", "mint", "pink"] },
      { key: "lights", label: "ไฟ", options: ["warm", "white", "pink", "sky"] },
    ],
  },
} as const;

export type DioramaKind = keyof typeof ITEM_SPECS;
export const DIORAMA_KINDS = Object.keys(ITEM_SPECS) as DioramaKind[];

export type DioramaItem = { id: string; kind: string; parts: Record<string, string>; x: number; z: number; r: number };
export type GiantLook = {
  base: string;
  items: DioramaItem[];
  board: string; // สีป้ายชื่อเล็ก
  house?: string; // แบบบ้าน (ข้อมูลเก่าไม่มี = ไม่มีบ้าน ของที่วางไว้แล้วจึงไม่ถูกบ้านทับ)
  wall?: string;
  roof?: string;
  fence?: string;
  tier?: number; // ระดับตามยอดสนับสนุน 0–3 (เซิร์ฟเวอร์กำหนดจากยอดจริง)
};

export const DEFAULT_GIANT_LOOK: GiantLook = { base: "red", items: [], board: "spruce", house: "cottage", wall: "cream", roof: "red", fence: "candy" };

function pick(v: unknown, list: readonly string[], fallback: string): string {
  return typeof v === "string" && list.includes(v) ? v : fallback;
}

// ข้อมูลของชนิดนั้น หรือ undefined ถ้าไม่รู้จัก
export function specFor(kind: string): Spec | undefined {
  return (ITEM_SPECS as unknown as Record<string, Spec>)[kind];
}

// ส่วนที่แต่งสีได้ของชนิดนั้น (ใช้ทั้งหน้าตกแต่งและการตรวจข้อมูลจากเซิร์ฟเวอร์)
export function partsFor(kind: string): readonly Part[] {
  return specFor(kind)?.parts ?? [];
}

// ค่าสีเริ่มต้นของทุกส่วนในชนิดนั้น
export function defaultParts(kind: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of partsFor(kind)) out[p.key] = p.options[0];
  return out;
}

// รัศมีกันทับของแต่ละชนิด
export function radiusOf(kind: string): number {
  return specFor(kind)?.r ?? 0.2;
}

// สร้างชิ้นใหม่ที่ค่าเริ่มต้นทุกส่วน
export function makeItem(id: string, kind: string, x: number, z: number): DioramaItem {
  return { id, kind, parts: defaultParts(kind), x, z, r: 0 };
}

// ชิ้นนี้วางได้ไหม: อยู่ในฐานทั้งชิ้น ไม่ทับตัวบ้าน และไม่ชนกับชิ้นอื่น (ยกเว้นชิ้นที่กำลังย้ายเอง)
export function fits(items: DioramaItem[], cand: { kind: string; x: number; z: number }, ignoreId?: string, house?: string): boolean {
  const r = radiusOf(cand.kind);
  if (Math.hypot(cand.x, cand.z) + r > BASE_R - 0.02) return false;
  const hs = houseSpot(house);
  if (house && house !== "none" && Math.hypot(cand.x - hs.x, cand.z - hs.z) < hs.r + r) return false;
  for (const o of items) {
    if (o.id === ignoreId) continue;
    const ro = radiusOf(o.kind);
    if (Math.hypot(o.x - cand.x, o.z - cand.z) < r + ro + 0.02) return false;
  }
  return true;
}

// หาตำแหน่งว่างใกล้กลางฐานสำหรับชิ้นใหม่ (ค้นเป็นวงรอบ ๆ กลาง)
export function freeSpot(items: DioramaItem[], kind: string, house?: string): { x: number; z: number } | null {
  // เริ่มหาจากลานหน้าบ้าน (ด้านหน้าฐาน) ก่อน
  const cz = house && house !== "none" ? 0.55 : 0;
  for (let rad = 0; rad <= BASE_R * 1.6; rad += 0.08) {
    const steps = rad === 0 ? 1 : Math.max(6, Math.round((2 * Math.PI * rad) / 0.12));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2 + rad;
      const x = Math.cos(a) * rad;
      const z = cz + Math.sin(a) * rad;
      if (fits(items, { kind, x, z }, undefined, house)) return { x: round(x), z: round(z) };
    }
  }
  return null;
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

// ตรวจของตกแต่งทั้งหมดที่ส่งมาจากหน้าเว็บ: ชนิดหรือสีที่ไม่รู้จักใช้ค่าเริ่มต้น ชิ้นนอกฐานและชิ้นที่ชนกันจะถูกตัดทิ้ง
export function parseItems(v: unknown, house?: string, max = MAX_ITEMS, kinds?: readonly string[]): DioramaItem[] {
  if (!Array.isArray(v)) return [];
  const out: DioramaItem[] = [];
  const ids = new Set<string>();
  for (const raw of v) {
    if (out.length >= max) break;
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const kind = typeof o.kind === "string" && specFor(o.kind) && (!kinds || kinds.includes(o.kind)) ? o.kind : "";
    if (!kind) continue;
    const x = Number(o.x);
    const z = Number(o.z);
    const r = Number(o.r);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (!fits(out, { kind, x, z }, undefined, house)) continue;
    const given = o.parts && typeof o.parts === "object" ? (o.parts as Record<string, unknown>) : {};
    const parts: Record<string, string> = {};
    for (const p of partsFor(kind)) parts[p.key] = pick(given[p.key], p.options, p.options[0]);
    let id = typeof o.id === "string" ? o.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) : "";
    if (!id || ids.has(id)) id = `i${out.length}${Math.floor(Math.random() * 1e6).toString(36)}`;
    ids.add(id);
    out.push({ id, kind, parts, x: round(x), z: round(z), r: Number.isFinite(r) ? round(((r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) : 0 });
  }
  return out;
}

// ---------- ระดับตามยอดสนับสนุน ----------
// ยิ่งสนับสนุนมาก ได้บ้านที่ใหญ่และอลังการขึ้น ตัวเลือกสีและของแต่งมากขึ้น
export type GiantTier = {
  id: number;
  min: number; // ยอดต่ำสุดของระดับนี้ (บาท)
  name: string;
  title: string;
  blurb: string;
  houses: readonly string[];
  walls: readonly string[];
  roofs: readonly string[];
  fences: readonly string[];
  bases: readonly string[];
  boards: readonly string[];
  kinds: readonly string[];
  maxItems: number;
  randomItems: [number, number];
  look: Omit<GiantLook, "items" | "tier">;
};
const K0 = ["pine", "snowman", "gift", "candy", "lantern"];
const K1 = [...K0, "bauble", "star", "bell", "wreath", "giftstack", "bench", "lamppost"];
const K2 = [...K1, "reindeer", "sled", "nutcracker", "icesculpture", "bigtree"];
const K3 = [...K2, "fountain", "icearch"];
export const GIANT_TIERS: readonly GiantTier[] = [
  {
    id: 0,
    min: 0,
    name: "ดาวดวงเล็ก",
    title: "บ้านหิมะน้อย",
    blurb: "กระท่อมหรืออิกลู แต่งได้ 4 ชิ้น",
    houses: ["cabin", "igloo", "none"],
    walls: ["wood", "cream", "white"],
    roofs: ["red", "forest", "black"],
    fences: ["picket", "none"],
    bases: ["red", "mint"],
    boards: ["spruce", "ivory"],
    kinds: K0,
    maxItems: 4,
    randomItems: [2, 4],
    look: { base: "red", board: "spruce", house: "cabin", wall: "wood", roof: "red", fence: "picket" },
  },
  {
    id: 1,
    min: 29,
    name: "ระฆังเงิน",
    title: "บ้านหิมะแสนอบอุ่น",
    blurb: "บ้านไม้หรือบ้านขนม ของแต่ง 8 ชิ้น",
    houses: ["cottage", "gingerbread", "cabin", "igloo", "none"],
    walls: ["cream", "red", "mint", "sky", "pink", "wood", "white"],
    roofs: ["red", "forest", "navy", "berry", "black"],
    fences: ["candy", "picket", "hedge", "none"],
    bases: ["pink", "mint", "red", "blue"],
    boards: ["spruce", "ivory", "berry"],
    kinds: K1,
    maxItems: 8,
    randomItems: [4, 7],
    look: { base: "red", board: "spruce", house: "cottage", wall: "cream", roof: "red", fence: "candy" },
  },
  {
    id: 2,
    min: 99,
    name: "ดาวประจำห้อง",
    title: "ชาเล่ต์ Exclusive",
    blurb: "ชาเล่ต์สองชั้น รูปปั้นน้ำแข็ง ของแต่ง 14 ชิ้น",
    houses: ["chalet", "cottage", "gingerbread", "cabin", "igloo", "none"],
    walls: [...HOUSE_WALLS],
    roofs: [...HOUSE_ROOFS],
    fences: ["ice", "lights", "candy", "picket", "hedge", "none"],
    bases: ["frost", "pink", "mint", "red", "blue"],
    boards: [...SIGN_BOARDS],
    kinds: K2,
    maxItems: 14,
    randomItems: [7, 11],
    look: { base: "frost", board: "gold", house: "chalet", wall: "wood", roof: "forest", fence: "ice" },
  },
  {
    id: 3,
    min: 199,
    name: "ผู้สนับสนุนรายใหญ่",
    title: "ปราสาทหิมะอลังการ",
    blurb: "ปราสาทหิมะ น้ำพุ ซุ้มน้ำแข็ง แสงออร่า ของแต่ง 20 ชิ้น",
    houses: ["castle", "chalet", "cottage", "gingerbread", "cabin", "igloo", "none"],
    walls: [...HOUSE_WALLS],
    roofs: [...HOUSE_ROOFS],
    fences: ["royal", "ice", "lights", "candy", "picket", "hedge", "none"],
    bases: ["royal", "frost", "pink", "mint", "red", "blue"],
    boards: [...SIGN_BOARDS],
    kinds: K3,
    maxItems: 20,
    randomItems: [10, 15],
    look: { base: "royal", board: "gold", house: "castle", wall: "white", roof: "navy", fence: "royal" },
  },
];
export function giantTier(amount: number): GiantTier {
  let t = GIANT_TIERS[0];
  for (const x of GIANT_TIERS) if (amount >= x.min) t = x;
  return t;
}
export function tierLook(tier: GiantTier): GiantLook {
  return { ...tier.look, items: [], tier: tier.id };
}

// ปรับลุคให้อยู่ในสิทธิ์ของระดับนั้น (เปลี่ยนระดับแล้วตัวเลือกที่เกินสิทธิ์จะกลับเป็นค่าของระดับ)
export function clampLook(l: GiantLook, tier: GiantTier): GiantLook {
  const house = tier.houses.includes(l.house ?? "") ? (l.house as string) : (tier.look.house as string);
  return {
    base: tier.bases.includes(l.base) ? l.base : tier.look.base,
    board: tier.boards.includes(l.board) ? l.board : tier.look.board,
    house,
    wall: tier.walls.includes(l.wall ?? "") ? l.wall : tier.look.wall,
    roof: tier.roofs.includes(l.roof ?? "") ? l.roof : tier.look.roof,
    fence: tier.fences.includes(l.fence ?? "") ? l.fence : tier.look.fence,
    items: parseItems(l.items, house, tier.maxItems, tier.kinds),
    tier: tier.id,
  };
}

// สุ่มแต่งบ้านทั้งหลังตามสิทธิ์ของระดับ: บ้าน สี รั้ว ฐาน และของบนฐานพร้อมสีแต่ละส่วน
export function randomLook(tier: GiantTier, rnd: () => number = Math.random): GiantLook {
  const one = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const houses = tier.houses.filter((h) => h !== "none");
  // ระดับสูงมีโอกาสได้บ้านเด่นของระดับนั้นมากกว่า
  const house = rnd() < 0.55 ? houses[0] : one(houses);
  const fences = tier.fences.filter((f) => f !== "none");
  const items: DioramaItem[] = [];
  const [lo, hi] = tier.randomItems;
  const want = lo + Math.floor(rnd() * (hi - lo + 1));
  // ของประจำระดับ (ที่ระดับล่างไม่มี) ใส่ให้ก่อนอย่างน้อยหนึ่งชิ้น
  const prev = GIANT_TIERS[tier.id - 1]?.kinds ?? [];
  const special = tier.kinds.filter((k) => !prev.includes(k));
  for (let n = 0, tries = 0; n < want && tries < want * 40; tries++) {
    const kind = n < Math.min(2, special.length) ? special[n % special.length] : one(tier.kinds);
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * (BASE_R - radiusOf(kind) - 0.05);
    const x = round(Math.cos(a) * d);
    const z = round(Math.sin(a) * d);
    if (!fits(items, { kind, x, z }, undefined, house)) continue;
    const parts: Record<string, string> = {};
    for (const p of partsFor(kind)) parts[p.key] = one(p.options);
    // หันหน้าออกด้านนอกเล็กน้อยให้ดูเป็นธรรมชาติ
    items.push({ id: `r${n}${Math.floor(rnd() * 1e6).toString(36)}`, kind, parts, x, z, r: round(((Math.atan2(x, z) + (rnd() - 0.5) * 0.8) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) });
    n++;
  }
  return { base: one(tier.bases), board: one(tier.boards), house, wall: one(tier.walls), roof: one(tier.roofs), fence: one(fences), items, tier: tier.id };
}

// ตรวจลุคที่ส่งมา: ถ้าระบุยอด (ตอนสั่งซื้อ) ตัดตัวเลือกให้อยู่ในสิทธิ์ของระดับ ไม่ระบุ (ตอนแสดงผล) อ่านตามที่เก็บไว้
export function parseGiantLook(v: unknown, amount?: number): GiantLook | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const house = pick(o.house, HOUSE_STYLES, "none");
  const raw: GiantLook = {
    base: pick(o.base, DIORAMA_BASES, DEFAULT_GIANT_LOOK.base),
    items: [],
    board: pick(o.board, SIGN_BOARDS, DEFAULT_GIANT_LOOK.board),
    house,
    wall: pick(o.wall, HOUSE_WALLS, "cream"),
    roof: pick(o.roof, HOUSE_ROOFS, "red"),
    fence: pick(o.fence, FENCES, "none"),
  };
  if (amount !== undefined) return clampLook({ ...raw, items: Array.isArray(o.items) ? (o.items as DioramaItem[]) : [] }, giantTier(amount));
  const tier = Number(o.tier);
  return { ...raw, items: parseItems(o.items, house), ...(Number.isInteger(tier) && tier >= 0 && tier <= 3 ? { tier } : {}) };
}
