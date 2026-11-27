// ผังของลานคริสต์มาส: โซนคำอวยพร ทางเดิน และช่องที่วางได้ทั้งหมด
// ผังทั้งหมดคำนวณแบบกำหนดค่าได้แน่นอน ทำให้เซิร์ฟเวอร์และเบราว์เซอร์ได้ตำแหน่งเดียวกัน
//
// ลำดับช่องต้องคงที่ตลอด เพราะตุ๊กตาและบ้าน Exclusive ที่วางแล้วเก็บเป็นเลขช่อง
// เมื่อย้ายโซน: ช่องเดิมทุกช่องยังอยู่ลำดับเดิม ช่องที่ทับโซนหรือทางเดินใหม่ถูกปิดไว้ (วางใหม่ไม่ได้)
// และพื้นที่ที่ว่างขึ้นจากโซนเก่าจะต่อท้ายรายการเป็นช่องใหม่
import { CELL, LAND_R, checkPlacement, cellKey, footprintCells, footprintCenter, type Cell, type Rules } from "@/lib/christmas/grid";

export type Zone = { x: number; z: number; half: number };

// ผังเดิมก่อนย้ายโซน ใช้คำนวณลำดับช่องเดิมเท่านั้น
export const LEGACY_ZONE: Zone = { x: -5, z: -19, half: 8 };
// โซนคำอวยพรแบบมีรั้วบนแผนที่: ห่างจากต้นไม้มากขึ้นและกว้างขึ้นกว่าเดิม
export const ZONE: Zone = { x: -12, z: -26, half: 10 };
// ประตูโซนหันเข้าหาต้นไม้ และทางเดินจากประตูไปยังต้นไม้
export const ZONE_GATE = { x: ZONE.x, z: ZONE.z + ZONE.half };

