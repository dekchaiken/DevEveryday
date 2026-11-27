"use client";

// การ์ดของบ้านหิมะ Exclusive ที่แตะบนฉาก: ข้อความบนป้าย และลิงก์โซเชียลของเจ้าของ
import { socialLinks, type Social } from "@/lib/christmas/social";

export type GiantInfo = { name: string; message: string; spot: number; social?: Social };

export function GiantCard({ info, onClose }: { info: GiantInfo; onClose: () => void }) {
  const links = socialLinks(info.social ?? null);
  return (
    <div className="xmas-giant-card-back" role="presentation" onClick={onClose}>
      <div className="xmas-giant-card" role="dialog" aria-label={`บ้านของ ${info.name}`} onClick={(e) => e.stopPropagation()}>
        <p className="xmas-giant-card-kicker">บ้านหิมะ Exclusive · จุดที่ {info.spot + 1}</p>
        <h3>{info.name}</h3>
        <p className="xmas-giant-card-sign">{info.message || "ขอให้ทุกคนมีความสุขในวันคริสต์มาส"}</p>
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
          ปิด
        </button>
      </div>
    </div>
  );
}
