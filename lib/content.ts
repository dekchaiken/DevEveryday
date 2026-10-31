import site from "@/content/site.json";
import type { Content } from "@/lib/types";

// ข้อมูลทั้งหมดของเว็บอยู่ใน content/site.json
// หน้า admin จะบันทึกกลับไปที่ไฟล์นี้ใน GitHub แล้ว Vercel จะ deploy ให้อัตโนมัติ
export function getContent(): Content {
  return site as Content;
}
