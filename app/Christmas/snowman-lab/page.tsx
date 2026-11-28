import type { Metadata } from "next";
import SnowmanLabClient from "./SnowmanLabClient";

export const metadata: Metadata = {
  title: "ห้องทดลองตุ๊กตาหิมะ",
  robots: { index: false, follow: false },
};

// หน้าตรวจโมเดลตุ๊กตาหิมะและบ้าน Exclusive หลายแบบพร้อมกัน (ไม่ลิงก์จากหน้าอื่น และไม่ให้เครื่องมือค้นหาเก็บ)
export default function SnowmanLabPage() {
  return <SnowmanLabClient />;
}
