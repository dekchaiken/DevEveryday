// เรียก Upstash Redis ผ่าน REST API ใช้เก็บลีดและคำสั่งซื้อ
// ต้องตั้งค่า UPSTASH_REDIS_REST_URL และ UPSTASH_REDIS_REST_TOKEN ใน Vercel
export function storeConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูล");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ฐานข้อมูลตอบกลับผิดพลาด (${res.status})`);
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result as T;
}
