import { NextResponse } from "next/server";
import { getOrder } from "@/lib/christmas/orders";
import { confirmPayment } from "@/lib/christmas/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// แอดมินยืนยันการโอนเงินด้วยตนเอง (ใช้กับโหมด manual เท่านั้น)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "confirm") return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "ไม่พบคำสั่งนี้" }, { status: 404 });
  if (order.mode !== "manual") return NextResponse.json({ error: "คำสั่งนี้ยืนยันอัตโนมัติผ่าน Omise" }, { status: 400 });
  if (order.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });
  const paid = await confirmPayment(id, `manual:${new Date().toISOString()}`);
  return NextResponse.json({ ok: true, status: paid?.status });
}
