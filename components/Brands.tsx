import type { CSSProperties } from "react";
import type { Brand } from "@/lib/types";
import { Reveal } from "@/components/Reveal";

// การ์ดธุรกิจในเครือ แต่ละใบมีสีและตัวอักษรประจำตัวเอง กดแล้วไปยังเว็บของธุรกิจนั้น
export function Brands({ items }: { items: Brand[] }) {
  return (
    <div className="brands">
      {items.map((b, i) => {
        const inner = (
          <>
            <div className="brand-art" style={{ "--c": b.color } as CSSProperties}>
              {b.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image} alt="" loading="lazy" />
              ) : (
                <span className="brand-initial" aria-hidden="true">
                  {b.name.replace(/^ตัวอย่าง:\s*/, "").charAt(0)}
                </span>
              )}
            </div>
            <div className="brand-body">
              <span className="brand-kicker">ในเครือ DevEveryday</span>
              <h3>{b.name}</h3>
              <p className="brand-tagline">{b.tagline}</p>
              <p className="brand-desc">{b.description}</p>
              {b.url && <span className="brand-go">เข้าชมเว็บไซต์ ↗</span>}
            </div>
          </>
        );

        return (
          <Reveal key={b.id} delay={i * 90}>
            {b.url ? (
              <a href={b.url} target="_blank" rel="noopener noreferrer" className="brand-card" style={{ "--c": b.color } as CSSProperties}>
                {inner}
              </a>
            ) : (
              <div className="brand-card" style={{ "--c": b.color } as CSSProperties}>
                {inner}
              </div>
            )}
          </Reveal>
        );
      })}
    </div>
  );
}
