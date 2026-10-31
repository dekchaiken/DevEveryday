"use client";

import { useEffect, useState } from "react";
import type { SiteInfo } from "@/lib/types";

export function Nav({ site }: { site: SiteInfo }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="container nav-inner">
        <a href="#top" className="brand">
          <span className="brand-dot" />
          {site.name}
        </a>
        <nav className="nav-links" aria-label="เมนูหลัก">
          <a href="#services">บริการ</a>
          <a href="#projects">ผลงาน</a>
          <a href="#brands">ในเครือ</a>
          <a href="#process">วิธีทำงาน</a>
          <a href="#pricing">แพ็กเกจ</a>
          <a href="#team">ทีมงาน</a>
          <a href="#contact">ติดต่อ</a>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <a href="#contact" className="btn btn-primary btn-sm">
            {site.ctaPrimary}
          </a>
        </div>
      </div>
    </header>
  );
}

// สลับธีมสว่าง/มืด และจำค่าไว้ใน localStorage
function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: ใช้ค่าชั่วคราวได้ */
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="สลับโหมดสว่าง/มืด">
      <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
