// งานวาดบน canvas ที่ใช้ร่วมกันระหว่างฉากสามมิติและตัวอย่างในหน้าเว็บ
// ทุกอย่างวาดด้วยโค้ดล้วน ไม่มีรูปภาพภายนอก ฟอนต์ตามระบบ: อังกฤษ JetBrains Mono, ไทย IBM Plex Sans Thai

export type BoardStyle = "spruce" | "ivory" | "berry" | "gold";

// ชื่อฟอนต์จริงที่ระบบโหลดให้ (next/font ตั้งชื่อแบบมีแฮชไว้ในตัวแปร CSS) ใช้ได้กับ canvas ด้วย
let fontCache: { sky: string; mono: string } | null = null;
export function fonts() {
  if (!fontCache) {
    const cs = typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
    const thai = cs?.getPropertyValue("--font-thai").trim() || '"IBM Plex Sans Thai"';
    const mono = cs?.getPropertyValue("--font-mono").trim() || '"JetBrains Mono"';
    fontCache = { sky: `${thai}, ${mono}, ui-monospace, monospace`, mono: `${mono}, ${thai}, ui-monospace, monospace` };
  }
  return fontCache;
}


// ---------- ตัวช่วยพื้นฐาน ----------
export function roundedPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ตัดข้อความตามความกว้างได้ทั้งภาษาไทยและอังกฤษ (ตัดทีละตัวอักษร)
export function wrapText(g: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of [...text]) {
    const next = cur + ch;
    if (g.measureText(next).width > maxWidth && cur) {
      lines.push(cur.trimEnd());
      cur = ch.trimStart();
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur.trimEnd());
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.$/, "") + "…";
    return kept;
  }
  return lines;
}

// หาขนาดตัวอักษรใหญ่ที่สุดที่ทำให้ข้อความพอดีกรอบ (ไม่เกินจำนวนบรรทัดที่กำหนด)
function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, maxLines: number, startPx: number, weight: number, family: string) {
  for (let px = startPx; px >= 14; px -= 2) {
    g.font = `${weight} ${px}px ${family}`;
    const lines = wrapText(g, text, maxW, maxLines);
    const lineH = px * 1.36;
    if (lines.length * lineH <= maxH) return { px, lines, lineH };
  }
  g.font = `${weight} 14px ${family}`;
  return { px: 14, lines: wrapText(g, text, maxW, maxLines), lineH: 19 };
}

// ---------- ป้ายที่ตุ๊กตายักษ์ถืออยู่ ----------
const BOARD: Record<BoardStyle, { top: string; bottom: string; frame: string; ink: string; accent: string }> = {
  spruce: { top: "#17463a", bottom: "#0a2019", frame: "#e3c27a", ink: "#fff8e6", accent: "#f6d98a" },
  ivory: { top: "#fffdf6", bottom: "#f1e7cf", frame: "#b8904a", ink: "#1d2b22", accent: "#9a7330" },
  berry: { top: "#9b1c31", bottom: "#5a0c1b", frame: "#f3d88f", ink: "#fff8e6", accent: "#f9e2a3" },
  gold: { top: "#f7dc8a", bottom: "#b8864a", frame: "#fff4cf", ink: "#2b1a08", accent: "#4a2c0c" },
};

export function drawGiantBoard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts: { name: string; message: string; style: BoardStyle }) {
  const p = BOARD[opts.style] ?? BOARD.spruce;
  const r = h * 0.12;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.45)";
  g.shadowBlur = h * 0.14;
  g.shadowOffsetY = h * 0.04;
  roundedPath(g, x, y, w, h, r);
  const bg = g.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, p.top);
  bg.addColorStop(1, p.bottom);
  g.fillStyle = bg;
  g.fill();
  g.restore();

  g.save();
  g.strokeStyle = p.frame;
  g.lineWidth = Math.max(6, h * 0.04);
  roundedPath(g, x, y, w, h, r);
  g.stroke();
  g.lineWidth = Math.max(2, h * 0.012);
  g.globalAlpha = 0.7;
  roundedPath(g, x + h * 0.06, y + h * 0.06, w - h * 0.12, h - h * 0.12, r * 0.6);
  g.stroke();
  g.restore();

  const cx = x + w / 2;
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = p.accent;
  g.font = `600 ${Math.round(h * 0.068)}px ${fonts().sky}`;
  g.letterSpacing = `${Math.round(h * 0.01)}px`;
  g.fillText("บ้านของ", cx, y + h * 0.17);
  g.restore();

  const nameFit = fitText(g, opts.name || "ชื่อของคุณ", w * 0.7, h * 0.14, 1, Math.round(h * 0.13), 700, fonts().sky);
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = p.ink;
  g.font = `700 ${nameFit.px}px ${fonts().sky}`;
  g.fillText(nameFit.lines[0] ?? "", cx, y + h * 0.34);
  g.restore();

  // ดาวเล็กสี่มุมป้าย
  g.save();
  g.fillStyle = p.accent;
  for (const [sx, sy] of [[x + w * 0.1, y + h * 0.17], [x + w * 0.9, y + h * 0.17], [x + w * 0.1, y + h * 0.84], [x + w * 0.9, y + h * 0.84]]) {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? h * 0.012 : h * 0.04;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  g.restore();

  // เส้นคั่นฟอยล์
  g.save();
  const line = g.createLinearGradient(cx - w * 0.22, 0, cx + w * 0.22, 0);
  line.addColorStop(0, "rgba(0,0,0,0)");
  line.addColorStop(0.5, p.frame);
  line.addColorStop(1, "rgba(0,0,0,0)");
  g.strokeStyle = line;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - w * 0.22, y + h * 0.47);
  g.lineTo(cx + w * 0.22, y + h * 0.47);
  g.stroke();
  g.restore();

  const msg = (opts.message || "ข้อความของคุณจะขึ้นตรงนี้").slice(0, 80);
  const msgFit = fitText(g, msg, w * 0.7, h * 0.26, 2, Math.round(h * 0.085), 500, fonts().sky);
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = p.ink;
  g.font = `500 ${msgFit.px}px ${fonts().sky}`;
  const startY = y + h * 0.7 - ((msgFit.lines.length - 1) * msgFit.lineH) / 2;
  msgFit.lines.forEach((l, i) => g.fillText(l, cx, startY + i * msgFit.lineH));
  g.restore();
}
