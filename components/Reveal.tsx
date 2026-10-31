"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// ทำให้ element ค่อยๆ ปรากฏเมื่อเลื่อนมาถึง
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = { "--d": `${delay}ms` } as CSSProperties;
  return (
    <Tag ref={ref as never} className={`reveal ${shown ? "in" : ""} ${className}`} style={style}>
      {children}
    </Tag>
  );
}
