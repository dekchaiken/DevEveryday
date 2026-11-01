// ฟังก์ชันเทศกาลแบบไม่พึ่งข้อมูลร้าน เพื่อใช้ได้ทั้งหน้าแรกและฝั่งเบราว์เซอร์
export function mdOf(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// อยู่ในช่วงเทศกาลหรือไม่ รองรับช่วงที่ข้ามปี เช่น 12-25 ถึง 01-05
export function inSeason(s: { start: string; end: string }, md: string) {
  if (!s.start || !s.end) return false;
  return s.start <= s.end ? md >= s.start && md <= s.end : md >= s.start || md <= s.end;
}
