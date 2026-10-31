"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "@/components/Reveal";
import { Tilt } from "@/components/Tilt";
import type { Member } from "@/lib/types";

const dateFmt = (iso: string) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    : "";

// ตัวย่อชื่อ: ใช้ตัวอักษรภาษาอังกฤษถ้ามี ไม่งั้นใช้ตัวแรกของชื่อ
function initials(name: string) {
  const latin = name.match(/[A-Za-z]/g);
  return latin ? latin.slice(0, 2).join("").toUpperCase() : name.trim().charAt(0);
}

export function Team({ members }: { members: Member[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const newcomers = useMemo(
    () => members.filter((m) => m.isNew).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)),
    [members],
  );
  const active = members.find((m) => m.id === activeId) ?? null;

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (activeId && !dlg.open) dlg.showModal();
    if (!activeId && dlg.open) dlg.close();
  }, [activeId]);

  return (
    <>
      {newcomers.length > 0 && (
        <div className="welcome">
          <Reveal>
            <Tilt className="welcome-main" style={{ "--c": newcomers[0].color } as CSSProperties}>
              <div style={{ "--c": newcomers[0].color } as CSSProperties}>
                <span className="welcome-tag">
                  <span className="badge-dot" /> ยินดีต้อนรับสมาชิกใหม่
                </span>
                <h3 className="welcome-name">{newcomers[0].name}</h3>
                <div className="welcome-role">{newcomers[0].role}</div>
                <p style={{ color: "var(--muted)", marginTop: 16, maxWidth: 440 }}>{newcomers[0].bio}</p>
              </div>
              <div>
                <div className="welcome-date">เข้าร่วมเมื่อ {dateFmt(newcomers[0].joinedAt)}</div>
                <div className="skills" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                  {newcomers[0].skills.map((s) => (
                    <span className="tag" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </Tilt>
          </Reveal>

          <div className="welcome-side">
            {newcomers.slice(1).length === 0 && <div className="empty-note">สมาชิกใหม่คนอื่นจะมาแสดงตรงนี้</div>}
            {newcomers.slice(1).map((m, i) => (
              <Reveal key={m.id} delay={120 * (i + 1)}>
                <button type="button" className="new-item" onClick={() => setActiveId(m.id)}>
                  <span className="avatar" style={{ "--c": m.color } as CSSProperties}>
                    {initials(m.name)}
                  </span>
                  <span>
                    <strong style={{ fontWeight: 500 }}>
                      {m.name}
                      <span className="new-badge">NEW</span>
                    </strong>
                    <small>
                      {m.role} · {dateFmt(m.joinedAt)}
                    </small>
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      )}

      <div className="roster">
        {members.map((m, i) => (
          <Reveal key={m.id} delay={i * 90}>
            <Tilt className="member" >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(m.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveId(m.id)}
                style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", cursor: "pointer" }}
              >
                <div className="row" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="avatar" style={{ "--c": m.color } as CSSProperties}>
                    {initials(m.name)}
                  </span>
                  <div>
                    <h3>
                      {m.name}
                      {m.isNew && <span className="new-badge">NEW</span>}
                    </h3>
                    <div className="role">{m.role}</div>
                  </div>
                </div>
                <div className="skills">
                  {m.skills.map((s) => (
                    <span className="tag" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className="member-cta">
                  <span>ดูประวัติ</span>
                  <span className="arrow">→</span>
                </div>
              </div>
            </Tilt>
          </Reveal>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="profile"
        onClick={(e) => e.target === dialogRef.current && setActiveId(null)}
        onClose={() => setActiveId(null)}
        aria-label="ประวัติสมาชิก"
      >
        {active && (
          <div className="profile-inner">
            <div className="profile-head">
              <span className="avatar avatar-lg" style={{ "--c": active.color } as CSSProperties}>
                {initials(active.name)}
              </span>
              <div>
                <h3>
                  {active.name}
                  {active.isNew && <span className="new-badge">NEW</span>}
                </h3>
                <div className="role" style={{ color: "var(--muted)" }}>
                  {active.role}
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  เข้าร่วม {dateFmt(active.joinedAt)}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm profile-close" onClick={() => setActiveId(null)}>
                ปิด
              </button>
            </div>
            <p className="bio">{active.bio}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {active.skills.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
            <ol className="timeline">
              {active.history.map((h, i) => (
                <li key={`${h.year}-${i}`} style={{ "--i": i, "--c": active.color } as CSSProperties}>
                  <span className="year">{h.year}</span>
                  <strong>{h.title}</strong>
                  <span>{h.detail}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </dialog>
    </>
  );
}
