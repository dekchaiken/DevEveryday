import Link from "next/link";
import { LeadsAdmin } from "@/components/LeadsAdmin";

export default function AdminLeadsPage() {
  return (
    <div className="admin">
      <div className="admin-top">
        <div className="admin-top-inner">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            ← กลับหน้า admin
          </Link>
          <strong className="brand" style={{ fontSize: 15 }}>
            <span className="brand-dot" /> ลีดจากฟอร์มติดต่อ
          </strong>
        </div>
      </div>
      <div className="admin-body" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="admin-panel">
          <LeadsAdmin />
        </div>
      </div>
    </div>
  );
}
