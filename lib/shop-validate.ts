import { CONDITIONS, SECTION_IDS, SHOP_LIMITS, type Announcement, type Banner, type Branch, type Collection, type Coupon, type Season, type Option, type Product, type Schedule, type Section, type Shop, type Variant } from "@/lib/shop";

type Result = { ok: true; value: Shop } | { ok: false; error: string };

class ShopError extends Error {}

function fail(msg: string): never {
  throw new ShopError(msg);
}

function text(v: unknown, field: string, max = 120, allowEmpty = true): string {
  if (typeof v !== "string") fail(`${field} ต้องเป็นข้อความ`);
  const s = v.trim();
  if (!allowEmpty && s === "") fail(`${field} ห้ามว่าง`);
  if (s.length > max) fail(`${field} ยาวเกิน ${max} ตัวอักษร`);
  return s;
}

function list<T>(v: unknown, field: string, max: number, fn: (x: unknown, i: number) => T): T[] {
  if (!Array.isArray(v)) fail(`${field} ต้องเป็นรายการ`);
  if (v.length > max) fail(`${field} มีได้ไม่เกิน ${max} รายการ`);
  return v.map((x, i) => fn(x, i));
}

function obj(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${field} ไม่ถูกต้อง`);
  return v as Record<string, unknown>;
}

function uniq<T extends { id: string }>(items: T[], field: string): T[] {
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.id) fail(`${field} มี id ว่าง`);
    if (seen.has(it.id)) fail(`${field} มี id ซ้ำ: ${it.id}`);
    seen.add(it.id);
  }
  return items;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const IMG = /^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

function schedule(o: Record<string, unknown>, field: string): Schedule {
  const start = text(o.start ?? "", `วันเริ่ม${field}`, 10);
  const end = text(o.end ?? "", `วันจบ${field}`, 10);
  if (start && !DATE.test(start)) fail(`วันเริ่ม${field} ต้องเป็นรูปแบบ YYYY-MM-DD`);
  if (end && !DATE.test(end)) fail(`วันจบ${field} ต้องเป็นรูปแบบ YYYY-MM-DD`);
  if (start && end && start > end) fail(`${field}: วันจบต้องไม่ก่อนวันเริ่ม`);
  return { start, end };
}

function hex(v: unknown, field: string): string {
  const s = text(v, field, 7, false);
  if (!HEX.test(s)) fail(`${field} ต้องเป็นรูปแบบ #rrggbb`);
  return s;
}

function image(v: unknown, field: string): string {
  const s = text(v ?? "", field, 200);
  if (s && !IMG.test(s)) fail(`${field} ไม่ถูกต้อง`);
  return s;
}

function link(v: unknown, field: string): string {
  const s = text(v ?? "", field, 300);
  if (s && !/^(https:\/\/|\/(?!\/))/.test(s)) fail(`${field} ต้องขึ้นต้นด้วย https:// หรือเป็น path เช่น /shop`);
  return s;
}

function options(v: unknown, field: string): Option[] {
  return uniq(
    list(v, field, SHOP_LIMITS.options, (x, i) => {
      const o = obj(x, `${field} #${i + 1}`);
      return { id: text(o.id, `id ของ${field}`, 40, false), name: text(o.name, `ชื่อ${field}`, 60, false) };
    }),
    field,
  );
}

