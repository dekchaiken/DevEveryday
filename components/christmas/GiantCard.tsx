"use client";

// การ์ดบ้านหิมะ Exclusive ที่แตะบนฉาก: ดูบ้านได้ 3 มิติ อ่านข้อความบนป้าย และลิงก์ของเจ้าของ
// โทนสปรูซและฟอยล์ทอง เหมือนแพ็กเกจพรีเมียม ปุ่มปิดจะพากล้องกลับมุมหลักเดิม
import { DioramaViewer } from "./DioramaViewer";
import { socialLinks, type Social } from "@/lib/christmas/social";
import type { GiantLook } from "@/lib/christmas/giant";

export type GiantInfo = { name: string; message: string; spot: number; social?: Social; look?: GiantLook };

export function GiantCard({ info, onClose }: { info: GiantInfo; onClose: () => void }) {
  const links = socialLinks(info.social ?? null);
  const look: GiantLook = info.look ?? { base: "pink", items: [], board: "spruce" };
  return (
    <div className="xmas-giant-card-back" role="presentation" onClick={onClose}>
      <div className="xmas-giant-card" role="dialog" aria-label={`บ้านของ ${info.name}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="xmas-giant-card-x" onClick={onClose} aria-label="ปิด">
          ×
        </button>
        <span className="xmas-giant-card-badge">EXCLUSIVE · จุดที่ {info.spot + 1}</span>
        <div className="xmas-giant-card-art">
          <DioramaViewer
            look={look}
            name={info.name}
            message={info.message || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส"}
            selectedId={null}
            onSelect={() => {}}
            onMove={() => {}}
            readOnly
          />
        </div>
        <h3 className="xmas-giant-card-name">{info.name}</h3>
        <div className="xmas-giant-card-sign">
          <p>{info.message || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส"}</p>
        </div>
        {links.length > 0 && (
          <div className="xmas-giant-card-links">
            {links.map((l) =>
              l.href ? (
                <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              ) : (
                <span key={l.key}>{l.label}</span>
              ),
            )}
          </div>
        )}
        <button type="button" className="xmas-giant-card-close" onClick={onClose}>
          กลับมุมหลัก
        </button>
      </div>
    </div>
  );
}
