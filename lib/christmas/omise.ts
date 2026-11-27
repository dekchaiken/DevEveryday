// เชื่อมต่อ Omise (PromptPay) แบบอัตโนมัติ
// ข้อมูลบัตรไม่ผ่านระบบของเรา ลูกค้าจ่ายผ่านคิวอาร์ของ Omise
// ต้องตั้งค่า OMISE_SECRET_KEY (คีย์ลับ ห้ามใส่ในฝั่งเบราว์เซอร์)

const API = "https://api.omise.co";

function auth() {
  const key = process.env.OMISE_SECRET_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า OMISE_SECRET_KEY");
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

export type OmiseCharge = {
  id: string;
  amount?: number; // สตางค์
  currency?: string;
  status: string; // pending | successful | failed | expired
  metadata?: { orderId?: string };
  source?: { scannable_code?: { image?: { download_uri?: string } } };
};

export async function createPromptPayCharge(amountBaht: number, orderId: string): Promise<OmiseCharge> {
  const res = await fetch(`${API}/charges`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(amountBaht * 100), // Omise ใช้หน่วยสตางค์
      currency: "thb",
      source: { type: "promptpay" },
      metadata: { orderId },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Omise ตอบกลับผิดพลาด (${res.status})`);
  return (await res.json()) as OmiseCharge;
}

export async function retrieveCharge(id: string): Promise<OmiseCharge> {
  const res = await fetch(`${API}/charges/${encodeURIComponent(id)}`, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Omise ตอบกลับผิดพลาด (${res.status})`);
  return (await res.json()) as OmiseCharge;
}
