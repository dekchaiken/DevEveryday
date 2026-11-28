"use client";

import { useEffect, useRef, useState } from "react";
import {
  SKY_FONT_INFO,
  SKY_FONTS,
  SKY_FRAME_INFO,
  SKY_FRAMES,
  SKY_INTRO_INFO,
  SKY_INTROS,
  SKY_PALETTE_INFO,
  SKY_PALETTES,
  SKY_SHOW_MS,
  SKY_THEME_INFO,
  SKY_THEMES,
  type SkyStyle,
} from "@/lib/christmas/skyStyle";
import { createSkyPainter, skyFamily, skyThumb } from "./skyShow";

// ตัวอย่างการแสดงจริง เล่นวนซ้ำ เลือกดูแบบจอคอมหรือจอมือถือได้ กดเล่นใหม่เพื่อดูการเปิดตัวอีกครั้ง
export function SkyPreview({ style, text, by }: { style: SkyStyle; text: string; by: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [device, setDevice] = useState<"desktop" | "phone">(() => (typeof window !== "undefined" && window.innerWidth < 760 ? "phone" : "desktop"));
  const latest = useRef({ style, text, by });
  latest.current = { style, text, by };
  const startRef = useRef(0);
  const restart = () => {
    startRef.current = performance.now();
  };
  // เปลี่ยนธีมหรือการเปิดตัว: เล่นตั้งแต่ต้นให้เห็นผลทันที
  useEffect(restart, [style.theme, style.intro, device]);

  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const painter = createSkyPainter();
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = SKY_SHOW_MS / 1000;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(cv);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const w = Math.round(cv.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
      const h = Math.round(cv.clientHeight * Math.min(window.devicePixelRatio || 1, 2));
      if (w < 2 || h < 2) return;
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      // วนเล่น: แสดงครบ 10 วินาที พัก 0.6 วินาที แล้วเริ่มใหม่
      const el = ((performance.now() - startRef.current) / 1000) % (dur + 0.6);
      const t = reduced ? 3.2 : Math.min(el, dur - 0.001);
      const o = latest.current;
      // พื้นหลังจำลองฉากต้นคริสต์มาส
      g.setTransform(1, 0, 0, 1, 0, 0);
      painter.paint(g, w, h, t, dur, o);
      g.globalCompositeOperation = "destination-over";
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0a2a20");
      bg.addColorStop(0.65, "#174d3a");
      bg.addColorStop(1, "#e9eef0");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div className={`xsky-preview is-${device}`}>
      <div className="xsky-preview-tools">
        <div className="xsky-seg" role="radiogroup" aria-label="ดูตัวอย่างบนจอ">
          {(["desktop", "phone"] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={device === d} className={device === d ? "is-on" : ""} onClick={() => setDevice(d)}>
              {d === "desktop" ? "จอคอม" : "จอมือถือ"}
            </button>
          ))}
        </div>
        <button type="button" className="xsky-replay" onClick={restart}>
          ▶ เล่นใหม่
        </button>
      </div>
      <div className="xsky-screen">
        <canvas ref={ref} aria-label="ตัวอย่างการแสดงบนจอ" role="img" />
      </div>
    </div>
  );
}

// ปุ่มธีมพร้อมภาพตัวอย่างนิ่ง
function ThemeCard({ style, on, onPick, id }: { style: SkyStyle; on: boolean; onPick: () => void; id: (typeof SKY_THEMES)[number] }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    // วาดตอนเครื่องว่าง หน้าจอจึงไม่สะดุดตอนเปิด
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 30));
    let alive = true;
    ric(() => alive && setSrc(skyThumb({ ...style, theme: id, intro: "rise" }, 192, 112)));
    return () => {
      alive = false;
    };
  }, [id, style.palette, style.frame, style.font]); // eslint-disable-line react-hooks/exhaustive-deps
  const info = SKY_THEME_INFO[id];
  return (
    <button type="button" role="radio" aria-checked={on} className={`xsky-theme ${on ? "is-on" : ""}`} onClick={onPick}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className="xsky-theme-ph" />}
      <b>{info.label}</b>
      <small>{info.hint}</small>
    </button>
  );
}

// ตัวเลือกรูปแบบแยกเป็นส่วน ๆ ใช้ในหน้าแต่งข้อความ (part = ส่วนที่จะแสดงในขั้นนั้น)
export function SkyStyleEditor({ style, onChange, part }: { style: SkyStyle; onChange: (s: SkyStyle) => void; part: "effect" | "look" }) {
  const set = <K extends keyof SkyStyle>(k: K, v: SkyStyle[K]) => onChange({ ...style, [k]: v });
  if (part === "effect")
    return (
      <div className="xsky-editor">
        <div className="xsky-group">
          <span className="xsky-label">ธีมเอฟเฟกต์</span>
          <div className="xsky-themes" role="radiogroup" aria-label="ธีมเอฟเฟกต์">
            {SKY_THEMES.map((id) => (
              <ThemeCard key={id} id={id} style={style} on={style.theme === id} onPick={() => set("theme", id)} />
            ))}
          </div>
        </div>
        <div className="xsky-group">
          <span className="xsky-label">การเปิดตัว</span>
          <div className="xsky-chips" role="radiogroup" aria-label="การเปิดตัว">
            {SKY_INTROS.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={style.intro === id} className={style.intro === id ? "is-on" : ""} onClick={() => set("intro", id)}>
                {SKY_INTRO_INFO[id].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  return (
    <div className="xsky-editor">
      <div className="xsky-group">
        <span className="xsky-label">ตัวอักษร</span>
        <div className="xsky-fonts" role="radiogroup" aria-label="ตัวอักษร">
          {SKY_FONTS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={style.font === id} className={style.font === id ? "is-on" : ""} onClick={() => set("font", id)}>
              <span style={{ fontFamily: skyFamily(id) }}>สุขสันต์</span>
              <small>{SKY_FONT_INFO[id].label}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="xsky-group">
        <span className="xsky-label">โทนสี</span>
        <div className="xsky-palettes" role="radiogroup" aria-label="โทนสี">
          {SKY_PALETTES.map((id) => {
            const [a, b] = SKY_PALETTE_INFO[id].swatch;
            return (
              <button key={id} type="button" role="radio" aria-checked={style.palette === id} className={style.palette === id ? "is-on" : ""} onClick={() => set("palette", id)}>
                <span className="xsky-sw" style={{ background: `linear-gradient(135deg, ${a} 0 55%, ${b} 55% 100%)` }} />
                <small>{SKY_PALETTE_INFO[id].label}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="xsky-group">
        <span className="xsky-label">กรอบข้อความ</span>
        <div className="xsky-chips" role="radiogroup" aria-label="กรอบข้อความ">
          {SKY_FRAMES.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={style.frame === id} className={style.frame === id ? "is-on" : ""} onClick={() => set("frame", id)}>
              {SKY_FRAME_INFO[id].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
