"use client";

import { useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/orders";

const LABEL: Record<OrderStatus, string> = { awaiting_payment: "รอโอนเงิน", paid: "ชำระแล้ว", shipped: "จัดส่งแล้ว", cancelled: "ยกเลิก" };
const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

// รายการคำสั่งซื้อ: ดูรายการสินค้า ที่อยู่ เปลี่ยนสถานะ ใส่เลขพัสดุ และบันทึกหมายเหตุ
export function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const json = (await res.json()) as { configured?: boolean; orders?: Order[]; error?: string };
      if (!res.ok) throw new Error(json.error || `โหลดไม่สำเร็จ (${res.status})`);
      setConfigured(json.configured !== false);
      setOrders(json.orders ?? []);
    } catch (err) {
      setError((err as Error).message);
      setOrders([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(id: string, patch: Partial<Pick<Order, "status" | "tracking" | "adminNote">>) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const json = (await res.json()) as { order?: Order; error?: string };
      if (!res.ok || !json.order) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setOrders((cur) => (cur ?? []).map((o) => (o.id === id ? json.order! : o)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (orders === null) return <p className="admin-hint">กำลังโหลด...</p>;
  if (!configured) {
    return (
      <section className="admin-card">
        <h2>ยังไม่ได้ตั้งค่าที่เก็บคำสั่งซื้อ</h2>
        <p className="admin-hint">ตั้งค่า Upstash Redis ตามคู่มือแล้ว Redeploy</p>
      </section>
    );
  }

  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <section className="admin-card">
      <div className="admin-head">
        <h2>คำสั่งซื้อทั้งหมด ({orders.length})</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
          รีเฟรช
        </button>
      </div>
      {error && <p className="admin-hint" style={{ color: "#e5484d" }}>{error}</p>}
      <div className="chip-row">
        {(["all", ...Object.keys(LABEL)] as const).map((k) => (
          <button key={k} type="button" className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k as OrderStatus | "all")}>
            {k === "all" ? "ทั้งหมด" : LABEL[k as OrderStatus]}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="admin-hint">ยังไม่มีคำสั่งซื้อในหมวดนี้</p>}
      {shown.map((o) => (
        <details key={o.id} className="admin-item" open={o.status === "awaiting_payment"}>
          <summary>
            <span className="admin-item-title">{o.id} · {o.customer.name}</span>
            <span className="admin-item-tag">{LABEL[o.status]}</span>
            <span className="admin-item-tag">{baht(o.total)}</span>
          </summary>
          <div className="admin-item-body">
            <div className="grid-2">
              <div>
                <span className="admin-hint">ผู้รับ</span>
                <div>{o.customer.name} · {o.customer.phone}</div>
                {o.customer.email && <div>{o.customer.email}</div>}
              </div>
              <div>
                <span className="admin-hint">ส่งเมื่อ</span>
                <div>{new Date(o.createdAt).toLocaleString("th-TH")}</div>
              </div>
            </div>
            <div>
              <span className="admin-hint">ที่อยู่จัดส่ง</span>
              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{o.customer.address}</p>
              {o.customer.note && <p style={{ margin: "6px 0 0" }}>หมายเหตุ: {o.customer.note}</p>}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {o.lines.map((l, i) => (
                <li key={i}>{l.name} · ไซส์ {l.size} × {l.qty} · {baht(l.price * l.qty)}</li>
              ))}
            </ul>
            <div>
              ยอดรวม {baht(o.subtotal)}
              {o.coupon && ` · คูปอง ${o.coupon} ลด ${baht(o.discount)}`} · <strong>รวม {baht(o.total)}</strong>
            </div>
            <div className="grid-2">
              <label className="field">
                <span className="admin-hint">สถานะ</span>
                <select className="input" value={o.status} disabled={saving === o.id} onChange={(e) => void save(o.id, { status: e.target.value as OrderStatus })}>
                  {(Object.keys(LABEL) as OrderStatus[]).map((s) => (
                    <option key={s} value={s}>{LABEL[s]}</option>
                  ))}
                </select>
              </label>
              <TrackingField key={o.id + o.updatedAt} initial={o.tracking} saving={saving === o.id} onSave={(tracking) => void save(o.id, { tracking })} />
            </div>
            <NoteField key={`n-${o.id}-${o.updatedAt}`} initial={o.adminNote} saving={saving === o.id} onSave={(adminNote) => void save(o.id, { adminNote })} />
          </div>
        </details>
      ))}
    </section>
  );
}

function TrackingField({ initial, saving, onSave }: { initial: string; saving: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="field">
      <span className="admin-hint">เลขพัสดุ</span>
      <div className="row">
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving || v === initial} onClick={() => onSave(v)}>
          บันทึก
        </button>
      </div>
    </div>
  );
}

function NoteField({ initial, saving, onSave }: { initial: string; saving: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span className="admin-hint">บันทึกของแอดมิน</span>
      <textarea className="input" rows={2} value={v} onChange={(e) => setV(e.target.value)} />
      <div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving || v === initial} onClick={() => onSave(v)}>
          บันทึกหมายเหตุ
        </button>
      </div>
    </div>
  );
}
