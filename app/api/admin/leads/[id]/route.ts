import { NextResponse } from "next/server";
import { LEAD_STATUSES, updateLead, type LeadStatus } from "@/lib/leads";

export const runtime = "nodejs";

// อัปเดตสถานะและบันทึกการติดต่อของลีด
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { status?: unknown; notes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const patch: { status?: LeadStatus; notes?: string } = {};
  if (body.status !== undefined) {
    if (!LEAD_STATUSES.includes(body.status as LeadStatus)) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    patch.status = body.status as LeadStatus;
  }
  if (body.notes !== undefined) patch.notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : "";
  try {
    return NextResponse.json({ ok: true, lead: await updateLead(id, patch) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
