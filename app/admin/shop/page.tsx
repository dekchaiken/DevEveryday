import { ShopStudio } from "@/components/shop/ShopStudio";
import { getShop } from "@/lib/shop";

export default function AdminShopPage() {
  return <ShopStudio initial={getShop()} />;
}
