import { CONDITIONS, SHOP_LIMITS, type Option, type Product, type Shop, type Variant } from "@/lib/shop";

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

function options(v: unknown, field: string): Option[] {
  return uniq(
    list(v, field, SHOP_LIMITS.options, (x, i) => {
      const o = obj(x, `${field} #${i + 1}`);
      return { id: text(o.id, `id ของ${field}`, 40, false), name: text(o.name, `ชื่อ${field}`, 60, false) };
    }),
    field,
  );
}

function variants(v: unknown, condition: string, field: string): Variant[] {
  const rows = list(v, field, SHOP_LIMITS.variants, (x, i) => {
    const o = obj(x, `ไซส์ #${i + 1}`);
    const qty = Number(o.qty);
    if (!Number.isInteger(qty) || qty < 0) fail("จำนวนคงเหลือต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
    return { size: text(o.size, "ไซส์", 20, false), qty };
  });
  if (condition === "used") {
    // มือ 2 มีชิ้นเดียว ไซส์เดียว
    if (rows.length !== 1 || rows[0].qty !== 1) fail("สินค้ามือ 2 ต้องมีไซส์เดียวและจำนวน 1 ชิ้นเท่านั้น");
  } else if (rows.length === 0) {
    fail("สินค้ามือ 1 ต้องมีอย่างน้อยหนึ่งไซส์");
  }
  const sizes = rows.map((r) => r.size);
  if (new Set(sizes).size !== sizes.length) fail("ไซส์ของสินค้าห้ามซ้ำกัน");
  return rows;
}

function products(v: unknown, shop: { brands: Option[]; categories: Option[]; types: Option[]; sizes: string[] }): Product[] {
  return uniq(
    list(v, "สินค้า", SHOP_LIMITS.products, (x, i) => {
      const o = obj(x, `สินค้า #${i + 1}`);
      const brandId = text(o.brandId, "แบรนด์ของสินค้า", 40);
      const categoryId = text(o.categoryId, "หมวดหมู่ของสินค้า", 40);
      const typeId = text(o.typeId, "ประเภทของสินค้า", 40);
      if (!shop.brands.some((b) => b.id === brandId)) fail(`สินค้า #${i + 1} ใช้แบรนด์ที่ไม่มีอยู่`);
      if (!shop.categories.some((c) => c.id === categoryId)) fail(`สินค้า #${i + 1} ใช้หมวดหมู่ที่ไม่มีอยู่`);
      if (!shop.types.some((t) => t.id === typeId)) fail(`สินค้า #${i + 1} ใช้ประเภทที่ไม่มีอยู่`);

      const condition = o.condition;
      if (!CONDITIONS.includes(condition as (typeof CONDITIONS)[number])) fail(`สินค้า #${i + 1} ต้องเป็นมือ 1 หรือมือ 2`);

      const price = Number(o.price);
      if (!Number.isInteger(price) || price < 0) fail(`ราคาสินค้า #${i + 1} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);

      const color = text(o.color, "สีสินค้า", 7, false);
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail(`สีสินค้า #${i + 1} ต้องเป็นรูปแบบ #rrggbb`);

      const image = text(o.image, "รูปสินค้า", 200);
      if (image && !/^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/.test(image)) fail("รูปสินค้าไม่ถูกต้อง");
      const side = text(o.side, "รูปด้านข้าง", 200);
      if (side && !/^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/.test(side)) fail("รูปด้านข้างไม่ถูกต้อง");
      const hookRaw = (o.hook ?? {}) as Record<string, unknown>;
      const hx = Number(hookRaw.x ?? 50);
      const hy = Number(hookRaw.y ?? 10);
      if (!(hx >= 0 && hx <= 100 && hy >= 0 && hy <= 100)) fail("จุดแขวนต้องอยู่ระหว่าง 0 ถึง 100");
      const views = list(o.views ?? [], "รูปหมุน 360", SHOP_LIMITS.views, (x) => text(x, "รูปหมุน 360", 200, false));
      for (const v of views) {
        if (!/^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/.test(v)) fail("รูปหมุน 360 ไม่ถูกต้อง");
      }

      const vs = variants(o.variants, condition as string, `ไซส์ของสินค้า #${i + 1}`);
      for (const r of vs) {
        if (!shop.sizes.includes(r.size)) fail(`ไซส์ ${r.size} ไม่อยู่ในรายการไซส์ของร้าน`);
      }

      return {
        id: text(o.id, "id สินค้า", 40, false),
        name: text(o.name, "ชื่อสินค้า", 120, false),
        brandId,
        categoryId,
        typeId,
        condition: condition as Product["condition"],
        price,
        description: text(o.description, "รายละเอียดสินค้า", 600),
        image,
        views,
        side,
        hook: { x: hx, y: hy },
        color,
        variants: vs,
      };
    }),
    "สินค้า",
  );
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
    const items = products(root.products, { brands, categories, types, sizes });

    return { ok: true, value: { brandName, tagline, sizes, categories, types, brands, products: items } };
  } catch (err) {
    if (err instanceof ShopError) return { ok: false, error: err.message };
    return { ok: false, error: "ข้อมูลร้านไม่ถูกต้อง" };
  }
}
