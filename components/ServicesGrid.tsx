"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Project, Service } from "@/lib/types";
import { ProjectMock } from "@/components/Projects";
import { Reveal } from "@/components/Reveal";
import { Tilt } from "@/components/Tilt";

// การ์ดบริการ กดแล้วเปิดรายการผลงานของบริการนั้น
export function ServicesGrid({ services, projects }: { services: Service[]; projects: Project[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const current = services.find((s) => s.id === openId) ?? null;

  return (
    <>
      <div className="grid-3">
        {services.map((s, i) => {
          const items = projects.filter((p) => p.serviceId === s.id);
          const open = () => {
            if (items.length > 0) setOpenId(s.id);
          };
          const linked = items.length > 0;
          return (
            <Reveal key={s.id} delay={i * 80}>
              <Tilt
                className={linked ? "service-link" : ""}
                role={linked ? "button" : undefined}
                tabIndex={linked ? 0 : undefined}
                aria-haspopup={linked ? "dialog" : undefined}
                onClick={open}
                onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
              >
                <span className="card-index">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <div className="card-eta">{s.eta}</div>
                {linked && <div className="card-more">ดูผลงาน {items.length} ชิ้น →</div>}
              </Tilt>
            </Reveal>
          );
        })}
      </div>

      {current && (
        <ServiceModal
          key={current.id}
          title={current.title}
          items={projects.filter((p) => p.serviceId === current.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

function ServiceModal({ title, items, onClose }: { title: string; items: Project[]; onClose: () => void }) {
  const [active, setActive] = useState<Project | null>(null);
  const [mode, setMode] = useState<"demo" | "cover">("demo");

  // ล็อกการเลื่อนหน้าไว้ตอนเปิด modal
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc ย้อนกลับไปรายการก่อน แล้วค่อยปิด
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (active) setActive(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);

  function openProject(p: Project) {
    setMode(p.demoUrl ? "demo" : "cover");
    setActive(p);
  }

  const showDemo = !!active && mode === "demo" && !!active.demoUrl;
  const outLink = active ? active.demoUrl || active.url : "";

  return (
    <div className="svc-overlay" onClick={onClose}>
      <div
        className="svc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-view={active ? "detail" : "list"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="svc-head">
          {active && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActive(null)}>
              ← กลับ
            </button>
          )}
          <span className="svc-title">{title}</span>
          <span className="spacer" />
          <button type="button" className="svc-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        {!active && (
          <div className="svc-list">
            {items.map((p, i) => (
              <button key={p.id} type="button" className="svc-item" style={{ animationDelay: `${i * 70}ms` }} onClick={() => openProject(p)}>
                <ProjectMock project={p} />
                <div className="svc-item-body">
                  <span className="project-meta">{p.category}</span>
                  <strong>{p.title}</strong>
                  <span className="svc-item-desc">{p.description}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {active && (
          <div className="svc-detail" key={active.id}>
            <div className="svc-info">
              <span className="project-meta">
                {active.category}
                {active.client && <> · {active.client}</>}
              </span>
              <h3>{active.title}</h3>
              <p>{active.description}</p>
              {active.tags.length > 0 && (
                <div className="project-tags">
                  {active.tags.map((t) => (
                    <span key={t} className="project-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="svc-actions">
                {active.demoUrl && (
                  <div className="seg" role="group" aria-label="แสดงผล">
                    <button type="button" className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>
                      Live demo
                    </button>
                    <button type="button" className={mode === "cover" ? "on" : ""} onClick={() => setMode("cover")}>
                      รูปปก
                    </button>
                  </div>
                )}
                {outLink && (
                  <a href={outLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    เปิดในแท็บใหม่ ↗
                  </a>
                )}
              </div>
            </div>

            <div className="svc-stage" data-frame={active.frame}>
              {showDemo ? (
                // iframe โหลดเฉพาะตอนที่เปิดดูผลงานนี้ ถ้า demo ฝังไม่ได้ให้ใช้ปุ่มเปิดในแท็บใหม่แทน
                <iframe src={active.demoUrl} title={active.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <ProjectMock project={active} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
