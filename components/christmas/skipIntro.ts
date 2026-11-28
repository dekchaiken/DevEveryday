// การเปลี่ยนห้องหรือเลือกจังหวัดภายในเว็บไม่ต้องเล่นกล่องของขวัญซ้ำ
// ตั้งธงก่อนลิงก์พาไปหน้าถัดไป กล่องจะข้ามเมื่อโหลดหน้านั้น แล้วล้างธงทิ้ง
// การรีเฟรชหรือเปิดลิงก์ใหม่จะไม่มีธง จึงยังเล่นกล่องตามปกติ
const KEY = "xmas-skip-intro";

export function markInternalNav() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* ไม่เป็นไร */
  }
}

export function consumeSkipIntro(): boolean {
  try {
    const on = sessionStorage.getItem(KEY) === "1";
    sessionStorage.removeItem(KEY);
    return on;
  } catch {
    return false;
  }
}

// ป้ายของการเดินทาง: หน้าถัดไปเล่นเมฆแหวกออกพร้อมชื่อจุดหมาย
const JOURNEY = "xmas-journey";
export type Journey = { from?: string; to?: string };
export function markJourney(j: Journey) {
  try {
    sessionStorage.setItem(JOURNEY, JSON.stringify(j));
  } catch {
    /* ไม่เป็นไร */
  }
}
export function consumeJourney(): Journey | null {
  try {
    const v = sessionStorage.getItem(JOURNEY);
    sessionStorage.removeItem(JOURNEY);
    return v ? (JSON.parse(v) as Journey) : null;
  } catch {
    return null;
  }
}
