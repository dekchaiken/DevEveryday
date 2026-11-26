// การ์ดอวยพรที่ผู้ใช้ส่งไปโซนคำอวยพรของแต่ละห้อง เก็บเป็น HASH ต่อห้อง (ช่อง = id)
import { cmd, storeConfigured } from "@/lib/redis";
import type { CardSpec } from "@/lib/christmas/cardSpec";
import type { Social } from "@/lib/christmas/social";

export type StoredCard = CardSpec & { id: string; room: string; createdAt: number; social?: Social };

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

// การ์ดของห้อง ใหม่สุดก่อน จำกัด 300 ใบเพื่อไม่ให้ข้อมูลตอบกลับใหญ่เกินไป
export async function listCards(room: string): Promise<StoredCard[]> {
  let items: StoredCard[];
  if (!storeConfigured()) {
    items = [...(mem.get(room)?.values() ?? [])];
  } else {
    const raw = (await cmd<string[]>("HGETALL", K(room))) ?? [];
    items = [];
    for (let i = 0; i < raw.length; i += 2) items.push(JSON.parse(raw[i + 1]) as StoredCard);
  }
  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 300);
}
