// เรียก Upstash Redis ผ่าน REST API ใช้เก็บลีดและคำสั่งซื้อ
// อ่านค่าจาก UPSTASH_REDIS_REST_URL / _TOKEN ก่อน ถ้าไม่มีจะใช้ชื่อที่ Vercel Upstash integration สร้างให้
// (UPSTASH_REDIS_KV_REST_API_URL / _TOKEN) ซึ่งเป็นค่าของฐานข้อมูลเดียวกัน
function redisEnv() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_KV_REST_API_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_KV_REST_API_TOKEN || "",
  };
}

export function storeConfigured() {
  const { url, token } = redisEnv();
  return Boolean(url && token);
}

export async function cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
  const { url, token } = redisEnv();
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

// หลายคำสั่งในธุรกรรมเดียว (MULTI/EXEC) ให้บันทึกการ์ดกับดัชนีพร้อมกันหรือไม่เลย
export async function txn(commands: (string | number)[][]): Promise<void> {
  const { url, token } = redisEnv();
  if (!url || !token) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูล");
  const res = await fetch(`${url}/multi-exec`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ฐานข้อมูลตอบกลับผิดพลาด (${res.status})`);
  const json = (await res.json()) as { error?: string }[] | { error?: string };
  const items = Array.isArray(json) ? json : [json];
  const failed = items.find((r) => r && r.error);
  if (failed?.error) throw new Error(failed.error);
}
