// เชื่อมต่อ paynoi: สร้าง PromptPay QR ที่มียอดมีสตางค์เฉพาะรายการ และถามสถานะการโอนเข้าบัญชีธนาคาร
// paynoi อ่านการแจ้งเตือนจาก SMS/LINE ของธนาคารที่ลงทะเบียนไว้ เงินเข้าบัญชีของเจ้าของโดยตรง
// เอกสารไม่ได้ระบุวิธีตรวจลายเซ็นของ webhook จึงไม่เชื่อ webhook ตรง ๆ แต่ถามสถานะกลับจาก API ด้วย API key ของเราเสมอ
const DEFAULT_API = "https://paynoi.com/ppay_api";
const KBANK_KEY_ID = "100568"; // รหัสธนาคาร กสิกรไทย ตามเอกสาร paynoi

export function paynoiConfigured(): boolean {
  return Boolean(process.env.PAYNOI_API_KEY && process.env.PAYNOI_ACCOUNT);
}

function settings() {
  const apiKey = process.env.PAYNOI_API_KEY;
  const account = process.env.PAYNOI_ACCOUNT; // เลขพร้อมเพย์: เบอร์มือถือ หรือเลขบัตรประชาชน
  if (!apiKey || !account) throw new Error("ยังไม่ได้ตั้งค่า PAYNOI_API_KEY หรือ PAYNOI_ACCOUNT");
  return {
    url: process.env.PAYNOI_API_URL || DEFAULT_API,
    apiKey,
    account,
    keyId: process.env.PAYNOI_KEY_ID || KBANK_KEY_ID,
    type: process.env.PAYNOI_ACCOUNT_TYPE === "2" ? "2" : "1", // 1 = เบอร์มือถือ, 2 = เลขบัตรประชาชน
  };
}

// ทุกข้อผิดพลาดของ paynoi ตอบ HTTP 200 พร้อม status 0 จึงต้องดูที่ status ในเนื้อความ
async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const s = settings();
  const res = await fetch(s.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: s.apiKey, ...body }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (data.status !== 1) throw new Error(`paynoi: ${String(data.msg ?? "ไม่ทราบสาเหตุ")}`);
  return data;
}

export type PaynoiCreated = { transId: string; qrImage: string; amountSatang: number; expireAt: string };

// สร้างรายการรับเงิน ยอดเป็นจำนวนเต็มบาท paynoi จะเพิ่มสตางค์สุ่ม 00–99 ให้เป็นยอดเฉพาะรายการ
export async function createPaynoiTransaction(amountBaht: number, ref1: string): Promise<PaynoiCreated> {
  const s = settings();
  const d = await call({ method: "create", amount: amountBaht, ref1, key_id: s.keyId, account: s.account, type: s.type });
  return {
    transId: String(d.trans_id),
    qrImage: String(d.qr_image_base64 ?? ""),
    amountSatang: Number(d.amount_check),
    expireAt: String(d.expire_at ?? ""),
  };
}

export type PaynoiCheck = { transId: string; ref1: string; amountSatang: number; paymentStatus: string };

// ถามสถานะรายการจาก paynoi โดยตรง ใช้ยืนยันก่อนตัดสินว่าจ่ายแล้ว
export async function checkPaynoiTransaction(transId: string): Promise<PaynoiCheck> {
  const d = await call({ method: "check", trans_id: transId });
  return {
    transId: String(d.trans_id ?? transId),
    ref1: String(d.ref1 ?? ""),
    amountSatang: Number(d.amount_check),
    paymentStatus: String(d.payment_status ?? ""),
  };
}

// รายการนี้จ่ายครบแล้วหรือยัง: สถานะ completed ตรงรหัสออเดอร์และยอดเป็นสตางค์เดียวกัน
export function paynoiMatches(check: PaynoiCheck, orderId: string, expectedSatang: number | undefined): boolean {
  return check.paymentStatus === "completed" && check.ref1 === orderId && expectedSatang !== undefined && check.amountSatang === expectedSatang;
}
