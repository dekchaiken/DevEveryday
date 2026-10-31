"use client";

import { useState, type CSSProperties } from "react";
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

// ลิงก์ภายนอกเปิดแท็บใหม่ ส่วน path ภายในเว็บเปิดในหน้าเดิม
function linkProps(url: string) {
  return url.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" };
}

function BrandIconSvg({ name, className }: { name: BrandIcon; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// ซ้าย: รายการธุรกิจให้เลือก ขวา: กรอบ browser จำลองหน้าเว็บของธุรกิจที่เลือก
export function Brands({ items }: { items: Brand[] }) {
  const [index, setIndex] = useState(0);
  const active = items[index] ?? items[0];
  if (!active) return null;

  // สีของเว็บใช้สีรองของธีม ไม่ใช้สีประจำธุรกิจ เพื่อให้ทุกปุ่มอยู่ในธีมเดียวกัน
  const style = { "--c": "var(--accent)" } as CSSProperties;

  return (
    <div className="bshow">
      <div className="bshow-list" role="tablist" aria-label="ธุรกิจในเครือ">
        {items.map((b, i) => (
          <Reveal key={b.id} delay={i * 80}>
            <button
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`bshow-item ${i === index ? "on" : ""}`}
              style={{ "--c": "var(--accent)" } as CSSProperties}
              onClick={() => setIndex(i)}
              onMouseEnter={() => setIndex(i)}
              onFocus={() => setIndex(i)}
            >
              <span className="bshow-item-icon">
                {b.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image} alt="" />
                ) : (
                  <BrandIconSvg name={b.icon} />
                )}
              </span>
              <span className="bshow-item-text">
                <strong>{b.name}</strong>
                <span>{b.tagline}</span>
              </span>
              <span className="bshow-item-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      <div className="bshow-stage" style={style} key={active.id}>
        <div className="bshow-frame">
          <div className="bshow-bar">
            <i />
            <i />
            <i />
            <span className="bshow-bar-title">{active.name}</span>
          </div>
          <div className="bshow-screen">
            {active.url ? (
              // หน้าเว็บจริงของธุรกิจแสดงสดในกรอบ ถ้าเว็บนั้นไม่อนุญาตให้ฝังจะใช้ปุ่มเปิดในแท็บใหม่แทน
              <div className="bshow-live">
                <iframe src={active.url} title={active.name} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
              </div>
            ) : (
              <div className="bshow-hero">
                {active.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.image} alt={active.name} />
                ) : (
                  <div className="bshow-hero-icon">
                    <BrandIconSvg name={active.icon} />
                  </div>
                )}
              </div>
            )}
            <div className="bshow-copy">
              <span className="bshow-kicker">ในเครือ DevEveryday</span>
              <h3>{active.name}</h3>
              <p className="bshow-tagline">{active.tagline}</p>
              <p className="bshow-desc">{active.description}</p>
              {active.url && (
                <a href={active.url} {...linkProps(active.url)} className="bshow-cta">
                  เข้าชมเว็บไซต์ <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
