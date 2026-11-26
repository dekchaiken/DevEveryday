"use client";

import { useEffect, useState } from "react";
import type { Ornament, OrnamentColor } from "@/lib/christmas/types";
import { socialLinks } from "@/lib/christmas/social";

// การ์ดคำอวยพรแนวตั้ง 9:16 สำหรับ Story IG / Facebook วาดด้วย canvas ทั้งหมด (ไม่ต้องใช้รูปภายนอก)
// โทนเดียวกับหน้าเว็บ (Spruce & Foil): พื้นต้นสน กระดาษงาช้าง ขอบทองฟอยล์ และลูกบอลสีจริง
const W = 1080;
const H = 1920;
const GOLD = "#c9a255";
const INK = "#1d2b22";
const SERIF = '"Noto Serif Thai", Georgia, serif';
const SANS = 'Sarabun, "Segoe UI", sans-serif';
const COLOR_HEX: Record<OrnamentColor, string> = {
  gold: "#e0b04f",
  red: "#c0354c",
  blue: "#3f74b8",
  pink: "#e98fb0",
  white: "#f4f1e8",
  green: "#3c9a63",
};
const COLOR_LABEL: Record<OrnamentColor, string> = { gold: "ทอง", red: "แดง", blue: "น้ำเงิน", pink: "ชมพู", white: "ขาว", green: "เขียว" };

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of [...text]) {
    const next = cur + ch;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].slice(0, -1) + "…";
    return kept;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// เส้นฟอยล์ทองจางที่ปลายสองข้าง
function foilLine(x: CanvasRenderingContext2D, y: number, half: number) {
  const g = x.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
  g.addColorStop(0, "rgba(201,162,85,0)");
  g.addColorStop(0.5, "rgba(232,209,154,1)");
  g.addColorStop(1, "rgba(201,162,85,0)");
  x.strokeStyle = g;
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(W / 2 - half, y);
  x.lineTo(W / 2 + half, y);
  x.stroke();
}

// ต้นสนแบบชั้น วาดไว้ด้านหลังแผงกระดาษ
function drawTree(x: CanvasRenderingContext2D, base: number) {
  const tiers = [
    { top: base - 700, w: 280 },
    { top: base - 560, w: 440 },
    { top: base - 420, w: 600 },
    { top: base - 280, w: 780 },
  ];
  x.fillStyle = "rgba(6,30,21,0.9)";
  for (const t of tiers) {
    x.beginPath();
    x.moveTo(W / 2, t.top);
    x.lineTo(W / 2 + t.w / 2, t.top + 230);
    x.lineTo(W / 2 - t.w / 2, t.top + 230);
    x.closePath();
    x.fill();
  }
  x.fillRect(W / 2 - 22, base - 30, 44, 50);
}

