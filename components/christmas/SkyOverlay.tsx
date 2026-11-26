"use client";

import { useEffect, useRef, useState } from "react";
import { paintSkyScene, type SkyTheme } from "./skyArt";

// ข้อความขึ้นจอ: วาดเป็นภาพบนหน้าจอ (ไม่ใช่ 3D) จึงชัดและพอดีกับทุกขนาดจอ
export type SkyShow = { id: string; text: string; by: string; theme: SkyTheme; duration: number };

export function SkyOverlay({ show, onDone }: { show: SkyShow; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  // เก็บ onDone ไว้ใน ref เพื่อไม่ให้ตัวจับเวลาเริ่มใหม่ทุกครั้งที่หน้าหลักอัปเดต
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // วาดต่อเนื่องด้วยเวลาจริง (ผู้ที่ตั้งค่าลดการเคลื่อนไหวจะเห็นภาพนิ่ง)
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      const t = reduced ? 4 : (performance.now() - start) / 1000;
      paintSkyScene(g, cv.width, cv.height, t, { theme: show.theme, text: show.text, by: show.by });
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [show]);

  // ค่อย ๆ ปรากฏ แล้วจางออกก่อนจบ
  useEffect(() => {
    const onT = setTimeout(() => setOn(true), 30);
    const outT = setTimeout(() => setOn(false), Math.max(show.duration - 900, 1500));
    const endT = setTimeout(() => doneRef.current(), show.duration);
    return () => {
      clearTimeout(onT);
      clearTimeout(outT);
      clearTimeout(endT);
    };
  }, [show]);

  return (
    <div className={`xmas-sky-overlay ${on ? "is-on" : ""}`} role="status" aria-live="polite" aria-label={`ข้อความจาก ${show.by}`}>
      <canvas ref={ref} width={1280} height={720} />
    </div>
  );
}