function inZoneOf(zone: Zone, x: number, z: number, pad = 0.6) {
  return Math.abs(x - zone.x) <= zone.half + pad && Math.abs(z - zone.z) <= zone.half + pad;
}
// ระยะจากจุดถึงทางเดินเส้นตรงจากต้นไม้ไปประตูโซน
function distToPathOf(zone: Zone, x: number, z: number): number {
  const vx = zone.x;
  const vz = zone.z + zone.half;
  const t = Math.max(0, Math.min(1, (x * vx + z * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - vx * t, z - vz * t);
}
function inPathOf(zone: Zone, x: number, z: number): boolean {
  return distToPathOf(zone, x, z) < 1.3 && Math.hypot(x, z) > 3;
}

export function inZone(x: number, z: number, pad = 0.6) {
  return inZoneOf(ZONE, x, z, pad);
}
export function distToPath(x: number, z: number): number {
  return distToPathOf(ZONE, x, z);
}
export function inPath(x: number, z: number): boolean {
  return inPathOf(ZONE, x, z);
}

// Exclusive วางได้ตั้งแต่รัศมีนี้ขึ้นไป (ใกล้ต้นกว่านี้ให้ตุ๊กตาหิมะธรรมดาแทน)
export const GIANT_RING_START = 5;
// ระยะห่างระหว่างจุดตุ๊กตายักษ์ เป็นจำนวนช่อง (3 ช่อง = 3.6 หน่วย ฐานหลังย่อแล้วห่างกันพอดี)
export const GIANT_STEP = 3;
// ขนาดตุ๊กตายักษ์บนฉาก (ย่อจากขนาดเดิมให้สมส่วนกับตุ๊กตาหิมะธรรมดา และให้วางได้มากขึ้น)
export const GIANT_MODEL_SCALE = 0.7;

// ช่องที่มุมใดมุมหนึ่งทับโซนหรือทางเดิน
function cornersOf(c: Cell): [number, number][] {
  return [
    [c.x * CELL, c.z * CELL],
    [(c.x + 1) * CELL, c.z * CELL],
    [c.x * CELL, (c.z + 1) * CELL],
    [(c.x + 1) * CELL, (c.z + 1) * CELL],
  ];
}

function rulesFor(zone: Zone, extraReserved?: (c: Cell) => boolean): Rules {
  return {
    road: (c) => cornersOf(c).some(([x, z]) => inPathOf(zone, x, z)), // ทางเดินไปโซนอวยพรวางทับไม่ได้
    reserved: (c) => cornersOf(c).some(([x, z]) => inZoneOf(zone, x, z)) || (extraReserved ? extraReserved(c) : false), // โซนคำอวยพรสงวนไว้
    occupied: () => false,
  };
}

// เรียงจากใกล้ต้นไปไกล แล้วเรียงตามมุม เพื่อให้ลำดับช่องคงที่
function byRingThenAngle(a: { x: number; z: number }, b: { x: number; z: number }) {
  const ra = Math.hypot(a.x, a.z);
  const rb = Math.hypot(b.x, b.z);
  if (Math.abs(ra - rb) > 1e-6) return ra - rb;
  return Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x);
}

// จุดตุ๊กตายักษ์ (2×2): วางบนตารางย่อยทุก GIANT_STEP ช่อง เฉพาะวงนอกรัศมี GIANT_RING_START
function giantSpotCells(rules: Rules): Cell[] {
  const out: Cell[] = [];
  const n = Math.ceil(LAND_R / CELL) + 2;
  for (let x = -n; x <= n; x++) {
    for (let z = -n; z <= n; z++) {
      if (x % GIANT_STEP !== 0 || z % GIANT_STEP !== 0) continue;
      const c = { x, z };
      const center = footprintCenter(c, 2);
      if (Math.hypot(center.x, center.z) < GIANT_RING_START) continue;
      if (checkPlacement(c, 2, rules).ok) out.push(c);
    }
  }
  return out.sort((a, b) => byRingThenAngle(footprintCenter(a, 2), footprintCenter(b, 2)));
}

// ช่องตุ๊กตาธรรมดา (1×1) ที่วางได้ตามกฎที่ให้มา
function dollCells(rules: Rules): Cell[] {
  const out: Cell[] = [];
  const n = Math.ceil(LAND_R / CELL) + 1;
  for (let x = -n; x <= n; x++) {
    for (let z = -n; z <= n; z++) {
      const c = { x, z };
      if (checkPlacement(c, 1, rules).ok) out.push(c);
    }
  }
  return out.sort((a, b) => byRingThenAngle(footprintCenter(a, 1), footprintCenter(b, 1)));
}

const footprintKeys = (cells: Cell[], size: 1 | 2) => {
  const s = new Set<string>();
  for (const c of cells) for (const f of footprintCells(c, size)) s.add(cellKey(f));
  return s;
};

// ---------- ลำดับช่องเดิม (ห้ามเปลี่ยน) ----------
const legacyRules = rulesFor(LEGACY_ZONE);
const LEGACY_GIANTS = giantSpotCells(legacyRules);
const legacyGiantKeys = footprintKeys(LEGACY_GIANTS, 2);
const LEGACY_DOLLS = dollCells(rulesFor(LEGACY_ZONE, (c) => legacyGiantKeys.has(cellKey(c))));
const legacyDollKeys = footprintKeys(LEGACY_DOLLS, 1);

// ---------- ผังปัจจุบัน: ช่องเดิมตามลำดับเดิม + ช่องใหม่ต่อท้าย ----------
const currentRules = rulesFor(ZONE);
const legacyGiantSet = new Set(LEGACY_GIANTS.map(cellKey));
// จุดบ้านใหม่: ต้องอยู่บนพื้นที่ที่ว่างขึ้นจริง ไม่ทับช่องตุ๊กตาหรือจุดบ้านเดิม
const NEW_GIANTS = giantSpotCells(currentRules).filter(
  (c) => !legacyGiantSet.has(cellKey(c)) && footprintCells(c, 2).every((f) => !legacyDollKeys.has(cellKey(f)) && !legacyGiantKeys.has(cellKey(f))),
);
const GIANT_CELLS_LIST = [...LEGACY_GIANTS, ...NEW_GIANTS];
const GIANT_CELL_KEYS = footprintKeys(GIANT_CELLS_LIST, 2);

// จุดบ้านเดิมที่ตอนนี้ทับโซนหรือทางเดินใหม่ (ปิดไว้ วางใหม่ไม่ได้)
export const GIANT_BLOCKED = new Set<number>();
LEGACY_GIANTS.forEach((c, i) => {
  if (!checkPlacement(c, 2, currentRules).ok) GIANT_BLOCKED.add(i);
});

export const GIANT_POSITIONS: { x: number; z: number; angle: number; cell: Cell; blocked: boolean }[] = GIANT_CELLS_LIST.map((c, i) => {
  const p = footprintCenter(c, 2);
  return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, angle: Math.atan2(p.z, p.x), cell: c, blocked: GIANT_BLOCKED.has(i) };
});
export const GIANT_CAPACITY = GIANT_POSITIONS.length;

