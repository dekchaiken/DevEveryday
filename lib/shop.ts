import raw from "@/content/shop.json";

// ข้อมูลร้านเสื้อผ้า (Chubby Man) อยู่ใน content/shop.json แยกจากเว็บหลัก
// สินค้ามือ 1 มีหลายไซส์และจำนวนคงเหลือต่อไซส์ สินค้ามือ 2 มีชิ้นเดียว ไซส์เดียว (qty = 1)

export const CONDITIONS = ["new", "used"] as const;
export type Condition = (typeof CONDITIONS)[number];

export type Option = { id: string; name: string };

export type Variant = { size: string; qty: number };

export type Product = {
  id: string;
  name: string;
  brandId: string;
  categoryId: string;
  typeId: string;
  condition: Condition;
  price: number; // บาท จำนวนเต็ม
  description: string;
  sizeGuide: string; // ข้อความตารางไซส์ เช่น "M: อก 44 นิ้ว ยาว 28 นิ้ว" (ว่างได้)
  image: string; // "/uploads/..." ว่างได้
  views: string[]; // รูปหลายมุม (ว่างได้)
  side: string; // รูปด้านข้าง (ว่างได้)
  hook: { x: number; y: number }; // จุดแขวนบนรูป (% ของรูป)
  color: string; // #rrggbb
  variants: Variant[];
  collectionIds: string[]; // คอลเลกชันที่สินค้านี้อยู่ (ว่างได้)
  popular: boolean; // แสดงในแถว "สินค้ายอดนิยม"
  trending: boolean; // แสดงในแถว "กำลังมาแรง"
};

export type Theme = {
  primary: string; // สีหลัก ปุ่มและจุดเด่น
  accent: string; // สีรอง ป้ายและไฮไลต์
  background: string; // พื้นหลังหน้า
  text: string; // สีตัวอักษร
};

// วันที่ใช้ในรูปแบบ YYYY-MM-DD ว่างหมายถึงไม่มีกำหนด
export type Schedule = { start: string; end: string };

export type Banner = Schedule & {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  link: string; // "/..." หรือ https://...
  active: boolean;
};

export type Announcement = Schedule & {
  id: string;
  text: string;
  active: boolean;
};

export type Collection = {
  id: string;
  name: string;
  description: string;
  image: string;
};

export type CouponScope = "all" | "category" | "collection";

export type Coupon = Schedule & {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number; // เปอร์เซ็นต์ (1–100) หรือจำนวนบาท
  minSpend: number; // ยอดขั้นต่ำ บาท
  usageLimit: number; // 0 = ไม่จำกัด
  used: number;
  scope: CouponScope;
  scopeId: string; // id ของหมวดหรือคอลเลกชัน ใช้เมื่อ scope ไม่ใช่ all
  active: boolean;
};

export type SectionId = "announcement" | "hero" | "popular" | "collections" | "trending" | "branches" | "newsletter";

export type Section = { id: SectionId; enabled: boolean };

export type Branch = { id: string; name: string; address: string; hours: string };

export type Shop = {
  brandName: string;
  tagline: string;
  sizes: string[];
  categories: Option[];
  types: Option[];
  brands: Option[];
  products: Product[];
  theme: Theme;
  banners: Banner[];
  announcements: Announcement[];
  collections: Collection[];
  coupons: Coupon[];
  sections: Section[];
  branches: Branch[];
  footer: { note: string; email: string; lineUrl: string };
};

export const SHOP_LIMITS = {
  sizes: 12,
  options: 20,
  products: 200,
  variants: 12,
  views: 36,
  banners: 8,
  announcements: 10,
  collections: 12,
  coupons: 50,
  branches: 10,
};

export const SECTION_IDS: SectionId[] = ["announcement", "hero", "popular", "collections", "trending", "branches", "newsletter"];

export function getShop(): Shop {
  return raw as unknown as Shop;
}

// ช่วงเวลาใช้งาน: ว่างหมายถึงไม่จำกัดด้านนั้น
export function isLive(s: Schedule, today: string) {
  return (!s.start || s.start <= today) && (!s.end || today <= s.end);
}
