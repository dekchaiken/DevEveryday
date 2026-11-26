// ลุคของ Exclusive: บ้านหิมะโมเดลที่สร้างเองในโค้ด พร้อมป้ายห้อยข้างบ้าน
// ผู้ซื้อเลือกสีผนัง สีสายไฟประดับ และสีป้าย ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์

export const GIANT_BODY = ["cream", "mint", "sky", "blush", "pearl", "ice"] as const; // สีผนังบ้าน
export const GIANT_LIGHTS = ["red", "gold", "blue", "multi"] as const; // สีสายไฟรอบประตูและหน้าต่าง
export const SIGN_BOARDS = ["spruce", "ivory", "berry", "gold"] as const;

// เลขสีของแต่ละตัวเลือก (ใช้ทั้งบนฉาก 3 มิติและภาพตัวอย่าง)
export const GIANT_BODY_HEX: Record<string, number> = { cream: 0xf6e3c0, mint: 0xd1fae5, sky: 0xdbeafe, blush: 0xfce7f3, pearl: 0xfff6e6, ice: 0xd6f3ff };
export const GIANT_LIGHT_HEX: Record<string, number[]> = {
  red: [0xff3b5c],
  gold: [0xffd76a],
  blue: [0x7dd3fc],
  multi: [0xff3b5c, 0xffd76a, 0x7dd3fc, 0x86efac],
};

export type GiantLook = {
  body: string;
  lights: string;
  board: string;
};

export const DEFAULT_GIANT_LOOK: GiantLook = {
  body: "cream",
  lights: "red",
  board: "spruce",
};

function pick(v: unknown, list: readonly string[], fallback: string): string {
  return typeof v === "string" && list.includes(v) ? v : fallback;
}

// ตรวจลุคที่ส่งมาจากหน้าเว็บ ค่าที่ไม่รู้จักใช้ค่าเริ่มต้นของชิ้นนั้น
export function parseGiantLook(v: unknown): GiantLook | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    body: pick(o.body, GIANT_BODY, DEFAULT_GIANT_LOOK.body),
    lights: pick(o.lights, GIANT_LIGHTS, DEFAULT_GIANT_LOOK.lights),
    board: pick(o.board, SIGN_BOARDS, DEFAULT_GIANT_LOOK.board),
  };
}
