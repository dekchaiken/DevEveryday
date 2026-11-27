// คำสั่งสนับสนุน (ตุ๊กตาหิมะยักษ์) เก็บใน Redis หรือหน่วยความจำ (พัฒนาในเครื่อง)
import { cmd, storeConfigured } from "@/lib/redis";
import type { MessageTheme, OrderPreview } from "@/lib/christmas/types";
import type { Social } from "@/lib/christmas/social";
import type { DecorPick } from "@/lib/christmas/decor";
import type { GiantLook } from "@/lib/christmas/giant";
import { GIANT_CAPACITY } from "@/lib/christmas/slots";

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
  spot: number; // จุดตั้ง Exclusive (เฉพาะ giant): -1 = ระบบจัดให้ตอนชำระเงิน, 0–N = จุดที่ผู้ซื้อเลือก
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
    // จองตำแหน่งว่างถัดไปให้ตุ๊กตาตัวนี้ (ไม่แทนที่ตัวที่ซื้อไว้แล้ว)
    const base = { orderId: paid.id, name: paid.name, message: paid.message, amount: paid.amount, paidAt: now, social: paid.social, look: paid.look };
    // ถ้าผู้ซื้อเลือกจุดไว้และจุดนั้นยังว่างตอนจ่าย ให้ใช้จุดนั้น
    if (paid.spot >= 0 && paid.spot < GIANT_CAPACITY && (await claimGiantSpot(paid.room, paid.spot, { ...base, spot: paid.spot }))) return paid;
    // ไม่งั้นจัดจุดว่างถัดไปให้ (กรณีจุดที่เลือกไว้ถูกจองไปก่อนแล้ว)
    const start = (await listGiants(paid.room)).length;
    for (let k = 0; k < GIANT_CAPACITY; k++) {
      const spot = (start + k) % GIANT_CAPACITY;
      if (await claimGiantSpot(paid.room, spot, { ...base, spot })) break;
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

// จองตำแหน่งนั้นให้ตุ๊กตาตัวนี้ คืน false ถ้ามีตัวอื่นอยู่แล้ว (ไม่ทับของเดิม)
async function claimGiantSpot(room: string, spot: number, g: Giant): Promise<boolean> {
  if (!storeConfigured()) {
    const m = mem.giants.get(room) ?? new Map<number, Giant>();
    if (m.has(spot)) return false;
    m.set(spot, g);
    mem.giants.set(room, m);
    return true;
  }
  return (await cmd<number>("HSETNX", K.giants(room), String(spot), JSON.stringify(g))) === 1;
}

// ข้อมูลที่แสดงให้ผู้ใช้เห็น (ไม่มีข้อมูลสำหรับใช้ภายใน)
export function toPreview(o: Order): OrderPreview {
  return { id: o.id, status: o.status, amount: o.amount, mode: o.mode, qrPayload: o.qrPayload, qrImage: o.qrImage };
}
