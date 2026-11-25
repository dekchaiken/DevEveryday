import type { ReactElement } from "react";
import type { RoomTheme } from "@/lib/christmas/rooms";

// ฉากเบื้องหลังของแต่ละห้อง วาดด้วย SVG ล้วน ไม่ใช้ไฟล์ภาพภายนอก
// ไม่รับการคลิก และอยู่ด้านหลังต้นไม้ 3 มิติ
export function RoomSkyline({ kind }: { kind: RoomTheme["skyline"] }) {
  return (
    <svg className={`xmas-skyline xmas-skyline-${kind}`} viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
      {kind === "city" && <City />}
      {kind === "hills" && <Hills />}
      {kind === "rice" && <Rice />}
      {kind === "sea" && <Sea />}
    </svg>
  );
}

// ตึกกรุงเทพฯ: แถวตึกความสูงต่างกันพร้อมหน้าต่างไฟ
function City() {
  const blocks: ReactElement[] = [];
  let x = 0;
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  while (x < 1200) {
    const w = 28 + Math.floor(rand() * 46);
    const h = 40 + Math.floor(rand() * 120);
    blocks.push(<rect key={`b${x}`} x={x} y={200 - h} width={w} height={h} fill="currentColor" />);
    for (let wy = 200 - h + 10; wy < 190; wy += 14) {
      if (rand() > 0.55) blocks.push(<rect key={`w${x}-${wy}`} x={x + 6} y={wy} width={4} height={5} fill="#ffd77a" opacity={0.85} />);
    }
    x += w + 2;
  }
  // เจดีย์ที่ดูเป็นเอกลักษณ์ของกรุงเทพฯ
  blocks.push(<polygon key="tip" points="880,200 895,60 910,200" fill="currentColor" />);
  return <>{blocks}</>;
}

// ภูเขาและดอยหมอกของเชียงใหม่
function Hills() {
  return (
    <>
      <path d="M0 200 L0 120 L150 40 L300 110 L430 60 L600 130 L760 50 L900 120 L1050 70 L1200 130 L1200 200 Z" fill="currentColor" opacity="0.55" />
      <path d="M0 200 L0 150 L200 100 L380 150 L560 110 L780 160 L980 105 L1200 150 L1200 200 Z" fill="currentColor" opacity="0.85" />
    </>
  );
}

// ทุ่งนาและกระท่อมของขอนแก่น
function Rice() {
  return (
    <>
      <path d="M0 150 Q300 120 600 145 T1200 140 L1200 200 L0 200 Z" fill="currentColor" opacity="0.6" />
      <rect x="120" y="120" width="34" height="24" fill="currentColor" />
      <polygon points="112,120 137,96 162,120" fill="currentColor" />
      <rect x="870" y="110" width="40" height="30" fill="currentColor" />
      <polygon points="862,110 890,82 918,110" fill="currentColor" />
      <path d="M0 175 Q300 160 600 176 T1200 172 L1200 200 L0 200 Z" fill="currentColor" opacity="0.9" />
    </>
  );
}

// ชายหาดภูเก็ตพร้อมต้นมะพร้าวและคลื่น
function Sea() {
  return (
    <>
      <path d="M0 150 Q150 135 300 150 T600 150 T900 150 T1200 150 L1200 200 L0 200 Z" fill="currentColor" opacity="0.35" />
      <path d="M0 165 Q150 152 300 165 T600 165 T900 165 T1200 165 L1200 200 L0 200 Z" fill="currentColor" opacity="0.6" />
      <path d="M1040 170 Q1046 110 1032 60" stroke="currentColor" strokeWidth="6" fill="none" />
      <path d="M1032 60 Q1000 40 975 60 M1032 60 Q1060 35 1088 52 M1032 60 Q1010 26 1000 22 M1032 60 Q1055 22 1072 14" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
    </>
  );
}
