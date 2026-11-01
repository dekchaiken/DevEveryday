import Link from "next/link";
import { OrdersAdmin } from "@/components/OrdersAdmin";

export default function AdminOrdersPage() {
  return (
    <div className="admin">
      <div className="admin-top">
        <div className="admin-top-inner">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            ← กลับหน้า admin
          </Link>
          <strong className="brand" style={{ fontSize: 15 }}>
            <span className="brand-dot" /> คำสั่งซื้อ
          </strong>
        </div>
      </div>
      <div className="admin-body" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="admin-panel">
          <OrdersAdmin />
        </div>
      </div>
    </div>
  );
}
