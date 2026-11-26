import { NextResponse } from "next/server";
import { getRoom } from "@/lib/christmas/rooms";
import { listOrders } from "@/lib/christmas/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ข้อมูลสาธารณะสำหรับแถบ Exclusive และผู้สนับสนุนทีม
// มีเฉพาะชื่อ ยอด และข้อความที่ผู้สนับสนุนกรอก ไม่มีข้อมูลการชำระเงินหรือติดต่อ
export async function GET(req: Request) {
  const room = getRoom(new URL(req.url).searchParams.get("room"));
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 400 });

  const paid = (await listOrders(200)).filter((o) => o.status === "paid");
  const pick = (o: (typeof paid)[number]) => ({ id: o.id, name: o.name, message: o.message, amount: o.amount, paidAt: o.paidAt, social: o.social ?? {} });
  const exclusive = paid.filter((o) => o.room === room.id && o.kind !== "support").slice(0, 30).map(pick);
  const supporters = paid.filter((o) => o.kind === "support").slice(0, 30).map(pick);

  return NextResponse.json(
    { exclusive, supporters },
    { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } },
  );
}
