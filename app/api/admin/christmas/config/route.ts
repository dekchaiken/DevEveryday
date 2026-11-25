import { NextResponse } from "next/server";
import { getConfig, setConfig, validateConfig } from "@/lib/christmas/config";
import { writeLog } from "@/lib/christmas/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// อ่านและบันทึกการตั้งค่าระบบคริสต์มาส (ต้องล็อกอินแอดมิน ตรวจโดย middleware)
export async function GET() {
  return NextResponse.json({ config: await getConfig() });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = validateConfig(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await setConfig(parsed.value);
  await writeLog({ type: "config", room: "all", actor: "admin", text: `บันทึกการตั้งค่า: ${parsed.value.payMode}, ${parsed.value.enabled ? "เปิดรับ" : "ปิดรับ"}, คำต้องห้าม ${parsed.value.blockedWords.length} คำ` });
  return NextResponse.json({ ok: true, config: parsed.value });
}
