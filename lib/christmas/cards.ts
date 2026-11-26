// การ์ดอวยพรที่ผู้ใช้ส่งไปโซนคำอวยพรของแต่ละห้อง เก็บเป็น HASH ต่อห้อง (ช่อง = id)
import { cmd, storeConfigured } from "@/lib/redis";
import { CARDS_PER_PERSON, type CardRecord, type CardSpec } from "@/lib/christmas/cardSpec";
import type { Social } from "@/lib/christmas/social";

// owner คือ clientId ของผู้ส่ง ใช้นับโควตา และจะไม่ถูกส่งออกไปหน้าเว็บ
export type StoredCard = CardSpec & { id: string; room: string; createdAt: number; social?: Social; owner: string };

const K = (room: string) => `xmas:${room}:cards`;
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
  await cmd("HSET", K(c.room), c.id, JSON.stringify(c));
}

// การ์ดทั้งหมดของห้อง ใหม่สุดก่อน (หน้าเว็บขอทีละหน้าด้วย page/size)
export async function listCards(room: string): Promise<StoredCard[]> {
  let items: StoredCard[];
  if (!storeConfigured()) {
    items = [...(mem.get(room)?.values() ?? [])];
  } else {
    const raw = (await cmd<string[]>("HGETALL", K(room))) ?? [];
    items = [];
    for (let i = 0; i < raw.length; i += 2) items.push(JSON.parse(raw[i + 1]) as StoredCard);
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
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
