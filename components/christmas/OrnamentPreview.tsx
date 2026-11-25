"use client";

import { useId } from "react";
import type { OrnamentColor, OrnamentShape } from "@/lib/christmas/types";

// ตัวอย่างลูกบอลแบบ SVG สไตล์เดียวกับตุ๊กตาหิมะ มีแสงสะท้อนและเงาเบา ๆ
const PAIR: Record<OrnamentColor, [string, string]> = {
  gold: ["#fff1b8", "#b9862a"],
  red: ["#ff6b7f", "#8f1028"],
  blue: ["#93c5fd", "#1e3a8a"],
  pink: ["#fbcfe8", "#be185d"],
  white: ["#ffffff", "#c9d6e2"],
  green: ["#86efac", "#166534"],
};

export function OrnamentPreview({ color, shape }: { color: OrnamentColor; shape: OrnamentShape }) {
  const uid = useId().replace(/:/g, "");
  const [light, dark] = PAIR[color];
  const fill = `url(#o${uid})`;
  return (
    <svg viewBox="0 0 200 200" className="xmas-ornament-art" role="img" aria-label={`ตัวอย่างลูกบอล ${shape}`}>
      <defs>
        <radialGradient id={`o${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <path d="M100 0 L100 36" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="3 3" />
      <ellipse cx="100" cy="186" rx="52" ry="6" fill="rgba(0,0,0,0.3)" />
      {shape === "ball" && (
        <>
          <circle cx="100" cy="110" r="58" fill={fill} />
          <ellipse cx="78" cy="88" rx="14" ry="9" fill="rgba(255,255,255,0.55)" transform="rotate(-25 78 88)" />
        </>
      )}
      {shape === "star" && (
        <path d="M100 52 L115 92 L158 96 L124 122 L134 164 L100 140 L66 164 L76 122 L42 96 L85 92 Z" fill={fill} stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinejoin="round" />
      )}
      {shape === "bell" && (
        <>
          <path d="M100 46 Q140 46 146 112 Q152 140 166 150 L34 150 Q48 140 54 112 Q60 46 100 46 Z" fill={fill} />
          <circle cx="100" cy="158" r="10" fill={dark} />
          <ellipse cx="82" cy="98" rx="8" ry="16" fill="rgba(255,255,255,0.45)" transform="rotate(12 82 98)" />
        </>
      )}
      {shape === "gift" && (
        <>
          <rect x="52" y="82" width="96" height="88" rx="6" fill={fill} />
          <rect x="46" y="66" width="108" height="22" rx="5" fill={fill} />
          <rect x="93" y="66" width="14" height="104" fill="#f5c542" />
          <rect x="46" y="80" width="108" height="6" fill="#f5c542" opacity="0.9" />
        </>
      )}
    </svg>
  );
}
