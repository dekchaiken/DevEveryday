// ของตกแต่งตามเทศกาล วาดด้วย SVG ล้วน ไม่ใช้ไฟล์ภาพภายนอก
// ทุกชิ้นเป็น pointer-events: none ไม่บังการคลิกของเนื้อหา

// ใยแมงมุมมุมหนึ่ง: เส้นรัศมีจากมุม และวงโค้งซ้อนกัน
function cobwebPath(size: number) {
  const rings = [0.2, 0.38, 0.56, 0.74, 0.92];
  const spokes = [0, 22, 45, 68, 90];
  const parts: string[] = [];
  for (const a of spokes) {
    const rad = (a * Math.PI) / 180;
    parts.push(`M0 0 L${(Math.cos(rad) * size).toFixed(1)} ${(Math.sin(rad) * size).toFixed(1)}`);
  }
  for (const r of rings) {
    const R = size * r;
    const pts = spokes.map((a) => {
      const rad = (a * Math.PI) / 180;
      return [Math.cos(rad) * R, Math.sin(rad) * R] as const;
    });
    parts.push(`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`);
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [x, y] = pts[i];
      // ดึงจุดควบคุมเข้าหาจุดกลาง ทำให้วงดูโค้งเหมือนใยจริง
      parts.push(`Q${((px + x) / 2 * 0.92).toFixed(1)} ${((py + y) / 2 * 0.92).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  }
  return parts.join(" ");
}

function Cobweb({ className }: { className: string }) {
  return (
    <svg className={`sd-web ${className}`} viewBox="0 0 220 220" aria-hidden="true">
      <path d={cobwebPath(220)} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1" />
    </svg>
  );
}

// แมงมุมห้อยจากเส้นใย แกว่งเบาๆ
function Spider({ className }: { className: string }) {
  return (
    <div className={`sd-spider ${className}`} aria-hidden="true">
      <div className="sd-thread" />
      <svg viewBox="0 0 60 70" className="sd-spider-body">
        <g stroke="#1a0d05" strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M30 26 L8 16 M30 26 L4 30 M30 26 L6 44 M30 26 L14 56" />
          <path d="M30 26 L52 16 M30 26 L56 30 M30 26 L54 44 M30 26 L46 56" />
        </g>
        <ellipse cx="30" cy="38" rx="12" ry="14" fill="#1a0d05" />
        <ellipse cx="30" cy="22" rx="7" ry="6" fill="#1a0d05" />
        <circle cx="27" cy="21" r="1.6" fill="#ff7a18" />
        <circle cx="33" cy="21" r="1.6" fill="#ff7a18" />
      </svg>
    </div>
  );
}

// ฟักทองจากมุม มีหน้าเปล่งแสง
function Pumpkin({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 110" className={`sd-pumpkin ${className}`} aria-hidden="true">
      <ellipse cx="34" cy="62" rx="32" ry="38" fill="#e8620c" />
      <ellipse cx="60" cy="62" rx="32" ry="38" fill="#ff7a18" />
      <ellipse cx="86" cy="62" rx="32" ry="38" fill="#e8620c" />
      <path d="M52 28 L58 10 L68 10 L66 28 Z" fill="#3b2a12" />
      <path d="M64 18 Q82 4 96 14" fill="none" stroke="#3b2a12" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 58 L58 48 L66 58 Z" fill="#fff3c4" />
      <path d="M74 58 L82 48 L90 58 Z" fill="#fff3c4" />
      <path d="M44 80 Q60 96 76 80 L74 88 Q60 100 46 88 Z" fill="#fff3c4" />
    </svg>
  );
}

// ค้างคาวบินเป็นระยะ
function Bat({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 60 30" className={`sd-bat ${className}`} aria-hidden="true">
      <path d="M30 12 Q22 2 12 6 Q16 12 6 14 Q18 18 22 26 Q26 18 30 18 Q34 18 38 26 Q42 18 54 14 Q44 12 48 6 Q38 2 30 12 Z" fill="#1a0d05" />
    </svg>
  );
}

// ชุดตกแต่งตามชนิดเทศกาล
export function SeasonDecor({ kind }: { kind: string }) {
  if (kind !== "halloween") return null;
  return (
    <div className="sd" aria-hidden="true">
      <Cobweb className="sd-web-tl" />
      <Cobweb className="sd-web-tr" />
      <Spider className="sd-spider-1" />
      <Pumpkin className="sd-pumpkin-bl" />
      <Pumpkin className="sd-pumpkin-br" />
      <Bat className="sd-bat-1" />
      <Bat className="sd-bat-2" />
    </div>
  );
}
