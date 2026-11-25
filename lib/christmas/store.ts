// เก็บสถานะต้นคริสต์มาสร่วมกัน ใช้ Upstash Redis ถ้าตั้งค่าไว้
// ถ้ายังไม่ได้ตั้งค่า จะใช้หน่วยความจำของเซิร์ฟเวอร์ (ใช้ได้เฉพาะตอนพัฒนาในเครื่อง)
import { cmd, storeConfigured } from "@/lib/redis";
import type { ChristmasState, Ornament, ShowEvent } from "@/lib/christmas/types";

const K_ORN = "xmas:ornaments"; // LIST ของ JSON, ใหม่สุดอยู่หัว
const K_EVT = "xmas:events"; // ZSET score = endAt
const K_VER = "xmas:version";
const MAX_ORNAMENTS = 400;
const SHOW_MEMORY_MS = 10 * 60 * 1000; // เก็บเหตุการณ์ที่จบแล้วไว้สักพักก่อนลบ
const GAP_MS = 1500; // เว้นช่วงระหว่างพลุ/ข้อความ
// เวลานำหน้าก่อนเริ่มเล่น ต้องมากกว่าความล่าช้าของการโพลสถานะ (ประมาณ 3–4 วินาที)
// เพื่อให้ทุกหน้าจอได้รับคิวทันก่อนถึงเวลาเล่น
const LEAD_MS = 5000;

// ---------- หน่วยความจำสำรองสำหรับการพัฒนาในเครื่อง ----------
const mem = {
  ornaments: [] as Ornament[],
  events: [] as ShowEvent[],
  version: 0,
  hits: new Map<string, number[]>(),
};

export const persistent = () => storeConfigured();

// ---------- อ่านสถานะ ----------
export async function readState(now: number): Promise<ChristmasState> {
  if (!persistent()) {
    const events = mem.events.filter((e) => e.startAt + e.duration > now);
    return {
      version: mem.version,
      ornaments: mem.ornaments.slice(0, 300),
      events,
      persistent: false,
    };
  }
  const [ver, ornRaw, evtRaw] = await Promise.all([
    cmd<string | null>("GET", K_VER),
    cmd<string[]>("LRANGE", K_ORN, 0, 299),
    cmd<string[]>("ZRANGEBYSCORE", K_EVT, now, "+inf"),
  ]);
  return {
    version: Number(ver ?? 0),
    ornaments: (ornRaw ?? []).map((s) => JSON.parse(s) as Ornament),
    events: (evtRaw ?? []).map((s) => JSON.parse(s) as ShowEvent),
    persistent: true,
  };
}

// ---------- เพิ่มลูกบอล ----------
export async function addOrnament(o: Ornament) {
  if (!persistent()) {
    mem.ornaments.unshift(o);
    mem.ornaments.length = Math.min(mem.ornaments.length, MAX_ORNAMENTS);
    mem.version++;
    return;
  }
  await cmd("LPUSH", K_ORN, JSON.stringify(o));
  await cmd("LTRIM", K_ORN, 0, MAX_ORNAMENTS - 1);
  await cmd("INCR", K_VER);
}

// ---------- จัดคิวเหตุการณ์ ----------
// เวลาเริ่มจริงคำนวณที่เซิร์ฟเวอร์ ต่อจากเหตุการณ์สุดท้ายที่อยู่ในคิว
// ทำให้ทุกคนเห็นพลุหรือข้อความเรียงกันตามลำดับเดียวกัน
export async function enqueueEvent(ev: Omit<ShowEvent, "startAt" | "id">, now: number): Promise<ShowEvent> {
  let lastEnd = now;
  if (!persistent()) {
    for (const e of mem.events) lastEnd = Math.max(lastEnd, e.startAt + e.duration);
  } else {
    const last = await cmd<string[]>("ZRANGE", K_EVT, -1, -1, "WITHSCORES");
    if (last && last.length >= 2) lastEnd = Math.max(lastEnd, Number(last[1]));
  }
  const startAt = Math.max(lastEnd + GAP_MS, now + LEAD_MS);
  const full: ShowEvent = { ...ev, id: crypto.randomUUID(), startAt };
  const endAt = startAt + ev.duration;

  if (!persistent()) {
    mem.events = mem.events.filter((e) => e.startAt + e.duration > now - SHOW_MEMORY_MS);
    mem.events.push(full);
    mem.version++;
  } else {
    await cmd("ZADD", K_EVT, endAt, JSON.stringify(full));
    await cmd("ZREMRANGEBYSCORE", K_EVT, "-inf", now - SHOW_MEMORY_MS);
    await cmd("INCR", K_VER);
  }
  return full;
}

// ---------- จำกัดความถี่ต่อ IP (นับเป็นนาที) ----------
export async function rateOk(ip: string, action: string, limit: number, now: number): Promise<boolean> {
  const bucket = Math.floor(now / 60000);
  if (!persistent()) {
    const key = `${action}:${ip}`;
    const recent = (mem.hits.get(key) ?? []).filter((t) => now - t < 60000);
    if (recent.length >= limit) return false;
    recent.push(now);
    mem.hits.set(key, recent);
    return true;
  }
  const key = `rl:xmas:${action}:${ip}:${bucket}`;
  const n = await cmd<number>("INCR", key);
  if (n === 1) await cmd("EXPIRE", key, 70);
  return n <= limit;
}
