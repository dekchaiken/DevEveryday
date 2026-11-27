// กล่องจดหมายของลูกค้า: จำคำสั่งซื้อไว้ในเบราว์เซอร์ เพื่อให้กลับมาดูสถานะ ชำระต่อ หรือดูผลหลังรีเฟรช
// เก็บเฉพาะรหัสคำสั่ง ห้อง ประเภท ยอด และชื่อที่ลูกค้าใส่เอง ข้อมูลการชำระและตกแต่งอยู่บนเซิร์ฟเวอร์
// อ่านเขียนครอบ try/catch เผื่อเบราว์เซอร์บล็อก storage
export type PendingOrder = { id: string; room: string; kind: string; amount: number; name?: string; at: number; notified?: boolean };

const KEY = "xmas-pending-orders";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // เก็บไว้ 24 ชั่วโมง แล้วซ่อนจากกล่องจดหมายเอง

function readAll(): PendingOrder[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PendingOrder[]) : [];
    return Array.isArray(list) ? list.filter((o) => o && typeof o.id === "string") : [];
  } catch {
    return [];
  }
}

function save(list: PendingOrder[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-30)));
  } catch {
    /* ไม่ทำให้หน้าพัง */
  }
}

export function listPending(): PendingOrder[] {
  return readAll().filter((o) => Date.now() - o.at < MAX_AGE_MS);
}

export function rememberPending(o: PendingOrder) {
  save([...readAll().filter((x) => x.id !== o.id), o]);
}

export function forgetPending(id: string) {
  save(readAll().filter((x) => x.id !== id));
}

export function markNotified(id: string) {
  save(readAll().map((x) => (x.id === id ? { ...x, notified: true } : x)));
}
