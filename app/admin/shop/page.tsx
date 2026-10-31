import { ShopAdmin } from "@/components/shop/ShopAdmin";
import { getShop } from "@/lib/shop";

export default function AdminShopPage() {
  return <ShopAdmin initial={getShop()} />;
}
