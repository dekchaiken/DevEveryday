"use client";

// การ์ดบ้านหิมะ Exclusive: โครงเดียวกับการ์ดตุ๊กตาหิมะที่ตกแต่งเอง (โทนครีมกระจก) เพิ่มขอบฟอยล์และกรอบทอง
// ดูบ้าน 3 มิติได้ หมุนได้ด้วยการลากหรือปุ่มหมุน ป้ายและข้อความอยู่ในแบนเนอร์ด้านบน
import { useRef } from "react";
import { DioramaViewer } from "./DioramaViewer";
import { Icon } from "./Icon";
import { SocialLinks } from "./ProfileCard";
import type { Social } from "@/lib/christmas/social";
import type { GiantLook } from "@/lib/christmas/giant";

export type GiantInfo = { name: string; message: string; spot: number; social?: Social; look?: GiantLook };

// สีป้ายที่เจ้าของเลือกตอนตกแต่ง (ตรงกับตัวเลือกในฟอร์ม) ใช้กับแบนเนอร์และการ์ด
export function boardOf(info: GiantInfo): string {
  const b = info.look?.board;
  return b === "ivory" || b === "berry" || b === "gold" ? b : "spruce";
}

export function GiantCard({ info, onClose }: { info: GiantInfo; onClose: () => void }) {
  const turnRef = useRef<((rad: number) => void) | null>(null);
  const look: GiantLook = info.look ?? { base: "pink", items: [], board: "spruce" };
  return (
    <div className={`xmas-focus glass xmas-decor-card xmas-giant-card board-${boardOf(info)}`} role="dialog" aria-label={`บ้านของ ${info.name}`}>
      <button className="xmas-x" onClick={onClose} aria-label="ปิด">
        <Icon name="close" size={18} />
      </button>
      <span className="xmas-giant-badge">EXCLUSIVE · จุดที่ {info.spot + 1}</span>
      <div className="xmas-giant-art">
        <DioramaViewer
          look={look}
          name={info.name}
          message={info.message}
          selectedId={null}
          onSelect={() => {}}
          onMove={() => {}}
          readOnly
          turnRef={turnRef}
        />
      </div>
      <div className="xmas-giant-turn">
        <button type="button" onClick={() => turnRef.current?.(-Math.PI / 4)}>
          หมุนซ้าย
        </button>
        <button type="button" onClick={() => turnRef.current?.(Math.PI / 4)}>
          หมุนขวา
        </button>
      </div>
      <b className="xmas-decor-card-name xmas-giant-name">{info.name}</b>
      <SocialLinks social={info.social} />
      <button type="button" className="xmas-giant-close" onClick={onClose}>
        กลับมุมหลัก
      </button>
    </div>
  );
}

// แบนเนอร์ป้ายประจำบ้านด้านบนกลางจอ: ข้อความบนป้ายและชื่อเจ้าของ กรอบฟอยล์ทอง
export function GiantBanner({ info }: { info: GiantInfo }) {
  return (
    <div className={`xmas-giant-banner board-${boardOf(info)}`} role="status" aria-label="ป้ายประจำบ้าน">
      <span className="xmas-giant-banner-kicker">ป้ายประจำบ้าน · {info.name}</span>
      <p>{info.message || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส"}</p>
    </div>
  );
}
