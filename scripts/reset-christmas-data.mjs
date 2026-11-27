// ล้างข้อมูลทั้งหมดของระบบคริสต์มาส (การ์ด ตุ๊กตา Exclusive ออเดอร์ ล็อก และการตั้งค่า) บน Upstash
// ทุกคีย์ของระบบขึ้นต้นด้วย "xmas:" จึงลบเฉพาะส่วนนี้ ไม่กระทบข้อมูลอื่นของแอป
//
// วิธีใช้:
//   ดูจำนวนก่อน (ไม่ลบอะไร):  UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/reset-christmas-data.mjs
//   ลบจริง:                   ... node scripts/reset-christmas-data.mjs --confirm
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
if (!url || !token) {
  console.error("ไม่พบค่า UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  process.exit(1);
}
const confirm = process.argv.includes("--confirm");

async function run(cmd) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const keys = [];
let cursor = "0";
do {
  const [next, batch] = await run(["SCAN", cursor, "MATCH", "xmas:*", "COUNT", "500"]);
  keys.push(...batch);
  cursor = String(next);
} while (cursor !== "0");

console.log(`พบ ${keys.length} คีย์ของระบบคริสต์มาส`);
if (!confirm) {
  console.log("ยังไม่ได้ลบ ใส่ --confirm เพื่อลบจริง");
  process.exit(0);
}
let removed = 0;
for (let i = 0; i < keys.length; i += 200) {
  const batch = keys.slice(i, i + 200);
  removed += Number(await run(["DEL", ...batch])) || 0;
}
console.log(`ลบแล้ว ${removed} คีย์`);
