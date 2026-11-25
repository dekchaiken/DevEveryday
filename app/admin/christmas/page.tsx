"use client";

import { useCallback, useEffect, useState } from "react";

// แดชบอร์ดระบบคริสต์มาส: ภาพรวม ห้อง คำสั่งสนับสนุน และการตั้งค่า (เฉพาะแอดมิน)
type Dash = {
  config: { enabled: boolean; payMode: "manual" | "gateway"; presetPrices: number[]; customMin: number; customMax: number };
  env: { storage: boolean; omise: boolean; promptpay: boolean };
  totals: { online: number; ornaments: number; revenue: number; paidCount: number; awaitingCount: number };
  rooms: { id: string; name: string; online: number; capacity: number; ornaments: number; giant: { name: string; message: string; amount: number } | null }[];
  orders: { id: string; room: string; kind: string; amount: number; name: string; message: string; mode: string; status: string; createdAt: number; paidAt: number | null; providerRef: string }[];
};

const STATUS_TH: Record<string, string> = { awaiting_payment: "รอชำระ", paid: "จ่ายแล้ว", cancelled: "ยกเลิก" };

export default function ChristmasAdmin() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ enabled: boolean; payMode: "manual" | "gateway"; presets: string; customMin: string; customMax: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/christmas/dashboard", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const d = (await res.json()) as Dash;
      setData(d);
      setError("");
      setForm((f) => f ?? { enabled: d.config.enabled, payMode: d.config.payMode, presets: d.config.presetPrices.join(","), customMin: String(d.config.customMin), customMax: String(d.config.customMax) });
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setNote("");
    const res = await fetch("/api/admin/christmas/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        payMode: form.payMode,
        presetPrices: form.presets.split(",").map((x) => Number(x.trim())).filter((x) => x > 0),
        customMin: Number(form.customMin),
        customMax: Number(form.customMax),
      }),
    });
    const body = (await res.json()) as { error?: string };
    setNote(res.ok ? "บันทึกการตั้งค่าแล้ว" : body.error ?? "บันทึกไม่สำเร็จ");
    setSaving(false);
    load();
  }

  async function confirmOrder(id: string) {
    await fetch(`/api/admin/christmas/orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    load();
  }

  if (!data) {
    return <main style={pageStyle}>{error || "กำลังโหลด…"}</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Admin · ระบบคริสต์มาส</p>
        <h1 style={{ margin: "4px 0 0", fontSize: 26 }}>แดชบอร์ดคริสต์มาส</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>รีเฟรชอัตโนมัติทุก 10 วินาที</p>
      </header>

      <section style={grid4}>
        <Stat label="คนออนไลน์ทุกห้อง" value={data.totals.online} />
        <Stat label="ลูกบอลที่แขวนแล้ว" value={data.totals.ornaments} />
        <Stat label="ยอดสนับสนุน (฿)" value={data.totals.revenue.toLocaleString("th-TH")} />
        <Stat label="รอชำระ" value={data.totals.awaitingCount} />
      </section>

      <section style={card}>
        <h2 style={h2}>สถานะระบบ</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Pill ok={data.env.storage} text="ฐานข้อมูล Upstash" />
          <Pill ok={data.env.omise} text="Omise (อัตโนมัติ)" />
          <Pill ok={data.env.promptpay} text="PromptPay (ใช้งานด้วยมือ)" />
          <Pill ok={data.config.enabled} text={data.config.enabled ? "เปิดรับสนับสนุน" : "ปิดรับสนับสนุน"} />
        </div>
        {!data.env.storage && <p style={warn}>ยังไม่ได้เชื่อม Upstash ข้อมูลห้องและคำสั่งจะไม่ซิงก์ระหว่างผู้ใช้</p>}
      </section>

      <section style={card}>
        <h2 style={h2}>ห้อง</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>ห้อง</th>
              <th style={th}>ออนไลน์</th>
              <th style={th}>ลูกบอล</th>
              <th style={th}>ตุ๊กตาหิมะยักษ์</th>
            </tr>
          </thead>
          <tbody>
            {data.rooms.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.name}</td>
                <td style={td}>
                  {r.online}/{r.capacity}
                </td>
                <td style={td}>{r.ornaments}</td>
                <td style={td}>{r.giant ? `${r.giant.name} · ฿${r.giant.amount}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={card}>
        <h2 style={h2}>ตั้งค่าการสนับสนุน</h2>
        {form && (
          <form onSubmit={saveConfig} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <label style={lbl}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> เปิดรับการสนับสนุน
            </label>
            <label style={lbl}>
              โหมดชำระเงิน
              <select value={form.payMode} onChange={(e) => setForm({ ...form, payMode: e.target.value as "manual" | "gateway" })} style={input}>
                <option value="manual">PromptPay แล้วแอดมินยืนยันด้วยมือ</option>
                <option value="gateway">Omise อัตโนมัติ</option>
              </select>
            </label>
            <label style={lbl}>
              ราคาปุ่มเลือกเร็ว (คั่นด้วยคอมมา)
              <input value={form.presets} onChange={(e) => setForm({ ...form, presets: e.target.value })} style={input} />
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ ...lbl, flex: 1 }}>
                ขั้นต่ำ (฿)
                <input value={form.customMin} onChange={(e) => setForm({ ...form, customMin: e.target.value })} style={input} />
              </label>
              <label style={{ ...lbl, flex: 1 }}>
                สูงสุด (฿)
                <input value={form.customMax} onChange={(e) => setForm({ ...form, customMax: e.target.value })} style={input} />
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button disabled={saving} style={btn}>
                {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
              </button>
              {note && <span style={{ fontSize: 13 }}>{note}</span>}
            </div>
          </form>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>คำสั่งสนับสนุนล่าสุด</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>เวลา</th>
                <th style={th}>ห้อง</th>
                <th style={th}>ประเภท</th>
                <th style={th}>ชื่อ / ข้อความ</th>
                <th style={th}>ยอด</th>
                <th style={th}>โหมด</th>
                <th style={th}>สถานะ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>
                    ยังไม่มีคำสั่ง
                  </td>
                </tr>
              )}
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td style={td}>{new Date(o.createdAt).toLocaleString("th-TH")}</td>
                  <td style={td}>{o.room}</td>
                  <td style={td}>{o.kind === "support" ? "สนับสนุนทีม" : "Exclusive"}</td>
                  <td style={td}>
                    <b>{o.name}</b>
                    <br />
                    <span style={{ color: "#64748b" }}>{o.message}</span>
                  </td>
                  <td style={td}>฿{o.amount}</td>
                  <td style={td}>{o.mode === "manual" ? "ด้วยมือ" : "Omise"}</td>
                  <td style={td}>{STATUS_TH[o.status] ?? o.status}</td>
                  <td style={td}>
                    {o.mode === "manual" && o.status === "awaiting_payment" && (
                      <button style={btnSmall} onClick={() => confirmOrder(o.id)}>
                        ยืนยันการโอน
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ ...card, margin: 0 }}>
      <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#166534" : "#991b1b" }}>
      {text}
    </span>
  );
}

const pageStyle: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "32px 20px 60px", fontFamily: "var(--font-thai), system-ui, sans-serif", color: "#0f172a", background: "#f8fafc", minHeight: "100vh" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 16 };
const grid4: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 };
const h2: React.CSSProperties = { margin: "0 0 12px", fontSize: 17 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 6px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const lbl: React.CSSProperties = { display: "grid", gap: 6, fontSize: 14 };
const input: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", font: "inherit" };
const btn: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, border: 0, background: "#0f766e", color: "#fff", font: "inherit", cursor: "pointer" };
const btnSmall: React.CSSProperties = { padding: "6px 10px", borderRadius: 8, border: 0, background: "#0f766e", color: "#fff", font: "inherit", fontSize: 13, cursor: "pointer" };
const warn: React.CSSProperties = { margin: "12px 0 0", color: "#991b1b", fontSize: 14 };
