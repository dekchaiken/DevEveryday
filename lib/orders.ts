import { cmd, storeConfigured } from "@/lib/redis";

export const ORDER_STATUSES = ["awaiting_payment", "paid", "shipped", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderLine = { name: string; size: string; qty: number; price: number };

export type Order = {
  id: string;
  createdAt: string;
  customer: { name: string; phone: string; email: string; address: string; note: string };
  lines: OrderLine[];
  subtotal: number;
  coupon: string;
  discount: number;
  total: number;
  status: OrderStatus;
  tracking: string;
  adminNote: string;
  updatedAt: string;
};

const INDEX = "orders:index";

export const ordersConfigured = storeConfigured;

export async function addOrder(order: Order) {
  await cmd("SET", `order:${order.id}`, JSON.stringify(order));
  await cmd("LPUSH", INDEX, order.id);
}

export async function listOrders(limit = 200): Promise<Order[]> {
  const ids = (await cmd<string[]>("LRANGE", INDEX, 0, limit - 1)) ?? [];
  const rows = await Promise.all(ids.map((id) => cmd<string | null>("GET", `order:${id}`)));
  return rows.flatMap((r) => (r ? [JSON.parse(r) as Order] : []));
}

export async function updateOrder(id: string, patch: Partial<Pick<Order, "status" | "tracking" | "adminNote">>) {
  const raw = await cmd<string | null>("GET", `order:${id}`);
  if (!raw) throw new Error("ไม่พบคำสั่งซื้อนี้");
  const next: Order = { ...(JSON.parse(raw) as Order), ...patch, updatedAt: new Date().toISOString() };
  await cmd("SET", `order:${id}`, JSON.stringify(next));
  return next;
}
