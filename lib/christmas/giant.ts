// ลุคของตุ๊กตาหิมะยักษ์ (Exclusive) ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
// ตัวเลือกชุดนี้มากกว่าตุ๊กตาฟรี เช่น มงกุฎทิอารา เขากวาง หมวกเอลฟ์ สีตัวแบบมุก และสีป้าย

export const GIANT_HATS = ["top", "beanie", "santa", "crown", "pom", "holly", "tiara", "antlers", "elf"] as const;
export const GIANT_BODY = ["white", "mint", "sky", "blush", "pearl", "ice"] as const;
export const GIANT_ACC = ["none", "glasses", "bow", "bell", "wreath"] as const;
export const SIGN_BOARDS = ["spruce", "ivory", "berry", "gold"] as const;
export const GIANT_SCARVES = ["red", "green", "gold", "blue", "white", "plaid"] as const;
export const GIANT_NOSES = ["carrot", "button", "star", "bell"] as const;
export const GIANT_ARMS = ["sticks", "wings", "gift", "none"] as const;
export const GIANT_LEGS = ["snow", "boots", "gift", "none"] as const;

export type GiantLook = {
  hat: string;
  scarf: string;
  nose: string;
  arms: string;
  body: string;
  legs: string;
  acc: string;
  board: string;
};

export const DEFAULT_GIANT_LOOK: GiantLook = {
  hat: "crown",
  scarf: "gold",
  nose: "star",
  arms: "wings",
  body: "pearl",
  legs: "snow",
  acc: "bow",
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
    hat: pick(o.hat, GIANT_HATS, DEFAULT_GIANT_LOOK.hat),
    scarf: pick(o.scarf, GIANT_SCARVES, DEFAULT_GIANT_LOOK.scarf),
    nose: pick(o.nose, GIANT_NOSES, DEFAULT_GIANT_LOOK.nose),
    arms: pick(o.arms, GIANT_ARMS, DEFAULT_GIANT_LOOK.arms),
    body: pick(o.body, GIANT_BODY, DEFAULT_GIANT_LOOK.body),
    legs: pick(o.legs, GIANT_LEGS, DEFAULT_GIANT_LOOK.legs),
    acc: pick(o.acc, GIANT_ACC, DEFAULT_GIANT_LOOK.acc),
    board: pick(o.board, SIGN_BOARDS, DEFAULT_GIANT_LOOK.board),
  };
}
