// ชนิดข้อมูลของต้นคริสต์มาสร่วมกัน ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์

import type { Social } from "@/lib/christmas/social";
import type { GiantLook } from "@/lib/christmas/giant";

export const ORNAMENT_COLORS = ["gold", "red", "blue", "pink", "white", "green"] as const;
export type OrnamentColor = (typeof ORNAMENT_COLORS)[number];

export const ORNAMENT_SHAPES = ["ball", "star", "bell", "gift"] as const;
export type OrnamentShape = (typeof ORNAMENT_SHAPES)[number];

// ลูกบอลหรือของตกแต่งหนึ่งชิ้นบนต้น
// เก็บตำแหน่งเป็นค่าสัดส่วน (height 0..1 จากโคนถึงยอด, angle เป็นเรเดียน)
// เพื่อให้ทุกหน้าจอแสดงตำแหน่งเดียวกันโดยไม่ขึ้นกับขนาดจอ
export type Ornament = {
  id: string;
  name: string;
  wish: string;
  color: OrnamentColor;
  shape: OrnamentShape;
  height: number;
  angle: number;
  createdAt: number;
  social?: Social; // ลิงก์โซเชียลของผู้แขวน (ไม่บังคับ)
};

// เหตุการณ์ที่เล่นให้ทุกคนเห็นพร้อมกันตามคิว
export const EVENT_KINDS = ["firework", "message"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

// ธีมการแสดงข้อความขอบคุณบนท้องฟ้า เห็นพร้อมกันทุกจอในห้อง
export const MESSAGE_THEMES = ["fireworks", "snow", "sparkle", "sleigh"] as const;
export type MessageTheme = (typeof MESSAGE_THEMES)[number];

export type ShowEvent = {
  id: string;
  kind: EventKind;
  text: string; // ข้อความ (ว่างได้สำหรับพลุ)
  by: string; // ชื่อผู้ส่ง
  color: OrnamentColor;
  theme: MessageTheme; // ธีมการแสดงของข้อความ
  startAt: number; // เวลาเซิร์ฟเวอร์ (ms) ที่ทุกหน้าจอเริ่มเล่นพร้อมกัน
  duration: number; // ms
};

// ตุ๊กตาหิมะยักษ์ของห้อง (ป้ายจากการสนับสนุนที่จ่ายแล้วล่าสุด)
export type GiantSign = { name: string; message: string; amount: number; paidAt: number; spot: number; social?: Social; look?: GiantLook };

export type ChristmasState = {
  version: number;
  ornaments: Ornament[];
  events: ShowEvent[]; // เฉพาะเหตุการณ์ที่ยังไม่จบ
  giant: GiantSign | null;
  persistent: boolean; // false = ใช้หน่วยความจำชั่วคราว (ยังไม่ได้ตั้งค่า Redis)
};

// ข้อมูลคำสั่งสนับสนุนที่ส่งให้หน้าเว็บ (ไม่มีข้อมูลภายในของระบบ)
export type OrderPreview = {
  id: string;
  status: "awaiting_payment" | "paid" | "cancelled";
  amount: number;
  mode: "manual" | "gateway";
  qrPayload: string;
  qrImage: string;
};
