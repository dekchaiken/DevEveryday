import { NextResponse } from "next/server";
import { ORDER_STATUSES, updateOrder, type OrderStatus } from "@/lib/orders";

export const runtime = "nodejs";

// อัปเดตสถานะ เลขพัสดุ และบันทึกของแอดมิน
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { status?: unknown; tracking?: unknown; adminNote?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const patch: { status?: OrderStatus; tracking?: string; adminNote?: string } = {};
  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status as OrderStatus)) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    patch.status = body.status as OrderStatus;
  }
  if (body.tracking !== undefined) patch.tracking = typeof body.tracking === "string" ? body.tracking.slice(0, 80) : "";
  if (body.adminNote !== undefined) patch.adminNote = typeof body.adminNote === "string" ? body.adminNote.slice(0, 1000) : "";
  try {
    return NextResponse.json({ ok: true, order: await updateOrder(id, patch) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
