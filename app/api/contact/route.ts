import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { addLead, leadsConfigured, tooMany, type Lead } from "@/lib/leads";
import { getContent } from "@/lib/content";

export const runtime = "nodejs";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ฟอร์มติดต่อ: ตรวจข้อมูล กันบอท (ช่อง website ต้องว่าง) จำกัดจำนวนครั้ง แล้วเก็บเป็นลีด
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  // ช่อง website ซ่อนไว้ บอทมักกรอก ถ้ามีค่าให้ทำเหมือนสำเร็จแต่ไม่บันทึก
  if (clip(body.website, 200)) return NextResponse.json({ ok: true });

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (tooMany(ip)) return NextResponse.json({ error: "ส่งข้อความบ่อยเกินไป ลองใหม่อีกครั้งภายหลัง" }, { status: 429 });

  const name = clip(body.name, 120);
  const email = clip(body.email, 160);
  const phone = clip(body.phone, 30);
  const type = clip(body.type, 60);
  const brief = clip(body.brief, 2000);
  const types = getContent().contact.types;

  if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อ" }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  if (!types.includes(type)) return NextResponse.json({ error: "กรุณาเลือกประเภทงาน" }, { status: 400 });

  if (!leadsConfigured()) {
    return NextResponse.json({ error: "ระบบรับข้อความยังไม่พร้อม กรุณาติดต่อทางอีเมลโดยตรง" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const lead: Lead = {
    id: `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    createdAt: now,
    name,
    email,
    phone,
    type,
    brief,
    status: "new",
    notes: "",
    updatedAt: now,
  };
  try {
    await addLead(lead);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
