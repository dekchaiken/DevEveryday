"use client";

import { useState, type FormEvent } from "react";
import { buildSocial, socialLinks, type Social } from "@/lib/christmas/social";
import { EMPTY_PROFILE, type Profile } from "./profile";

// ค่าเริ่มต้นของช่อง Facebook: ลิงก์โปรไฟล์ที่สร้างเอง หรือชื่อแสดงผลที่เคยพิมพ์ไว้
function fbPrefill(s: Social): string {
  if (s.fb) return /^\d+$/.test(s.fb) ? `https://www.facebook.com/profile.php?id=${s.fb}` : `https://www.facebook.com/${s.fb}`;
  return s.fbText ?? "";
}

// การ์ดโปรไฟล์: ชื่อ + Instagram / Facebook (ไม่บังคับ) ใช้ทั้งตอนเข้าครั้งแรกและตอนแก้ไข
export function ProfileCard({
  initial,
  editing,
  onSave,
  onCancel,
}: {
  initial: Profile | null;
  editing: boolean;
  onSave: (p: Profile) => void;
  onCancel?: () => void; // มีเฉพาะตอนแก้ไข (ครั้งแรกต้องกรอกชื่อ)
}) {
  const start = initial ?? EMPTY_PROFILE;
  const [name, setName] = useState(start.name);
  const [ig, setIg] = useState(start.social.ig ? `@${start.social.ig}` : "");
  const [fb, setFb] = useState(fbPrefill(start.social));
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณาใส่ชื่อ");
    const built = buildSocial(ig, fb);
    if (built.error) return setError(built.error);
    onSave({ name: name.trim(), social: built.social });
  }

  // ตัวอย่างลิงก์ที่จะแสดง ให้ผู้ใช้เห็นก่อนบันทึก
  const preview = socialLinks(buildSocial(ig, fb).social);

  return (
    <div className="xmas-intro" role="dialog" aria-modal="true" aria-labelledby="xmas-profile-title">
      <form className="xmas-intro-card xmas-profile-card" onSubmit={submit}>
        <p className="xmas-intro-kicker">{editing ? "แก้ไขโปรไฟล์" : "โปรไฟล์ของคุณ"}</p>
        <h1 id="xmas-profile-title">บอกชื่อให้เพื่อนๆ รู้จัก</h1>
        <p className="xmas-intro-text">ชื่อนี้จะขึ้นบนลูกบอล ตุ๊กตาหิมะ และป้ายที่คุณสนับสนุน ลิงก์โซเชียลไม่บังคับ</p>

        <label className="xmas-field">
          <span className="xmas-field-label">ชื่อที่จะแสดง</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้า" autoComplete="nickname" autoFocus />
        </label>
        <label className="xmas-field">
          <span className="xmas-field-label">Instagram</span>
          <input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@ชื่อ หรือวางลิงก์" autoComplete="off" autoCapitalize="none" />
        </label>
        <label className="xmas-field">
          <span className="xmas-field-label">Facebook</span>
          <input value={fb} onChange={(e) => setFb(e.target.value)} placeholder="ชื่อผู้ใช้ หรือวางลิงก์" autoComplete="off" autoCapitalize="none" />
        </label>

        {preview.length > 0 && (
          <p className="xmas-profile-preview">
            จะแสดงเป็น {preview.map((l) => l.label).join(" · ")}
          </p>
        )}
        {error && <p className="xmas-msg err">{error}</p>}

        <button className="xmas-intro-btn" type="submit">
          <span>{editing ? "บันทึก" : "บันทึกและเข้าต้นคริสต์มาส"}</span>
        </button>
        {editing && onCancel && (
          <button type="button" className="xmas-link-btn xmas-profile-skip" onClick={onCancel}>
            ยกเลิก
          </button>
        )}
      </form>
    </div>
  );
}

// แถวลิงก์โซเชียลสำหรับการ์ดคำอวยพร ตุ๊กตา และป้าย (ไม่แสดงถ้าไม่มี)
export function SocialLinks({ social }: { social?: Social | null }) {
  const links = socialLinks(social);
  if (links.length === 0) return null;
  return (
    <span className="xmas-social-links">
      {links.map((l) =>
        l.href ? (
          <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" className="xmas-social-chip">
            {l.label}
          </a>
        ) : (
          <span key={l.key} className="xmas-social-chip is-text">
            {l.label}
          </span>
        ),
      )}
    </span>
  );
}
