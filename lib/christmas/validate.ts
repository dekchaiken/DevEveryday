import { EVENT_KINDS, ORNAMENT_COLORS, ORNAMENT_SHAPES, type EventKind, type OrnamentColor, type OrnamentShape } from "@/lib/christmas/types";

// กรองคำหยาบเบื้องต้น (รายการสั้น ๆ สำหรับเริ่มต้น ควรขยายตามการใช้งานจริง)
// ไม่ครอบคลุมทุกกรณี ต้องมีปุ่มรายงานและหน้า admin สำหรับซ่อนรายการด้วย
const BLOCKED = ["fuck", "shit", "bitch", "เย็ด", "หี", "ควย", "สัส", "เหี้ย", "อีดอก", "ระยำ"];

export function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function hasBlocked(s: string): boolean {
  const lower = s.toLowerCase();
  return BLOCKED.some((w) => lower.includes(w));
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function parseOrnament(body: Record<string, unknown>) {
  const name = clean(body.name, 20);
  const wish = clean(body.wish, 140);
  const color = pick<OrnamentColor>(body.color, ORNAMENT_COLORS, "gold");
  const shape = pick<OrnamentShape>(body.shape, ORNAMENT_SHAPES, "ball");
  const height = Number(body.height);
  const angle = Number(body.angle);
  if (!name) return { error: "กรุณาใส่ชื่อเล่น" } as const;
  if (hasBlocked(name) || hasBlocked(wish)) return { error: "ข้อความมีคำที่ไม่เหมาะสม" } as const;
  if (!Number.isFinite(height) || height < 0.12 || height > 0.96) return { error: "ตำแหน่งบนต้นไม่ถูกต้อง" } as const;
  if (!Number.isFinite(angle)) return { error: "ตำแหน่งบนต้นไม่ถูกต้อง" } as const;
  return {
    value: {
      name,
      wish,
      color,
      shape,
      height: Math.round(height * 1000) / 1000,
      angle: Math.round(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 1000) / 1000,
    },
  } as const;
}

export function parseEvent(body: Record<string, unknown>) {
  const kind = pick<EventKind>(body.kind, EVENT_KINDS, "firework");
  const text = clean(body.text, 80);
  const by = clean(body.by, 20) || "ทีมงาน";
  const color = pick<OrnamentColor>(body.color, ORNAMENT_COLORS, "gold");
  if (hasBlocked(text) || hasBlocked(by)) return { error: "ข้อความมีคำที่ไม่เหมาะสม" } as const;
  if (kind === "message" && !text) return { error: "กรุณาใส่ข้อความ" } as const;
  const duration = kind === "firework" ? 3200 : Math.min(Math.max(Number(body.duration) || 6000, 3000), 12000);
  return { value: { kind, text, by, color, duration } } as const;
}
