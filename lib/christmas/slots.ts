// ตำแหน่งวางบนลานคริสต์มาส: ตุ๊กตาธรรมดาใช้ช่อง 1×1 ตุ๊กตายักษ์ใช้จุด 2×2 (ผังมาจาก layout.ts)
// ชื่อเดิมยังคงไว้เพื่อให้โค้ดอื่นทำงานต่อได้ ค่าทั้งหมดมาจากผังเดียวกัน
import { cellKey, worldToCell } from "@/lib/christmas/grid";
import { DOLL_BLOCKED, DOLL_CELLS, DOLL_DISPLAY_POSITIONS, DOLL_POSITIONS, GIANT_BLOCKED, GIANT_DISPLAY_POSITIONS, GIANT_POSITIONS as GP, ZONE_CARD_SLOTS } from "@/lib/christmas/layout";
export { GIANT_CAPACITY, GIANT_MODEL_SCALE, GIANT_POSITIONS, GIANT_RING_START, GIANT_STEP, ZONE, ZONE_CARD_SLOTS, ZONE_GATE, ZONE_GATE_ANGLE, ZONE_RAIL_Y, ZONE_RINGS, ZONE_WALLS, ZONE_STOPS, ZONE_WALKWAYS, ZONE_WALL_TOP, ZONE_WALL_R, DECOR_SPOTS, PATH_HALF, distToPath, inPath, inZone } from "@/lib/christmas/layout";

// จำนวนช่องตุ๊กตาหิมะธรรมดาทั้งหมด (ลำดับช่องคงที่ตามผัง)
export const SLOT_COUNT = DOLL_CELLS.length;
export const SLOT_POSITIONS = DOLL_POSITIONS;
// ตำแหน่งที่วาดบนฉาก: ตุ๊กตาที่วางไว้ก่อนผังเปลี่ยนและตอนนี้ทับโซน ทางเดิน หรือโคนต้น ย้ายไปแสดงที่ช่องเปิดใกล้สุด
export const SLOT_DISPLAY_POSITIONS = DOLL_DISPLAY_POSITIONS;
export const GIANT_DISPLAY = GP.map((g, i) => {
  const d = GIANT_DISPLAY_POSITIONS[i];
  return { ...g, x: d.x, z: d.z, angle: Math.atan2(d.z, d.x) };
});

// จำนวนการ์ดที่แขวนบนรั้วในฉาก (การ์ดที่เหลือดูได้จากรายการในโซน)
export const ZONE_CAPACITY = ZONE_CARD_SLOTS.length; // จำนวนช่องซองบนรั้ว 4 ชั้น (คำนวณจากผังโซน)

// ช่องที่ใกล้จุดที่เลือกบนพื้นที่สุด (ใช้ตอนแตะบนฉาก)
export function nearestSlot(x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < SLOT_POSITIONS.length; i++) {
    if (DOLL_BLOCKED.has(i)) continue;
    const p = SLOT_POSITIONS[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// ช่องที่วางใหม่ไม่ได้: ช่องเดิมที่ตอนนี้ทับโซนคำอวยพรหรือทางเดินใหม่
export function isReservedSlot(slot: number) {
  return DOLL_BLOCKED.has(slot);
}

// จุดบ้าน Exclusive ที่วางใหม่ไม่ได้ (ทับโซนหรือทางเดินใหม่)
export function isBlockedGiantSpot(spot: number) {
  return GIANT_BLOCKED.has(spot);
}

// ช่องที่อยู่ตรงจุดในโลกพอดี (ใช้ตอนแตะเลือกบนฉาก ได้ช่องตรงกับที่แตะเสมอ) ไม่ใช่ช่องที่วางได้ = null
const SLOT_BY_CELL = new Map(DOLL_CELLS.map((c, i) => [cellKey(c), i]));
export function slotAtWorld(x: number, z: number): number | null {
  const i = SLOT_BY_CELL.get(cellKey(worldToCell(x, z)));
  return i === undefined || DOLL_BLOCKED.has(i) ? null : i;
}
