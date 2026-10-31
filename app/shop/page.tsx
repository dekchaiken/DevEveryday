import type { Metadata } from "next";
import { ShopClient } from "@/components/shop/ShopClient";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Chubby Man · ร้านเสื้อผ้า",
  description: "เสื้อผ้าไซส์ใหญ่ มือ 1 และมือ 2 เลือกดูบนราวแขวนได้เลย",
};

export default function ShopPage() {
  return <ShopClient shop={getShop()} />;
}
