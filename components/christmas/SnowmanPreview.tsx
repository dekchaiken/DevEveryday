"use client";

import { useId } from "react";

export type SnowParts = {
  hat: string;
  scarf: string;
  nose: string;
  arms: string;
  body: string;
  legs: string;
  acc: string;
};

// สีของตัวหิมะ (ไล่สีจากแสงด้านบนซ้ายไปเงาด้านล่างขวา)
const BODY: Record<string, [string, string]> = {
  white: ["#ffffff", "#dbe7f0"],
  mint: ["#e6fbf1", "#a7e3c7"],
  sky: ["#eaf4ff", "#9cc9f0"],
  blush: ["#fff0f6", "#f2b6cf"],
  pearl: ["#fffaf0", "#e4cfa8"],
  ice: ["#f0fcff", "#8fd4ea"],
};
const SCARF: Record<string, [string, string]> = {
  red: ["#e8334f", "#8f1028"],
  green: ["#22a95a", "#0f5a2f"],
  gold: ["#fbd46b", "#b9862a"],
  blue: ["#3b82f6", "#1e3a8a"],
  white: ["#ffffff", "#c9d6e2"],
  plaid: ["#d6334c", "#7a1020"],
};

// ตุ๊กตาหิมะแบบ SVG สไตล์ flat ที่มีแสงและเงาเล็กน้อย ปรับตามชิ้นส่วนที่เลือก
export function SnowmanPreview({ parts, className }: { parts: SnowParts; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const [bodyLight, bodyDark] = BODY[parts.body] ?? BODY.white;
  const [scarfLight, scarfDark] = SCARF[parts.scarf] ?? SCARF.red;
  const bodyFill = `url(#b${uid})`;
  const scarfFill = `url(#s${uid})`;

  return (
    <svg viewBox="0 0 200 250" className={`xmas-snowman ${className ?? ""}`} role="img" aria-label="ตัวอย่างตุ๊กตาหิมะ">
      <defs>
        <radialGradient id={`b${uid}`} cx="35%" cy="28%" r="75%">
          <stop offset="0" stopColor={bodyLight} />
          <stop offset="0.75" stopColor={bodyLight} />
          <stop offset="1" stopColor={bodyDark} />
        </radialGradient>
        <linearGradient id={`s${uid}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={scarfLight} />
          <stop offset="1" stopColor={scarfDark} />
        </linearGradient>
        <radialGradient id={`g${uid}`} cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#ffd76a" />
          <stop offset="1" stopColor="#b9862a" />
        </radialGradient>
        <linearGradient id={`r${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#f04a62" />
          <stop offset="1" stopColor="#9d1130" />
        </linearGradient>
      </defs>

      {/* เงาพื้น */}
      <ellipse cx="100" cy="236" rx="80" ry="8" fill="rgba(15,30,40,0.35)" />

      {/* ฐาน/ขา */}
      {parts.legs === "snow" && <ellipse cx="100" cy="212" rx="66" ry="14" fill={bodyFill} />}
      {parts.legs === "boots" && (
        <>
          <rect x="68" y="204" width="26" height="28" rx="8" fill="#4a2f1d" />
          <rect x="106" y="204" width="26" height="28" rx="8" fill="#4a2f1d" />
          <rect x="66" y="222" width="30" height="8" rx="3" fill="#2a1a10" />
          <rect x="104" y="222" width="30" height="8" rx="3" fill="#2a1a10" />
        </>
      )}
      {parts.legs === "gift" && (
        <>
          <rect x="62" y="200" width="76" height="32" rx="4" fill={`url(#r${uid})`} />
          <rect x="95" y="200" width="10" height="32" fill="#f5c542" />
          <rect x="62" y="210" width="76" height="6" fill="#f5c542" opacity="0.9" />
        </>
      )}

      {/* ตัว 3 ท่อน */}
      <circle cx="100" cy="170" r="44" fill={bodyFill} />
      <circle cx="100" cy="112" r="34" fill={bodyFill} />
      <circle cx="100" cy="68" r="27" fill={bodyFill} />

      {/* แขน */}
      {parts.arms === "sticks" && (
        <g fill="none" stroke="#7a4a24" strokeLinecap="round">
          <path d="M67 118 Q46 110 30 92" strokeWidth="5" />
          <path d="M133 118 Q154 110 170 92" strokeWidth="5" />
          <path d="M30 92 L21 85 M30 92 L26 80 M30 92 L38 84" strokeWidth="3" />
          <path d="M170 92 L179 85 M170 92 L174 80 M170 92 L162 84" strokeWidth="3" />
        </g>
      )}
      {parts.arms === "wings" && (
        <>
          <ellipse cx="32" cy="128" rx="18" ry="9" fill={bodyFill} transform="rotate(-20 32 128)" />
          <ellipse cx="168" cy="128" rx="18" ry="9" fill={bodyFill} transform="rotate(20 168 128)" />
        </>
      )}
      {parts.arms === "gift" && (
        <>
          <path d="M67 118 Q46 110 30 92" fill="none" stroke="#7a4a24" strokeWidth="5" strokeLinecap="round" />
          <path d="M30 92 L21 85 M30 92 L26 80" fill="none" stroke="#7a4a24" strokeWidth="3" strokeLinecap="round" />
          <path d="M133 118 Q152 108 166 96" fill="none" stroke="#7a4a24" strokeWidth="5" strokeLinecap="round" />
          <rect x="156" y="74" width="24" height="22" rx="2.5" fill={`url(#r${uid})`} />
          <rect x="166" y="74" width="4" height="22" fill="#f5c542" />
          <rect x="156" y="82" width="24" height="3" fill="#f5c542" opacity="0.9" />
        </>
      )}

      {/* ตา */}
      <circle cx="90" cy="64" r="3.6" fill="#111" />
      <circle cx="110" cy="64" r="3.6" fill="#111" />
      <circle cx="91.2" cy="62.8" r="1.1" fill="#fff" />
      <circle cx="111.2" cy="62.8" r="1.1" fill="#fff" />

      {/* แว่นตา */}
      {parts.acc === "glasses" && (
        <g fill="none" stroke="#1f2937" strokeWidth="2.6">
          <circle cx="90" cy="64" r="9" fill="rgba(255,255,255,0.15)" />
          <circle cx="110" cy="64" r="9" fill="rgba(255,255,255,0.15)" />
          <path d="M99 64 H101" />
        </g>
      )}

      {/* จมูก */}
      {parts.nose === "carrot" && <path d="M100 70 L132 76 L100 80 Z" fill="#ff8a1f" />}
      {parts.nose === "button" && <circle cx="100" cy="76" r="5.2" fill={`url(#r${uid})`} />}
      {parts.nose === "star" && (
        <polygon points="100,66 103.4,73 111,73.6 105.2,78.2 107.2,85.8 100,81.4 92.8,85.8 94.8,78.2 89,73.6 96.6,73" fill={`url(#g${uid})`} />
      )}
      {parts.nose === "bell" && (
        <>
          <circle cx="100" cy="78" r="6" fill={`url(#g${uid})`} />
          <circle cx="100" cy="84" r="1.6" fill="#7a4a10" />
        </>
      )}

      {/* ผ้าพันคอ */}
      <path d="M72 96 Q100 116 128 96" fill="none" stroke={scarfFill} strokeWidth="11" strokeLinecap="round" />
      {parts.scarf === "plaid" && (
        <path d="M76 96 Q100 115 124 96" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" opacity="0.8" />
      )}
      <path d="M118 104 L124 126 L114 124 Z" fill={scarfFill} />
      {parts.acc === "wreath" && (
        <g>
          <path d="M70 104 Q100 130 130 104" fill="none" stroke="#15803d" strokeWidth="9" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={80 + i * 10} cy={116 + Math.sin((i / 4) * Math.PI) * 4} r="3.4" fill="#dc2643" />
          ))}
        </g>
      )}
      {parts.acc === "bell" && (
        <>
          <circle cx="120" cy="122" r="6" fill={`url(#g${uid})`} />
          <circle cx="120" cy="128" r="1.6" fill="#7a4a10" />
        </>
      )}
      {parts.acc === "bow" && (
        <>
          <path d="M84 118 L72 110 L72 126 Z" fill={`url(#r${uid})`} />
          <path d="M84 118 L96 110 L96 126 Z" fill={`url(#r${uid})`} />
          <circle cx="84" cy="118" r="3" fill="#7d0d24" />
        </>
      )}

      {/* หมวก */}
      {parts.hat === "tiara" && (
        <>
          <path d="M74 52 L80 40 L100 46 L120 40 L126 52 Z" fill={`url(#g${uid})`} />
          <circle cx="100" cy="44" r="4" fill="#dc2643" />
          <circle cx="88" cy="48" r="2.6" fill="#7dd3fc" />
          <circle cx="112" cy="48" r="2.6" fill="#7dd3fc" />
        </>
      )}
      {parts.hat === "antlers" && (
        <g fill="none" stroke="#7a4a24" strokeWidth="4" strokeLinecap="round">
          <path d="M84 48 Q76 30 66 26 M72 36 L64 30 M78 40 L70 40" />
          <path d="M116 48 Q124 30 134 26 M128 36 L136 30 M122 40 L130 40" />
        </g>
      )}
      {parts.hat === "elf" && (
        <>
          <path d="M74 54 Q100 -16 128 50 Z" fill="#16a34a" />
          <rect x="70" y="48" width="60" height="10" rx="5" fill="#ffffff" />
          <circle cx="126" cy="22" r="7" fill={`url(#g${uid})`} />
        </>
      )}
      {parts.hat === "top" && (
        <>
          <ellipse cx="100" cy="46" rx="36" ry="5" fill="#1f2937" />
          <rect x="80" y="14" width="40" height="32" rx="3" fill="#2b3442" />
          <rect x="80" y="36" width="40" height="5" fill="#dc2643" />
        </>
      )}
      {parts.hat === "beanie" && (
        <>
          <path d="M72 58 Q72 22 100 22 Q128 22 128 58 Z" fill={scarfFill} />
          <rect x="70" y="52" width="60" height="9" rx="4" fill="#fff" opacity="0.9" />
          <circle cx="100" cy="20" r="8" fill="#fff" />
        </>
      )}
      {parts.hat === "santa" && (
        <>
          <path d="M74 52 Q94 -4 136 36 L122 46 Z" fill={`url(#r${uid})`} />
          <circle cx="136" cy="36" r="8" fill="#fff" />
          <rect x="70" y="44" width="60" height="11" rx="5" fill="#fff" />
        </>
      )}
      {parts.hat === "crown" && (
        <>
          <path d="M72 52 L78 20 L90 38 L100 14 L110 38 L122 20 L128 52 Z" fill={`url(#g${uid})`} />
          <circle cx="100" cy="36" r="3" fill="#dc2643" />
          <circle cx="82" cy="44" r="2.4" fill="#22a95a" />
          <circle cx="118" cy="44" r="2.4" fill="#3b82f6" />
        </>
      )}
      {parts.hat === "pom" && (
        <>
          <path d="M72 58 Q72 26 100 26 Q128 26 128 58 Z" fill="#7dd3fc" />
          <path d="M72 52 H128 V60 H72 Z" fill="#ffffff" />
          <circle cx="100" cy="22" r="11" fill="#ffffff" />
        </>
      )}
      {parts.hat === "holly" && (
        <>
          <path d="M70 46 Q84 30 100 40 Q116 30 130 46 Q116 54 100 48 Q84 54 70 46 Z" fill="#16a34a" />
          <circle cx="90" cy="44" r="4" fill="#dc2643" />
          <circle cx="110" cy="44" r="4" fill="#dc2643" />
        </>
      )}
    </svg>
  );
}
