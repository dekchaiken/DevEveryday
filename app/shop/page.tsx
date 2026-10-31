import type { Metadata } from "next";
import { Storefront } from "@/components/shop/Storefront";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Chubby Man · ร้านเสื้อผ้า",
  description: "เสื้อผ้าไซส์ใหญ่ มือ 1 และมือ 2 เลือกซื้อได้ที่หน้าร้าน",
};

export default function ShopPage() {
  return <Storefront shop={getShop()} />;
}
