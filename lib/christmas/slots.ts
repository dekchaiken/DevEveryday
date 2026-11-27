// ตำแหน่งวางบนลานคริสต์มาส: ตุ๊กตาธรรมดาใช้ช่อง 1×1 ตุ๊กตายักษ์ใช้จุด 2×2 (ผังมาจาก layout.ts)
// ชื่อเดิมยังคงไว้เพื่อให้โค้ดอื่นทำงานต่อได้ ค่าทั้งหมดมาจากผังเดียวกัน
import { DOLL_CELLS, DOLL_POSITIONS } from "@/lib/christmas/layout";
export { GIANT_CAPACITY, GIANT_MODEL_SCALE, GIANT_POSITIONS, GIANT_RING_START, GIANT_STEP, ZONE, ZONE_GATE, distToPath, inPath, inZone } from "@/lib/christmas/layout";

// จำนวนช่องตุ๊กตาหิมะธรรมดาทั้งหมด (ลำดับช่องคงที่ตามผัง)
export const SLOT_COUNT = DOLL_CELLS.length;
export const SLOT_POSITIONS = DOLL_POSITIONS;

// จำนวนการ์ดที่แขวนบนรั้วในฉาก (การ์ดที่เหลือดูได้จากรายการในโซน)
export const ZONE_CAPACITY = 284; // ตรงกับจำนวนช่องซองบนรั้ว 4 ชั้นใน TreeScene

// ช่องที่ใกล้จุดที่เลือกบนพื้นที่สุด (ใช้ตอนแตะบนฉาก)
export function nearestSlot(x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < SLOT_POSITIONS.length; i++) {
    const p = SLOT_POSITIONS[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// ช่องที่สงวนไว้สำหรับป้ายประจำห้อง (ยังไม่มีในผังใหม่)
const RESERVED = new Set<number>();
export function isReservedSlot(slot: number) {
  return RESERVED.has(slot);
}
