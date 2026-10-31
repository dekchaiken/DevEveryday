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
  image: string; // "/uploads/..." ว่างได้ ถ้าว่างจะวาดเสื้อจากสีให้เอง
  color: string; // #rrggbb
  variants: Variant[];
};

export type Shop = {
  brandName: string;
  tagline: string;
  sizes: string[];
  categories: Option[];
  types: Option[];
  brands: Option[];
  products: Product[];
};

export const SHOP_LIMITS = { sizes: 12, options: 20, products: 200, variants: 12 };

export function getShop(): Shop {
  return raw as Shop;
}