async function drawCard(o: Ornament, roomName: string): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`700 76px ${SERIF}`), document.fonts.load(`400 40px ${SANS}`)]);
  } catch {
    /* ใช้ฟอนต์สำรองของเครื่อง */
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) return c;
  x.textAlign = "center";
  x.textBaseline = "alphabetic";

  // พื้นหลังท้องฟ้าต้นสน พร้อมแสงทองด้านหลังแผง
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0d3125");
  bg.addColorStop(0.55, "#103a2b");
  bg.addColorStop(1, "#061b13");
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 800, 30, W / 2, 800, 760);
  glow.addColorStop(0, "rgba(232,209,154,0.32)");
  glow.addColorStop(1, "rgba(232,209,154,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);

  // เกล็ดหิมะคงที่ (วาดซ้ำได้ภาพเดิม)
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 110; i++) {
    x.fillStyle = `rgba(255,250,240,${0.25 + rnd() * 0.5})`;
    x.beginPath();
    x.arc(rnd() * W, rnd() * H, 1 + rnd() * 3.5, 0, Math.PI * 2);
    x.fill();
  }

  // หัวการ์ด: ชื่อห้องและชื่อการ์ด
  x.fillStyle = "#e8d19a";
  x.font = `600 40px ${SANS}`;
  x.fillText(`ต้นคริสต์มาส${roomName}`, W / 2, 150);
  x.fillStyle = "#f6e7b8";
  x.font = `700 84px ${SERIF}`;
  x.fillText("คำอวยพรคริสต์มาส", W / 2, 260);
  foilLine(x, 304, 260);

  drawTree(x, 1880);

  // วัดคำอวยพรก่อน เพื่อให้แผงสูงพอดีกับเนื้อหา
  const wish = o.wish?.trim() || "ขอให้มีความสุขในวันคริสต์มาส";
  x.font = `700 76px ${SERIF}`;
  const lines = wrapLines(x, `“${wish}”`, 700, 6);
  const panelW = 900;
  const panelX = (W - panelW) / 2;
  const panelY = 420;
  const panelH = 200 + lines.length * 112 + 250;

  // แผงกระดาษงาช้างพร้อมเงาและขอบทองสองชั้น
  x.save();
  x.shadowColor = "rgba(0,0,0,0.4)";
  x.shadowBlur = 50;
  x.shadowOffsetY = 20;
  roundRect(x, panelX, panelY, panelW, panelH, 56);
  const paper = x.createLinearGradient(0, panelY, 0, panelY + panelH);
  paper.addColorStop(0, "#fffdf6");
  paper.addColorStop(1, "#f4ecd8");
  x.fillStyle = paper;
  x.fill();
  x.restore();
  x.lineWidth = 5;
  x.strokeStyle = GOLD;
  roundRect(x, panelX, panelY, panelW, panelH, 56);
  x.stroke();
  x.lineWidth = 1.5;
  x.strokeStyle = "rgba(201,162,85,0.55)";
  roundRect(x, panelX + 18, panelY + 18, panelW - 36, panelH - 36, 42);
  x.stroke();

  // ลูกบอลที่แขวนจากขอบบนของแผง ใช้สีจริงของลูกบอล
  const ballY = panelY + 6;
  x.strokeStyle = GOLD;
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(W / 2, panelY - 110);
  x.lineTo(W / 2, ballY - 62);
  x.stroke();
  const ball = x.createRadialGradient(W / 2 - 18, ballY - 22, 6, W / 2, ballY, 66);
  ball.addColorStop(0, "#ffffff");
  ball.addColorStop(0.22, COLOR_HEX[o.color]);
  ball.addColorStop(1, "#2a1a10");
  x.fillStyle = ball;
  x.beginPath();
  x.arc(W / 2, ballY, 62, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = GOLD;
  x.lineWidth = 3;
  x.stroke();

  // ป้ายหัวและคำอวยพร
  x.fillStyle = "#a57a2c";
  x.font = `600 34px ${SANS}`;
  x.fillText("คำอวยพรจาก", W / 2, panelY + 160);
  x.fillStyle = INK;
  x.font = `700 76px ${SERIF}`;
  const quoteTop = panelY + 250;
  lines.forEach((line, i) => x.fillText(line, W / 2, quoteTop + i * 112));

  // เส้นฟอยล์กั้นพร้อมรูปข้าวหลามตัดตรงกลาง
  const divY = quoteTop + lines.length * 112 + 30;
  foilLine(x, divY, 180);
  x.fillStyle = GOLD;
  x.beginPath();
  x.moveTo(W / 2, divY - 10);
  x.lineTo(W / 2 + 10, divY);
  x.lineTo(W / 2, divY + 10);
  x.lineTo(W / 2 - 10, divY);
  x.closePath();
  x.fill();

  // ชื่อ ลิงก์โซเชียล และวันที่
  x.fillStyle = INK;
  x.font = `700 62px ${SANS}`;
  x.fillText(o.name, W / 2, divY + 92);
  const links = socialLinks(o.social)
    .map((l) => l.label)
    .join("  ·  ");
  if (links) {
    x.fillStyle = "#3d5a48";
    x.font = `400 38px ${SANS}`;
    x.fillText(links, W / 2, divY + 150);
  }
  x.fillStyle = "#7a7566";
  x.font = `400 32px ${SANS}`;
  const when = new Date(o.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  x.fillText(`แขวนเมื่อ ${when} · ลูก${COLOR_LABEL[o.color]}`, W / 2, divY + (links ? 206 : 160));

  // เครดิตด้านล่างการ์ด
  x.fillStyle = "#fffaf0";
  x.font = `700 52px ${SANS}`;
  x.fillText("Power by DevEveryDay ❤️", W / 2, 1800);
  x.fillStyle = "#e8d19a";
  x.font = `400 34px ${SANS}`;
  const host = typeof window !== "undefined" ? window.location.host : "";
  x.fillText(`${host}/Christmas`, W / 2, 1862);
  return c;
}

// แสดงการ์ดที่สร้างแล้ว ให้แชร์ (เมนูแชร์ของเครื่อง) หรือบันทึกรูป
export function ShareCardModal({ ornament, roomName, onClose }: { ornament: Ornament; roomName: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [new File(["x"], "x.png", { type: "image/png" })] }),
    );
  }, []);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    drawCard(ornament, roomName).then((c) =>
      c.toBlob((b) => {
        if (!alive || !b) return;
        created = URL.createObjectURL(b);
        setBlob(b);
        setUrl(created);
      }, "image/png"),
    );
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [ornament, roomName]);

  async function share() {
    if (!blob) return;
    const file = new File([blob], "christmas-wish.png", { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: "คำอวยพรคริสต์มาส", text: `${ornament.name}: ${ornament.wish || ""}`.trim() });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMsg("แชร์ไม่สำเร็จ ลองบันทึกรูปแล้วอัปโหลดเองได้");
    }
  }

  function download() {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "christmas-wish.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="xmas-intro" role="dialog" aria-modal="true" aria-label="การ์ดคำอวยพร">
      <div className="xmas-intro-card xmas-share-card">
        <p className="xmas-intro-kicker">แชร์การ์ด</p>
        {url ? <img src={url} alt="การ์ดคำอวยพรคริสต์มาส" className="xmas-share-img" /> : <p className="xmas-intro-text">กำลังสร้างการ์ด…</p>}
        <p className="xmas-intro-tip">แชร์ไป Story IG หรือ Facebook ได้จากเมนูแชร์ของเครื่อง หรือบันทึกรูปแล้วอัปโหลดเอง</p>
        <div className="xmas-share-actions">
          {canShare && (
            <button type="button" className="xmas-intro-btn" onClick={share} disabled={!blob}>
              <span>แชร์</span>
            </button>
          )}
          <button type="button" className="xmas-chip-btn" onClick={download} disabled={!blob}>
            บันทึกรูป
          </button>
          <button type="button" className="xmas-chip-btn" onClick={onClose}>
            ปิด
          </button>
        </div>
        {msg && <p className="xmas-msg err">{msg}</p>}
      </div>
    </div>
  );
}
