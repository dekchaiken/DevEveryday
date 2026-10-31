"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const password = new FormData(e.currentTarget).get("password");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit} style={{ transform: "none" }}>
        <div>
          <span className="eyebrow">Admin</span>
          <h2 style={{ fontSize: 26, marginTop: 14 }}>เข้าสู่ระบบจัดการเว็บ</h2>
          <p className="admin-hint" style={{ marginTop: 6 }}>กรอกรหัสผ่าน admin ที่ตั้งไว้ใน Environment Variables</p>
        </div>
        <div className="field">
          <label htmlFor="password">รหัสผ่าน</label>
          <input id="password" name="password" type="password" className="input" required autoFocus autoComplete="current-password" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
        </button>
        <div role="alert" style={{ color: "#e5484d", fontSize: 14, minHeight: 20 }}>
          {error}
        </div>
      </form>
    </div>
  );
}
