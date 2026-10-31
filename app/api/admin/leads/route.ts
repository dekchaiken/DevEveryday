import { NextResponse } from "next/server";
import { leadsConfigured, listLeads } from "@/lib/leads";

export const runtime = "nodejs";

export async function GET() {
  if (!leadsConfigured()) return NextResponse.json({ configured: false, leads: [] });
  try {
    return NextResponse.json({ configured: true, leads: await listLeads() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
