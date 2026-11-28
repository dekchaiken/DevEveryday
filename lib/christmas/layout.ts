// ผังของลานคริสต์มาส: โซนคำอวยพร ทางเดิน และช่องที่วางได้ทั้งหมด
// ผังทั้งหมดคำนวณแบบกำหนดค่าได้แน่นอน ทำให้เซิร์ฟเวอร์และเบราว์เซอร์ได้ตำแหน่งเดียวกัน
//
// ลำดับช่องต้องคงที่ตลอด เพราะตุ๊กตาและบ้าน Exclusive ที่วางแล้วเก็บเป็นเลขช่อง
// เมื่อย้ายโซน: ช่องเดิมทุกช่องยังอยู่ลำดับเดิม ช่องที่ทับโซนหรือทางเดินใหม่ถูกปิดไว้ (วางใหม่ไม่ได้)
// และพื้นที่ที่ว่างขึ้นจากโซนเก่าจะต่อท้ายรายการเป็นช่องใหม่
import { CELL, LAND_R, LEGACY_TREE_CORE_R, TREE_CORE_R, checkPlacement, cellKey, footprintCells, footprintCenter, type Cell, type Rules } from "@/lib/christmas/grid";

// โซนแบบสี่เหลี่ยม (half = ครึ่งความกว้าง) หรือวงกลม (round: half = รัศมีที่สงวนไว้)
// gate = จุดที่ทางเดินจากต้นไม้มาถึงโซน (ไม่ระบุ = กลางขอบด้านที่หันเข้าหาต้น แบบผังเดิม)
export type Zone = { x: number; z: number; half: number; round?: boolean; gate?: { x: number; z: number } };

// ผังรุ่นแรก (ก่อนย้ายโซน) รุ่นที่สอง (โซน 20×20) และรุ่นที่สาม (หมู่บ้าน 26×26) ใช้คำนวณลำดับช่องเดิมเท่านั้น
export const LEGACY_ZONE: Zone = { x: -5, z: -19, half: 8 };
export const ZONE_V2: Zone = { x: -12, z: -26, half: 10 };
export const ZONE_V3: Zone = { x: -14, z: -32, half: 13 };

// ---------- โซนคำอวยพรปัจจุบัน: หมู่บ้านวงกลม ห่างต้น 30 หน่วย อยู่ในเขตลานทั้งหมด ----------
// กำแพงการ์ดสามวง (รัศมี 4.5 / 8.5 / 12.5) มีทางเดินวงแหวนสองวงคั่น ทุกหน้าการ์ดหันเข้าหาทางเดิน
export const ZONE_WALL_R = 12.5; // รัศมีกำแพงวงนอกสุด (ขอบหมู่บ้าน)
const ZONE_CENTER = { x: -15, z: -26 };
const ZONE_DIST = Math.hypot(ZONE_CENTER.x, ZONE_CENTER.z);
export const ZONE_GATE = {
  x: ZONE_CENTER.x * (1 - ZONE_WALL_R / ZONE_DIST),
  z: ZONE_CENTER.z * (1 - ZONE_WALL_R / ZONE_DIST),
};
// สงวนวงกว้างกว่ากำแพงเล็กน้อย เผื่อบ้านหิมะสองหลังข้างประตูและต้นสนรอบนอก
export const ZONE: Zone = { x: ZONE_CENTER.x, z: ZONE_CENTER.z, half: 15.3, round: true, gate: ZONE_GATE };
// มุมของประตูเมื่อมองจากจุดกลางโซน (ชี้กลับมาหาต้นไม้)
export const ZONE_GATE_ANGLE = Math.atan2(ZONE_GATE.z - ZONE.z, ZONE_GATE.x - ZONE.x);
// ครึ่งความกว้างของทางเดิน (ทางเดินปัจจุบันกว้างขึ้นเพื่อให้มีอุโมงค์ซุ้มไฟ)
const PATH_HALF_OLD = 1.3;
export const PATH_HALF = 1.7;

