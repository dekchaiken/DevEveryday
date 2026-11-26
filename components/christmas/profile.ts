// โปรไฟล์ผู้เยี่ยมชม (ชื่อ + ลิงก์โซเชียล) จำไว้ในเบราว์เซอร์ของแต่ละคน
// ใช้เป็นค่าเริ่มต้นของทุกฟอร์ม (แขวนคำอวยพร ตกแต่งตุ๊กตา สนับสนุน) แก้ไขทับได้เสมอ
import type { Social } from "@/lib/christmas/social";

export type Profile = { name: string; social: Social };

const KEY = "xmas-profile";

export const EMPTY_PROFILE: Profile = { name: "", social: {} };

export function loadProfile(): Profile | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    if (typeof p.name !== "string") return null;
    return { name: p.name.slice(0, 20), social: p.social && typeof p.social === "object" ? p.social : {} };
  } catch {
    return null; // เบราว์เซอร์ปิดการเก็บข้อมูลไว้ ใช้งานได้ตามปกติโดยไม่จำค่า
  }
}

export function saveProfile(p: Profile) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ไม่บันทึกได้ก็ใช้งานต่อได้ในหน้านี้
  }
}
