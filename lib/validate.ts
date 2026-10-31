import type { Content, HistoryItem, Member, Plan, Project, Service, Step } from "@/lib/types";

type Result = { ok: true; value: Content } | { ok: false; error: string };

const LIMITS = { short: 120, long: 600, services: 12, plans: 4, steps: 6, team: 30, history: 8, skills: 10, projects: 12, tags: 8 };

class ValidationError extends Error {}

function str(v: unknown, field: string, max = LIMITS.short, allowEmpty = true): string {
  if (typeof v !== "string") throw new ValidationError(`${field} ต้องเป็นข้อความ`);
  const s = v.trim();
  if (!allowEmpty && s === "") throw new ValidationError(`${field} ห้ามว่าง`);
  if (s.length > max) throw new ValidationError(`${field} ยาวเกิน ${max} ตัวอักษร`);
  return s;
}

function arr<T>(v: unknown, field: string, max: number, fn: (item: unknown, i: number) => T): T[] {
  if (!Array.isArray(v)) throw new ValidationError(`${field} ต้องเป็นรายการ`);
  if (v.length > max) throw new ValidationError(`${field} มีได้ไม่เกิน ${max} รายการ`);
  return v.map((item, i) => fn(item, i));
}

function uniqueIds<T extends { id: string }>(items: T[], field: string): T[] {
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.id) throw new ValidationError(`${field} มี id ว่าง`);
    if (seen.has(it.id)) throw new ValidationError(`${field} มี id ซ้ำ: ${it.id}`);
    seen.add(it.id);
  }
  return items;
}

function obj(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ValidationError(`${field} ไม่ถูกต้อง`);
  return v as Record<string, unknown>;
}

