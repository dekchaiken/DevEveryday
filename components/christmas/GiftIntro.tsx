"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { consumeSkipIntro } from "./skipIntro";
import GiftBox3D from "./GiftBox3D";
import "./christmas.css";

// play: รอให้แตะ · open: แกะโบว์และเปิดฝา · leaving: วาบเข้าหน้าหลักแล้วฉากจาง · done: แสดงหน้าหลัก
type Phase = "play" | "open" | "leaving" | "done";

const LEAVE_MS = 900; // ระยะเวลาที่ฉากของขวัญจางออกพร้อมหน้าหลักที่จางเข้า

// เปิดตัวด้วยกล่องของขวัญ 3 มิติ: ต้องแตะเพื่อแกะ (ไม่เปิดเองอัตโนมัติ) แล้ววาบเข้าหน้าหลัก
// เล่นทุกครั้งที่โหลดหน้าหรือรีเฟรช และข้ามได้ตลอดเวลา
export default function GiftIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("play");

  // ก่อนวาดหน้าจอ: ถ้าเป็นการเปลี่ยนห้องภายในเว็บ ข้ามกล่องไปเลย
  useLayoutEffect(() => {
    if (consumeSkipIntro()) setPhase("done");
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("done"), LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const open = () => setPhase((p) => (p === "play" ? "open" : p));
  const finish = () => setPhase((p) => (p === "open" ? "leaving" : p));
  const skip = () => setPhase("done");

  return (
    <>
      <div className={`xmas-gift-under ${phase === "leaving" || phase === "done" ? "is-shown" : ""}`}>{children}</div>

      {phase !== "done" && (
        <div
          className={`xmas-gift ${phase === "open" ? "is-opening" : ""} ${phase === "leaving" ? "is-leaving" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="เปิดของขวัญคริสต์มาส"
        >
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

          <GiftBox3D opening={phase === "open"} onOpen={open} onFinish={finish} />

          <p className="xmas-gift-hint">{phase === "play" ? "แตะกล่องเพื่อแกะของขวัญ" : "ของขวัญของคุณ…"}</p>

          {phase === "play" && (
            <button className="xmas-gift-skip" onClick={skip}>
              ข้าม
            </button>
          )}
        </div>
      )}
    </>
  );
}
