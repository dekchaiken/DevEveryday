import type { CSSProperties } from "react";
import type { Brand, BrandIcon } from "@/lib/types";
import { Reveal } from "@/components/Reveal";

// ไอคอนเส้นบาง (stroke) วาดด้วย SVG ล้วน เปลี่ยนสีตามธีมได้ด้วย currentColor
const ICON_PATHS: Record<BrandIcon, string[]> = {
  shirt: ["M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3-2 2a2 2 0 0 1-4 0z"],
  store: ["M3 9l2-5h14l2 5", "M3 9v11h18V9", "M3 9h18", "M9 20v-6h6v6"],
  code: ["M8 8l-4 4 4 4", "M16 8l4 4-4 4", "M14 5l-4 14"],
  coffee: ["M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z", "M17 10h2a2 2 0 0 1 0 4h-2", "M8 3v2", "M12 3v2"],
  globe: ["M3 12h18", "M12 3c3 3.5 3 14.5 0 18", "M12 3c-3 3.5-3 14.5 0 18"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
};

function BrandIconSvg({ name }: { name: BrandIcon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// การ์ดธุรกิจในเครือ: พื้นที่ภาพด้านบนใช้รูปหรือไอคอน ด้านล่างเป็นข้อมูลและปุ่มเข้าชม
export function Brands({ items }: { items: Brand[] }) {
  return (
    <div className="brands">
      {items.map((b, i) => {
        const card = (
          <>
            <div className="brand-art">
              {b.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image} alt="" loading="lazy" />
              ) : (
                <div className="brand-icon">
                  <BrandIconSvg name={b.icon} />
                </div>
              )}
            </div>
            <div className="brand-body">
              <span className="brand-kicker">ในเครือ DevEveryday</span>
              <h3>{b.name}</h3>
              <p className="brand-tagline">{b.tagline}</p>
              <p className="brand-desc">{b.description}</p>
              {b.url && (
                <span className="brand-go">
                  เข้าชมเว็บไซต์
                  <span className="brand-arrow" aria-hidden="true">
                    ↗
                  </span>
                </span>
              )}
            </div>
          </>
        );

        const style = { "--c": b.color } as CSSProperties;
        return (
          <Reveal key={b.id} delay={i * 90}>
            {b.url ? (
              <a href={b.url} target="_blank" rel="noopener noreferrer" className="brand-card" style={style}>
                {card}
              </a>
            ) : (
              <div className="brand-card" style={style}>
                {card}
              </div>
            )}
          </Reveal>
        );
      })}
    </div>
  );
}