function build(input: unknown): Content {
  const root = obj(input, "ข้อมูล");
  const s = obj(root.site, "site");
  const site = {
    name: str(s.name, "ชื่อเว็บ", LIMITS.short, false),
    tagline: str(s.tagline, "Tagline"),
    headline: str(s.headline, "หัวข้อหน้าแรก", LIMITS.long, false),
    subheadline: str(s.subheadline, "คำอธิบายหน้าแรก", LIMITS.long),
    badge: str(s.badge, "ข้อความ badge"),
    ctaPrimary: str(s.ctaPrimary, "ปุ่มหลัก"),
    ctaSecondary: str(s.ctaSecondary, "ปุ่มรอง"),
    email: str(s.email, "อีเมลติดต่อ"),
    footer: str(s.footer, "ข้อความ footer"),
  };

  const stack = arr(root.stack, "stack", LIMITS.skills, (x, i) => str(x, `stack #${i + 1}`)).filter(Boolean);

  const projects: Project[] = uniqueIds(
    arr(root.projects, "ผลงาน", LIMITS.projects, (x, i) => {
      const o = obj(x, `ผลงาน #${i + 1}`);
      const color = str(o.color, "สีผลงาน", 7);
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new ValidationError(`สีผลงาน ${color} ไม่ถูกต้อง (ต้องเป็น #rrggbb)`);
      const url = str(o.url, "ลิงก์ผลงาน", 300);
      if (url && !/^https?:\/\//.test(url)) throw new ValidationError("ลิงก์ผลงานต้องขึ้นต้นด้วย http:// หรือ https://");
      const image = str(o.image, "รูปผลงาน", 200);
      // รูปต้องมาจากที่อัปโหลดผ่านหน้า admin เท่านั้น กันการใส่ path แปลกๆ
      if (image && !/^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/.test(image)) throw new ValidationError("รูปผลงานไม่ถูกต้อง");
      return {
        id: str(o.id, "id ผลงาน", 40, false),
        title: str(o.title, "ชื่อผลงาน", LIMITS.short, false),
        client: str(o.client, "ชื่อลูกค้า"),
        category: str(o.category, "หมวดงาน"),
        description: str(o.description, "รายละเอียดผลงาน", LIMITS.long),
        tags: arr(o.tags, "แท็ก", LIMITS.tags, (t, j) => str(t, `แท็ก ${j + 1}`)).filter(Boolean),
        url,
        image,
        color,
        featured: o.featured === true,
      };
    }),
    "ผลงาน",
  );

  const services: Service[] = uniqueIds(
    arr(root.services, "บริการ", LIMITS.services, (x, i) => {
      const o = obj(x, `บริการ #${i + 1}`);
      return {
        id: str(o.id, "id บริการ", 40, false),
        title: str(o.title, "ชื่อบริการ", LIMITS.short, false),
        description: str(o.description, "รายละเอียดบริการ", LIMITS.long),
        eta: str(o.eta, "ระยะเวลา"),
      };
    }),
    "บริการ",
  );

  const plans: Plan[] = uniqueIds(
    arr(root.plans, "แพ็กเกจ", LIMITS.plans, (x, i) => {
      const o = obj(x, `แพ็กเกจ #${i + 1}`);
      return {
        id: str(o.id, "id แพ็กเกจ", 40, false),
        name: str(o.name, "ชื่อแพ็กเกจ", LIMITS.short, false),
        price: str(o.price, "ราคา"),
        unit: str(o.unit, "หน่วยราคา"),
        highlight: o.highlight === true,
        features: arr(o.features, "ฟีเจอร์", 12, (f, j) => str(f, `ฟีเจอร์ ${j + 1}`)).filter(Boolean),
      };
    }),
    "แพ็กเกจ",
  );

  const process: Step[] = uniqueIds(
    arr(root.process, "ขั้นตอน", LIMITS.steps, (x, i) => {
      const o = obj(x, `ขั้นตอน #${i + 1}`);
      return {
        id: str(o.id, "id ขั้นตอน", 40, false),
        title: str(o.title, "ชื่อขั้นตอน", LIMITS.short, false),
        description: str(o.description, "รายละเอียดขั้นตอน", LIMITS.long),
      };
    }),
    "ขั้นตอน",
  );

  const team: Member[] = uniqueIds(
    arr(root.team, "ทีมงาน", LIMITS.team, (x, i) => {
      const o = obj(x, `สมาชิก #${i + 1}`);
      const color = str(o.color, "สี", 7);
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new ValidationError(`สี ${color} ไม่ถูกต้อง (ต้องเป็น #rrggbb)`);
      const joinedAt = str(o.joinedAt, "วันที่เข้าร่วม", 10);
      if (joinedAt && !/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)) throw new ValidationError("วันที่เข้าร่วมต้องเป็นรูปแบบ YYYY-MM-DD");
      const history: HistoryItem[] = arr(o.history, "ประวัติ", LIMITS.history, (h, j) => {
        const hh = obj(h, `ประวัติ ${j + 1}`);
        return {
          year: str(hh.year, "ปี", 20),
          title: str(hh.title, "หัวข้อประวัติ", LIMITS.short),
          detail: str(hh.detail, "รายละเอียดประวัติ", LIMITS.long),
        };
      });
      return {
        id: str(o.id, "id สมาชิก", 40, false),
        name: str(o.name, "ชื่อสมาชิก", LIMITS.short, false),
        role: str(o.role, "ตำแหน่ง"),
        bio: str(o.bio, "ประวัติโดยย่อ", LIMITS.long),
        skills: arr(o.skills, "ทักษะ", LIMITS.skills, (k, j) => str(k, `ทักษะ ${j + 1}`)).filter(Boolean),
        color,
        joinedAt,
        isNew: o.isNew === true,
        history,
      };
    }),
    "ทีมงาน",
  );

  const contact = obj(root.contact, "contact");
  return {
    site,
    stack,
    projects,
    services,
    plans,
    process,
    team,
    contact: {
      types: arr(contact.types, "ประเภทงาน", 12, (t, i) => str(t, `ประเภทงาน ${i + 1}`)).filter(Boolean),
    },
  };
}

export function validateContent(input: unknown): Result {
  try {
    return { ok: true, value: build(input) };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: err.message };
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  }
}