function variants(v: unknown, condition: string, field: string, sizes: string[]): Variant[] {
  const rows = list(v, field, SHOP_LIMITS.variants, (x) => {
    const o = obj(x, "ไซส์");
    const qty = Number(o.qty);
    if (!Number.isInteger(qty) || qty < 0) fail("จำนวนคงเหลือต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
    const size = text(o.size, "ไซส์", 20, false);
    if (!sizes.includes(size)) fail(`ไซส์ ${size} ไม่อยู่ในรายการไซส์ของร้าน`);
    return { size, qty };
  });
  if (condition === "used") {
    if (rows.length !== 1 || rows[0].qty !== 1) fail("สินค้ามือ 2 ต้องมีไซส์เดียวและจำนวน 1 ชิ้นเท่านั้น");
  } else if (rows.length === 0) {
    fail("สินค้ามือ 1 ต้องมีอย่างน้อยหนึ่งไซส์");
  }
  const names = rows.map((r) => r.size);
  if (new Set(names).size !== names.length) fail("ไซส์ของสินค้าห้ามซ้ำกัน");
  return rows;
}

export function validateShop(input: unknown): Result {
  try {
    const root = obj(input, "ข้อมูลร้าน");
    const brandName = text(root.brandName, "ชื่อร้าน", 60, false);
    const tagline = text(root.tagline, "คำโปรยร้าน", 120);
    const sizes = list(root.sizes, "ไซส์", SHOP_LIMITS.sizes, (x, i) => text(x, `ไซส์ #${i + 1}`, 20, false));
    if (new Set(sizes).size !== sizes.length) fail("ไซส์ห้ามซ้ำกัน");

    const categories = options(root.categories, "หมวดหมู่");
    const types = options(root.types, "ประเภท");
    const brands = options(root.brands, "แบรนด์");

    const collections: Collection[] = uniq(
      list(root.collections ?? [], "คอลเลกชัน", SHOP_LIMITS.collections, (x, i) => {
        const o = obj(x, `คอลเลกชัน #${i + 1}`);
        return {
          id: text(o.id, "id คอลเลกชัน", 40, false),
          name: text(o.name, "ชื่อคอลเลกชัน", 60, false),
          description: text(o.description, "คำอธิบายคอลเลกชัน", 200),
          image: image(o.image, "รูปคอลเลกชัน"),
        };
      }),
      "คอลเลกชัน",
    );

    const products: Product[] = uniq(
      list(root.products, "สินค้า", SHOP_LIMITS.products, (x, i) => {
        const o = obj(x, `สินค้า #${i + 1}`);
        const brandId = text(o.brandId, "แบรนด์ของสินค้า", 40);
        const categoryId = text(o.categoryId, "หมวดหมู่ของสินค้า", 40);
        const typeId = text(o.typeId, "ประเภทของสินค้า", 40);
        if (!brands.some((b) => b.id === brandId)) fail(`สินค้า #${i + 1} ใช้แบรนด์ที่ไม่มีอยู่`);
        if (!categories.some((c) => c.id === categoryId)) fail(`สินค้า #${i + 1} ใช้หมวดหมู่ที่ไม่มีอยู่`);
        if (!types.some((t) => t.id === typeId)) fail(`สินค้า #${i + 1} ใช้ประเภทที่ไม่มีอยู่`);
        const condition = o.condition;
        if (!CONDITIONS.includes(condition as (typeof CONDITIONS)[number])) fail(`สินค้า #${i + 1} ต้องเป็นมือ 1 หรือมือ 2`);
        const price = Number(o.price);
        if (!Number.isInteger(price) || price < 0) fail(`ราคาสินค้า #${i + 1} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);
        const hookRaw = (o.hook ?? {}) as Record<string, unknown>;
        const hx = Number(hookRaw.x ?? 50);
        const hy = Number(hookRaw.y ?? 10);
        if (!(hx >= 0 && hx <= 100 && hy >= 0 && hy <= 100)) fail("จุดแขวนต้องอยู่ระหว่าง 0 ถึง 100");
        const views = list(o.views ?? [], "รูปหมุน 360", SHOP_LIMITS.views, (v) => {
          const s = text(v, "รูปหมุน 360", 200, false);
          if (!IMG.test(s)) fail("รูปหมุน 360 ไม่ถูกต้อง");
          return s;
        });
        const collectionIds = list(o.collectionIds ?? [], "คอลเลกชันของสินค้า", 10, (c) => text(c, "คอลเลกชันของสินค้า", 40, false));
        for (const cid of collectionIds) {
          if (!collections.some((c) => c.id === cid)) fail(`สินค้า #${i + 1} อยู่ในคอลเลกชันที่ไม่มีอยู่`);
        }
        const vs = variants(o.variants, condition as string, `ไซส์ของสินค้า #${i + 1}`, sizes);
        return {
          id: text(o.id, "id สินค้า", 40, false),
          name: text(o.name, "ชื่อสินค้า", 120, false),
          brandId,
          categoryId,
          typeId,
          condition: condition as Product["condition"],
          price,
          description: text(o.description, "รายละเอียดสินค้า", 600),
          sizeGuide: text(o.sizeGuide ?? "", "ตารางไซส์", 400),
          image: image(o.image, "รูปสินค้า"),
          views,
          side: image(o.side, "รูปด้านข้าง"),
          hook: { x: hx, y: hy },
          color: hex(o.color, "สีสินค้า"),
          variants: vs,
          collectionIds,
          popular: o.popular === true,
          trending: o.trending === true,
        };
      }),
      "สินค้า",
    );

    const theme = obj(root.theme, "ธีม");
    const banners: Banner[] = uniq(
      list(root.banners ?? [], "แบนเนอร์", SHOP_LIMITS.banners, (x, i) => {
        const o = obj(x, `แบนเนอร์ #${i + 1}`);
        return {
          id: text(o.id, "id แบนเนอร์", 40, false),
          title: text(o.title, "หัวข้อแบนเนอร์", 80, false),
          subtitle: text(o.subtitle, "คำโปรยแบนเนอร์", 160),
          image: image(o.image, "รูปแบนเนอร์"),
          link: link(o.link, "ลิงก์แบนเนอร์"),
          active: o.active === true,
          ...schedule(o, "แบนเนอร์"),
        };
      }),
      "แบนเนอร์",
    );

    const announcements: Announcement[] = uniq(
      list(root.announcements ?? [], "ประกาศ", SHOP_LIMITS.announcements, (x, i) => {
        const o = obj(x, `ประกาศ #${i + 1}`);
        return {
          id: text(o.id, "id ประกาศ", 40, false),
          text: text(o.text, "ข้อความประกาศ", 160, false),
          active: o.active === true,
          ...schedule(o, "ประกาศ"),
        };
      }),
      "ประกาศ",
    );

    const coupons: Coupon[] = uniq(
      list(root.coupons ?? [], "คูปอง", SHOP_LIMITS.coupons, (x, i) => {
        const o = obj(x, `คูปอง #${i + 1}`);
        const type = o.type === "fixed" ? "fixed" : "percent";
        const value = Number(o.value);
        if (!Number.isInteger(value) || value <= 0) fail("ค่าคูปองต้องเป็นจำนวนเต็มมากกว่า 0");
        if (type === "percent" && value > 100) fail("คูปองเปอร์เซ็นต์ต้องไม่เกิน 100");
        const scope = o.scope === "category" || o.scope === "collection" ? o.scope : "all";
        const scopeId = text(o.scopeId ?? "", "หมวดหรือคอลเลกชันของคูปอง", 40);
        if (scope === "category" && !categories.some((c) => c.id === scopeId)) fail("คูปองนี้ผูกกับหมวดที่ไม่มีอยู่");
        if (scope === "collection" && !collections.some((c) => c.id === scopeId)) fail("คูปองนี้ผูกกับคอลเลกชันที่ไม่มีอยู่");
        const code = text(o.code, "รหัสคูปอง", 30, false).toUpperCase();
        if (!/^[A-Z0-9_-]+$/.test(code)) fail("รหัสคูปองใช้ได้เฉพาะ A-Z 0-9 _ -");
        const minSpend = Number(o.minSpend ?? 0);
        const usageLimit = Number(o.usageLimit ?? 0);
        const used = Number(o.used ?? 0);
        if (!Number.isInteger(minSpend) || minSpend < 0) fail("ยอดขั้นต่ำต้องเป็นจำนวนเต็มตั้งแต่ 0");
        if (!Number.isInteger(usageLimit) || usageLimit < 0) fail("จำนวนสิทธิ์ต้องเป็นจำนวนเต็มตั้งแต่ 0");
        if (!Number.isInteger(used) || used < 0) fail("จำนวนที่ใช้ไปแล้วไม่ถูกต้อง");
        return {
          id: text(o.id, "id คูปอง", 40, false),
          code,
          type,
          value,
          minSpend,
          usageLimit,
          used,
          scope,
          scopeId: scope === "all" ? "" : scopeId,
          active: o.active === true,
          ...schedule(o, "คูปอง"),
        };
      }),
      "คูปอง",
    );

    const sectionsRaw = list(root.sections ?? [], "ส่วนของหน้า", SECTION_IDS.length, (x) => {
      const o = obj(x, "ส่วนของหน้า");
      const id = text(o.id, "ส่วนของหน้า", 20, false);
      if (!SECTION_IDS.includes(id as (typeof SECTION_IDS)[number])) fail(`ไม่รู้จักส่วนของหน้า: ${id}`);
      return { id: id as Section["id"], enabled: o.enabled !== false };
    });
    const sections: Section[] = SECTION_IDS.map((id) => sectionsRaw.find((s) => s.id === id) ?? { id, enabled: true });

    const seasons: Season[] = uniq(
      list(root.seasons ?? [], "เทศกาล", SHOP_LIMITS.seasons, (x, i) => {
        const o = obj(x, `เทศกาล #${i + 1}`);
        const md = (v: unknown, field: string) => {
          const s = text(v, field, 5, false);
          if (!/^\d{2}-\d{2}$/.test(s)) fail(`${field} ต้องเป็นรูปแบบ MM-DD`);
          return s;
        };
        const t = obj(o.theme, "ธีมของเทศกาล");
        return {
          id: text(o.id, "id เทศกาล", 40, false),
          name: text(o.name, "ชื่อเทศกาล", 60, false),
          start: md(o.start, "วันเริ่มเทศกาล"),
          end: md(o.end, "วันจบเทศกาล"),
          announcement: text(o.announcement ?? "", "ข้อความเทศกาล", 160),
          theme: {
            primary: hex(t.primary, "สีหลักเทศกาล"),
            accent: hex(t.accent, "สีรองเทศกาล"),
            background: hex(t.background, "สีพื้นหลังเทศกาล"),
            text: hex(t.text, "สีตัวอักษรเทศกาล"),
          },
          active: o.active === true,
        };
      }),
      "เทศกาล",
    );

    const branches: Branch[] = uniq(
      list(root.branches ?? [], "สาขา", SHOP_LIMITS.branches, (x, i) => {
        const o = obj(x, `สาขา #${i + 1}`);
        return {
          id: text(o.id, "id สาขา", 40, false),
          name: text(o.name, "ชื่อสาขา", 80, false),
          address: text(o.address, "ที่อยู่สาขา", 200),
          hours: text(o.hours, "เวลาเปิดสาขา", 80),
        };
      }),
      "สาขา",
    );

    const pay = obj(root.payment ?? {}, "ข้อมูลการโอนเงิน");
    const footer = obj(root.footer, "ท้ายเว็บ");

    return {
      ok: true,
      value: {
        brandName,
        tagline,
        sizes,
        categories,
        types,
        brands,
        products,
        theme: {
          primary: hex(theme.primary, "สีหลัก"),
          accent: hex(theme.accent, "สีรอง"),
          background: hex(theme.background, "สีพื้นหลัง"),
          text: hex(theme.text, "สีตัวอักษร"),
        },
        banners,
        announcements,
        collections,
        coupons,
        sections,
        seasons,
        payment: {
          bankName: text(pay.bankName ?? "", "ชื่อธนาคาร", 60),
          accountName: text(pay.accountName ?? "", "ชื่อบัญชี", 120),
          accountNo: text(pay.accountNo ?? "", "เลขบัญชี", 40),
          promptpay: text(pay.promptpay ?? "", "พร้อมเพย์", 40),
        },
        branches,
        footer: {
          note: text(footer.note, "ข้อความท้ายเว็บ", 200),
          email: text(footer.email, "อีเมลติดต่อ", 120),
          lineUrl: link(footer.lineUrl, "ลิงก์ LINE"),
        },
      },
    };
  } catch (err) {
    if (err instanceof ShopError) return { ok: false, error: err.message };
    return { ok: false, error: "ข้อมูลร้านไม่ถูกต้อง" };
  }
}
