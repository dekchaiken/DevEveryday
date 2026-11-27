import { NextResponse } from "next/server";
import { getOrder } from "@/lib/christmas/orders";
import { confirmPayment } from "@/lib/christmas/payments";
import { SpotLostError } from "@/lib/christmas/orders";
import { writeLog } from "@/lib/christmas/log";

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
  try {
    const paid = await confirmPayment(id, `manual:${new Date().toISOString()}`);
    await writeLog({ type: "paid", room: order.room, actor: "admin", text: `แอดมินยืนยันการโอน ${id.slice(0, 8)} ฿${order.amount}` });
    return NextResponse.json({ ok: true, status: paid?.status });
  } catch (err) {
    if (err instanceof SpotLostError) return NextResponse.json({ error: err.message, code: "spot_lost" }, { status: 409 });
    throw err;
  }
}
