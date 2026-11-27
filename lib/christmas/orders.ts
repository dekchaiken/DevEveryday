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
  spot: number; // จุดตั้ง Exclusive (เฉพาะ giant) จองไว้ตอนสร้างออเดอร์ 0–N ส่วนออเดอร์อื่นเป็น 0
  social?: Social; // ลิงก์โซเชียลของผู้สนับสนุน
  decor?: DecorPick; // ชิ้นส่วนตุ๊กตา (เฉพาะ decor)
  look?: GiantLook; // ลุคตุ๊กตายักษ์ (เฉพาะ giant)
  mode: "manual" | "gateway" | "paynoi";
  payAmountSatang?: number; // ยอดที่ต้องโอนเป็นสตางค์ (paynoi) เช่น 10024 = 100.24 บาท
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  providerRef: string; // เลขอ้างอิงจาก Omise (ถ้ามี)
  qrPayload: string; // ข้อความ PromptPay (โหมด manual)
  qrImage: string; // ลิงก์รูป QR จาก Omise (โหมด gateway)
};

export type Giant = { orderId: string; name: string; message: string; amount: number; paidAt: number; spot: number; social?: Social; look?: GiantLook };

const mem = {
  orders: new Map<string, Order>(),
  giants: new Map<string, Map<number, Giant>>(),
  holds: new Map<string, Map<number, { orderId: string; exp: number }>>(),
};
// จองจุดไว้ตั้งแต่สร้างออเดอร์ ถ้าไม่จ่ายภายในเวลานี้จุดจะว่างให้คนอื่น
export const HOLD_MS = 60 * 60 * 1000;
const K = {
  order: (id: string) => `xmas:order:${id}`,
  index: "xmas:orders", // ZSET score = createdAt
  giants: (room: string) => `xmas:${room}:giants`, // HASH: ตำแหน่ง -> ตุ๊กตายักษ์ (ทุกตัวที่ซื้อ)
  hold: (room: string, spot: number) => `xmas:${room}:hold:${spot}`, // STRING: รหัสออเดอร์ที่จองจุดนี้ (หมดอายุเอง)
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
  if (paid.kind === "giant") {
    // จุดที่จองไว้ตอนสร้างออเดอร์ต้องยังเป็นของคำสั่งนี้ ถ้าหมดอายุแล้วมีคนอื่นได้ไปจะไม่จัดจุดให้เอง
    // ให้โยน error เพื่อให้แอดมินคุยกับผู้ซื้อ (ไม่มีกรณีจ่ายแล้วแต่ไม่ได้จุด)
    const base = { orderId: paid.id, name: paid.name, message: paid.message, amount: paid.amount, paidAt: now, social: paid.social, look: paid.look };
    const ok = paid.spot >= 0 && paid.spot < GIANT_CAPACITY && (await claimGiantSpot(paid.room, paid.spot, { ...base, spot: paid.spot }));
    if (!ok) throw new SpotLostError(paid.spot);
  }
  await saveOrder(paid);
  return paid;
}

export class SpotLostError extends Error {
  constructor(spot: number) {
    super(`จุดที่จองไว้ (จุด ${spot + 1}) หมดอายุแล้วและมีคนอื่นได้ไปแล้ว ต้องติดต่อผู้ซื้อเพื่อเลือกจุดใหม่`);
  }
}

// จองจุดให้คำสั่งนี้ (SET NX พร้อมวันหมดอายุ) คืน false ถ้ามีคำสั่งอื่นจองอยู่หรือมีคนซื้อไปแล้ว
async function holdSpot(room: string, spot: number, orderId: string): Promise<boolean> {
  if (!storeConfigured()) {
    if (mem.giants.get(room)?.has(spot)) return false;
    const m = mem.holds.get(room) ?? new Map<number, { orderId: string; exp: number }>();
    const cur = m.get(spot);
    const now = Date.now();
    if (cur && cur.exp > now && cur.orderId !== orderId) return false;
    m.set(spot, { orderId, exp: now + HOLD_MS });
    mem.holds.set(room, m);
    return true;
  }
  if (await cmd<string | null>("HGET", K.giants(room), String(spot))) return false;
  return (await cmd<string | null>("SET", K.hold(room, spot), orderId, "NX", "PX", HOLD_MS)) === "OK";
}

// คืนจุดเมื่อสร้างออเดอร์ไม่สำเร็จ (เช่น สร้าง QR ไม่ได้) เพื่อให้คนอื่นจองได้
export async function releaseGiantSpot(room: string, spot: number, orderId: string): Promise<void> {
  if (!storeConfigured()) {
    const m = mem.holds.get(room);
    if (m?.get(spot)?.orderId === orderId) m.delete(spot);
    return;
  }
  if ((await cmd<string | null>("GET", K.hold(room, spot))) === orderId) await cmd("DEL", K.hold(room, spot));
}

// จองจุดให้ออเดอร์ใหม่: ถ้าผู้ซื้อระบุจุดมาให้จองจุดนั้น ถ้าไม่ระบุให้หาจุดว่างถัดไป
export async function reserveGiantSpot(room: string, orderId: string, wanted: number | null): Promise<{ spot: number } | { error: "taken" | "full" }> {
  const taken = new Set((await listGiants(room)).map((g) => g.spot));
  if (wanted !== null) {
    if (taken.has(wanted)) return { error: "taken" };
    return (await holdSpot(room, wanted, orderId)) ? { spot: wanted } : { error: "taken" };
  }
  if (taken.size >= GIANT_CAPACITY) return { error: "full" };
  for (let s = 0; s < GIANT_CAPACITY; s++) {
    if (taken.has(s)) continue;
    if (await holdSpot(room, s, orderId)) return { spot: s };
  }
  return { error: "full" };
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

// ถอดตุ๊กตายักษ์ออกจากจุด (แอดมินใช้ตอนลบเนื้อหาไม่เหมาะสม) คืน false ถ้าไม่มีอยู่
export async function removeGiant(room: string, spot: number): Promise<boolean> {
  if (!storeConfigured()) {
    const m = mem.giants.get(room);
    return Boolean(m?.delete(spot));
  }
  return (await cmd<number>("HDEL", K.giants(room), String(spot))) === 1;
}

// ข้อมูลที่แสดงให้ผู้ใช้เห็น (ไม่มีข้อมูลสำหรับใช้ภายใน)
export function toPreview(o: Order): OrderPreview {
  const payAmount = o.payAmountSatang !== undefined ? (o.payAmountSatang / 100).toFixed(2) : undefined;
  return { id: o.id, status: o.status, amount: o.amount, payAmount, mode: o.mode, qrPayload: o.qrPayload, qrImage: o.qrImage };
}
