"use client";

import { useState, type FormEvent } from "react";

export function Contact({ types, email }: { types: string[]; email: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "ส่งข้อความไม่สำเร็จ");
      setNote("รับข้อความแล้ว ทีมจะติดต่อกลับภายใน 24 ชั่วโมง");
      form.reset();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit} style={{ transform: "none" }}>
      <div className="field">
        <label htmlFor="name">ชื่อ / บริษัท</label>
        <input id="name" name="name" className="input" required placeholder="เช่น คุณสมชาย / บริษัท ABC" />
      </div>
      <div className="field">
        <label htmlFor="email">อีเมล</label>
        <input id="email" name="email" className="input" type="email" required placeholder="you@example.com" />
      </div>
      <div className="field">
        <label htmlFor="phone">เบอร์โทร (ไม่บังคับ)</label>
        <input id="phone" name="phone" className="input" type="tel" placeholder="เช่น 08x-xxx-xxxx" />
      </div>
      <div className="field">
        <label htmlFor="type">ประเภทงาน</label>
        <select id="type" name="type" className="input" required defaultValue="">
          <option value="" disabled>
            เลือกประเภทงาน
          </option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="brief">รายละเอียดโปรเจกต์</label>
        <textarea id="brief" name="brief" className="input" rows={4} placeholder="เป้าหมาย กลุ่มลูกค้า งบโดยประมาณ และกำหนดเวลา" />
      </div>
      {/* ช่องนี้ซ่อนไว้สำหรับกันบอท ผู้ใช้จริงจะไม่เห็นและไม่กรอก */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "กำลังส่ง..." : "ส่งข้อความ"} <span className="arrow">→</span>
        </button>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          หรือเมล {email}
        </span>
      </div>
      <div className="form-note" role="status">
        {note}
      </div>
    </form>
  );
}
