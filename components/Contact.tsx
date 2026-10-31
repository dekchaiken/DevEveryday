"use client";

import { useState, type FormEvent } from "react";

export function Contact({ types, email }: { types: string[]; email: string }) {
  const [note, setNote] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // เดโม: ยังไม่ได้ส่งข้อมูลไปที่ไหน ต่อ API / อีเมลได้ภายหลัง
    setNote("รับข้อความแล้ว (เดโม) ทีมจะติดต่อกลับภายใน 24 ชั่วโมง");
    e.currentTarget.reset();
  }

  return (
    <form className="card form" onSubmit={onSubmit} style={{ transform: "none" }}>
      <div className="field">
        <label htmlFor="name">ชื่อ / บริษัท</label>
        <input id="name" className="input" required placeholder="เช่น คุณสมชาย / บริษัท ABC" />
      </div>
      <div className="field">
        <label htmlFor="email">อีเมล</label>
        <input id="email" className="input" type="email" required placeholder="you@example.com" />
      </div>
      <div className="field">
        <label htmlFor="type">ประเภทงาน</label>
        <select id="type" className="input" required defaultValue="">
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
        <textarea id="brief" className="input" rows={4} placeholder="เป้าหมาย กลุ่มลูกค้า งบโดยประมาณ และกำหนดเวลา" />
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="submit">
          ส่งข้อความ <span className="arrow">→</span>
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
