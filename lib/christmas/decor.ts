// ตุ๊กตาหิมะที่ผู้ใช้ตกแต่งและวางบนช่องรอบต้นคริสต์มาส (ฟรี) เก็บแยกตามห้อง
import { cmd, storeConfigured } from "@/lib/redis";
import { SLOT_COUNT } from "@/lib/christmas/slots";
import type { Social } from "@/lib/christmas/social";

export { SLOT_COUNT };
export const HATS = ["top", "beanie", "santa", "crown", "pom", "holly"] as const;
export const SCARVES = ["red", "green", "gold", "blue", "white", "plaid"] as const;
export const NOSES = ["carrot", "button", "star", "bell"] as const;
export const ARMS = ["sticks", "wings", "gift", "none"] as const;
export const BODY_COLORS = ["white", "mint", "sky", "blush"] as const;
export const LEGS = ["snow", "boots", "gift", "none"] as const; // ฐาน/ขา
export const ACCESSORIES = ["none", "glasses", "bow", "bell"] as const;

export type Decor = {
  id: string;
  room: string;
  slot: number; // 0..SLOT_COUNT-1
  name: string;
  hat: string;
  scarf: string;
  nose: string;
  arms: string;
  body: string;
  legs: string;
  acc: string;
  createdAt: number;
  likes: number;
  social?: Social; // ลิงก์โซเชียลของผู้วาง (ไม่บังคับ)
};

const K = {
  hash: (r: string) => `xmas:${r}:deco2`, // HASH: ช่อง -> JSON ของตุ๊กตา
  likes: (r: string) => `xmas:${r}:likes`, // HASH: id -> จำนวนถูกใจ
  voters: (r: string, id: string) => `xmas:${r}:voters:${id}`, // SET ของ clientId
};

const mem = {
  slots: new Map<string, Map<number, Decor>>(),
  likes: new Map<string, Map<string, number>>(),
  voters: new Map<string, Set<string>>(),
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
    return;
  }
  await cmd("DEL", K.hash(room), K.likes(room));
}

