// ตุ๊กตาหิมะที่ผู้ใช้ตกแต่งและวางบนช่องรอบต้นคริสต์มาส (ฟรี) เก็บแยกตามห้อง
import { cmd, storeConfigured } from "@/lib/redis";
import { isReservedSlot, SLOT_COUNT } from "@/lib/christmas/slots";
import type { Social } from "@/lib/christmas/social";
import { parseSnowParts, type SnowParts } from "@/lib/christmas/snowman";

export { SLOT_COUNT };
// ชิ้นส่วนทั้งหมดกำหนดไว้ที่ snowman.ts (ใช้ร่วมกับหน้าตกแต่งและโมเดล 3 มิติ)
// ชิ้นส่วนที่ผู้ซื้อ Exclusive เลือก (ใช้ตอนสร้างคำสั่งซื้อ)
export type DecorPick = { slot: number } & SnowParts;

// ชิ้นส่วนรุ่นแรกต้องมีเสมอ ชิ้นที่เพิ่มทีหลังไม่บังคับ (ข้อมูลเก่าไม่มี จะใช้ค่าเริ่มต้นตอนแสดงผล)
export type Decor = {
  id: string;
  room: string;
  slot: number; // 0..SLOT_COUNT-1
  name: string;
  createdAt: number;
  likes: number;
  social?: Social; // ลิงก์โซเชียลของผู้วาง (ไม่บังคับ)
} & Pick<SnowParts, "hat" | "scarf" | "nose" | "arms" | "body" | "legs" | "acc"> &
  Partial<SnowParts>;

const K = {
  hash: (r: string) => `xmas:${r}:deco2`, // HASH: ช่อง -> JSON ของตุ๊กตา
  likes: (r: string) => `xmas:${r}:likes`, // HASH: id -> จำนวนถูกใจ
  voters: (r: string, id: string) => `xmas:${r}:voters:${id}`, // SET ของ clientId
  free: (r: string) => `xmas:${r}:decofree`, // HASH: clientId -> id ของตุ๊กตาฟรีที่วางแล้ว (ได้คนละ 1 ตัวต่อห้อง)
};

const mem = {
  slots: new Map<string, Map<number, Decor>>(),
  likes: new Map<string, Map<string, number>>(),
  voters: new Map<string, Set<string>>(),
  free: new Map<string, Map<string, string>>(),
};

function memRoom(room: string) {
  let m = mem.slots.get(room);
  if (!m) {
    m = new Map();
    mem.slots.set(room, m);
  }
  return m;
}

// รายการตุ๊กตาทั้งหมดของห้อง พร้อมจำนวนถูกใจ
export async function listDecor(room: string): Promise<Decor[]> {
  let items: Decor[];
  let counts: Map<string, number>;
  if (!storeConfigured()) {
    items = [...memRoom(room).values()];
    counts = mem.likes.get(room) ?? new Map();
  } else {
    const raw = (await cmd<string[]>("HGETALL", K.hash(room))) ?? [];
    items = [];
    for (let i = 0; i < raw.length; i += 2) items.push(JSON.parse(raw[i + 1]) as Decor);
    const hash = (await cmd<string[]>("HGETALL", K.likes(room))) ?? [];
    counts = new Map();
    for (let i = 0; i < hash.length; i += 2) counts.set(hash[i], Number(hash[i + 1]));
  }
  return items.map((d) => ({ ...d, likes: counts.get(d.id) ?? 0 }));
}

// ตรวจชิ้นส่วนที่ส่งมาจากหน้าเว็บ คืน null ถ้าไม่ถูกต้อง
export function parseDecorPick(v: unknown): DecorPick | null {
  if (!v || typeof v !== "object") return null;
  const slot = Number((v as Record<string, unknown>).slot);
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) return null;
  const parts = parseSnowParts(v);
  return parts ? { slot, ...parts } : null;
}

