import type { CSSProperties } from "react";
import { Contact } from "@/components/Contact";
import { HeroOrb } from "@/components/HeroOrb";
import { Magnetic } from "@/components/Magnetic";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { Team } from "@/components/Team";
import { Tilt } from "@/components/Tilt";
import { getContent } from "@/lib/content";

export default function Home() {
  const c = getContent();
  const words = c.site.headline.split(" ");
  // คำสุดท้ายจะถูกไล่สีให้เด่น
  const accentFrom = Math.max(words.length - 2, 0);

  return (
    <>
      <Nav site={c.site} />

      <main id="top">
        <section className="hero">
          <HeroOrb />
          <div className="hero-grid-bg" aria-hidden />
          <div className="container">
            <span className="badge">
              <span className="badge-dot" />
              {c.site.badge}
            </span>

            <h1>
              {words.map((w, i) => (
                <span key={`${w}-${i}`} className={i >= accentFrom ? "word accent" : "word"} style={{ "--i": i } as CSSProperties}>
                  {w}
                  {i < words.length - 1 ? " " : ""}
                </span>
              ))}
            </h1>

            <p className="lead">{c.site.subheadline}</p>

            <div className="hero-actions">
              <Magnetic>
                <a href="#contact" className="btn btn-primary">
                  {c.site.ctaPrimary} <span className="arrow">→</span>
                </a>
              </Magnetic>
              <Magnetic>
                <a href="#services" className="btn btn-ghost">
                  {c.site.ctaSecondary}
                </a>
              </Magnetic>
            </div>

            <div className="hero-meta">
              <div>
                <b>{c.services.length}</b>บริการหลัก
              </div>
              <div>
                <b>{c.team.length}</b>สมาชิกทีม
              </div>
              <div>
                <b>24h</b>ตอบกลับ
              </div>
            </div>
          </div>
        </section>

        <div className="marquee" aria-label="เทคโนโลยีที่ใช้">
          <div className="marquee-track">
            {[...c.stack, ...c.stack].map((s, i) => (
              <span key={`${s}-${i}`}>{s}</span>
            ))}
          </div>
        </div>

        <section id="services" className="section">
          <div className="container">
            <Reveal>
              <span className="eyebrow">บริการ</span>
              <h2 className="section-title">รับทำอะไรบ้าง</h2>
              <p className="lead">เลือกเฉพาะส่วนที่ต้องการ หรือให้ทีมวางแผนทั้งโปรเจกต์ตั้งแต่ต้นจนจบ</p>
            </Reveal>
            <div className="grid-3">
              {c.services.map((s, i) => (
                <Reveal key={s.id} delay={i * 80}>
                  <Tilt>
                    <span className="card-index">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                    <div className="card-eta">{s.eta}</div>
                  </Tilt>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <Reveal>
              <span className="eyebrow">วิธีทำงาน</span>
              <h2 className="section-title">4 ขั้นตอนสู่งานที่ส่งมอบได้</h2>
            </Reveal>
            <ProcessSteps steps={c.process} />
          </div>
        </section>

        <section id="pricing" className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <Reveal>
              <span className="eyebrow">แพ็กเกจ</span>
              <h2 className="section-title">เลือกรูปแบบที่เหมาะกับงาน</h2>
              <p className="lead">ราคาขึ้นอยู่กับขอบเขตงาน ทีมจะประเมินให้ก่อนเริ่มทุกครั้ง</p>
            </Reveal>
            <div className="plans">
              {c.plans.map((p, i) => (
                <Reveal key={p.id} delay={i * 100} className="plan">
                  <Tilt className={`plan ${p.highlight ? "highlight" : ""}`}>
                    {p.highlight && <span className="plan-badge">แนะนำ</span>}
                    <div className="plan-name">{p.name}</div>
                    <div className="plan-price">{p.price}</div>
                    <div className="plan-unit">{p.unit}</div>
                    <ul>
                      {p.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <a href="#contact" className={`btn ${p.highlight ? "btn-primary" : "btn-ghost"}`}>
                      เลือกแพ็กเกจ
                    </a>
                  </Tilt>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <Reveal>
              <span className="eyebrow">ทีมงาน</span>
              <h2 className="section-title">พบกับทีมงานของเรา</h2>
              <p className="lead">สมาชิกใหม่จะแสดงไว้ด้านบนก่อน กดการ์ดเพื่อดูประวัติและเส้นทางการทำงาน</p>
            </Reveal>
            <Team members={c.team} />
          </div>
        </section>

        <section id="contact" className="section" style={{ paddingTop: 0 }}>
          <div className="container contact-grid">
            <Reveal>
              <span className="eyebrow">ติดต่อ</span>
              <h2 className="section-title">เริ่มโปรเจกต์กับเรา</h2>
              <p className="lead">บอกเราคร่าวๆ ว่าอยากทำอะไร ทีมจะตอบกลับพร้อมแนวทางและประมาณการเบื้องต้น</p>
              <div className="contact-info">
                <div>
                  <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
                    EMAIL
                  </span>
                  <br />
                  <a href={`mailto:${c.site.email}`}>{c.site.email}</a>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <Contact types={c.contact.types} email={c.site.email} />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <span>{c.site.footer}</span>
          <a href="#top" className="mono" style={{ fontSize: 12 }}>
            ↑ กลับด้านบน
          </a>
        </div>
      </footer>
    </>
  );
}

function ProcessSteps({ steps }: { steps: { id: string; title: string; description: string }[] }) {
  return (
    <Reveal className="steps">
      {steps.map((s, i) => (
        <div key={s.id} className="step" style={{ transitionDelay: `${i * 150}ms` }}>
          <div className="step-dot">{String(i + 1).padStart(2, "0")}</div>
          <h3>{s.title}</h3>
          <p>{s.description}</p>
        </div>
      ))}
    </Reveal>
  );
}
