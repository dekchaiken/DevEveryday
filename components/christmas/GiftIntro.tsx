"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { consumeSkipIntro } from "./skipIntro";
import "./christmas.css";

type Phase = "play" | "open" | "done";

const AUTO_OPEN_MS = 4200; // เปิดกล่องเองถ้าผู้ใช้ไม่กด
const REVEAL_MS = 1500; // ระยะเวลาเปลี่ยนจากกล่องเข้าสู่หน้าเว็บ

// เปิดตัวด้วยกล่องของขวัญคริสต์มาสที่ถูกแกะออก ก่อนเข้าสู่หน้าเว็บ
// เล่นทุกครั้งที่โหลดหน้าหรือรีเฟรช และข้ามได้ตลอดเวลา
export default function GiftIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("play");

  // ก่อนวาดหน้าจอ: ถ้าเป็นการเปลี่ยนห้องภายในเว็บ ข้ามกล่องไปเลย
  useLayoutEffect(() => {
    if (consumeSkipIntro()) setPhase("done");
  }, []);

  function open() {
    setPhase((p) => (p === "play" ? "open" : p));
  }

  useEffect(() => {
    if (phase === "play") {
      const t = setTimeout(open, AUTO_OPEN_MS);
      return () => clearTimeout(t);
    }
    if (phase === "open") {
      const t = setTimeout(() => {
        setPhase("done");
      }, REVEAL_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const skip = () => setPhase("done");

  return (
    <>
      <div className={`xmas-gift-under ${phase === "done" ? "is-shown" : ""}`}>{children}</div>

      {phase !== "done" && (
        <div className={`xmas-gift ${phase === "open" ? "is-opening" : ""}`} role="dialog" aria-modal="true" aria-label="เปิดของขวัญคริสต์มาส">
          <div className="xmas-gift-stars" aria-hidden />
          <div className="xmas-gift-burst" aria-hidden />

          <div className="xmas-gift-title">
            <p className="xmas-gift-thai">สุขสันต์วันคริสต์มาส</p>
            <h1>
              {"Merry Christmas".split("").map((ch, i) => (
                <span key={i} style={{ animationDelay: `${0.25 + i * 0.045}s` }}>
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </h1>
          </div>

          <button className="xmas-gift-box gb3" onClick={open} aria-label="แตะเพื่อแกะของขวัญ">
            <span className="gb3-scene" aria-hidden>
              <span className="gb3-glow" />
              <span className="gb3-box">
                <span className="gb3-face gb3-front">
                  <i className="gb3-rib-v" />
                  <i className="gb3-rib-h" />
                </span>
                <span className="gb3-face gb3-back" />
                <span className="gb3-face gb3-left">
                  <i className="gb3-rib-v" />
                </span>
                <span className="gb3-face gb3-right">
                  <i className="gb3-rib-v" />
                </span>
                <span className="gb3-face gb3-bottom" />
                <span className="gb3-lid">
                  <i className="gb3-rib-v" />
                  <span className="gb3-bow">
                    <i className="gb3-loop gb3-loop-l" />
                    <i className="gb3-loop gb3-loop-r" />
                    <i className="gb3-knot" />
                  </span>
                </span>
              </span>
              <span className="gb3-shadow" />
              <span className="gb3-flash" />
            </span>
          </button>

          <p className="xmas-gift-hint">{phase === "play" ? "แตะกล่องเพื่อแกะของขวัญ" : "ของขวัญของคุณ…"}</p>

          {Array.from({ length: 36 }).map((_, i) => (
            <span
              key={i}
              className="xmas-gift-spark"
              style={
                {
                  "--dx": `${(Math.cos((i / 36) * Math.PI * 2) * (90 + (i % 5) * 26)).toFixed(2)}px`,
                  "--dy": `${(Math.sin((i / 36) * Math.PI * 2) * (90 + (i % 5) * 26)).toFixed(2)}px`,
                  "--d": `${(i % 6) * 40}ms`,
                  "--c": ["#f5c542", "#dc2643", "#7ee7b0", "#ffffff", "#38bdf8"][i % 5],
                } as React.CSSProperties
              }
              aria-hidden
            />
          ))}

          <button className="xmas-gift-skip" onClick={skip}>
            ข้าม
          </button>
        </div>
      )}
    </>
  );
}
