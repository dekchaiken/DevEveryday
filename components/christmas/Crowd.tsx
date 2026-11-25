"use client";

// ฝูงชนเงาอยู่เบื้องหลังฉาก: ใช้จำนวนคนออนไลน์ และชื่อจากคำอวยพร/ตุ๊กตาหิมะที่มีในห้อง
// ตำแหน่งกำหนดจากลำดับ (ไม่สุ่ม) เพื่อให้เซิร์ฟเวอร์และเบราว์เซอร์ตรงกัน
const MAX_FIGURES = 26;

// สัดส่วนเงาหนึ่งตัว: ยืนอยู่แนวขอบฟ้าของพื้นหิมะ (ด้านหลังฉาก) ยิ่งสูงยิ่งเล็กลง เพื่อให้ดูมีระยะลึก
function figureLayout(i: number, total: number) {
  const left = total <= 1 ? 50 : 3 + ((i * 97) % 94) * 0.94 + ((i * 13) % 7) * 0.1;
  const depth = ((i * 37) % 10) / 10; // 0..0.9
  return {
    left: Math.min(97, Math.max(2, left)),
    scale: 0.4 + depth * 0.35,
    bottom: 42 + depth * 9,
    delay: -((i * 0.73) % 4),
    opacity: 0.22 + depth * 0.16,
  };
}

export function Crowd({ count, names }: { count: number; names: string[] }) {
  const total = Math.min(MAX_FIGURES, Math.max(0, Math.round(count)));
  if (total === 0) return null;
  return (
    <div className="xmas-crowd" aria-hidden>
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
              animationDelay: `${l.delay}s`,
            }}
          >
            {label && <span className="xmas-crowd-name">{label}</span>}
            <svg viewBox="0 0 40 84" width="40" height="84">
              <circle cx="20" cy="12" r="9" fill="currentColor" />
              <path d="M6 84 V52 Q6 30 20 30 Q34 30 34 52 V84 Z" fill="currentColor" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