// ช่องตุ๊กตาใหม่: ว่างตามผังปัจจุบัน ไม่ทับจุดบ้าน และยังไม่เคยมีในลำดับเดิม
const NEW_DOLLS = dollCells(rulesFor(ZONE, (c) => GIANT_CELL_KEYS.has(cellKey(c)))).filter((c) => !legacyDollKeys.has(cellKey(c)));
export const DOLL_CELLS: Cell[] = [...LEGACY_DOLLS, ...NEW_DOLLS];

// ช่องตุ๊กตาเดิมที่ตอนนี้ทับโซนหรือทางเดินใหม่ (ปิดไว้ วางใหม่ไม่ได้)
export const DOLL_BLOCKED = new Set<number>();
LEGACY_DOLLS.forEach((c, i) => {
  if (!checkPlacement(c, 1, currentRules).ok) DOLL_BLOCKED.add(i);
});

// จุดกลางของช่องตุ๊กตาแต่ละช่องในโลก (ใช้ตำแหน่งบนฉาก)
export const DOLL_POSITIONS = DOLL_CELLS.map((c) => footprintCenter(c, 1));

// ---------- ช่องแขวนซองการ์ดบนรั้วโซนคำอวยพร ----------
// ราว 4 ชั้น ห่างกัน 0.55 หน่วย ให้ซองแขวนใต้ราวได้โดยไม่ทับราวชั้นล่าง
export const ZONE_RAIL_Y = [2.25, 1.7, 1.15, 0.6];
export type ZoneCardSlot = { x: number; z: number; ry: number; y: number };
// ลำดับ: ด้านหน้า (กล้องมองเห็น) ก่อน แล้วด้านข้าง และด้านหลัง ทำทีละชั้น
function buildZoneCardSlots(): ZoneCardSlot[] {
  const { x: zx, z: zz, half: zh } = ZONE;
  const gx = ZONE_GATE.x;
  const gz = ZONE_GATE.z;
  const out: ZoneCardSlot[] = [];
  const step = 0.8;
  const sideTs: number[] = [];
  for (let t = -zh + 0.8; t <= zh - 0.8 + 0.001; t += step) sideTs.push(Math.round(t * 100) / 100);
  for (const y of ZONE_RAIL_Y) {
    sideTs.forEach((t) => {
      if (Math.abs(zx + t - gx) > 1.8) out.push({ x: zx + t, z: gz + 0.1, ry: 0, y });
    });
  }
  for (const y of ZONE_RAIL_Y) {
    sideTs.forEach((t) => {
      out.push({ x: zx - zh - 0.1, z: zz + t, ry: -Math.PI / 2, y });
      out.push({ x: zx + zh + 0.1, z: zz + t, ry: Math.PI / 2, y });
    });
  }
  for (const y of ZONE_RAIL_Y) {
    sideTs.forEach((t) => {
      out.push({ x: zx + t, z: zz - zh - 0.1, ry: Math.PI, y });
    });
  }
  return out;
}
export const ZONE_CARD_SLOTS = buildZoneCardSlots();
