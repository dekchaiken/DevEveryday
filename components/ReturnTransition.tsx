"use client";

import { useEffect, useState } from "react";

// เมื่อกลับเข้ามาจากลิงก์ภายนอก (ผ่านปุ่มย้อนกลับหรือแท็บที่เคยซ่อนไว้) ให้แสดงม่านเปลี่ยนฉากสั้นๆ
export function ReturnTransition({ name }: { name: string }) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    let hiddenAt = 0;
    const show = () => setKey((k) => k + 1);
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) show();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 1200) {
        hiddenAt = 0;
        show();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (key === 0) return null;
  return (
    <div key={key} className="return-veil" aria-hidden="true">
      <strong>{name}</strong>
      <span />
    </div>
  );
}
