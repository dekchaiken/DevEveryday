"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { consumeSkipIntro } from "./skipIntro";
import SnowGlobe3D from "./SnowGlobe3D";
import "./christmas.css";

// play: รอให้แตะ · open: ลูกแก้วสั่นและกล้องพุ่งเข้าไป · leaving: แสงทองจางเผยหน้าหลัก · done: แสดงหน้าหลัก
type Phase = "play" | "open" | "leaving" | "done";

const LEAVE_MS = 900; // ระยะเวลาแสงทองจางหาย (ตรงกับ .xmas-gift.is-leaving ใน christmas.css)

// หน้าเปิดเป็นลูกแก้วหิมะ 3 มิติ: ต้องแตะเพื่อเข้า (ไม่เข้าเองอัตโนมัติ) ข้ามได้ตลอด
// ระหว่างหน้าเปิด ฉากหลักสร้างเสร็จแล้วแต่หยุดวาดไว้ (html[data-intro="on"]) เครื่องจึงวาดภาพเดียวและลื่นตลอด
// ลูกแก้วเริ่มวาดหลังฉากหลักสร้างเสร็จ (หรือเกิน 2.5 วินาที) ช่วงสร้างฉากที่หนักจึงไม่ทำให้ลูกแก้วกระตุก
export default function GiftIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("play");
  const [globeOn, setGlobeOn] = useState(false);
  const flashRef = useRef<HTMLDivElement>(null);

  // ก่อนวาดหน้าจอ: ถ้าเป็นการเปลี่ยนห้องภายในเว็บ ข้ามหน้าเปิดไปเลย
  useLayoutEffect(() => {
    if (consumeSkipIntro()) setPhase("done");
    else document.documentElement.dataset.intro = "on";
  }, []);

  // ฉากหลักพร้อมเมื่อไหร่ค่อยเริ่มลูกแก้ว
  useEffect(() => {
    if (phase === "done") return;
    if (document.documentElement.dataset.sceneReady === "1") {
      setGlobeOn(true);
      return;
    }
    const on = () => setGlobeOn(true);
    window.addEventListener("xmas-scene-ready", on);
    const t = window.setTimeout(on, 2500);
    return () => {
      window.removeEventListener("xmas-scene-ready", on);
      window.clearTimeout(t);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "leaving" || phase === "done") delete document.documentElement.dataset.intro;
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("done"), LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // บอกหน้าหลักว่าหน้าเปิดจบแล้ว เพื่อให้คู่มือการใช้งานเริ่มหลังจากนั้น
  useEffect(() => {
    if (phase !== "done") return;
    document.documentElement.dataset.giftDone = "1";
    window.dispatchEvent(new Event("xmas-gift-done"));
  }, [phase]);

  const open = () => setPhase((p) => (p === "play" && globeOn ? "open" : p));
  const finish = () => setPhase((p) => (p === "open" ? "leaving" : p));
  const skip = () => setPhase("done");

  return (
    <>
      <div className={`xmas-gift-under ${phase === "leaving" || phase === "done" ? "is-shown" : ""}`}>{children}</div>

      {phase !== "done" && (
        <div
          className={`xmas-gift is-globe ${globeOn ? "is-ready" : ""} ${phase === "open" ? "is-opening" : ""} ${phase === "leaving" ? "is-leaving" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="เข้าสู่ลานคริสต์มาส"
        >
          <div className="xmas-globe-bokeh" aria-hidden />
          <div className="xmas-gift-title">
            <p className="xmas-gift-thai">สุขสันต์วันคริสต์มาส</p>
            <h1>
              {"Merry Christmas".split("").map((ch, i) => (
                <span key={i} style={{ animationDelay: `${0.25 + i * 0.045}s` }}>
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </h1>
          </div>

          {globeOn && (
            <SnowGlobe3D
              opening={phase === "open"}
              onOpen={open}
              onFinish={finish}
              onFlash={(k) => {
                if (flashRef.current) flashRef.current.style.opacity = String(k);
              }}
            />
          )}

          <p className="xmas-gift-hint">{!globeOn ? "กำลังเตรียมลานคริสต์มาส…" : phase === "play" ? "แตะลูกแก้วหิมะเพื่อเข้าสู่ลานคริสต์มาส" : ""}</p>

          {phase === "play" && (
            <button className="xmas-gift-skip" onClick={skip}>
              ข้าม
            </button>
          )}
          <div ref={flashRef} className="xmas-globe-flash" aria-hidden />
        </div>
      )}
    </>
  );
}
