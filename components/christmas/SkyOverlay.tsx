"use client";

import { useEffect, useRef } from "react";
import type { SkyStyle } from "@/lib/christmas/skyStyle";
import { createSkyPainter } from "./skyShow";

// ข้อความขึ้นจอ: แสดงเต็มจอทับฉาก (กดผ่านได้ ไม่บังการใช้งาน) ทุกคนในห้องเห็นพร้อมกัน
export type SkyShow = { id: string; text: string; by: string; style: SkyStyle; duration: number };

// จำกัดจำนวนพิกเซลของแคนวาส ให้จอความละเอียดสูงยังลื่น 60–120fps
const MAX_PIXELS = 2_400_000;

export function SkyOverlay({ show, onDone }: { show: SkyShow; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // เก็บ onDone ไว้ใน ref เพื่อไม่ให้การแสดงเริ่มใหม่ทุกครั้งที่หน้าหลักอัปเดต
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d", { alpha: true, desynchronized: true } as CanvasRenderingContext2DSettings);
    if (!cv || !g) return;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const painter = createSkyPainter();
    const dur = show.duration / 1000;
    let scale = 1;
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      scale = Math.min(dpr, Math.sqrt(MAX_PIXELS / Math.max(1, cssW * cssH)));
      cv.width = Math.round(cssW * scale);
      cv.height = Math.round(cssH * scale);
      painter.invalidate();
    };
    resize();
    window.addEventListener("resize", resize);
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= dur) {
        doneRef.current();
        return;
      }
      // ผู้ที่ตั้งค่าลดการเคลื่อนไหว: แสดงภาพนิ่งตอนข้อความครบ แล้วจางออกตามเวลา
      const tt = reduced ? Math.min(Math.max(t, 3.2), dur - 0.01) : t;
      painter.paint(g, cv.width, cv.height, tt, dur, { text: show.text, by: show.by, style: show.style });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [show]);

  return (
    <div className="xmas-sky-overlay" role="status" aria-live="polite" aria-label={`ข้อความจาก ${show.by}: ${show.text}`}>
      <canvas ref={ref} />
    </div>
  );
}
