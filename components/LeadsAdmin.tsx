"use client";

import { useEffect, useState } from "react";
import type { Lead, LeadStatus } from "@/lib/leads";

const LABEL: Record<LeadStatus, string> = { new: "ใหม่", contacted: "ติดต่อแล้ว", won: "ปิดงานได้", lost: "ไม่สำเร็จ" };

// รายการลีดทั้งหมด: ดูข้อมูลผู้สนใจ เปลี่ยนสถานะ และบันทึกการติดต่อกลับ
export function LeadsAdmin() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/leads", { cache: "no-store" });
      const json = (await res.json()) as { configured?: boolean; leads?: Lead[]; error?: string };
      if (!res.ok) throw new Error(json.error || `โหลดไม่สำเร็จ (${res.status})`);
      setConfigured(json.configured !== false);
      setLeads(json.leads ?? []);
    } catch (err) {
      setError((err as Error).message);
      setLeads([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(id: string, patch: { status?: LeadStatus; notes?: string }) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const json = (await res.json()) as { lead?: Lead; error?: string };
      if (!res.ok || !json.lead) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setLeads((cur) => (cur ?? []).map((l) => (l.id === id ? json.lead! : l)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (leads === null) return <p className="admin-hint">กำลังโหลด...</p>;

  if (!configured) {
    return (
      <section className="admin-card">
        <h2>ยังไม่ได้ตั้งค่าที่เก็บลีด</h2>
        <p className="admin-hint">
          สร้างฐาน Upstash Redis จาก Vercel Marketplace แล้วเพิ่มตัวแปร UPSTASH_REDIS_REST_URL และ UPSTASH_REDIS_REST_TOKEN ใน Vercel จากนั้นกด Redeploy
        </p>
      </section>
    );
  }

  const shown = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <section className="admin-card">
      <div className="admin-head">
        <h2>ลีดทั้งหมด ({leads.length})</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
          รีเฟรช
        </button>
      </div>
      {error && <p className="admin-hint" style={{ color: "#e5484d" }}>{error}</p>}
      <div className="chip-row">
        {(["all", ...Object.keys(LABEL)] as const).map((k) => (
          <button key={k} type="button" className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k as LeadStatus | "all")}>
            {k === "all" ? "ทั้งหมด" : LABEL[k as LeadStatus]}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="admin-hint">ยังไม่มีลีดในหมวดนี้</p>}
      {shown.map((l) => (
        <details key={l.id} className="admin-item" open={l.status === "new"}>
          <summary>
            <span className="admin-item-title">{l.name}</span>
            <span className="admin-item-tag">{LABEL[l.status]}</span>
            <span className="admin-item-tag">{l.type}</span>
          </summary>
          <div className="admin-item-body">
            <div className="grid-2">
              <div>
                <span className="admin-hint">อีเมล</span>
                <div><a href={`mailto:${l.email}`}>{l.email}</a></div>
              </div>
              <div>
                <span className="admin-hint">โทร</span>
                <div>{l.phone || "-"}</div>
              </div>
              <div>
                <span className="admin-hint">ส่งเมื่อ</span>
                <div>{new Date(l.createdAt).toLocaleString("th-TH")}</div>
              </div>
              <div>
                <span className="admin-hint">สถานะ</span>
                <select className="input" value={l.status} disabled={saving === l.id} onChange={(e) => void save(l.id, { status: e.target.value as LeadStatus })}>
                  {(Object.keys(LABEL) as LeadStatus[]).map((s) => (
                    <option key={s} value={s}>{LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className="admin-hint">รายละเอียดโปรเจกต์</span>
              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{l.brief || "-"}</p>
            </div>
            <NotesField key={l.id + l.updatedAt} initial={l.notes} saving={saving === l.id} onSave={(notes) => void save(l.id, { notes })} />
          </div>
        </details>
      ))}
    </section>
  );
}

function NotesField({ initial, saving, onSave }: { initial: string; saving: boolean; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span className="admin-hint">บันทึกการติดต่อกลับ</span>
      <textarea className="input" rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
      <div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving || value === initial} onClick={() => onSave(value)}>
          บันทึกหมายเหตุ
        </button>
      </div>
    </div>
  );
}
