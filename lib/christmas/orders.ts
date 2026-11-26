// คำสั่งสนับสนุน (ตุ๊กตาหิมะยักษ์) เก็บใน Redis หรือหน่วยความจำ (พัฒนาในเครื่อง)
import { cmd, storeConfigured } from "@/lib/redis";
import type { MessageTheme, OrderPreview } from "@/lib/christmas/types";
import type { Social } from "@/lib/christmas/social";
import type { DecorPick } from "@/lib/christmas/decor";
import type { GiantLook } from "@/lib/christmas/giant";
import { GIANT_SPOT_DEFS } from "@/lib/christmas/slots";

export type OrderStatus = "awaiting_payment" | "paid" | "cancelled";
// giant = ตุ๊กตาหิมะยักษ์ (Exclusive ประจำห้อง) | support = สนับสนุนทีม DevEveryday
// decor = ตุ๊กตาหิมะ Exclusive ที่วางได้ไม่จำกัด (จ่ายต่อตัว)
// message = ข้อความอวยพรขึ้นจอ (ไม่มีป้าย) · decor = ตุ๊กตาหิมะ Exclusive จ่ายต่อตัว
export type OrderKind = "giant" | "support" | "decor" | "message";
export type Order = {
  id: string;
  room: string;
  kind: OrderKind;
  amount: number; // บาท
  name: string;
  message: string;
  theme: MessageTheme; // ธีมการแสดงบนท้องฟ้า (เฉพาะ giant)
  spot: number; // ตำแหน่งป้ายประจำห้อง 0–3 (เฉพาะ giant)
  social?: Social; // ลิงก์โซเชียลของผู้สนับสนุน
  decor?: DecorPick; // ชิ้นส่วนตุ๊กตา (เฉพาะ decor)
  look?: GiantLook; // ลุคตุ๊กตายักษ์ (เฉพาะ giant)
  mode: "manual" | "gateway";
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  providerRef: string; // เลขอ้างอิงจาก Omise (ถ้ามี)
  qrPayload: string; // ข้อความ PromptPay (โหมด manual)
  qrImage: string; // ลิงก์รูป QR จาก Omise (โหมด gateway)
};

export type Giant = { orderId: string; name: string; message: string; amount: number; paidAt: number; spot: number; social?: Social; look?: GiantLook };

const mem = { orders: new Map<string, Order>(), giants: new Map<string, Map<number, Giant>>() };
const K = {
  order: (id: string) => `xmas:order:${id}`,
  index: "xmas:orders", // ZSET score = createdAt
  giants: (room: string) => `xmas:${room}:giants`, // HASH: ตำแหน่ง -> ตุ๊กตายักษ์ (ทุกตัวที่ซื้อ)
};

export async function saveOrder(o: Order) {
  if (!storeConfigured()) {
    mem.orders.set(o.id, o);
    return;
  }
  await cmd("SET", K.order(o.id), JSON.stringify(o));
  await cmd("ZADD", K.index, o.createdAt, o.id);
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!storeConfigured()) return mem.orders.get(id) ?? null;
  const raw = await cmd<string | null>("GET", K.order(id));
  return raw ? (JSON.parse(raw) as Order) : null;
}

export async function listOrders(limit = 100): Promise<Order[]> {
  if (!storeConfigured()) {
    return [...mem.orders.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
  const ids = (await cmd<string[]>("ZREVRANGE", K.index, 0, limit - 1)) ?? [];
  if (ids.length === 0) return [];
  const raws = (await cmd<(string | null)[]>("MGET", ...ids.map((id) => K.order(id)))) ?? [];
  return raws.filter((r): r is string => Boolean(r)).map((r) => JSON.parse(r) as Order);
}

// ทำเครื่องหมายว่าจ่ายแล้ว (idempotent: ถ้าจ่ายแล้วจะไม่ทำซ้ำ)
export async function markPaid(id: string, providerRef: string, now: number): Promise<Order | null> {
  const o = await getOrder(id);
  if (!o || o.status === "paid") return o;
  const paid: Order = { ...o, status: "paid", paidAt: now, providerRef: providerRef || o.providerRef };
  await saveOrder(paid);
  if (paid.kind === "giant") {
    // ถ้าตำแหน่งที่เลือกถูกจองไปก่อน ให้ย้ายไปจุดว่างแรกที่เหลือ
    const taken = new Set((await listGiants(paid.room)).map((g) => g.spot));
    let spot = paid.spot ?? 0;
    if (taken.has(spot)) spot = GIANT_SPOT_DEFS.findIndex((_, i) => !taken.has(i));
    if (spot >= 0) {
      const giant: Giant = { orderId: paid.id, name: paid.name, message: paid.message, amount: paid.amount, paidAt: now, spot, social: paid.social, look: paid.look };
      await saveGiant(paid.room, giant);
    }
  }
  return paid;
}

// ตุ๊กตายักษ์ทั้งหมดของห้อง (เรียงตามเวลาที่ซื้อ)
export async function listGiants(room: string): Promise<Giant[]> {
  if (!storeConfigured()) {
    return [...(mem.giants.get(room)?.values() ?? [])].sort((a, b) => a.paidAt - b.paidAt);
  }
  const raw = (await cmd<string[]>("HGETALL", K.giants(room))) ?? [];
  const out: Giant[] = [];
  for (let i = 0; i < raw.length; i += 2) out.push(JSON.parse(raw[i + 1]) as Giant);
  return out.sort((a, b) => a.paidAt - b.paidAt);
}

async function saveGiant(room: string, g: Giant) {
  if (!storeConfigured()) {
    const m = mem.giants.get(room) ?? new Map<number, Giant>();
    m.set(g.spot, g);
    mem.giants.set(room, m);
    return;
  }
  await cmd("HSET", K.giants(room), String(g.spot), JSON.stringify(g));
}

// ข้อมูลที่แสดงให้ผู้ใช้เห็น (ไม่มีข้อมูลสำหรับใช้ภายใน)
export function toPreview(o: Order): OrderPreview {
  return { id: o.id, status: o.status, amount: o.amount, mode: o.mode, qrPayload: o.qrPayload, qrImage: o.qrImage };
}
