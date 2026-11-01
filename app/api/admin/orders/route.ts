import { NextResponse } from "next/server";
import { listOrders, ordersConfigured } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET() {
  if (!ordersConfigured()) return NextResponse.json({ configured: false, orders: [] });
  try {
    return NextResponse.json({ configured: true, orders: await listOrders() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
