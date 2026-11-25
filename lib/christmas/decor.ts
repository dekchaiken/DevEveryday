// ตุ๊กตาหิมะที่ผู้ใช้ตกแต่งและวางรอบต้นคริสต์มาส (ฟรี) เก็บแยกตามห้อง
import { cmd, storeConfigured } from "@/lib/redis";

export const SLOT_COUNT = 8;
export const HATS = ["top", "beanie", "santa", "crown"] as const;
export const SCARVES = ["red", "green", "gold", "blue"] as const;
export const NOSES = ["carrot", "button", "star"] as const;
export const ARMS = ["sticks", "wings", "none"] as const;
export const BODY_COLORS = ["white", "mint", "sky", "blush"] as const;
export const LEGS = ["snow", "boots", "none"] as const; // ฐาน/ขา

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
  createdAt: number;
  likes: number;
};


const MAX = 200;
const K = {
  list: (r: string) => `xmas:${r}:decos`, // LIST ของ JSON
  likes: (r: string) => `xmas:${r}:likes`, // HASH id -> จำนวนถูกใจ
  voters: (r: string, id: string) => `xmas:${r}:voters:${id}`, // SET ของ clientId
};

const mem = { list: new Map<string, Decor[]>(), likes: new Map<string, Map<string, number>>(), voters: new Map<string, Set<string>>() };

export async function listDecor(room: string): Promise<Decor[]> {
  if (!storeConfigured()) return [...(mem.list.get(room) ?? [])];
  const raws = (await cmd<string[]>("LRANGE", K.list(room), 0, MAX - 1)) ?? [];
  const items = raws.map((s) => JSON.parse(s) as Decor);
  if (items.length === 0) return [];
  const hash = (await cmd<string[]>("HGETALL", K.likes(room))) ?? [];
  const counts = new Map<string, number>();
  for (let i = 0; i < hash.length; i += 2) counts.set(hash[i], Number(hash[i + 1]));
  return items.map((d) => ({ ...d, likes: counts.get(d.id) ?? 0 }));
}

export async function addDecor(d: Decor): Promise<boolean> {
  const existing = await listDecor(d.room);
  if (existing.some((x) => x.slot === d.slot)) return false; // ช่องนี้มีคนวางแล้ว
  if (!storeConfigured()) {
    const arr = mem.list.get(d.room) ?? [];
    arr.unshift(d);
    mem.list.set(d.room, arr.slice(0, MAX));
    return true;
  }
  await cmd("LPUSH", K.list(d.room), JSON.stringify(d));
  await cmd("LTRIM", K.list(d.room), 0, MAX - 1);
  return true;
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
