// รูปทรงของต้นคริสต์มาส ใช้ร่วมกันระหว่างการวาดฉาก การคลิก และการคำนวณตำแหน่งของลูกบอล
// ตำแหน่งทุกชิ้นเก็บเป็น (height, angle) ดังนั้นทุกหน้าจอจะเห็นตำแหน่งเดียวกัน
// height คือสัดส่วนความสูงของพุ่ม (0 = ฐานพุ่ม, 1 = ยอด) จึงไม่ขึ้นกับขนาดจริงของต้น

export const TREE_H = 5.2; // ความสูงของส่วนพุ่มใบ (จากฐานพุ่มถึงยอด)
export const TREE_R0 = 2.0; // รัศมีพุ่มที่ฐาน
export const TREE_BASE_Y = 0.42; // ความสูงจากพื้นที่พุ่มเริ่ม (ต่ำกว่านี้เห็นเป็นลำต้น)
export const TREE_TOP_Y = TREE_BASE_Y + TREE_H; // ยอดพุ่ม (ดาวอยู่เหนือจุดนี้)

// รัศมีของพุ่มที่ระดับความสูง h (0 = ฐาน, 1 = ยอด) โค้งออกเล็กน้อยเหมือนต้นสนจริง
export function radiusAt(h: number) {
  const k = Math.max(0, 1 - h);
  return TREE_R0 * Math.pow(k, 0.92) + 0.04;
}

// จุดกึ่งกลางของลูกบอลที่แขวนบนต้น: อยู่ชิดผิวพุ่มด้านนอก ห้อยจากกิ่งที่อยู่เหนือขึ้นไป
export function ornamentPosition(height: number, angle: number) {
  const y = TREE_BASE_Y + height * TREE_H;
  const r = radiusAt(height) + 0.03;
  return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r };
}

// เวกเตอร์ปกติของผิวกรวยต้นไม้ ณ มุมนั้น (ชี้ออกจากต้นและขึ้นเล็กน้อย)
export function surfaceNormal(angle: number) {
  const len = Math.hypot(TREE_H, TREE_R0);
  const nr = TREE_H / len;
  const ny = TREE_R0 / len;
  return { x: Math.cos(angle) * nr, y: ny, z: Math.sin(angle) * nr };
}

// แปลงจุดที่คลิกบนผิวต้นเป็น (height, angle)
export function pointToHeightAngle(x: number, y: number, z: number) {
  const height = Math.min(Math.max((y - TREE_BASE_Y) / TREE_H, 0.08), 0.94);
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
