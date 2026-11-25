"use client";

// ฉากหลังที่อยู่นอกฉาก 3 มิติ: พระจันทร์และเนินเขาไกล (ผู้คนเป็นวัตถุในฉาก 3 มิติแล้ว)
export function Backdrop() {
  return (
    <div className="xmas-crowd" aria-hidden>
      <div className="xmas-moon" />
      <svg className="xmas-hills" viewBox="0 0 1600 300" preserveAspectRatio="none">
        <path className="xmas-hills-far" d="M0 180 C160 120 260 150 380 118 C520 80 620 150 760 128 C900 104 1010 160 1160 122 C1300 88 1420 140 1600 110 V300 H0 Z" />
        <path className="xmas-hills-near" d="M0 230 C200 190 320 220 480 200 C640 178 760 230 940 208 C1120 186 1240 232 1420 206 C1500 196 1560 210 1600 204 V300 H0 Z" />
      </svg>
    </div>
  );
}
