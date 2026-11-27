// จำคำสั่งซื้อที่ยังไม่ชำระไว้ในเบราว์เซอร์ของลูกค้า เพื่อให้กลับมาตรวจสถานะได้หลังรีเฟรชหน้า
// เก็บเฉพาะรหัสคำสั่งกับยอดและห้อง ไม่เก็บข้อมูลส่วนตัว และอ่านเขียนครอบ try/catch เผื่อเบราว์เซอร์บล็อก storage
export type PendingOrder = { id: string; room: string; kind: string; amount: number; at: number };

const KEY = "xmas-pending-orders";
const MAX_AGE_MS = 3 * 60 * 60 * 1000; // คำสั่งที่เก่ากว่านี้ไม่ต้องตามต่อ

export function listPending(): PendingOrder[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PendingOrder[]) : [];
    return Array.isArray(list) ? list.filter((o) => o && typeof o.id === "string" && Date.now() - o.at < MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

function save(list: PendingOrder[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-20)));
  } catch {
    /* ไม่ทำให้หน้าพัง */
  }
}

export function rememberPending(o: PendingOrder) {
  save([...listPending().filter((x) => x.id !== o.id), o]);
}

export function forgetPending(id: string) {
  save(listPending().filter((x) => x.id !== id));
}
