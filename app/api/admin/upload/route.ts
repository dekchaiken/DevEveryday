import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { uploadImage } from "@/lib/github";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (รูปที่ตัดพื้นหลังแล้วเป็น PNG จึงใหญ่กว่า)

// ตรวจชนิดไฟล์จากลายเซ็นในไบต์แรก ไม่เชื่อแค่ชื่อไฟล์หรือ content-type ที่ส่งมา
function detect(bytes: Buffer): "png" | "jpg" | "webp" | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export async function POST(req: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "ไม่พบไฟล์ที่อัปโหลด" }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์ที่อัปโหลด" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 4 MB" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = detect(bytes);
  if (!ext) return NextResponse.json({ error: "รองรับเฉพาะ PNG, JPG และ WebP" }, { status: 400 });

  const name = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.${ext}`;
  try {
    await uploadImage(name, bytes);
    return NextResponse.json({ path: `/uploads/${name}` });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
