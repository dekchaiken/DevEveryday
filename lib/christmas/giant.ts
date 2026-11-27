// ลุคของ Exclusive: ฐานกลมลายขนมหวาน มีตาราง 4×4 ให้วางของตกแต่งอิสระ (ตุ๊กตาหิมะ ต้นสน กล่องของขวัญ ไม้เท้าขนม)
// ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์ จึงไม่มี Three.js หรือ Redis ในไฟล์นี้

export const DIORAMA_GRID = 4; // ตารางย่อยบนฐาน 4×4 ช่อง
export const DIORAMA_KINDS = ["snowman", "tree", "gift", "candy"] as const;
export const DIORAMA_BASES = ["pink", "mint", "red", "blue"] as const; // ลายแถบของฐาน
export const GIFT_COLORS = ["red", "green", "blue", "pink", "gold"] as const; // สีกล่องของขวัญ (สีริบบิ้นสลับอัตโนมัติ)
export const TREE_COLORS = ["forest", "mint", "frost"] as const; // สีต้นสน
export const SIGN_BOARDS = ["spruce", "ivory", "berry", "gold"] as const; // สีป้ายชื่อเล็กที่ปักข้างฐาน

// สีจริงของแต่ละตัวเลือก (ใช้ทั้งบนฉากและในหน้าตัวอย่าง)
export const BASE_HEX: Record<string, { a: number; b: number }> = {
  pink: { a: 0xf9a8c4, b: 0xffffff },
  mint: { a: 0x86e0b8, b: 0xffffff },
  red: { a: 0xe0465a, b: 0xffffff },
  blue: { a: 0x8ec5ff, b: 0xffffff },
};
export const GIFT_HEX: Record<string, number> = { red: 0xdc2643, green: 0x22a35a, blue: 0x3b82f6, pink: 0xf472b6, gold: 0xf5c542 };
export const TREE_HEX: Record<string, number> = { forest: 0x1f7a4d, mint: 0x52c293, frost: 0x2f8f6b };

export type DioramaItem = { i: number; kind: string; color: string }; // i = ช่องบนตาราง 0..15
export type GiantLook = {
  base: string;
  items: DioramaItem[];
  board: string; // สีป้ายชื่อเล็ก
};

export const DEFAULT_GIANT_LOOK: GiantLook = { base: "pink", items: [], board: "spruce" };

function pick(v: unknown, list: readonly string[], fallback: string): string {
  return typeof v === "string" && list.includes(v) ? v : fallback;
}

// สีที่ใช้ได้ของแต่ละชนิด (ชนิดที่ไม่มีสีให้ค่าว่าง)
export function colorOptionsFor(kind: string): readonly string[] {
  if (kind === "gift") return GIFT_COLORS;
  if (kind === "tree") return TREE_COLORS;
  return [];
}

// ตรวจของตกแต่งทั้งหมดที่ส่งมาจากหน้าเว็บ: ช่องซ้ำ ช่องนอกตาราง ชนิดหรือสีที่ไม่รู้จักจะถูกตัดทิ้ง
export function parseItems(v: unknown): DioramaItem[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<number>();
  const out: DioramaItem[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const i = Number(o.i);
    if (!Number.isInteger(i) || i < 0 || i >= DIORAMA_GRID * DIORAMA_GRID || seen.has(i)) continue;
    const kind = pick(o.kind, DIORAMA_KINDS, "");
    if (!kind) continue;
    const opts = colorOptionsFor(kind);
    const color = opts.length ? pick(o.color, opts, opts[0]) : "";
    seen.add(i);
    out.push({ i, kind, color });
  }
  return out.sort((a, b) => a.i - b.i);
}

// ตรวจลุคที่ส่งมาจากหน้าเว็บ ค่าที่ไม่รู้จักใช้ค่าเริ่มต้น
export function parseGiantLook(v: unknown): GiantLook | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    base: pick(o.base, DIORAMA_BASES, DEFAULT_GIANT_LOOK.base),
    items: parseItems(o.items),
    board: pick(o.board, SIGN_BOARDS, DEFAULT_GIANT_LOOK.board),
  };
}
