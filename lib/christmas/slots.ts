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

// ตำแหน่งป้ายประจำห้อง 4 จุดรอบลาน (มุมจากแกน +x, หน้าต้นคือ +z ซึ่งหันเข้าหากล้องตอนเริ่ม)
// ตุ๊กตาหิมะทั่วไปวางบนช่องที่อยู่ใกล้จุดเหล่านี้ไม่ได้ เพื่อเว้นที่ให้ป้ายขนาดใหญ่
export const GIANT_SPOT_DEFS = [
  { label: "หน้าขวา", angle: Math.PI / 4 },
  { label: "หน้าซ้าย", angle: (3 * Math.PI) / 4 },
  { label: "หลังซ้าย", angle: (5 * Math.PI) / 4 },
  { label: "หลังขวา", angle: (7 * Math.PI) / 4 },
] as const;
export const GIANT_SPOT_RADIUS = 5;

const RESERVED = new Set<number>();
for (const d of GIANT_SPOT_DEFS) {
  const cx = Math.cos(d.angle) * GIANT_SPOT_RADIUS;
  const cz = Math.sin(d.angle) * GIANT_SPOT_RADIUS;
  SLOT_POSITIONS.forEach((p, i) => {
    if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < 1.5 ** 2) RESERVED.add(i);
  });
}

// ช่องที่สงวนไว้สำหรับป้ายประจำห้อง
export function isReservedSlot(slot: number) {
  return RESERVED.has(slot);
}

