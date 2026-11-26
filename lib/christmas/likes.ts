// ถูกใจคำอวยพร (ลูกบอล) และนับจำนวนถูกใจของทั้งห้อง กดได้หนึ่งครั้งต่อคนต่อชิ้น
import { cmd, storeConfigured } from "@/lib/redis";

const mem = {
  counts: new Map<string, Map<string, number>>(), // ห้อง -> (id -> จำนวน)
  voters: new Map<string, Set<string>>(), // ห้อง:id -> clientId
};
const K = {
  counts: (room: string) => `xmas:${room}:olikes`, // HASH id -> จำนวน
  voters: (room: string, id: string) => `xmas:${room}:ovoters:${id}`, // SET ของ clientId
};

// กดถูกใจ คืนจำนวนล่าสุด และ added=true เมื่อเพิ่งกดครั้งแรก
export async function likeOrnament(room: string, id: string, clientId: string): Promise<{ count: number; added: boolean }> {
  if (!storeConfigured()) {
    const key = `${room}:${id}`;
    const voters = mem.voters.get(key) ?? new Set<string>();
    let added = false;
    if (!voters.has(clientId)) {
      voters.add(clientId);
      mem.voters.set(key, voters);
      const counts = mem.counts.get(room) ?? new Map<string, number>();
      counts.set(id, (counts.get(id) ?? 0) + 1);
      mem.counts.set(room, counts);
      added = true;
    }
    return { count: mem.counts.get(room)?.get(id) ?? 0, added };
  }
  const n = await cmd<number>("SADD", K.voters(room, id), clientId);
  if (n === 1) await cmd("HINCRBY", K.counts(room), id, 1);
  const count = Number((await cmd<string | null>("HGET", K.counts(room), id)) ?? 0);
  return { count, added: n === 1 };
}

// จำนวนถูกใจของลูกบอลทุกชิ้นในห้อง (เฉพาะที่มากกว่า 0)
export async function ornamentLikeCounts(room: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!storeConfigured()) {
    for (const [id, n] of mem.counts.get(room) ?? []) if (n > 0) out[id] = n;
    return out;
  }
  const raw = (await cmd<string[]>("HGETALL", K.counts(room))) ?? [];
  for (let i = 0; i < raw.length; i += 2) {
    const n = Number(raw[i + 1]);
    if (n > 0) out[raw[i]] = n;
  }
  return out;
}
