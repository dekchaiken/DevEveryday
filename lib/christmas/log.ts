// บันทึกกิจกรรมของระบบคริสต์มาส (แอดมินดูและล้างได้จากหน้า admin)
// เก็บล่าสุดไม่เกิน 2,000 รายการ ที่อยู่ IP ถูกตัดให้เหลือเฉพาะส่วนต้นเพื่อความเป็นส่วนตัว
import { cmd, storeConfigured } from "@/lib/redis";

export type LogType = "ornament" | "decor" | "like" | "order" | "paid" | "event" | "config" | "moderation" | "blocked";
export type LogEntry = { id: string; at: number; type: LogType; room: string; actor: string; text: string };

const LIMIT = 2000;
const KEY = "xmas:log";
const mem: LogEntry[] = [];

export function maskIp(ip: string) {
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}:*`;
  const p = ip.split(".");
  return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : "unknown";
}

// บันทึกไม่ควรทำให้การทำรายการหลักล้มเหลว จึงจับข้อผิดพลาดไว้ภายใน
export async function writeLog(e: Omit<LogEntry, "id" | "at">) {
  try {
    const entry: LogEntry = { ...e, id: crypto.randomUUID(), at: Date.now(), text: e.text.slice(0, 200) };
    if (!storeConfigured()) {
      mem.unshift(entry);
      if (mem.length > LIMIT) mem.length = LIMIT;
      return;
    }
    await cmd("LPUSH", KEY, JSON.stringify(entry));
    await cmd("LTRIM", KEY, 0, LIMIT - 1);
  } catch {
    /* ปล่อยผ่าน */
  }
}

export async function listLogs(limit = 300, type?: string, room?: string): Promise<LogEntry[]> {
  let all: LogEntry[] = mem;
  if (storeConfigured()) {
    const raw = (await cmd<string[]>("LRANGE", KEY, 0, LIMIT - 1)) ?? [];
    all = raw.map((s) => JSON.parse(s) as LogEntry);
  }
  return all
    .filter((e) => (!type || type === "all" || e.type === type) && (!room || room === "all" || e.room === room))
    .slice(0, limit);
}

export async function clearLogs() {
  if (!storeConfigured()) {
    mem.length = 0;
    return;
  }
  await cmd("DEL", KEY);
}
