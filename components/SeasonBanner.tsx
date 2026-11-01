"use client";

import { useEffect, useState } from "react";
import type { LandingSeason } from "@/lib/types";
import { inSeason, mdOf } from "@/lib/seasons";

// แถบประกาศเทศกาลของหน้าแรก และเปลี่ยนสีหลักของเว็บตามเทศกาลที่ตรงกับวันนี้
export function SeasonBanner({ seasons }: { seasons: LandingSeason[] }) {
  const [season, setSeason] = useState<LandingSeason | null>(null);

  useEffect(() => {
    const md = mdOf(new Date());
    const found = seasons.find((s) => s.active && inSeason(s, md)) ?? null;
    setSeason(found);
    if (!found) return;
    const root = document.documentElement;
    root.style.setProperty("--accent", found.accent);
    root.style.setProperty("--glow", `color-mix(in srgb, ${found.accent} 30%, transparent)`);
    return () => {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--glow");
    };
  }, [seasons]);

  if (!season) return null;
  return (
    <div className="season-bar" role="status">
      {season.badge && <b>{season.badge}</b>}
      <span>{season.announcement}</span>
    </div>
  );
}
