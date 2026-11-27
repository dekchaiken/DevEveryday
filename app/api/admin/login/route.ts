import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, safeEqual } from "@/lib/session";
import { clientIp } from "@/lib/clientIp";
import { rateOk } from "@/lib/christmas/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured" }, { status: 500 });
  }
  // จำกัดการลองรหัสผ่าน: ไม่เกิน 10 ครั้งต่อนาทีต่อ IP
  if (!(await rateOk(clientIp(req), "admin-login", 10, Date.now()))) {
    return NextResponse.json({ error: "ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (!safeEqual(password, expected)) {
    // หน่วงเวลาเล็กน้อยเพื่อลดการเดารหัส
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
