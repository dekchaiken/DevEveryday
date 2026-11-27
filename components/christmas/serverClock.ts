// นาฬิกาของเซิร์ฟเวอร์ที่ใช้ร่วมกันทั้งห้อง: ปรับผลต่างจากนาฬิกาเครื่องผู้ใช้ทุกครั้งที่ซิงก์
let offsetMs = 0;
let started = false;

export function serverNowMs(): number {
  return Date.now() + offsetMs;
}

async function syncOnce() {
  try {
    const t0 = Date.now();
    const res = await fetch("/api/christmas/time", { cache: "no-store" });
    const t1 = Date.now();
    const data = (await res.json()) as { now?: number };
    if (typeof data.now === "number") offsetMs = data.now - (t0 + t1) / 2;
  } catch {
    /* ซิงก์ไม่ได้ก็ใช้นาฬิกาเครื่องไปก่อน */
  }
}

// เริ่มซิงก์ครั้งเดียวต่อหน้า และซิงก์ซ้ำทุก 30 วินาทีเพื่อกันนาฬิกาเลื่อน
export function startServerClock() {
  if (started || typeof window === "undefined") return;
  started = true;
  void syncOnce();
  window.setInterval(() => void syncOnce(), 30000);
}
