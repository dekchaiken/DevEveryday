import { AdminEditor } from "@/app/admin/AdminEditor";
import { getContent } from "@/lib/content";

// หน้าแก้ไขข้อมูลเว็บ (ป้องกันด้วย middleware: ต้องล็อกอินก่อน)
export default function AdminPage() {
  return <AdminEditor initial={getContent()} />;
}
