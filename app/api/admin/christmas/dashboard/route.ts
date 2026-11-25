import { NextResponse } from "next/server";
import { getConfig } from "@/lib/christmas/config";
import { ROOMS, ROOM_CAPACITY } from "@/lib/christmas/rooms";
import { listOrders } from "@/lib/christmas/orders";
import { persistent, readState, roomCounts } from "@/lib/christmas/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ข้อมูลภาพรวมระบบคริสต์มาสสำหรับหน้า admin
export async function GET() {
  const now = Date.now();
  const [config, counts, orders] = await Promise.all([getConfig(), roomCounts(now), listOrders(100)]);
  const rooms = await Promise.all(
    ROOMS.map(async (r) => {
      const st = await readState(r.id, now);
      return {
        id: r.id,
        name: r.name,
        online: counts[r.id] ?? 0,
        capacity: ROOM_CAPACITY,
        ornaments: st.ornaments.length,
        giant: st.giant,
      };
    }),
  );
  const paid = orders.filter((o) => o.status === "paid");
  const awaiting = orders.filter((o) => o.status === "awaiting_payment");
  const env = {
    storage: persistent(),
    omise: Boolean(process.env.OMISE_SECRET_KEY),
    promptpay: Boolean(process.env.XMAS_PROMPTPAY_ID),
  };
  return NextResponse.json({
    config,
    env,
    totals: {
      online: rooms.reduce((s, r) => s + r.online, 0),
      ornaments: rooms.reduce((s, r) => s + r.ornaments, 0),
      revenue: paid.reduce((s, o) => s + o.amount, 0),
      paidCount: paid.length,
      awaitingCount: awaiting.length,
    },
    rooms,
    orders: orders.map((o) => ({
      id: o.id,
      room: o.room,
      amount: o.amount,
      name: o.name,
      message: o.message,
      mode: o.mode,
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      providerRef: o.providerRef,
    })),
  });
}
