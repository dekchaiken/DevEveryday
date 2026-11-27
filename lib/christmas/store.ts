// เก็บสถานะต้นคริสต์มาสแยกตามห้อง ใช้ Upstash Redis ถ้าตั้งค่าไว้
// ถ้ายังไม่ได้ตั้งค่า จะใช้หน่วยความจำของเซิร์ฟเวอร์ (ใช้ได้เฉพาะตอนพัฒนาในเครื่อง)
import { cmd, storeConfigured } from "@/lib/redis";
import type { ChristmasState, Ornament, ShowEvent } from "@/lib/christmas/types";
import { ROOM_CAPACITY, ROOMS } from "@/lib/christmas/rooms";
import { listGiants } from "@/lib/christmas/orders";

// ตุ๊กตายักษ์ที่ส่งให้หน้าเว็บ: ตัด orderId ออก (เป็นข้อมูลภายในของการชำระเงิน)
async function publicGiants(room: string) {
  return (await listGiants(room)).map(({ orderId: _orderId, ...g }) => g);
}

const MAX_ORNAMENTS = 400;
const SHOW_MEMORY_MS = 10 * 60 * 1000; // เก็บเหตุการณ์ที่จบแล้วไว้สักพักก่อนลบ
const GAP_MS = 1500; // เว้นช่วงระหว่างพลุ/ข้อความ
// เวลานำหน้าก่อนเริ่มเล่น ต้องมากกว่าความล่าช้าของการโพลสถานะ (ประมาณ 3–4 วินาที)
const LEAD_MS = 5000;
const ONLINE_MS = 45 * 1000; // ถือว่าออนไลน์ถ้าส่ง heartbeat ภายในช่วงนี้

export const persistent = () => storeConfigured();

// ---------- หน่วยความจำสำรอง แยกตามห้อง ----------
type MemRoom = {
  ornaments: Ornament[];
  events: ShowEvent[];
  version: number;
  online: Map<string, number>;
};
const mem = new Map<string, MemRoom>();
const hits = new Map<string, number[]>();
function memRoom(room: string): MemRoom {
  let r = mem.get(room);
  if (!r) {
    r = { ornaments: [], events: [], version: 0, online: new Map() };
    mem.set(room, r);
  }
  return r;
}

const K = {
  orn: (r: string) => `xmas:${r}:ornaments`, // LIST ของ JSON ใหม่สุดอยู่หัว
  evt: (r: string) => `xmas:${r}:events`, // ZSET score = endAt
  ver: (r: string) => `xmas:${r}:version`,
  onl: (r: string) => `xmas:${r}:online`, // ZSET score = เวลา heartbeat ล่าสุด
};

// ---------- อ่านสถานะของห้อง ----------
export async function readState(room: string, now: number): Promise<ChristmasState> {
  if (!persistent()) {
    const m = memRoom(room);
    return {
      version: m.version,
      ornaments: m.ornaments.slice(0, 300),
      events: m.events.filter((e) => e.startAt + e.duration > now),
      giants: await publicGiants(room),
      persistent: false,
    };
  }
  const [ver, ornRaw, evtRaw, giants] = await Promise.all([
    cmd<string | null>("GET", K.ver(room)),
    cmd<string[]>("LRANGE", K.orn(room), 0, 299),
    cmd<string[]>("ZRANGEBYSCORE", K.evt(room), now, "+inf"),
    publicGiants(room),
  ]);
  return {
    version: Number(ver ?? 0),
    ornaments: (ornRaw ?? []).map((s) => JSON.parse(s) as Ornament),
    events: (evtRaw ?? []).map((s) => JSON.parse(s) as ShowEvent),
    giants,
    persistent: true,
  };
}

// ---------- เพิ่มลูกบอล ----------
export async function addOrnament(room: string, o: Ornament) {
  if (!persistent()) {
    const m = memRoom(room);
    m.ornaments.unshift(o);
    m.ornaments.length = Math.min(m.ornaments.length, MAX_ORNAMENTS);
    m.version++;
    return;
  }
  await cmd("LPUSH", K.orn(room), JSON.stringify(o));
  await cmd("LTRIM", K.orn(room), 0, MAX_ORNAMENTS - 1);
  await cmd("INCR", K.ver(room));
}

// ---------- จัดคิวเหตุการณ์ของห้อง ----------
// เวลาเริ่มจริงคำนวณที่เซิร์ฟเวอร์ ต่อจากเหตุการณ์สุดท้ายในห้องนั้น
export async function enqueueEvent(room: string, ev: Omit<ShowEvent, "startAt" | "id">, now: number): Promise<ShowEvent> {
  let lastEnd = now;
  if (!persistent()) {
    const m = memRoom(room);
    for (const e of m.events) lastEnd = Math.max(lastEnd, e.startAt + e.duration);
  } else {
    const last = await cmd<string[]>("ZRANGE", K.evt(room), -1, -1, "WITHSCORES");
    if (last && last.length >= 2) lastEnd = Math.max(lastEnd, Number(last[1]));
  }
  const startAt = Math.max(lastEnd + GAP_MS, now + LEAD_MS);
  const full: ShowEvent = { ...ev, id: crypto.randomUUID(), startAt };
  const endAt = startAt + ev.duration;

  if (!persistent()) {
    const m = memRoom(room);
    m.events = m.events.filter((e) => e.startAt + e.duration > now - SHOW_MEMORY_MS);
    m.events.push(full);
    m.version++;
  } else {
    await cmd("ZADD", K.evt(room), endAt, JSON.stringify(full));
    await cmd("ZREMRANGEBYSCORE", K.evt(room), "-inf", now - SHOW_MEMORY_MS);
    await cmd("INCR", K.ver(room));
  }
  return full;
}

