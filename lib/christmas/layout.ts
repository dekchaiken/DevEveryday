// ผังของลานคริสต์มาส: โซนคำอวยพร ทางเดิน และช่องที่วางได้ทั้งหมด
// ผังทั้งหมดคำนวณแบบกำหนดค่าได้แน่นอน ทำให้เซิร์ฟเวอร์และเบราว์เซอร์ได้ตำแหน่งเดียวกัน
import { CELL, LAND_R, checkPlacement, cellKey, footprintCells, footprintCenter, type Cell, type Rules } from "@/lib/christmas/grid";

// โซนคำอวยพรแบบมีรั้วบนแผนที่ (ช่องที่ทับโซนจะวางไม่ได้)
export const ZONE = { x: -5, z: -19, half: 8 };
// ประตูโซนหันเข้าหาต้นไม้ และทางเดินจากประตูไปยังต้นไม้
export const ZONE_GATE = { x: ZONE.x, z: ZONE.z + ZONE.half };

export function inZone(x: number, z: number, pad = 0.6) {
  return Math.abs(x - ZONE.x) <= ZONE.half + pad && Math.abs(z - ZONE.z) <= ZONE.half + pad;
}
// ระยะจากจุดถึงทางเดินเส้นตรงจากต้นไม้ไปประตูโซน
export function distToPath(x: number, z: number): number {
  const vx = ZONE_GATE.x;
  const vz = ZONE_GATE.z;
  const t = Math.max(0, Math.min(1, (x * vx + z * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - vx * t, z - vz * t);
}
export function inPath(x: number, z: number): boolean {
  return distToPath(x, z) < 1.3 && Math.hypot(x, z) > 3;
}

// วงแหวนของตุ๊กตายักษ์เริ่มนอกรัศมีนี้ ส่วนในรัศมีนี้เป็นของตุ๊กตาหิมะธรรมดา
export const GIANT_RING_START = 10;
// ระยะห่างระหว่างจุดตุ๊กตายักษ์ เป็นจำนวนช่อง (4 ช่อง = 4.8 หน่วย พอให้ป้ายไม่ชนกัน)
export const GIANT_STEP = 4;

// ช่องที่มุมใดมุมหนึ่งทับโซนหรือทางเดิน
function cornersOf(c: Cell): [number, number][] {
  return [
    [c.x * CELL, c.z * CELL],
    [(c.x + 1) * CELL, c.z * CELL],
    [c.x * CELL, (c.z + 1) * CELL],
    [(c.x + 1) * CELL, (c.z + 1) * CELL],
  ];
}
const touchesZone = (c: Cell) => cornersOf(c).some(([x, z]) => inZone(x, z));
const touchesPath = (c: Cell) => cornersOf(c).some(([x, z]) => inPath(x, z));

const baseRules: Rules = {
  road: (c) => touchesPath(c), // ทางเดินไปโซนอวยพรวางทับไม่ได้
  reserved: (c) => touchesZone(c), // โซนคำอวยพรสงวนไว้
  occupied: () => false,
};

// เรียงจากใกล้ต้นไปไกล แล้วเรียงตามมุม เพื่อให้ลำดับช่องคงที่
function byRingThenAngle(a: { x: number; z: number }, b: { x: number; z: number }) {
  const ra = Math.hypot(a.x, a.z);
  const rb = Math.hypot(b.x, b.z);
  if (Math.abs(ra - rb) > 1e-6) return ra - rb;
  return Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x);
}

// จุดตุ๊กตายักษ์ (2×2): วางบนตารางย่อยทุก GIANT_STEP ช่อง เฉพาะวงนอกรัศมี GIANT_RING_START
function giantSpotCells(): Cell[] {
  const out: Cell[] = [];
  const n = Math.ceil(LAND_R / CELL) + 2;
  for (let x = -n; x <= n; x++) {
    for (let z = -n; z <= n; z++) {
      if (x % GIANT_STEP !== 0 || z % GIANT_STEP !== 0) continue;
      const c = { x, z };
      const center = footprintCenter(c, 2);
      if (Math.hypot(center.x, center.z) < GIANT_RING_START) continue;
      if (checkPlacement(c, 2, baseRules).ok) out.push(c);
    }
  }
  return out.sort((a, b) => byRingThenAngle(footprintCenter(a, 2), footprintCenter(b, 2)));
}

const GIANT_CELLS_LIST = giantSpotCells();
// ช่องทั้งหมดที่ตุ๊กตายักษ์จองไว้ (ตุ๊กตาธรรมดาวางทับไม่ได้ แม้จุดนั้นจะยังว่าง)
const GIANT_CELL_KEYS = new Set<string>();
for (const c of GIANT_CELLS_LIST) for (const f of footprintCells(c, 2)) GIANT_CELL_KEYS.add(cellKey(f));

export const GIANT_POSITIONS: { x: number; z: number; angle: number; cell: Cell }[] = GIANT_CELLS_LIST.map((c) => {
  const p = footprintCenter(c, 2);
  return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, angle: Math.atan2(p.z, p.x), cell: c };
});
export const GIANT_CAPACITY = GIANT_POSITIONS.length;

// ช่องของตุ๊กตาหิมะธรรมดา (1×1): ทุกช่องที่วางได้ ยกเว้นช่องที่จองให้ตุ๊กตายักษ์
const dollRules: Rules = {
  road: baseRules.road,
  reserved: (c) => baseRules.reserved(c) || GIANT_CELL_KEYS.has(cellKey(c)),
  occupied: () => false,
};
export const DOLL_CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  const n = Math.ceil(LAND_R / CELL) + 1;
  for (let x = -n; x <= n; x++) {
    for (let z = -n; z <= n; z++) {
      const c = { x, z };
      if (checkPlacement(c, 1, dollRules).ok) out.push(c);
    }
  }
  return out.sort((a, b) => byRingThenAngle(footprintCenter(a, 1), footprintCenter(b, 1)));
})();

// จุดกลางของช่องตุ๊กตาแต่ละช่องในโลก (ใช้ตำแหน่งบนฉาก)
export const DOLL_POSITIONS = DOLL_CELLS.map((c) => footprintCenter(c, 1));
