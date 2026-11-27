// ลุคของ Exclusive: ฐานกลมลายขนมหวาน วางของตกแต่งได้อย่างอิสระด้วยพิกัด (x, z) และการหมุน (r)
// ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์ จึงไม่มี Three.js หรือ Redis ในไฟล์นี้

export const BASE_R = 1.35; // รัศมีฐาน (หน่วยโลก)
export const MAX_ITEMS = 24;
export const DIORAMA_KINDS = ["snowman", "tree", "gift", "candy"] as const;
export const DIORAMA_BASES = ["pink", "mint", "red", "blue"] as const; // ลายแถบของฐาน
export const GIFT_COLORS = ["red", "green", "blue", "pink", "gold"] as const; // สีกล่องของขวัญ (ริบบิ้นสลับอัตโนมัติ)
export const TREE_COLORS = ["forest", "mint", "frost"] as const; // สีต้นสน
export const SIGN_BOARDS = ["spruce", "ivory", "berry", "gold"] as const; // สีป้ายชื่อเล็ก

// สีจริงของแต่ละตัวเลือก (ใช้ทั้งบนฉากและในหน้าตัวอย่าง)
export const BASE_HEX: Record<string, { a: number; b: number }> = {
  pink: { a: 0xf9a8c4, b: 0xffffff },
  mint: { a: 0x86e0b8, b: 0xffffff },
  red: { a: 0xe0465a, b: 0xffffff },
  blue: { a: 0x8ec5ff, b: 0xffffff },
};
export const GIFT_HEX: Record<string, number> = { red: 0xdc2643, green: 0x22a35a, blue: 0x3b82f6, pink: 0xf472b6, gold: 0xf5c542 };
export const TREE_HEX: Record<string, number> = { forest: 0x1f7a4d, mint: 0x52c293, frost: 0x2f8f6b };

// รัศมีของแต่ละชิ้น ใช้กันการวางทับกันและกันไม่ให้ล้นขอบฐาน
export const ITEM_R: Record<string, number> = { snowman: 0.2, tree: 0.22, gift: 0.2, candy: 0.12 };

export type DioramaItem = { id: string; kind: string; color: string; x: number; z: number; r: number };
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

// ชิ้นนี้วางได้ไหม: อยู่ในฐานทั้งชิ้น และไม่ชนกับชิ้นอื่น (ยกเว้นชิ้นที่กำลังย้ายเอง)
export function fits(items: DioramaItem[], cand: { kind: string; x: number; z: number }, ignoreId?: string): boolean {
  const r = ITEM_R[cand.kind] ?? 0.2;
  if (Math.hypot(cand.x, cand.z) + r > BASE_R - 0.02) return false;
  for (const o of items) {
    if (o.id === ignoreId) continue;
    const ro = ITEM_R[o.kind] ?? 0.2;
    if (Math.hypot(o.x - cand.x, o.z - cand.z) < r + ro + 0.02) return false;
  }
  return true;
}

// หาตำแหน่งว่างใกล้กลางฐานสำหรับชิ้นใหม่ (ค้นเป็นวงรอบ ๆ กลาง)
export function freeSpot(items: DioramaItem[], kind: string): { x: number; z: number } | null {
  for (let rad = 0; rad <= BASE_R; rad += 0.08) {
    const steps = rad === 0 ? 1 : Math.max(6, Math.round((2 * Math.PI * rad) / 0.12));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2 + rad;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (fits(items, { kind, x, z })) return { x: round(x), z: round(z) };
    }
  }
  return null;
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

// ตรวจของตกแต่งทั้งหมดที่ส่งมาจากหน้าเว็บ: ชนิดหรือสีที่ไม่รู้จัก ชิ้นนอกฐาน และชิ้นที่ชนกันจะถูกตัดทิ้ง
export function parseItems(v: unknown): DioramaItem[] {
  if (!Array.isArray(v)) return [];
  const out: DioramaItem[] = [];
  const ids = new Set<string>();
  for (const raw of v) {
    if (out.length >= MAX_ITEMS) break;
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const kind = pick(o.kind, DIORAMA_KINDS, "");
    if (!kind) continue;
    const opts = colorOptionsFor(kind);
    const color = opts.length ? pick(o.color, opts, opts[0]) : "";
    const x = Number(o.x);
    const z = Number(o.z);
    const r = Number(o.r);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (!fits(out, { kind, x, z })) continue;
    let id = typeof o.id === "string" ? o.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) : "";
    if (!id || ids.has(id)) id = `i${out.length}${Math.floor(Math.random() * 1e6).toString(36)}`;
    ids.add(id);
    out.push({ id, kind, color, x: round(x), z: round(z), r: Number.isFinite(r) ? round(((r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) : 0 });
  }
  return out;
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
