// คำสั่งสนับสนุน (ตุ๊กตาหิมะยักษ์) เก็บใน Redis หรือหน่วยความจำ (พัฒนาในเครื่อง)
import { cmd, storeConfigured } from "@/lib/redis";
import type { OrderPreview } from "@/lib/christmas/types";

export type OrderStatus = "awaiting_payment" | "paid" | "cancelled";
// giant = ตุ๊กตาหิมะยักษ์ (Exclusive ประจำห้อง) | support = สนับสนุนทีม DevEveryday
export type OrderKind = "giant" | "support";
export type Order = {
  id: string;
  room: string;
  kind: OrderKind;
  amount: number; // บาท
  name: string;
  message: string;
  mode: "manual" | "gateway";
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  providerRef: string; // เลขอ้างอิงจาก Omise (ถ้ามี)
  qrPayload: string; // ข้อความ PromptPay (โหมด manual)
  qrImage: string; // ลิงก์รูป QR จาก Omise (โหมด gateway)
};

export type Giant = { orderId: string; name: string; message: string; amount: number; paidAt: number };

const mem = { orders: new Map<string, Order>(), giants: new Map<string, Giant>() };
const K = {
  order: (id: string) => `xmas:order:${id}`,
  index: "xmas:orders", // ZSET score = createdAt
  giant: (room: string) => `xmas:${room}:giant`,
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
  if (paid.kind !== "support") {
    const giant: Giant = { orderId: paid.id, name: paid.name, message: paid.message, amount: paid.amount, paidAt: now };
    if (!storeConfigured()) mem.giants.set(paid.room, giant);
    else await cmd("SET", K.giant(paid.room), JSON.stringify(giant));
  }
  return paid;
}

export async function getGiant(room: string): Promise<Giant | null> {
  if (!storeConfigured()) return mem.giants.get(room) ?? null;
  const raw = await cmd<string | null>("GET", K.giant(room));
  return raw ? (JSON.parse(raw) as Giant) : null;
}

// ข้อมูลที่แสดงให้ผู้ใช้เห็น (ไม่มีข้อมูลสำหรับใช้ภายใน)
export function toPreview(o: Order): OrderPreview {
  return { id: o.id, status: o.status, amount: o.amount, mode: o.mode, qrPayload: o.qrPayload, qrImage: o.qrImage };
}
