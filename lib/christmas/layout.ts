// ผังของลานคริสต์มาส: โซนคำอวยพร ทางเดิน และช่องที่วางได้ทั้งหมด
// ผังทั้งหมดคำนวณแบบกำหนดค่าได้แน่นอน ทำให้เซิร์ฟเวอร์และเบราว์เซอร์ได้ตำแหน่งเดียวกัน
//
// ลำดับช่องต้องคงที่ตลอด เพราะตุ๊กตาและบ้าน Exclusive ที่วางแล้วเก็บเป็นเลขช่อง
// เมื่อย้ายโซน: ช่องเดิมทุกช่องยังอยู่ลำดับเดิม ช่องที่ทับโซนหรือทางเดินใหม่ถูกปิดไว้ (วางใหม่ไม่ได้)
// และพื้นที่ที่ว่างขึ้นจากโซนเก่าจะต่อท้ายรายการเป็นช่องใหม่
import { CELL, LAND_R, LEGACY_TREE_CORE_R, TREE_CORE_R, checkPlacement, cellKey, footprintCells, footprintCenter, type Cell, type Rules } from "@/lib/christmas/grid";

export type Zone = { x: number; z: number; half: number };

// ผังรุ่นแรก (ก่อนย้ายโซน) และรุ่นที่สอง (โซน 20×20) ใช้คำนวณลำดับช่องเดิมเท่านั้น
export const LEGACY_ZONE: Zone = { x: -5, z: -19, half: 8 };
export const ZONE_V2: Zone = { x: -12, z: -26, half: 10 };
// โซนคำอวยพรปัจจุบัน: หมู่บ้านคำอวยพร 26×26 หน่วย มีกำแพงการ์ดสองวงล้อมต้นสนกลางลาน
export const ZONE: Zone = { x: -14, z: -32, half: 13 };
// ประตูโซนหันเข้าหาต้นไม้ และทางเดินจากประตูไปยังต้นไม้
export const ZONE_GATE = { x: ZONE.x, z: ZONE.z + ZONE.half };
// ครึ่งความกว้างของทางเดิน (ทางเดินปัจจุบันกว้างขึ้นเพื่อให้มีอุโมงค์ซุ้มไฟ)
const PATH_HALF_OLD = 1.3;
export const PATH_HALF = 1.7;

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
function inPathOf(zone: Zone, x: number, z: number, half: number): boolean {
  return distToPathOf(zone, x, z) < half && Math.hypot(x, z) > 3;
}

