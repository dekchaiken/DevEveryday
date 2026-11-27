import { NextResponse } from "next/server";
import { listOrders } from "@/lib/christmas/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = ["id", "createdAt", "room", "kind", "amount", "name", "message", "mode", "status", "paidAt", "providerRef", "spot"] as const;

// กันการเปิดไฟล์ CSV ใน Excel แล้วข้อความถูกตีความเป็นสูตร (ขึ้นต้นด้วย = + - @ หรือ tab)
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// ส่งออกรายการสั่งซื้อทั้งหมดเป็น CSV (ไม่รวมอีเมลหรือเบอร์ของผู้ซื้อ)
export async function GET() {
  const orders = await listOrders(2000);
  const rows = orders.map((o) =>
    [
      o.id,
      new Date(o.createdAt).toISOString(),
      o.room,
      o.kind,
      o.amount,
      o.name,
      o.message,
      o.mode,
      o.status,
      o.paidAt ? new Date(o.paidAt).toISOString() : "",
      o.providerRef,
      o.kind === "giant" ? o.spot + 1 : "",
    ]
      .map(cell)
      .join(","),
  );
  // BOM ทำให้ Excel อ่านภาษาไทยถูกต้อง
  const body = "\uFEFF" + [COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
