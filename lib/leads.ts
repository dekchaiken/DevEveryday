// เก็บรายชื่อผู้สนใจ (leads) ใน Upstash Redis ผ่าน REST API
// ไม่เก็บข้อมูลลูกค้าลงใน GitHub เพราะ repo เป็นสาธารณะและจะ deploy ใหม่ทุกครั้งที่มีการส่งฟอร์ม
// ต้องตั้งค่า UPSTASH_REDIS_REST_URL และ UPSTASH_REDIS_REST_TOKEN ใน Vercel ก่อนใช้งาน

export const LEAD_STATUSES = ["new", "contacted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Lead = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  brief: string;
  status: LeadStatus;
  notes: string;
  updatedAt: string;
};

const INDEX = "leads:index";

export function leadsConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูลสำหรับเก็บลีด");
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

export async function addLead(lead: Lead) {
  await cmd("SET", `lead:${lead.id}`, JSON.stringify(lead));
  await cmd("LPUSH", INDEX, lead.id);
}

export async function listLeads(limit = 200): Promise<Lead[]> {
  const ids = (await cmd<string[]>("LRANGE", INDEX, 0, limit - 1)) ?? [];
  const rows = await Promise.all(ids.map((id) => cmd<string | null>("GET", `lead:${id}`)));
  return rows.flatMap((r) => (r ? [JSON.parse(r) as Lead] : []));
}

export async function updateLead(id: string, patch: Partial<Pick<Lead, "status" | "notes">>) {
  const raw = await cmd<string | null>("GET", `lead:${id}`);
  if (!raw) throw new Error("ไม่พบรายการนี้");
  const next: Lead = { ...(JSON.parse(raw) as Lead), ...patch, updatedAt: new Date().toISOString() };
  await cmd("SET", `lead:${id}`, JSON.stringify(next));
  return next;
}

// จำกัดการส่งฟอร์มจาก IP เดียวกัน (ทำงานได้ระดับ instance ของ serverless จึงเป็นการป้องกันเบื้องต้น)
const hits = new Map<string, number[]>();
export function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}