// วางตุ๊กตา Exclusive หลังชำระเงินแล้ว: ใช้ช่องที่เลือกได้ (รวมช่องสงวน) ถ้าช่องถูกแย่งไปแล้วจะสุ่มช่องว่างแทน
// id ใช้เลขคำสั่งซื้อ เพื่อให้เรียกซ้ำไม่วางซ้ำ
export async function placePaidDecor(room: string, id: string, name: string, social: Social, pick: DecorPick): Promise<{ decor: Decor; moved: boolean } | null> {
  const taken = new Set((await listDecor(room)).map((d) => d.slot));
  const { slot: _wanted, ...parts } = pick;
  void _wanted;
  const build = (slot: number): Decor => ({
    ...parts,
    id,
    room,
    slot,
    name,
    createdAt: Date.now(),
    likes: 0,
    social,
  });
  if (!taken.has(pick.slot) && (await claimDecor(build(pick.slot)))) return { decor: build(pick.slot), moved: false };
  taken.add(pick.slot);
  for (let t = 0; t < 300; t++) {
    const i = Math.floor(Math.random() * SLOT_COUNT);
    if (taken.has(i) || isReservedSlot(i)) continue;
    taken.add(i);
    if (await claimDecor(build(i))) return { decor: build(i), moved: true };
  }
  return null;
}

// จองช่องแบบอะตอมิก: ถ้ามีคนวางแล้วจะคืนค่า false ไม่ทับของเดิม
export async function claimDecor(d: Decor): Promise<boolean> {
  if (!storeConfigured()) {
    const m = memRoom(d.room);
    if (m.has(d.slot)) return false;
    m.set(d.slot, d);
    return true;
  }
  const ok = await cmd<number>("HSETNX", K.hash(d.room), String(d.slot), JSON.stringify(d));
  return ok === 1;
}

// กดถูกใจได้หนึ่งครั้งต่อคนต่อชิ้น คืนค่าจำนวนล่าสุด
export async function like(room: string, id: string, clientId: string): Promise<number> {
  if (!storeConfigured()) {
    const key = `${room}:${id}`;
    const voters = mem.voters.get(key) ?? new Set<string>();
    if (!voters.has(clientId)) {
      voters.add(clientId);
      mem.voters.set(key, voters);
      const likes = mem.likes.get(room) ?? new Map<string, number>();
      likes.set(id, (likes.get(id) ?? 0) + 1);
      mem.likes.set(room, likes);
    }
    return mem.likes.get(room)?.get(id) ?? 0;
  }
  const added = await cmd<number>("SADD", K.voters(room, id), clientId);
  if (added === 1) await cmd("HINCRBY", K.likes(room), id, 1);
  return Number((await cmd<string | null>("HGET", K.likes(room), id)) ?? 0);
}

// จองสิทธิ์วางตุ๊กตาฟรีของคนนี้ในห้องนี้ (ได้ 1 ตัวต่อคนต่อห้อง) คืน false ถ้าเคยวางแล้ว
export async function claimFreeDecor(room: string, clientId: string, decorId: string): Promise<boolean> {
  if (!storeConfigured()) {
    const m = mem.free.get(room) ?? new Map<string, string>();
    mem.free.set(room, m);
    if (m.has(clientId)) return false;
    m.set(clientId, decorId);
    return true;
  }
  return (await cmd<number>("HSETNX", K.free(room), clientId, decorId)) === 1;
}

// คืนสิทธิ์ตุ๊กตาฟรี (ใช้เมื่อวางไม่สำเร็จเพราะช่องถูกแย่งไปก่อน)
export async function releaseFreeDecor(room: string, clientId: string) {
  if (!storeConfigured()) {
    mem.free.get(room)?.delete(clientId);
    return;
  }
  await cmd("HDEL", K.free(room), clientId);
}

// ลบตุ๊กตาหนึ่งตัวออกจากช่อง (ผู้ดูแล)
export async function removeDecor(room: string, slot: number): Promise<boolean> {
  if (!storeConfigured()) return memRoom(room).delete(slot);
  const n = await cmd<number>("HDEL", K.hash(room), String(slot));
  return n === 1;
}

// ล้างตุ๊กตาและจำนวนถูกใจทั้งห้อง (ผู้ดูแล)
export async function clearDecor(room: string) {
  if (!storeConfigured()) {
    mem.slots.delete(room);
    mem.likes.delete(room);
    mem.free.delete(room);
    return;
  }
  await cmd("DEL", K.hash(room), K.likes(room), K.free(room));
}

