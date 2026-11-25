// ห้องหรือโซนของต้นคริสต์มาส แต่ละห้องมีต้นไม้ ลูกบอล และคิวพลุของตัวเอง
// ใช้แอปเดียวกัน แยกข้อมูลด้วย key ของห้อง

export const ROOM_CAPACITY = 150; // จำนวนคนออนไลน์สูงสุดต่อห้อง

export type RoomTheme = {
  id: string;
  name: string;
  region: string;
  blurb: string;
  skyTop: string;
  skyBottom: string;
  ground: string;
  accent: string;
  skyline: "city" | "hills" | "rice" | "sea";
};

export const ROOMS: RoomTheme[] = [
  {
    id: "bangkok",
    name: "กรุงเทพฯ",
    region: "ภาคกลาง",
    blurb: "ไฟเมืองหลวงยามค่ำคืน ตึกสูงระยิบระยับ",
    skyTop: "#06101d",
    skyBottom: "#1a1636",
    ground: "#e8eef6",
    accent: "#f5c542",
    skyline: "city",
  },
  {
    id: "chiang-mai",
    name: "เชียงใหม่",
    region: "ภาคเหนือ",
    blurb: "หมอกบนดอยกับท้องฟ้าคริสต์มาสเย็นสบาย",
    skyTop: "#071a22",
    skyBottom: "#0f2b33",
    ground: "#e9f4f1",
    accent: "#7ee7b0",
    skyline: "hills",
  },
  {
    id: "khon-kaen",
    name: "ขอนแก่น",
    region: "ภาคอีสาน",
    blurb: "ทุ่งนาและแสงดาวยามค่ำ อบอุ่นเหมือนบ้าน",
    skyTop: "#0c1a10",
    skyBottom: "#2a2412",
    ground: "#f1efe6",
    accent: "#f59e0b",
    skyline: "rice",
  },
  {
    id: "phuket",
    name: "ภูเก็ต",
    region: "ภาคใต้",
    blurb: "ชายทะเลอันดามัน ลมเย็นและคลื่นเบา ๆ",
    skyTop: "#041a2b",
    skyBottom: "#0b3a4a",
    ground: "#eef6fb",
    accent: "#38bdf8",
    skyline: "sea",
  },
];

export function getRoom(id: string | null | undefined): RoomTheme | null {
  return ROOMS.find((r) => r.id === id) ?? null;
}
