// ภาพตัวอย่างบ้านหิมะ Exclusive แบบ SVG ให้ตรงกับบ้านที่แสดงบนฉากจริง (สีผนังและสีไฟตามที่เลือก)
import { GIANT_BODY_HEX, GIANT_LIGHT_HEX, type GiantLook } from "@/lib/christmas/giant";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

// จุดไฟเรียงตามขอบสี่เหลี่ยม ใช้กับประตูและหน้าต่าง
function outline(x0: number, y0: number, x1: number, y1: number, step = 9): [number, number][] {
  const out: [number, number][] = [];
  for (let x = x0; x <= x1; x += step) {
    out.push([x, y0], [x, y1]);
  }
  for (let y = y0 + step; y < y1; y += step) {
    out.push([x0, y], [x1, y]);
  }
  return out;
}

export function CottagePreview({ look, className }: { look: GiantLook; className?: string }) {
  const wall = hex(GIANT_BODY_HEX[look.body] ?? GIANT_BODY_HEX.cream);
  const palette = (GIANT_LIGHT_HEX[look.lights] ?? GIANT_LIGHT_HEX.red).map(hex);
  const bulbs = [...outline(104, 150, 136, 212), ...outline(60, 138, 92, 170), ...outline(148, 138, 180, 170), ...outline(34, 118, 206, 118, 14)];

  return (
    <svg viewBox="0 0 240 230" className={`xmas-snowman xmas-cottage ${className ?? ""}`} role="img" aria-label="ตัวอย่างบ้านหิมะ">
      <ellipse cx="120" cy="214" rx="104" ry="11" fill="#eef6fb" opacity="0.9" />
      <rect x="160" y="50" width="18" height="44" fill="#9b3a2b" />
      <rect x="156" y="46" width="26" height="7" fill="#6b2a20" />
      <rect x="50" y="110" width="140" height="104" fill={wall} />
      <polygon points="30,118 120,40 210,118" fill="#f4f8ff" stroke="#c9d6e8" strokeWidth="2" strokeLinejoin="round" />
      <rect x="104" y="150" width="32" height="64" fill="#5b1a1f" />
      <circle cx="120" cy="140" r="9" fill="none" stroke="#1f7a3a" strokeWidth="3" />
      <rect x="60" y="138" width="32" height="32" fill="#ffd166" />
      <rect x="148" y="138" width="32" height="32" fill="#ffd166" />
      <path d="M76 138v32M60 154h32M164 138v32M148 154h32" stroke="#7a4a24" strokeWidth="3" />
      <circle cx="120" cy="100" r="9" fill="#ffd166" />
      <path d="M112 100h16" stroke="#7a4a24" strokeWidth="2" />
      {bulbs.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={palette[i % palette.length]} />
      ))}
      <rect x="40" y="152" width="8" height="18" fill="#3b2a1a" />
      <rect x="36" y="142" width="16" height="12" fill="#ffd166" />
      <rect x="192" y="152" width="8" height="18" fill="#3b2a1a" />
      <rect x="188" y="142" width="16" height="12" fill="#ffd166" />
    </svg>
  );
}
