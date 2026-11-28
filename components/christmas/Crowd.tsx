"use client";

// บรรยากาศรอบฉาก (อยู่นอกฉาก 3 มิติ): พระจันทร์ แสงเหนือ ไฟประดับสาย และขอบกระจกเกล็ดน้ำแข็ง
export function Backdrop() {
  // ไฟสายที่ห้อยเป็นเส้นโค้งข้ามด้านบน ตำแหน่งกำหนดจากลำดับ
  const bulbs = Array.from({ length: 22 }, (_, i) => {
    const t = i / 21;
    return { left: 2 + t * 96, top: 8 + Math.sin(Math.PI * t) * 26 + (i % 2) * 2, color: ["#fde68a", "#fca5a5", "#93c5fd", "#fef3c7", "#86efac"][i % 5], delay: (i * 0.37) % 3 };
  });
  return (
    <div className="xmas-atmos" aria-hidden>
      <div className="xmas-aurora" />
      <div className="xmas-fairy">
        <svg className="xmas-fairy-wire" viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M0 4 Q50 40 100 4" />
        </svg>
        {bulbs.map((b, i) => (
          <i key={i} style={{ left: `${b.left}%`, top: `${b.top}%`, background: b.color, color: b.color, animationDelay: `${b.delay}s` }} />
        ))}
      </div>
      <div className="xmas-frost" />
    </div>
  );
}
