import { isLive, type Coupon, type Product, type Shop } from "@/lib/shop";

// ราคาและคูปองที่ใช้ร่วมกันทั้งหน้าร้านและเซิร์ฟเวอร์ เพื่อให้ยอดที่ลูกค้าเห็นตรงกับยอดที่บันทึก
export type CartLine = { key: string; productId: string; size: string; qty: number };

export function linesWithProducts(shop: Shop, lines: CartLine[]) {
  return lines
    .map((l) => ({ l, p: shop.products.find((x) => x.id === l.productId) }))
    .filter((x): x is { l: CartLine; p: Product } => Boolean(x.p));
}

export function subtotalOf(shop: Shop, lines: CartLine[]) {
  return linesWithProducts(shop, lines).reduce((s, { l, p }) => s + p.price * l.qty, 0);
}

// ตรวจคูปอง: สถานะ ช่วงวัน สิทธิ์การใช้ ยอดขั้นต่ำ และหมวดหรือคอลเลกชันที่กำหนด
export function applyCoupon(shop: Shop, code: string, lines: CartLine[], today: string) {
  const c = shop.coupons.find((x) => x.code === code.trim().toUpperCase());
  if (!c) return { error: "ไม่พบคูปองนี้" } as const;
  if (!c.active || !isLive(c, today)) return { error: "คูปองนี้ไม่อยู่ในช่วงใช้งาน" } as const;
  if (c.usageLimit > 0 && c.used >= c.usageLimit) return { error: "คูปองนี้ถูกใช้ครบแล้ว" } as const;
  const items = linesWithProducts(shop, lines);
  const subtotal = items.reduce((s, { l, p }) => s + p.price * l.qty, 0);
  const scoped = items
    .filter(({ p }) => {
      if (c.scope === "category") return p.categoryId === c.scopeId;
      if (c.scope === "collection") return p.collectionIds.includes(c.scopeId);
      return true;
    })
    .reduce((s, { l, p }) => s + p.price * l.qty, 0);
  if (subtotal < c.minSpend) return { error: `ยอดขั้นต่ำ ฿${c.minSpend.toLocaleString("th-TH")}` } as const;
  if (scoped === 0) return { error: "คูปองนี้ใช้กับสินค้าในตะกร้าไม่ได้" } as const;
  const discount = c.type === "percent" ? Math.floor((scoped * c.value) / 100) : Math.min(c.value, scoped);
  return { coupon: c as Coupon, discount } as const;
}
