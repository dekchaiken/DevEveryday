import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ทดสอบว่าคีย์ Omise ที่ตั้งไว้ใช้งานได้จริงหรือไม่ โดยไม่ส่งค่าคีย์กลับไปยังเบราว์เซอร์
export async function GET() {
  const key = process.env.OMISE_SECRET_KEY;
  if (!key) return NextResponse.json({ configured: false, ok: false, note: "ยังไม่ได้ตั้งค่า OMISE_SECRET_KEY ใน Environment Variables" });
  try {
    const res = await fetch("https://api.omise.co/account", {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
      cache: "no-store",
    });
    return NextResponse.json({
      configured: true,
      ok: res.ok,
      status: res.status,
      note: res.ok ? "เชื่อมต่อ Omise สำเร็จ" : res.status === 401 ? "คีย์ไม่ถูกต้อง หรือเป็นคีย์คนละโหมด" : `เชื่อมต่อไม่สำเร็จ (HTTP ${res.status})`,
    });
  } catch {
    return NextResponse.json({ configured: true, ok: false, note: "เชื่อมต่อ Omise ไม่ได้ ลองใหม่ภายหลัง" });
  }
}
