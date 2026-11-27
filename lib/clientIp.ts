// IP ของผู้เรียก: ใช้ค่าสุดท้ายใน x-forwarded-for ที่พร็อกซีของแพลตฟอร์มต่อท้ายเอง
// ค่าต้นสายเป็นของผู้ส่ง จึงปลอมได้ ห้ามใช้ค่าแรก (เดิมระบบใช้ค่าแรก ทำให้หลบการจำกัดจำนวนได้)
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
