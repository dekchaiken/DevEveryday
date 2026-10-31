import { NextResponse } from "next/server";
import { saveJsonFile } from "@/lib/github";
import { validateShop } from "@/lib/shop-validate";

export const runtime = "nodejs";

// บันทึกข้อมูลร้านลง content/shop.json แล้ว Vercel จะ deploy ใหม่ให้อัตโนมัติ
export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = validateShop(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    await saveJsonFile("content/shop.json", result.value, "content: update shop from admin");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
