// ตำแหน่งวางตุ๊กตาหิมะ 1,000 ช่อง บนพื้นหิมะรอบต้นคริสต์มาส
// คำนวณแบบกำหนดค่าได้แน่นอน (deterministic) เพื่อให้เซิร์ฟเวอร์และเบราว์เซอร์ได้ตำแหน่งเดียวกัน
export const SLOT_COUNT = 1000;

const R0 = 2.2; // รัศมีวงในสุด (ห่างจากลำต้น)
const RING_GAP = 0.3; // ระยะห่างระหว่างวง
const ARC_GAP = 0.5; // ระยะห่างของตุ๊กตาในวงเดียวกัน

function buildSlots() {
  const out: { x: number; z: number }[] = [];
  let ring = 0;
  for (let r = R0; out.length < SLOT_COUNT; r += RING_GAP, ring++) {
    const n = Math.max(6, Math.floor((2 * Math.PI * r) / ARC_GAP));
    const offset = (ring % 2) * 0.5; // สลับมุมให้วงถัดไปเรียงเป็นรูปสามเหลี่ยม
    for (let i = 0; i < n && out.length < SLOT_COUNT; i++) {
      const a = ((i + offset) / n) * Math.PI * 2;
      out.push({
        x: Math.round(Math.cos(a) * r * 1000) / 1000,
        z: Math.round(Math.sin(a) * r * 1000) / 1000,
      });
    }
  }
  return out;
}

export const SLOT_POSITIONS = buildSlots();

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

// ตำแหน่งตุ๊กตาหิมะยักษ์: วงกว้างรอบลานที่ขยายออกเรื่อย ๆ ตามจำนวนที่ซื้อ
// ระบบจัดให้อัตโนมัติ ตัวที่ซื้อแล้วจะไม่ถูกแทนที่หรือหายไป
// โซนคำอวยพรแบบมีรั้วบนแผนที่: สงวนพื้นที่นี้ไม่ให้วางตุ๊กตายักษ์
export const ZONE = { x: -5, z: -19, half: 8 };
// จำนวนการ์ดที่แขวนบนรั้วในฉาก (การ์ดที่เหลือดูได้จากรายการในโซน)
export const ZONE_CAPACITY = 284; // ตรงกับจำนวนช่องซองบนรั้ว 4 ชั้นใน TreeScene
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

export const GIANT_RING_START = 10;
export const GIANT_RING_GAP = 3.2;
export const GIANT_SPACING = 5.2;
export const GIANT_POSITIONS: { x: number; z: number; angle: number }[] = (() => {
  const out: { x: number; z: number; angle: number }[] = [];
  for (let r = GIANT_RING_START, ring = 0; r < 44; r += GIANT_RING_GAP, ring++) {
    const n = Math.floor((2 * Math.PI * r) / GIANT_SPACING);
    const offset = (ring % 2) * 0.5;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 4 + ((i + offset) / n) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * r * 100) / 100;
      const z = Math.round(Math.sin(a) * r * 100) / 100;
      if (inZone(x, z) || inPath(x, z)) continue; // เว้นพื้นที่โซนคำอวยพรและทางเดินไปโซน
      out.push({ x, z, angle: a });
    }
  }
  return out;
})();
// จำนวนตุ๊กตายักษ์สูงสุดต่อห้อง (เต็มพื้นที่วงกว้างแล้ว)
export const GIANT_CAPACITY = GIANT_POSITIONS.length;

// ตุ๊กตายักษ์อยู่ไกลจากตุ๊กตาทั่วไป จึงไม่สงวนช่องใด
const RESERVED = new Set<number>();

// ช่องที่สงวนไว้สำหรับป้ายประจำห้อง
export function isReservedSlot(slot: number) {
  return RESERVED.has(slot);
}

