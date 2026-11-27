"use client";

// ป้ายประจำบ้านด้านบนกลางจอ: แสดงเฉพาะเมื่อผู้ใช้กด "ดูป้าย" จากคำอธิบายข้างบ้าน
// ไม่มีโมเดล 3 มิติในการ์ด เพื่อไม่ให้บังบ้านที่อยากดูอยู่
import { SocialLinks } from "./ProfileCard";
import type { Social } from "@/lib/christmas/social";
import type { GiantLook } from "@/lib/christmas/giant";

export type GiantInfo = { name: string; message: string; spot: number; social?: Social; look?: GiantLook };

// สีป้ายที่เจ้าของเลือกตอนตกแต่ง (ตรงกับตัวเลือกในฟอร์ม)
export function boardOf(info: GiantInfo): string {
  const b = info.look?.board;
  return b === "ivory" || b === "berry" || b === "gold" ? b : "spruce";
}

// สีลายของฐาน (ใช้เป็นแถบสีที่ขอบล่างของป้าย)
export function baseColorOf(info: GiantInfo): string {
  const key = info.look?.base ?? "pink";
  const colors: Record<string, string> = { pink: "#f9a8c4", mint: "#86e0b8", red: "#e0465a", blue: "#8ec5ff" };
  return colors[key] ?? colors.pink;
}

export function GiantBanner({ info, onClose }: { info: GiantInfo; onClose: () => void }) {
  return (
    <div
      className={`xmas-giant-banner board-${boardOf(info)}`}
      style={{ ["--base" as string]: baseColorOf(info) }}
      role="dialog"
      aria-label={`ป้ายประจำบ้านของ ${info.name}`}
    >
      <button type="button" className="xmas-giant-banner-x" onClick={onClose} aria-label="ปิดป้าย">
        ×
      </button>
      <span className="xmas-giant-banner-kicker">ป้ายประจำบ้าน · จุดที่ {info.spot + 1}</span>
      <b className="xmas-giant-banner-name">{info.name}</b>
      <p>{info.message || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส"}</p>
      <SocialLinks social={info.social} />
      <button type="button" className="xmas-giant-close" onClick={onClose}>
        กลับมุมหลัก
      </button>
    </div>
  );
}
