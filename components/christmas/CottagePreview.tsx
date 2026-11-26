// ภาพตัวอย่างบ้านหิมะ Exclusive แบบ SVG ให้ตรงกับบ้านบนฉากจริง (สีผนัง สีไฟ และของตกแต่งตามที่เลือก)
import { DECO_SLOTS, GIANT_BODY_HEX, GIANT_LIGHT_HEX, type GiantLook } from "@/lib/christmas/giant";

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

// ตำแหน่งของตกแต่งในภาพ ตรงกับจุดวางจริงในฉาก (ซ้ายและขวาของประตู หน้าสุด และยอดหลังคา)
const DECO_POS: [number, number][] = [
  [58, 222],
  [182, 222],
  [22, 226],
  [218, 226],
  [120, 26],
];

function DecoIcon({ kind, x, y, i }: { kind: string; x: number; y: number; i: number }) {
  switch (kind) {
    case "gift":
      return (
        <g transform={`translate(${x},${y}) scale(1.6)`}>
          <rect x="-11" y="-14" width="22" height="16" fill={i % 2 ? "#3b82f6" : "#dc2643"} />
          <rect x="-11" y="-8" width="22" height="3" fill="#f5c542" />
          <rect x="-2" y="-14" width="4" height="16" fill="#f5c542" />
        </g>
      );
    case "snowman":
      return (
        <g transform={`translate(${x},${y}) scale(1.6)`}>
          <circle cx="0" cy="-6" r="5" fill="#ffffff" stroke="#c9d6e8" />
          <circle cx="0" cy="-17" r="4" fill="#ffffff" stroke="#c9d6e8" />
          <rect x="-4" y="-25" width="8" height="5" fill="#1f2937" />
        </g>
      );
    case "pine":
      return (
        <g transform={`translate(${x},${y}) scale(1.6)`}>
          <polygon points="0,-30 10,0 -10,0" fill="#0f3d24" />
          <polygon points="0,-30 5,-18 -5,-18" fill="#eef5fb" />
        </g>
      );
    case "candy":
      return (
        <g transform={`translate(${x},${y}) scale(1.6)`}>
          <path d="M-3 0 V-20 Q-3 -26 3 -24" fill="none" stroke="#dc2643" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "lantern":
      return (
        <g transform={`translate(${x},${y}) scale(1.6)`}>
          <rect x="-5" y="-14" width="10" height="13" fill="#ffd166" />
          <polygon points="-7,-14 7,-14 0,-19" fill="#2b2118" />
        </g>
      );
    case "star":
      return (
        <polygon
          transform={`translate(${x},${y}) scale(1.6)`}
          points="0,-13 4,-4 13,-4 6,2 8,11 0,6 -8,11 -6,2 -13,-4 -4,-4"
          fill="#f5c542"
          stroke="#b98a2a"
          strokeWidth="1"
        />
      );
    default:
      return null;
  }
}

export function CottagePreview({ look, className }: { look: GiantLook; className?: string }) {
  const wall = hex(GIANT_BODY_HEX[look.body] ?? GIANT_BODY_HEX.cream);
  const palette = (GIANT_LIGHT_HEX[look.lights] ?? GIANT_LIGHT_HEX.red).map(hex);
  const bulbs = [...outline(104, 150, 136, 212), ...outline(60, 138, 92, 170), ...outline(148, 138, 180, 170), ...outline(34, 118, 206, 118, 14)];

  return (
    <svg viewBox="0 0 240 240" className={`xmas-snowman xmas-cottage ${className ?? ""}`} role="img" aria-label="ตัวอย่างบ้านหิมะ">
      <ellipse cx="120" cy="222" rx="112" ry="10" fill="#eef6fb" opacity="0.9" />
      <rect x="160" y="50" width="18" height="44" fill="#9b3a2b" />
      <rect x="156" y="46" width="26" height="7" fill="#6b2a20" />
      <rect x="50" y="110" width="140" height="104" fill={wall} />
      <polygon points="30,118 120,40 210,118" fill="#f4f8ff" stroke="#c9d6e8" strokeWidth="2" strokeLinejoin="round" />
      <rect x="104" y="150" width="32" height="64" fill="#7a1d2a" />
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
      {Array.from({ length: DECO_SLOTS }, (_, i) => (
        <DecoIcon key={i} kind={look.deco?.[i] ?? "none"} x={DECO_POS[i][0]} y={DECO_POS[i][1]} i={i} />
      ))}
    </svg>
  );
}