export function inZone(x: number, z: number, pad = 0.6) {
  return inZoneOf(ZONE, x, z, pad);
}
export function distToPath(x: number, z: number): number {
  return distToPathOf(ZONE, x, z);
}
export function inPath(x: number, z: number): boolean {
  return inPathOf(ZONE, x, z, PATH_HALF);
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

type Gen = { zone: Zone; pathHalf: number; coreR: number };
function rulesFor(gen: Gen, extraReserved?: (c: Cell) => boolean): Rules {
  return {
    road: (c) => cornersOf(c).some(([x, z]) => inPathOf(gen.zone, x, z, gen.pathHalf)), // ทางเดินไปโซนอวยพรวางทับไม่ได้
    reserved: (c) => cornersOf(c).some(([x, z]) => inZoneOf(gen.zone, x, z)) || (extraReserved ? extraReserved(c) : false), // โซนคำอวยพรสงวนไว้
    occupied: () => false,
    coreR: gen.coreR,
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

// ---------- ลำดับช่อง: ทุกรุ่นของผังต่อท้ายกัน (ห้ามแก้รุ่นที่ผ่านมา เพิ่มรุ่นใหม่ต่อท้ายเท่านั้น) ----------
// รุ่นที่ 1: โซนเดิม  รุ่นที่ 2: โซน 20×20  รุ่นที่ 3: หมู่บ้านคำอวยพรและต้นใหญ่ (โคนต้นกว้างขึ้น ทางเดินกว้างขึ้น)
const GENS: Gen[] = [
  { zone: LEGACY_ZONE, pathHalf: PATH_HALF_OLD, coreR: LEGACY_TREE_CORE_R },
  { zone: ZONE_V2, pathHalf: PATH_HALF_OLD, coreR: LEGACY_TREE_CORE_R },
  { zone: ZONE, pathHalf: PATH_HALF, coreR: TREE_CORE_R },
];
const GIANT_CELLS_LIST: Cell[] = [];
const DOLL_LIST: Cell[] = [];
GENS.forEach((gen, gi) => {
  const giantSet = new Set(GIANT_CELLS_LIST.map(cellKey));
  const giantKeysBefore = footprintKeys(GIANT_CELLS_LIST, 2);
  const dollKeysBefore = footprintKeys(DOLL_LIST, 1);
  // จุดบ้านใหม่: ต้องอยู่บนพื้นที่ที่ว่างขึ้นจริง ไม่ทับช่องตุ๊กตาหรือจุดบ้านของรุ่นก่อน
  const giants = giantSpotCells(rulesFor(gen)).filter(
    (c) => gi === 0 || (!giantSet.has(cellKey(c)) && footprintCells(c, 2).every((f) => !dollKeysBefore.has(cellKey(f)) && !giantKeysBefore.has(cellKey(f)))),
  );
  GIANT_CELLS_LIST.push(...giants);
  const giantKeys = footprintKeys(GIANT_CELLS_LIST, 2);
  // ช่องตุ๊กตาใหม่: ว่างตามผังรุ่นนี้ ไม่ทับจุดบ้าน และยังไม่เคยมีในรุ่นก่อน
  const dolls = dollCells(rulesFor(gen, (c) => giantKeys.has(cellKey(c)))).filter((c) => !dollKeysBefore.has(cellKey(c)));
  DOLL_LIST.push(...dolls);
});
const currentRules = rulesFor(GENS[GENS.length - 1]);

// จุดบ้านของรุ่นก่อนที่ตอนนี้ทับโซน ทางเดิน หรือโคนต้น (ปิดไว้ วางใหม่ไม่ได้)
export const GIANT_BLOCKED = new Set<number>();
GIANT_CELLS_LIST.forEach((c, i) => {
  if (!checkPlacement(c, 2, currentRules).ok) GIANT_BLOCKED.add(i);
});

export const GIANT_POSITIONS: { x: number; z: number; angle: number; cell: Cell; blocked: boolean }[] = GIANT_CELLS_LIST.map((c, i) => {
  const p = footprintCenter(c, 2);
  return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, angle: Math.atan2(p.z, p.x), cell: c, blocked: GIANT_BLOCKED.has(i) };
});
export const GIANT_CAPACITY = GIANT_POSITIONS.length;

export const DOLL_CELLS: Cell[] = DOLL_LIST;

// ช่องตุ๊กตาของรุ่นก่อนที่ตอนนี้ทับโซน ทางเดิน หรือโคนต้น (ปิดไว้ วางใหม่ไม่ได้)
export const DOLL_BLOCKED = new Set<number>();
DOLL_LIST.forEach((c, i) => {
  if (!checkPlacement(c, 1, currentRules).ok) DOLL_BLOCKED.add(i);
});

// จุดกลางของช่องตุ๊กตาแต่ละช่องในโลก (ใช้ตำแหน่งบนฉาก)
export const DOLL_POSITIONS = DOLL_CELLS.map((c) => footprintCenter(c, 1));

// ตำแหน่งที่ใช้แสดงบนฉาก: ช่องที่ถูกปิด (ตุ๊กตาที่วางไว้ก่อนผังเปลี่ยน) ย้ายไปแสดงที่ช่องเปิดที่ใกล้สุด
// ช่องปลายทางไม่ซ้ำกัน และเลือกจากช่องรุ่นล่าสุดก่อน (พื้นที่ใหม่ ยังไม่ค่อยมีคนวาง)
function relocate<T extends { x: number; z: number }>(positions: T[], blocked: Set<number>): { x: number; z: number }[] {
  const out = positions.map((p) => ({ x: p.x, z: p.z }));
  const used = new Set<number>();
  for (const i of blocked) {
    const p = positions[i];
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < positions.length; j++) {
      if (blocked.has(j) || used.has(j)) continue;
      const d = (positions[j].x - p.x) ** 2 + (positions[j].z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) {
      used.add(best);
      out[i] = { x: positions[best].x, z: positions[best].z };
    }
  }
  return out;
}
export const DOLL_DISPLAY_POSITIONS = relocate(DOLL_POSITIONS, DOLL_BLOCKED);
export const GIANT_DISPLAY_POSITIONS = relocate(GIANT_POSITIONS, GIANT_BLOCKED);

// ---------- ช่องแขวนซองการ์ดในหมู่บ้านคำอวยพร ----------
// ราว 4 ชั้น ห่างกัน 0.55 หน่วย ให้ซองแขวนใต้ราวได้โดยไม่ทับราวชั้นล่าง
export const ZONE_RAIL_Y = [2.25, 1.7, 1.15, 0.6];
export type ZoneCardSlot = { x: number; z: number; ry: number; y: number };
// กำแพงการ์ดสองหน้า วางเป็นสองวงรอบต้นสนกลางลาน (ช่องว่างตรงแนวประตูเป็นทางเดินเข้า)
// x, z คือจุดกลางกำแพงในโลก ry คือมุมหมุนของหน้ากำแพงที่หันออกจากศูนย์กลาง
export type ZoneWall = { x: number; z: number; ry: number; len: number; ring: 0 | 1 };
export const ZONE_RINGS = [
  { r: 6.5, count: 8, len: 3.2, offset: Math.PI / 8 },
  { r: 10.2, count: 12, len: 3.6, offset: Math.PI / 12 },
];
export const ZONE_GATE_HALF = 2.2; // ครึ่งความกว้างช่องประตูบนรั้วด้านหน้า
export const ZONE_WALLS: ZoneWall[] = ZONE_RINGS.flatMap((ring, ri) =>
  Array.from({ length: ring.count }, (_, k) => {
    const phi = ring.offset + (k / ring.count) * Math.PI * 2;
    const nx = Math.cos(phi);
    const nz = Math.sin(phi);
    return { x: ZONE.x + nx * ring.r, z: ZONE.z + nz * ring.r, ry: Math.atan2(nx, nz), len: ring.len, ring: ri as 0 | 1 };
  }),
);
const SLOT_STEP = 0.8;
// ระยะของซองตามแนวกำแพงยาว len (จัดกึ่งกลาง)
function slotTs(len: number): number[] {
  const n = Math.max(1, Math.floor((len - 0.4) / SLOT_STEP + 1e-6) + 1);
  const n2 = Math.min(n, Math.floor(len / SLOT_STEP));
  return Array.from({ length: n2 }, (_, i) => Math.round((i - (n2 - 1) / 2) * SLOT_STEP * 100) / 100);
}
// ลำดับ: ระดับสายตาก่อน ด้านในวงในรอบต้นสน → ด้านนอกวงใน → ด้านในวงนอก → ด้านนอกวงนอก → รั้วรอบโซน
const ROW_ORDER = [1, 2, 0, 3].map((i) => ZONE_RAIL_Y[i]);
function buildZoneCardSlots(): ZoneCardSlot[] {
  const out: ZoneCardSlot[] = [];
  const gateAngle = Math.PI / 2;
  const angDist = (w: ZoneWall) => {
    const a = Math.atan2(w.z - ZONE.z, w.x - ZONE.x);
    const d = Math.abs(a - gateAngle) % (Math.PI * 2);
    return Math.min(d, Math.PI * 2 - d);
  };
  const face = (w: ZoneWall, side: 1 | -1) => {
    // หน้า +1 หันออกจากศูนย์กลาง, -1 หันเข้าหาต้นสน
    const nx = Math.sin(w.ry) * side;
    const nz = Math.cos(w.ry) * side;
    const tx = Math.cos(w.ry);
    const tz = -Math.sin(w.ry);
    const ry = Math.atan2(nx, nz);
    const ts = slotTs(w.len);
    return ROW_ORDER.map((y) => ts.map((t) => ({ x: w.x + tx * t + nx * 0.08, z: w.z + tz * t + nz * 0.08, ry, y })));
  };
  // หน้าที่หันเข้าศูนย์กลาง: กำแพงฝั่งตรงข้ามประตูมองเห็นก่อน (กล้องยืนหน้าประตูมองเข้าลาน)
  // หน้าที่หันออก: กำแพงใกล้ประตูมองเห็นก่อน
  for (const [ring, side] of [
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const walls = ZONE_WALLS.filter((w) => w.ring === ring).sort((a, b) => (side < 0 ? angDist(b) - angDist(a) : angDist(a) - angDist(b)));
    const faces = walls.map((w) => face(w, side));
    ROW_ORDER.forEach((_, ri) => faces.forEach((f) => out.push(...f[ri])));
  }
  // รั้วรอบโซน: แขวนด้านใน (หันเข้าลาน) ด้านหน้าเว้นช่องประตู
  const { x: zx, z: zz, half: zh } = ZONE;
  const ts: number[] = [];
  for (let t = -zh + 0.8; t <= zh - 0.8 + 0.001; t += SLOT_STEP) ts.push(Math.round(t * 100) / 100);
  for (const y of ROW_ORDER) {
    ts.forEach((t) => {
      if (Math.abs(t) > ZONE_GATE_HALF + 0.4) out.push({ x: zx + t, z: zz + zh - 0.1, ry: Math.PI, y });
    });
    ts.forEach((t) => out.push({ x: zx - zh + 0.1, z: zz + t, ry: Math.PI / 2, y }));
    ts.forEach((t) => out.push({ x: zx + zh - 0.1, z: zz + t, ry: -Math.PI / 2, y }));
    ts.forEach((t) => out.push({ x: zx + t, z: zz - zh + 0.1, ry: 0, y }));
  }
  return out;
}
export const ZONE_CARD_SLOTS = buildZoneCardSlots();