// ---------- ออนไลน์ในห้อง (heartbeat) ----------
// คืนค่า full = true ถ้าห้องเต็มและคนนี้ยังไม่ได้อยู่ในห้อง
export async function heartbeat(room: string, clientId: string, now: number): Promise<{ count: number; full: boolean }> {
  if (!persistent()) {
    const m = memRoom(room);
    for (const [id, t] of m.online) if (now - t > ONLINE_MS) m.online.delete(id);
    const known = m.online.has(clientId);
    if (!known && m.online.size >= ROOM_CAPACITY) return { count: m.online.size, full: true };
    m.online.set(clientId, now);
    return { count: m.online.size, full: false };
  }
  await cmd("ZREMRANGEBYSCORE", K.onl(room), "-inf", now - ONLINE_MS);
  const known = await cmd<string | null>("ZSCORE", K.onl(room), clientId);
  const card = await cmd<number>("ZCARD", K.onl(room));
  if (known === null && card >= ROOM_CAPACITY) return { count: card, full: true };
  await cmd("ZADD", K.onl(room), now, clientId);
  return { count: known === null ? card + 1 : card, full: false };
}

// จำนวนคนออนไลน์ของทุกห้อง (ใช้แสดงบนหน้าเลือกห้อง)
export async function roomCounts(now: number): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const r of ROOMS) {
    if (!persistent()) {
      const m = memRoom(r.id);
      for (const [id, t] of m.online) if (now - t > ONLINE_MS) m.online.delete(id);
      out[r.id] = m.online.size;
    } else {
      await cmd("ZREMRANGEBYSCORE", K.onl(r.id), "-inf", now - ONLINE_MS);
      out[r.id] = (await cmd<number>("ZCARD", K.onl(r.id))) ?? 0;
    }
  }
  return out;
}

// ---------- จำกัดความถี่ต่อ IP (นับเป็นนาที) ----------
export async function rateOk(ip: string, action: string, limit: number, now: number): Promise<boolean> {
  const bucket = Math.floor(now / 60000);
  if (!persistent()) {
    const key = `${action}:${ip}`;
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60000);
    if (recent.length >= limit) return false;
    recent.push(now);
    hits.set(key, recent);
    return true;
  }
  const key = `rl:xmas:${action}:${ip}:${bucket}`;
  const n = await cmd<number>("INCR", key);
  if (n === 1) await cmd("EXPIRE", key, 70);
  return n <= limit;
}

// ---------- ผู้ดูแล: อ่านและลบข้อมูลของห้อง ----------
export async function adminOrnaments(room: string): Promise<Ornament[]> {
  if (!persistent()) return [...memRoom(room).ornaments];
  const raw = (await cmd<string[]>("LRANGE", K.orn(room), 0, MAX_ORNAMENTS - 1)) ?? [];
  return raw.map((r) => JSON.parse(r) as Ornament);
}

export async function adminEvents(room: string): Promise<ShowEvent[]> {
  if (!persistent()) return [...memRoom(room).events];
  const raw = (await cmd<string[]>("ZRANGE", K.evt(room), 0, -1)) ?? [];
  return raw.map((r) => JSON.parse(r) as ShowEvent);
}

export async function removeOrnament(room: string, id: string): Promise<boolean> {
  if (!persistent()) {
    const m = memRoom(room);
    const before = m.ornaments.length;
    m.ornaments = m.ornaments.filter((o) => o.id !== id);
    if (m.ornaments.length === before) return false;
    m.version++;
    return true;
  }
  const raw = (await cmd<string[]>("LRANGE", K.orn(room), 0, MAX_ORNAMENTS - 1)) ?? [];
  const keep = raw.filter((r) => (JSON.parse(r) as Ornament).id !== id);
  if (keep.length === raw.length) return false;
  await cmd("DEL", K.orn(room));
  if (keep.length) await cmd("RPUSH", K.orn(room), ...keep);
  await cmd("INCR", K.ver(room));
  return true;
}

export async function removeEvent(room: string, id: string): Promise<boolean> {
  if (!persistent()) {
    const m = memRoom(room);
    const before = m.events.length;
    m.events = m.events.filter((e) => e.id !== id);
    if (m.events.length === before) return false;
    m.version++;
    return true;
  }
  const raw = (await cmd<string[]>("ZRANGE", K.evt(room), 0, -1)) ?? [];
  const hit = raw.find((r) => (JSON.parse(r) as ShowEvent).id === id);
  if (!hit) return false;
  await cmd("ZREM", K.evt(room), hit);
  await cmd("INCR", K.ver(room));
  return true;
}

// ล้างลูกบอลและคิวเหตุการณ์ของห้อง (ตุ๊กตาหิมะจัดการแยกในไฟล์ decor)
export async function clearRoomStore(room: string) {
  if (!persistent()) {
    mem.delete(room);
    return;
  }
  await cmd("DEL", K.orn(room), K.evt(room));
  await cmd("INCR", K.ver(room));
}

