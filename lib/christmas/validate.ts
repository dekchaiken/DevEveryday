import { parseSkyStyle, SKY_SHOW_MS } from "@/lib/christmas/skyStyle";
import { sanitizeSocial } from "@/lib/christmas/social";
import { EVENT_KINDS, MESSAGE_THEMES, ORNAMENT_COLORS, ORNAMENT_SHAPES, type EventKind, type MessageTheme, type OrnamentColor, type OrnamentShape } from "@/lib/christmas/types";

// กรองคำหยาบเบื้องต้น (รายการสั้น ๆ สำหรับเริ่มต้น ควรขยายตามการใช้งานจริง)
// ไม่ครอบคลุมทุกกรณี ต้องมีปุ่มรายงานและหน้า admin สำหรับซ่อนรายการด้วย
const BLOCKED = ["fuck", "shit", "bitch", "เย็ด", "หี", "ควย", "สัส", "เหี้ย", "อีดอก", "ระยำ"];

export function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

// รายการพื้นฐาน + คำที่แอดมินเพิ่มในหน้า admin (เก็บในการตั้งค่า)
export const DEFAULT_BLOCKED = BLOCKED;

export function hasBlocked(s: string, extra: readonly string[] = []): boolean {
  const lower = s.toLowerCase();
  return BLOCKED.some((w) => lower.includes(w)) || extra.some((w) => w && lower.includes(w.toLowerCase()));
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function parseOrnament(body: Record<string, unknown>, extra: readonly string[] = []) {
  const name = clean(body.name, 20);
  const wish = clean(body.wish, 140);
  const color = pick<OrnamentColor>(body.color, ORNAMENT_COLORS, "gold");
  const shape = pick<OrnamentShape>(body.shape, ORNAMENT_SHAPES, "ball");
  const height = Number(body.height);
  const angle = Number(body.angle);
  if (!name) return { error: "กรุณาใส่ชื่อเล่น" } as const;
  if (hasBlocked(name, extra) || hasBlocked(wish, extra)) return { error: "ข้อความมีคำที่ไม่เหมาะสม" } as const;
  // ช่วงเดียวกับที่หน้าเว็บให้แตะได้ (geometry.ts: pointToHeightAngle) เผื่อขอบไว้เล็กน้อย
  if (!Number.isFinite(height) || height < 0.06 || height > 0.96) return { error: "ตำแหน่งบนต้นไม่ถูกต้อง" } as const;
  if (!Number.isFinite(angle)) return { error: "ตำแหน่งบนต้นไม่ถูกต้อง" } as const;
  const social = sanitizeSocial(body.social, (s) => hasBlocked(s, extra));
  return {
    value: {
      name,
      wish,
      social,
      color,
      shape,
      height: Math.round(height * 1000) / 1000,
      angle: Math.round(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 1000) / 1000,
    },
  } as const;
}

export function parseEvent(body: Record<string, unknown>, extra: readonly string[] = []) {
  const kind = pick<EventKind>(body.kind, EVENT_KINDS, "firework");
  const text = clean(body.text, 80);
  const by = clean(body.by, 20) || "ทีมงาน";
  const color = pick<OrnamentColor>(body.color, ORNAMENT_COLORS, "gold");
  const theme = pick<MessageTheme>(body.theme, MESSAGE_THEMES, "fireworks");
  if (hasBlocked(text, extra) || hasBlocked(by, extra)) return { error: "ข้อความมีคำที่ไม่เหมาะสม" } as const;
  if (kind === "message" && !text) return { error: "กรุณาใส่ข้อความ" } as const;
  const duration = kind === "firework" ? 3200 : Math.min(Math.max(Number(body.duration) || SKY_SHOW_MS, 3000), 15000);
  const style = parseSkyStyle(body.style, theme);
  return { value: { kind, text, by, color, theme, duration, ...(kind === "message" ? { style } : {}) } } as const;
}
