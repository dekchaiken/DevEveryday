import type { Metadata } from "next";
import TreeLabClient from "./TreeLabClient";

export const metadata: Metadata = {
  title: "ห้องทดลองต้นคริสต์มาส",
  robots: { index: false, follow: false },
};

// หน้าเทียบแบบต้นคริสต์มาส (ไม่ลิงก์จากหน้าอื่น และไม่ให้เครื่องมือค้นหาเก็บ)
export default function TreeLabPage() {
  return <TreeLabClient />;
}