function inZoneOf(zone: Zone, x: number, z: number, pad = 0.6) {
  if (zone.round) return Math.hypot(x - zone.x, z - zone.z) <= zone.half + pad;
  return Math.abs(x - zone.x) <= zone.half + pad && Math.abs(z - zone.z) <= zone.half + pad;
}
// ระยะจากจุดถึงทางเดินเส้นตรงจากต้นไม้ไปประตูโซน
function distToPathOf(zone: Zone, x: number, z: number): number {
  const vx = zone.gate ? zone.gate.x : zone.x;
  const vz = zone.gate ? zone.gate.z : zone.z + zone.half;
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

// ---------- ของตกแต่งรอบลาน: ตำแหน่งคงที่และสงวนช่องไว้ ไม่ทับตุ๊กตาหรือบ้าน Exclusive ----------
export type DecorSpot = { kind: "lamp" | "bench" | "baubles" | "grove"; x: number; z: number; r: number; a: number };
const deg = (d: number) => (d * Math.PI) / 180;
function buildDecorSpots(): DecorSpot[] {
  const out: DecorSpot[] = [];
  const at = (kind: DecorSpot["kind"], a: number, rad: number, r: number) => out.push({ kind, x: Math.cos(a) * rad, z: Math.sin(a) * rad, r, a });
  // เสาไฟ 12 ต้นรอบลาน: มุมกล้องหน้าต้น (90°) และทางเดินไปโซนอยู่กึ่งกลางระหว่างเสาพอดี
  for (let k = 0; k < 12; k++) at("lamp", deg(75 + k * 30), 7.7, 0.45);
  for (const a of [0, 150, 300]) at("bench", deg(a), 8.6, 0.95);
  for (const a of [20, 125, 195]) at("baubles", deg(a), 11.2, 1.4);
  // ป่าสนเป็นกลุ่มที่ขอบลาน (ไกลจากต้น ไม่กินพื้นที่ที่คนนิยมวาง) เว้นแนวทางไปโซน
  const gateA = Math.atan2(ZONE_GATE.z, ZONE_GATE.x);
  for (let k = 0; k < 16; k++) {
    const a = deg(k * 22.5 + 8);
    const d = Math.abs(Math.atan2(Math.sin(a - gateA), Math.cos(a - gateA)));
    if (d < deg(16)) continue;
    const x = Math.cos(a) * 48.5;
    const z = Math.sin(a) * 48.5;
    if (inZoneOf(ZONE, x, z, 4)) continue;
    at("grove", a, 48.5, 3.6);
  }
  return out;
}
export const DECOR_SPOTS = buildDecorSpots();
function inDecor(x: number, z: number, pad = 0) {
  return DECOR_SPOTS.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + pad);
}

