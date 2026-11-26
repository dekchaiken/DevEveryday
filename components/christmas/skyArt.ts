// งานวาดบน canvas ที่ใช้ร่วมกันระหว่างฉากสามมิติและตัวอย่างในหน้าเว็บ
// ทุกอย่างวาดด้วยโค้ดล้วน ไม่มีรูปภาพภายนอก ฟอนต์ตามระบบ: อังกฤษ JetBrains Mono, ไทย IBM Plex Sans Thai

export type SkyTheme = "fireworks" | "snow" | "sparkle" | "sleigh";
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

export const THEME_ACCENT: Record<SkyTheme, string> = {
  fireworks: "#f5c542",
  snow: "#cfeeff",
  sparkle: "#f8e3a1",
  sleigh: "#f7a1a1",
};

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

// ---------- แผงข้อความบนท้องฟ้า ----------
// กระดาษสปรูซโปร่งแสง ขอบฟอยล์ทองสองชั้น มุมประดับ ตัวอักษรไทยชัดเจน
export function drawSkyPanel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts: { text: string; by: string; theme: SkyTheme }) {
  const accent = THEME_ACCENT[opts.theme];
  const r = h * 0.24;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = h * 0.3;
  g.shadowOffsetY = h * 0.08;
  roundedPath(g, x, y, w, h, r);
  const bg = g.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, "rgba(14,50,39,0.94)");
  bg.addColorStop(1, "rgba(5,22,17,0.94)");
  g.fillStyle = bg;
  g.fill();
  g.restore();

  // ขอบฟอยล์ทองสองชั้น
  g.save();
  const foil = g.createLinearGradient(x, y, x + w, y + h);
  foil.addColorStop(0, "#fff3c8");
  foil.addColorStop(0.5, "#c9a255");
  foil.addColorStop(1, "#f7e2a6");
  g.strokeStyle = foil;
  g.lineWidth = Math.max(4, h * 0.028);
  roundedPath(g, x, y, w, h, r);
  g.stroke();
  g.strokeStyle = "rgba(232,209,154,0.5)";
  g.lineWidth = Math.max(2, h * 0.01);
  roundedPath(g, x + h * 0.075, y + h * 0.075, w - h * 0.15, h - h * 0.15, r * 0.7);
  g.stroke();
  g.restore();

  // มุมประดับรูปข้าวหลามตัด
  g.save();
  g.fillStyle = "#e8d19a";
  const cs = h * 0.07;
  const corners: [number, number][] = [
    [x + h * 0.2, y + h * 0.2],
    [x + w - h * 0.2, y + h * 0.2],
    [x + h * 0.2, y + h - h * 0.2],
    [x + w - h * 0.2, y + h - h * 0.2],
  ];
  for (const [cx, cy] of corners) {
    g.beginPath();
    g.moveTo(cx, cy - cs);
    g.lineTo(cx + cs * 0.6, cy);
    g.lineTo(cx, cy + cs);
    g.lineTo(cx - cs * 0.6, cy);
    g.closePath();
    g.fill();
  }
  g.restore();

  // ผู้ส่ง และข้อความหลัก
  const cx = x + w / 2;
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = accent;
  g.font = `500 ${Math.round(h * 0.13)}px ${fonts().sky}`;
  if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(h * 0.012)}px`;
  g.fillText(`จาก ${opts.by.slice(0, 20)}`, cx, y + h * 0.25);
  g.restore();

  const fit = fitText(g, opts.text.slice(0, 80), w * 0.74, h * 0.46, 2, Math.round(h * 0.3), 600, fonts().sky);
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff8e6";
  g.shadowColor = accent;
  g.shadowBlur = h * 0.08;
  g.font = `600 ${fit.px}px ${fonts().sky}`;
  const startY = y + h * 0.6 - ((fit.lines.length - 1) * fit.lineH) / 2;
  fit.lines.forEach((line, i) => g.fillText(line, cx, startY + i * fit.lineH));
  g.restore();
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

// ---------- เลื่อนของซานตา มีกวางเรนเดียร์นำหน้า ----------
function reindeer(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  g.save();
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = "round";
  g.lineWidth = 4 * s;
  // ลำตัวและขา
  g.beginPath();
  g.ellipse(cx, cy, 30 * s, 14 * s, -0.08, 0, Math.PI * 2);
  g.fill();
  for (const dx of [-20, -8, 12, 24]) {
    g.beginPath();
    g.moveTo(cx + dx * s, cy + 8 * s);
    g.lineTo(cx + (dx - 4) * s, cy + 30 * s);
    g.stroke();
  }
  // คอ หัว และจมูกสีแดง
  g.beginPath();
  g.moveTo(cx + 22 * s, cy - 4 * s);
  g.quadraticCurveTo(cx + 36 * s, cy - 20 * s, cx + 44 * s, cy - 32 * s);
  g.lineWidth = 9 * s;
  g.stroke();
  g.beginPath();
  g.ellipse(cx + 49 * s, cy - 36 * s, 10 * s, 7 * s, 0.4, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = "#ff3b4f";
  g.shadowBlur = 12 * s;
  g.fillStyle = "#ff3b4f";
  g.beginPath();
  g.arc(cx + 58 * s, cy - 37 * s, 3.2 * s, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  // เขาแตกกิ่ง
  g.strokeStyle = color;
  g.lineWidth = 3 * s;
  g.beginPath();
  g.moveTo(cx + 46 * s, cy - 42 * s);
  g.quadraticCurveTo(cx + 40 * s, cy - 58 * s, cx + 52 * s, cy - 64 * s);
  g.moveTo(cx + 44 * s, cy - 46 * s);
  g.lineTo(cx + 30 * s, cy - 56 * s);
  g.moveTo(cx + 52 * s, cy - 64 * s);
  g.lineTo(cx + 60 * s, cy - 58 * s);
  g.stroke();
  g.restore();
}

export function drawSled(g: CanvasRenderingContext2D, w: number, h: number) {
  g.save();
  // กวางสามตัวนำหน้า
  const base = h * 0.58;
  [0, 62, 124].forEach((dx, i) => {
    g.globalAlpha = 0.95 - i * 0.08;
    reindeer(g, w * 0.16 + dx * (w / 512), base - 6, (h / 160) * 0.92, "#fdf1c7");
  });
  g.globalAlpha = 1;
  // ตัวเลื่อนสีแดงเข้มขอบทอง
  const bx = w * 0.42;
  const by = h * 0.58;
  const bw = w * 0.5;
  const bh = h * 0.24;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 10;
  roundedPath(g, bx, by, bw, bh, bh * 0.3);
  const body = g.createLinearGradient(0, by, 0, by + bh);
  body.addColorStop(0, "#e5405f");
  body.addColorStop(1, "#7d0d24");
  g.fillStyle = body;
  g.fill();
  g.restore();
  g.save();
  g.fillStyle = "#f5c542";
  g.fillRect(bx, by + bh * 0.82, bw, bh * 0.1);
  g.strokeStyle = "#f5c542";
  g.lineWidth = Math.max(3, h * 0.03);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(bx - bw * 0.06, by + bh * 1.02);
  g.quadraticCurveTo(bx + bw * 0.2, by + bh * 1.42, bx + bw * 1.02, by + bh * 1.12);
  g.stroke();
  g.restore();
  // ฝุ่นประกายด้านหลัง
  g.save();
  g.fillStyle = "#fff7d6";
  g.shadowColor = "#fde68a";
  g.shadowBlur = 14;
  for (let i = 0; i < 10; i++) {
    const px = bx - bw * 0.1 - i * (w * 0.018);
    const py = by + bh * 0.4 + Math.sin(i * 1.7) * bh * 0.5;
    g.globalAlpha = 0.8 - i * 0.07;
    g.beginPath();
    g.arc(px, py, Math.max(1.5, h * 0.018) * (1 - i * 0.06), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// ---------- ตัวอย่างฉากท้องฟ้าทั้งฉาก (ใช้ในหน้าแก้ไข) ----------
// สร้างเอฟเฟกต์จากเวลา t เพื่อให้วาดซ้ำได้โดยไม่ต้องเก็บสถานะ
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const FIREWORK_COLORS = ["#f5c542", "#fff6d8", "#f08a5d", "#ffe08a"];

let sledCanvas: HTMLCanvasElement | null = null;

export function paintSkyScene(g: CanvasRenderingContext2D, W: number, H: number, t: number, opts: { theme: SkyTheme; text: string; by: string }) {
  // ท้องฟ้าไล่สี แสงจากขอบล่าง
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#071f18");
  sky.addColorStop(0.6, "#0f3a2c");
  sky.addColorStop(1, "#1f5a44");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 1.05, 10, W / 2, H * 1.05, W * 0.6);
  glow.addColorStop(0, "rgba(232,209,154,0.35)");
  glow.addColorStop(1, "rgba(232,209,154,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.save();
  g.globalCompositeOperation = "lighter";
  if (opts.theme === "fireworks") {
    // พลุระเบิดเป็นชุด: แสงวาบตอนจุด แล้วกระจายเป็นประกายพร้อมหางและแรงโน้มถ่วง
    const period = 1.5;
    for (let k = Math.floor((t - 2.4) / period); k <= Math.floor(t / period); k++) {
      if (k < 0) continue;
      const age = t - k * period;
      if (age < 0 || age > 2.2) continue;
      const ox = W * (0.18 + hash(k * 3.1) * 0.64);
      const oy = H * (0.2 + hash(k * 5.7) * 0.28);
      const col = FIREWORK_COLORS[Math.floor(hash(k * 9.3) * FIREWORK_COLORS.length)];
      const life = Math.max(0, 1 - age / 2.2);
      // แสงวาบตรงจุดระเบิด
      if (age < 0.5) {
        const fl = g.createRadialGradient(ox, oy, 0, ox, oy, W * 0.09 * (1 - age));
        fl.addColorStop(0, "rgba(255,246,214,0.9)");
        fl.addColorStop(1, "rgba(255,246,214,0)");
        g.globalAlpha = 1 - age / 0.5;
        g.fillStyle = fl;
        g.fillRect(ox - W * 0.1, oy - W * 0.1, W * 0.2, W * 0.2);
      }
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + hash(k + i) * 0.18;
        const sp = (0.6 + hash(k * 17 + i) * 0.4) * H * 0.44;
        const d = (sp * (1 - Math.exp(-age * 2.6))) / 2.6;
        const fall = 0.5 * H * 0.2 * age * age;
        const px = ox + Math.cos(a) * d;
        const py = oy + Math.sin(a) * d + fall;
        const tx = ox + Math.cos(a) * d * 0.86;
        const ty = oy + Math.sin(a) * d * 0.86 + fall * 0.86;
        g.globalAlpha = life;
        g.strokeStyle = col;
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(px, py);
        g.stroke();
        g.globalAlpha = life;
        g.fillStyle = col;
        g.beginPath();
        g.arc(px, py, 2.8 * (0.6 + life * 0.6), 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (opts.theme === "snow") {
    // หิมะหนาแน่นทำความลึกด้วยขนาดและความเร็ว
    for (let i = 0; i < 120; i++) {
      const depth = hash(i * 2.3);
      const speed = 0.04 + depth * 0.09;
      const x = (hash(i * 7.1) * W + Math.sin(t * 0.6 + i) * (6 + depth * 16) + W) % W;
      const y = ((hash(i * 4.9) + t * speed) % 1) * (H + 20) - 10;
      g.globalAlpha = 0.35 + depth * 0.6;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, 1 + depth * 3.2, 0, Math.PI * 2);
      g.fill();
    }
  } else if (opts.theme === "sparkle") {
    // ประกายทองวิ่งไปตามกรอบ และประกายกระพริบ
    const inset = H * 0.07;
    const pw = W - inset * 2;
    const ph = H - inset * 2;
    const perim = 2 * (pw + ph);
    for (let i = 0; i < 14; i++) {
      let d = ((hash(i) + t * 0.09) % 1) * perim;
      let px = 0;
      let py = 0;
      if (d < pw) {
        px = inset + d;
        py = inset;
      } else if ((d -= pw) < ph) {
        px = inset + pw;
        py = inset + d;
      } else if ((d -= ph) < pw) {
        px = inset + pw - d;
        py = inset + ph;
      } else {
        d -= pw;
        px = inset;
        py = inset + ph - d;
      }
      const s = 0.6 + 0.4 * Math.sin(t * 6 + i);
      g.globalAlpha = 0.9;
      const rg = g.createRadialGradient(px, py, 0, px, py, 16 * s);
      rg.addColorStop(0, "rgba(255,246,214,1)");
      rg.addColorStop(1, "rgba(245,197,66,0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(px, py, 16 * s, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 24; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3);
      g.globalAlpha = tw * 0.7;
      g.fillStyle = "#fff6d6";
      g.beginPath();
      g.arc(hash(i * 3.7) * W, hash(i * 1.9) * H, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // ข้อความกลางฉาก
  g.globalAlpha = 1;
  drawSkyPanel(g, W * 0.07, H * 0.09, W * 0.86, H * 0.5, { text: opts.text, by: opts.by, theme: opts.theme });

  // เลื่อนของซานตาวิ่งผ่านท้องฟ้า
  if (opts.theme === "sleigh") {
    const sw = W * 0.5;
    const sh = sw * 0.31;
    const sx = ((t * 0.075) % 1.7 - 0.36) * W;
    if (!sledCanvas || sledCanvas.width !== Math.round(sw)) {
      sledCanvas = document.createElement("canvas");
      sledCanvas.width = Math.round(sw);
      sledCanvas.height = Math.round(sh);
      const og = sledCanvas.getContext("2d");
      if (og) drawSled(og, sledCanvas.width, sledCanvas.height);
    }
    g.drawImage(sledCanvas, sx, H * 0.6, sw, sh);
  }
}
