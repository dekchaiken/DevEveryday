"use client";

import { useRef, type ReactNode } from "react";

// ปุ่มที่ดึงเข้าหาเมาส์เล็กน้อย
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  function onMove(e: React.PointerEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.setProperty("--mx", `${(x * 0.25).toFixed(1)}px`);
    el.style.setProperty("--my", `${(y * 0.35).toFixed(1)}px`);
  }

  function onLeave() {
    ref.current?.style.setProperty("--mx", "0px");
    ref.current?.style.setProperty("--my", "0px");
  }

  return (
    <span ref={ref} className="magnetic" onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </span>
  );
}
