"use client";

// ฉากเบื้องหลัง: พระจันทร์ เนินเขาไกล และฝูงชนเงาที่ยืนอยู่แนวขอบฟ้า
// จำนวนคนอิงจากผู้ใช้ออนไลน์จริง ชื่อดึงจากคำอวยพรและตุ๊กตาหิมะของห้อง
// ตำแหน่งกำหนดจากลำดับ (ไม่สุ่ม) เพื่อให้เซิร์ฟเวอร์และเบราว์เซอร์ตรงกัน
const MAX_FIGURES = 26;

type Variant = "adult" | "hat" | "child" | "bag";

const VARIANTS: Variant[] = ["adult", "hat", "adult", "bag", "child", "hat", "adult", "bag"];

// ตัวละครเงาแต่ละแบบ (viewBox 40x84 ฐานอยู่ล่างสุด)
function Silhouette({ variant }: { variant: Variant }) {
  return (
    <svg viewBox="0 0 40 84" width="40" height="84" aria-hidden>
      {variant === "child" ? (
        <>
          <circle cx="20" cy="22" r="8" fill="currentColor" />
          <path d="M9 84 V58 Q9 40 20 40 Q31 40 31 58 V84 Z" fill="currentColor" />
        </>
      ) : (
        <>
          <circle cx="20" cy="12" r="9" fill="currentColor" />
          <path d="M6 84 V52 Q6 30 20 30 Q34 30 34 52 V84 Z" fill="currentColor" />
          {variant === "hat" && <path d="M10.5 6 Q20 -3 29.5 6 Z" fill="currentColor" />}
          {variant === "hat" && <circle cx="20" cy="-1" r="3" fill="currentColor" />}
          {variant === "bag" && <rect x="26" y="46" width="11" height="15" rx="2" fill="currentColor" />}
        </>
      )}
    </svg>
  );
}

// ตำแหน่ง ขนาด และความจางของคนแต่ละคน (ยิ่งอยู่ไกลยิ่งเล็กและจาง)
function figureLayout(i: number, total: number) {
  const left = total <= 1 ? 50 : 2 + ((i * 97) % 94) * 0.96 + ((i * 13) % 7) * 0.08;
  const depth = ((i * 37) % 10) / 10; // 0 ไกล .. 0.9 ใกล้
  return {
    left: Math.min(98, Math.max(1, left)),
    scale: 0.42 + depth * 0.42,
    bottom: 51 + depth * 6,
    delay: -((i * 0.73) % 4),
    opacity: 0.5 + depth * 0.35,
    blur: depth < 0.35 ? 1.2 : 0,
    variant: VARIANTS[i % VARIANTS.length],
  };
}

export function Crowd({ count, names }: { count: number; names: string[] }) {
  const total = Math.min(MAX_FIGURES, Math.max(0, Math.round(count)));
  return (
    <div className="xmas-crowd" aria-hidden>
      <div className="xmas-moon" />
      <svg className="xmas-hills" viewBox="0 0 1600 300" preserveAspectRatio="none">
        <path className="xmas-hills-far" d="M0 180 C160 120 260 150 380 118 C520 80 620 150 760 128 C900 104 1010 160 1160 122 C1300 88 1420 140 1600 110 V300 H0 Z" />
        <path className="xmas-hills-near" d="M0 230 C200 190 320 220 480 200 C640 178 760 230 940 208 C1120 186 1240 232 1420 206 C1500 196 1560 210 1600 204 V300 H0 Z" />
      </svg>
      {Array.from({ length: total }, (_, i) => {
        const l = figureLayout(i, total);
        const label = names.length ? names[i % names.length] : "";
        return (
          <div
            key={i}
            className="xmas-crowd-fig"
            style={{
              left: `${l.left}%`,
              bottom: `${l.bottom}%`,
              transform: `scale(${l.scale})`,
              opacity: l.opacity,
              filter: l.blur ? `blur(${l.blur}px)` : undefined,
              animationDelay: `${l.delay}s`,
            }}
          >
            {label && <span className="xmas-crowd-name">{label}</span>}
            <Silhouette variant={l.variant} />
          </div>
        );
      })}
    </div>
  );
}