type Gen = { zone: Zone; pathHalf: number; coreR: number; decor?: boolean };
function rulesFor(gen: Gen, extraReserved?: (c: Cell) => boolean): Rules {
  return {
    road: (c) => cornersOf(c).some(([x, z]) => inPathOf(gen.zone, x, z, gen.pathHalf)), // ทางเดินไปโซนอวยพรวางทับไม่ได้
    // โซนคำอวยพรและของตกแต่งรอบลานสงวนไว้ (ใช้จุดกลางช่องตรวจของตกแต่งด้วย เพราะเสาไฟเล็กกว่าช่อง)
    reserved: (c) =>
      cornersOf(c).some(([x, z]) => inZoneOf(gen.zone, x, z)) ||
      (gen.decor ? cornersOf(c).some(([x, z]) => inDecor(x, z)) || inDecor((c.x + 0.5) * CELL, (c.z + 0.5) * CELL) : false) ||
      (extraReserved ? extraReserved(c) : false),
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
// รุ่นที่ 4: หมู่บ้านวงกลมใกล้ต้นขึ้น และสงวนช่องใต้ของตกแต่งรอบลาน
const GENS: Gen[] = [
  { zone: LEGACY_ZONE, pathHalf: PATH_HALF_OLD, coreR: LEGACY_TREE_CORE_R },
  { zone: ZONE_V2, pathHalf: PATH_HALF_OLD, coreR: LEGACY_TREE_CORE_R },
  { zone: ZONE_V3, pathHalf: PATH_HALF, coreR: TREE_CORE_R },
  { zone: ZONE, pathHalf: PATH_HALF, coreR: TREE_CORE_R, decor: true },
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
// ราว 5 ชั้น ห่างกัน 0.55 หน่วย ซองแขวนใต้ราว
export const ZONE_RAIL_Y = [2.8, 2.25, 1.7, 1.15, 0.6];
export const ZONE_WALL_TOP = 3.05;
export type ZoneCardSlot = { x: number; z: number; ry: number; y: number; stop: number };
// กำแพงหนึ่งแผง: x, z คือจุดกลาง ry คือมุมหมุนที่หน้า +z ของแผงชี้ออกจากจุดกลางโซน
export type ZoneWall = { x: number; z: number; ry: number; len: number; ring: number; angle: number };
// faces: +1 = หน้าการ์ดหันออก, -1 = หันเข้า
export const ZONE_RINGS: { r: number; count: number; len: number; faces: (1 | -1)[] }[] = [
  { r: 4.5, count: 6, len: 3.6, faces: [1] },
  { r: 8.5, count: 12, len: 3.6, faces: [1, -1] },
  { r: ZONE_WALL_R, count: 18, len: 3.6, faces: [-1] },
];
// ทางเดินวงแหวน: วงในระหว่างกำแพงวง 0 กับ 1 และวงนอกระหว่างวง 1 กับ 2
export const ZONE_WALKWAYS = [
  { r: 6.5, inner: 4.5, outer: 8.5 },
  { r: 10.5, inner: 8.5, outer: ZONE_WALL_R },
];
// แผงที่ตรงกับแนวประตูถูกเว้นไว้ทุกวง เป็นทางเดินตรงจากประตูถึงต้นสนกลางลาน
export const ZONE_WALLS: ZoneWall[] = ZONE_RINGS.flatMap((ring, ri) => {
  const out: ZoneWall[] = [];
  for (let k = 1; k < ring.count; k++) {
    const angle = ZONE_GATE_ANGLE + (k / ring.count) * Math.PI * 2;
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);
    out.push({ x: ZONE.x + nx * ring.r, z: ZONE.z + nz * ring.r, ry: Math.atan2(nx, nz), len: ring.len, ring: ri, angle });
  }
  return out;
});
// จุดชมการ์ด: หนึ่งจุดต่อหนึ่งหน้ากำแพง เรียงตามทางเดิน (วงในก่อน) และตามมุมจากประตูทวนเข็ม
export type ZoneStop = { wall: number; side: 1 | -1; walkway: number; center: { x: number; y: number; z: number }; normal: { x: number; z: number }; tangent: { x: number; z: number }; first: number; count: number };
const SLOT_STEP = 0.7;
const SLOT_TS = [-1.4, -0.7, 0, 0.7, 1.4];
function buildStops(): { stops: ZoneStop[]; slots: ZoneCardSlot[] } {
  const faces: { wall: number; side: 1 | -1; walkway: number; rel: number; ring: number }[] = [];
  ZONE_WALLS.forEach((w, wi) => {
    for (const side of ZONE_RINGS[w.ring].faces) {
      const walkway = side > 0 ? w.ring : w.ring - 1;
      const rel = (((w.angle - ZONE_GATE_ANGLE) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      faces.push({ wall: wi, side, walkway, rel, ring: w.ring });
    }
  });
  faces.sort((a, b) => a.walkway - b.walkway || a.rel - b.rel || a.ring - b.ring);
  const stops: ZoneStop[] = [];
  const slots: ZoneCardSlot[] = [];
  faces.forEach((f) => {
    const w = ZONE_WALLS[f.wall];
    const nx = Math.sin(w.ry) * f.side;
    const nz = Math.cos(w.ry) * f.side;
    // ทิศซ้ายไปขวาเมื่อยืนมองหน้ากำแพง
    const rx = nz;
    const rz = -nx;
    const first = slots.length;
    for (const y of ZONE_RAIL_Y) {
      for (const t of SLOT_TS) {
        slots.push({ x: w.x + rx * t + nx * 0.08, z: w.z + rz * t + nz * 0.08, ry: Math.atan2(nx, nz), y, stop: stops.length });
      }
    }
    stops.push({
      wall: f.wall,
      side: f.side,
      walkway: f.walkway,
      center: { x: w.x + nx * 0.1, y: 1.55, z: w.z + nz * 0.1 },
      normal: { x: nx, z: nz },
      tangent: { x: rx, z: rz },
      first,
      count: slots.length - first,
    });
  });
  void SLOT_STEP;
  return { stops, slots };
}
const BUILT = buildStops();
export const ZONE_STOPS = BUILT.stops;
export const ZONE_CARD_SLOTS = BUILT.slots;
