"use client";

import { useEffect, useRef } from "react";

const MIN_MS = 1100; // ให้เห็นแอนิเมชันอย่างน้อยเท่านี้ แม้โหลดเสร็จเร็ว
const FALLBACK_MS = 4000; // กันค้าง ถ้า load event ไม่มาภายในเวลานี้
const CHARSET = "01<>/{}#$%&*+=_ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ข้อความสถานะตามเปอร์เซ็นต์ เหมือนกำลัง compile ทีละขั้น
const STAGES: [number, string][] = [
  [0, "กำลังเริ่มต้นระบบ"],
  [30, "กำลังโหลดฟอนต์"],
  [65, "กำลังประกอบคอมโพเนนต์"],
  [90, "เกือบเสร็จแล้ว"],
  [100, "พร้อมใช้งาน"],
];

export function Loader({ name }: { name: string }) {
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const status = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const bar = fill.current;
    const label = num.current;
    const word = mark.current;
    const stage = status.current;
    if (!el || !bar || !label || !word || !stage) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minMs = reduce ? 250 : MIN_MS;
    const startedAt = performance.now();

    let shown = 0;
    let target = 25;
    let loaded = false;
    let finished = false;
    let frame = 0;
    let raf = 0;
    let lastStage = "";

    // ขยับ target ขึ้นเรื่อยๆ ระหว่างรอ เพื่อให้หลอดไม่ค้างนิ่ง
    const markLoaded = () => {
      if (loaded) return;
      loaded = true;
      target = 100;
    };

    const onLoad = () => {
      target = Math.max(target, 80);
      const fonts = document.fonts?.ready ?? Promise.resolve();
      fonts.then(markLoaded, markLoaded);
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const fallback = window.setTimeout(markLoaded, FALLBACK_MS);

    const finish = () => {
      finished = true;
      el.classList.add("is-done");
      el.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("is-loading");
    };

    const paint = () => {
      bar.style.transform = `scaleX(${shown / 100})`;
      label.textContent = `${Math.floor(shown)}%`;

      // ตัวอักษรที่ล็อกแล้วจะค่อยๆ โผล่ทีละตัว ตัวที่เหลือสุ่มไปเรื่อยๆ
      if (!reduce && frame % 3 === 0) {
        const solved = Math.floor((shown / 100) * name.length);
        let out = "";
        for (let i = 0; i < name.length; i++) {
          out +=
            i < solved || shown >= 100
              ? name[i]
              : CHARSET[Math.floor(Math.random() * CHARSET.length)];
        }
        word.textContent = out;
      }

      const current = [...STAGES].reverse().find(([at]) => shown >= at)?.[1] ?? "";
      if (current !== lastStage) {
        lastStage = current;
        stage.textContent = current;
      }
    };

    const loop = () => {
      frame += 1;
      if (!loaded && target < 88) target += 0.05;
      const step = (target - shown) * 0.08;
      shown = Math.min(target, shown + Math.max(step, 0.2));
      paint();

      const elapsed = performance.now() - startedAt;
      if (loaded && shown >= 99.5 && elapsed >= minMs) {
        shown = 100;
        paint();
        window.setTimeout(finish, 180);
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      window.removeEventListener("load", onLoad);
      if (!finished) document.documentElement.classList.remove("is-loading");
    };
  }, [name]);

  return (
    <div ref={root} className="loader" role="status" aria-live="polite" aria-label="กำลังโหลดหน้าเว็บ">
      <div className="loader-inner">
        <div className="loader-mark">
          <span ref={mark}>{name}</span>
          <span className="loader-cursor" />
        </div>
        <div className="loader-track">
          <div ref={fill} className="loader-fill" />
        </div>
        <div className="loader-meta">
          <span ref={status}>{STAGES[0][1]}</span>
          <span ref={num}>0%</span>
        </div>
      </div>
    </div>
  );
}
