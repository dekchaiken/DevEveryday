import type { CSSProperties } from "react";
import type { Project } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { Tilt } from "@/components/Tilt";

// ผลงานแบบ bento: งาน featured กินสองคอลัมน์ ที่เหลือเป็นการ์ดปกติ
export function Projects({ items }: { items: Project[] }) {
  return (
    <div className="bento">
      {items.map((p, i) => (
        <Reveal key={p.id} delay={i * 80} className={p.featured ? "bento-wide" : ""}>
          <Tilt className="card project">
            <ProjectMock project={p} />
            <div className="project-body">
              <div className="project-meta">
                {p.category}
                {p.client && <> · {p.client}</>}
              </div>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              {p.tags.length > 0 && (
                <div className="project-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="project-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="project-link">
                  ดูเว็บไซต์ ↗
                </a>
              )}
            </div>
          </Tilt>
        </Reveal>
      ))}
    </div>
  );
}

// กรอบ browser พร้อมรูปจริง ถ้ายังไม่มีรูปจะวาดโครงหน้าเว็บจากสีของผลงานแทน
export function ProjectMock({ project: p }: { project: Project }) {
  return (
    <div className="mock" style={{ "--c": p.color } as CSSProperties}>
      <div className="mock-bar">
        <i />
        <i />
        <i />
        <span className="mock-url">{p.title}</span>
      </div>
      <div className="mock-screen">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.title} loading="lazy" />
        ) : (
          <div className="mock-skel" aria-hidden="true">
            <div className="sk-hero" />
            <div className="sk-row">
              <div className="sk-card" />
              <div className="sk-card" />
              <div className="sk-card" />
            </div>
            <div className="sk-line w70" />
            <div className="sk-line w45" />
          </div>
        )}
      </div>
    </div>
  );
}
