// รูปทรงของต้นคริสต์มาส ใช้ร่วมกันระหว่างการวาดฉาก การคลิก และการคำนวณตำแหน่งของลูกบอล
// ตำแหน่งทุกชิ้นเก็บเป็น (height, angle) ดังนั้นทุกหน้าจอจะเห็นตำแหน่งเดียวกัน

export const TREE_H = 3.4; // ความสูงของส่วนใบ
export const TREE_R0 = 1.45; // รัศมีที่โคนต้น

// รัศมีของต้นที่ระดับความสูง h (0 = โคน, 1 = ยอด)
export function radiusAt(h: number) {
  return TREE_R0 * (1 - h) + 0.05;
}

// พิกัดของลูกบอลที่ติดอยู่บนผิวใบ (วางลอยเล็กน้อยให้เห็นชัด)
export function ornamentPosition(height: number, angle: number) {
  const y = height * TREE_H + 0.1;
  const r = radiusAt(height) * 1.04;
  return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r };
}

// แปลงจุดที่คลิกบนผิวต้นเป็น (height, angle)
export function pointToHeightAngle(x: number, y: number, z: number) {
  const height = Math.min(Math.max((y - 0.1) / TREE_H, 0.12), 0.96);
  let angle = Math.atan2(z, x);
  if (angle < 0) angle += Math.PI * 2;
  return { height: Math.round(height * 1000) / 1000, angle: Math.round(angle * 1000) / 1000 };
}

// สีของลูกบอลและของตกแต่ง
export const ORNAMENT_HEX: Record<string, number> = {
  gold: 0xf5c542,
  red: 0xdc2643,
  blue: 0x3b82f6,
  pink: 0xf472b6,
  white: 0xf8fafc,
  green: 0x22c55e,
};
