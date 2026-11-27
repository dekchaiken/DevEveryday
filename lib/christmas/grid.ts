// กริดของลานคริสต์มาส: การวางทุกชิ้น (ตุ๊กตาหิมะธรรมดา 1×1 และ Exclusive 2×2) ใช้ช่องและกฎชุดเดียวกัน
// โมดูลนี้ไม่มีการเรียก Redis หรือ Three.js จึงใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์ และทดสอบได้ด้วยตัวเอง

export const CELL = 1.2; // ขนาดของช่องกริดในโลก (หน่วย)
export const LAND_R = 44; // รัศมีของลานที่วางได้ (ตรงกับขอบพื้นที่ที่แสดงบนฉากตอนนี้)
export const TREE_CORE_R = 2.8; // พื้นที่โคนต้นคริสต์มาสที่ห้ามวาง

export type Cell = { x: number; z: number };
export type Footprint = 1 | 2; // 1 = ตุ๊กตาธรรมดา, 2 = Exclusive
export type Blocked = "outside" | "tree" | "road" | "reserved" | "occupied";

export const cellKey = (c: Cell) => `${c.x},${c.z}`;

// ช่องที่มีจุดในโลกนี้อยู่ (floor ทำงานถูกต้องกับค่าติดลบ)
export function worldToCell(x: number, z: number): Cell {
  return { x: Math.floor(x / CELL), z: Math.floor(z / CELL) };
}

// ศูนย์กลางของชิ้นงานในโลก เมื่อวางที่มุมล่างซ้ายของช่อง c และกว้าง size ช่อง
export function footprintCenter(c: Cell, size: Footprint): { x: number; z: number } {
  return { x: (c.x + size / 2) * CELL, z: (c.z + size / 2) * CELL };
}

// รายการช่องทั้งหมดที่ชิ้นงานจะกินพื้นที่
export function footprintCells(c: Cell, size: Footprint): Cell[] {
  const out: Cell[] = [];
  for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) out.push({ x: c.x + dx, z: c.z + dz });
  return out;
}

// ตรวจพื้นที่ของช่องเดียว: ทุกมุมต้องอยู่ในลาน และไม่เข้าไปในโคนต้น
function landStatus(c: Cell): "ok" | "outside" | "tree" {
  let worst: "ok" | "outside" | "tree" = "ok";
  for (const [px, pz] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const d = Math.hypot((c.x + px) * CELL, (c.z + pz) * CELL);
    if (d > LAND_R) return "outside";
    if (d < TREE_CORE_R) worst = "tree";
  }
  return worst;
}

export type Rules = {
  road: (c: Cell) => boolean; // ถนนและทางเดิน วางทับไม่ได้
  reserved: (c: Cell) => boolean; // พื้นที่ที่สงวนไว้ เช่น โซนอวยพร
  occupied: (c: Cell) => boolean; // มีชิ้นงานอยู่แล้ว
};

export type PlacementResult = { ok: true } | { ok: false; reason: Blocked; cell: Cell };

// ตรวจว่าวางชิ้นงานได้หรือไม่ และถ้าไม่ได้ บอกว่าติดที่ช่องไหนเพราะอะไร (ใช้ทั้งเซิร์ฟเวอร์และพรีวิวสีเขียว/แดง)
export function checkPlacement(c: Cell, size: Footprint, rules: Rules): PlacementResult {
  for (const cell of footprintCells(c, size)) {
    const land = landStatus(cell);
    if (land === "outside") return { ok: false, reason: "outside", cell };
    if (land === "tree") return { ok: false, reason: "tree", cell };
    if (rules.road(cell)) return { ok: false, reason: "road", cell };
    if (rules.reserved(cell)) return { ok: false, reason: "reserved", cell };
    if (rules.occupied(cell)) return { ok: false, reason: "occupied", cell };
  }
  return { ok: true };
}

// แปลงเส้นทางเป็นชุดช่อง เพื่อใช้เป็นถนนที่วางทับไม่ได้ (halfWidth = จำนวนช่องที่ขยายออกจากเส้นกลาง)
export function roadCells(points: [number, number][], halfWidth = 0): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len / 0.25));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const c = worldToCell(ax + (bx - ax) * t, az + (bz - az) * t);
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        for (let dz = -halfWidth; dz <= halfWidth; dz++) out.add(cellKey({ x: c.x + dx, z: c.z + dz }));
      }
    }
  }
  return out;
}
