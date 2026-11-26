// การ์ดอวยพรที่ผู้ใช้ส่งไปโซนคำอวยพรของแต่ละห้อง เก็บเป็น HASH ต่อห้อง (ช่อง = id)
import { cmd, storeConfigured, txn } from "@/lib/redis";
import { CARDS_PER_PERSON, type CardRecord, type CardSpec } from "@/lib/christmas/cardSpec";
import type { Social } from "@/lib/christmas/social";

// owner คือ clientId ของผู้ส่ง ใช้นับโควตา และจะไม่ถูกส่งออกไปหน้าเว็บ
export type StoredCard = CardSpec & { id: string; room: string; createdAt: number; social?: Social; owner: string };

const K = (room: string) => `xmas:${room}:cards`; // HASH id -> การ์ด (ใช้เปิดทีละใบ)
const IDX = (room: string) => `xmas:${room}:cards:time`; // ZSET id ตามเวลาที่ส่ง (ใช้แบ่งหน้า)
const mem = new Map<string, Map<string, StoredCard>>();

export async function addCard(c: StoredCard) {
  if (!storeConfigured()) {
    let m = mem.get(c.room);
    if (!m) {
      m = new Map();
      mem.set(c.room, m);
    }
    m.set(c.id, c);
    return;
  }
  await txn([
    ["HSET", K(c.room), c.id, JSON.stringify(c)],
    ["ZADD", IDX(c.room), c.createdAt, c.id],
  ]);
}

// ดัชนีเก่าก่อนมี ZSET: สร้างจาก HASH ครั้งเดียวต่อโปรเซส (ปกติมีแค่ตอนอัปเกรด)
const indexed = new Set<string>();
async function ensureIndex(room: string) {
  if (indexed.has(room)) return;
  const n = Number((await cmd<number>("ZCARD", IDX(room))) ?? 0);
  if (n === 0) {
    const raw = (await cmd<string[]>("HGETALL", K(room))) ?? [];
    const pairs: (string | number)[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const c = JSON.parse(raw[i + 1]) as StoredCard;
      pairs.push(c.createdAt, c.id);
    }
    for (let i = 0; i < pairs.length; i += 500) {
      await cmd("ZADD", IDX(room), ...pairs.slice(i, i + 500));
    }
  }
  indexed.add(room);
}

// หนึ่งหน้าของการ์ดในห้อง เรียงใหม่สุดก่อน พร้อมจำนวนทั้งหมด (ไม่ต้องดึงทุกใบ)
export async function pageCards(room: string, page: number, size: number): Promise<{ items: StoredCard[]; total: number }> {
  if (!storeConfigured()) {
    const all = [...(mem.get(room)?.values() ?? [])].sort((a, b) => b.createdAt - a.createdAt);
    return { items: all.slice((page - 1) * size, page * size), total: all.length };
  }
  await ensureIndex(room);
  const total = Number((await cmd<number>("ZCARD", IDX(room))) ?? 0);
  const start = (page - 1) * size;
  const ids = (await cmd<string[]>("ZREVRANGE", IDX(room), start, start + size - 1)) ?? [];
  if (ids.length === 0) return { items: [], total };
  const raw = (await cmd<(string | null)[]>("HMGET", K(room), ...ids)) ?? [];
  const items = raw.filter((r): r is string => Boolean(r)).map((r) => JSON.parse(r) as StoredCard);
  return { items, total };
}

export async function findCard(room: string, id: string): Promise<StoredCard | null> {
  if (!storeConfigured()) return mem.get(room)?.get(id) ?? null;
  const raw = await cmd<string | null>("HGET", K(room), id);
  return raw ? (JSON.parse(raw) as StoredCard) : null;
}

// ตัดข้อมูลภายในออก (owner) ก่อนส่งให้หน้าเว็บ
export function toPublic(c: StoredCard, likes: number): CardRecord {
  const { owner: _owner, ...rest } = c;
  void _owner;
  return { ...rest, likes };
}

export function cardsLeft(cards: StoredCard[], clientId: string): number {
  const used = cards.filter((c) => c.owner === clientId).length;
  return Math.max(0, CARDS_PER_PERSON - used);
}

// โควตาต่อคนต่อห้องนับแบบอะตอมิกด้วย INCR (กันการส่งพร้อมกันเกินโควตา)
const memQuota = new Map<string, number>();
const quotaKey = (room: string, clientId: string) => `xmas:${room}:quota:${clientId}`;

export async function reserveCardSlot(room: string, clientId: string): Promise<boolean> {
  if (!storeConfigured()) {
    const n = (memQuota.get(quotaKey(room, clientId)) ?? 0) + 1;
    if (n > CARDS_PER_PERSON) return false;
    memQuota.set(quotaKey(room, clientId), n);
    return true;
  }
  const n = await cmd<number>("INCR", quotaKey(room, clientId));
  if (n > CARDS_PER_PERSON) {
    await cmd("DECR", quotaKey(room, clientId));
    return false;
  }
  return true;
}

export async function releaseCardSlot(room: string, clientId: string) {
  if (!storeConfigured()) {
    memQuota.set(quotaKey(room, clientId), Math.max(0, (memQuota.get(quotaKey(room, clientId)) ?? 0) - 1));
    return;
  }
  await cmd("DECR", quotaKey(room, clientId));
}

export async function usedCardSlots(room: string, clientId: string): Promise<number> {
  if (!storeConfigured()) return memQuota.get(quotaKey(room, clientId)) ?? 0;
  return Number((await cmd<string | null>("GET", quotaKey(room, clientId))) ?? 0);
}
