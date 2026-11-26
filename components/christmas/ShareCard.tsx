"use client";

import { useEffect, useState } from "react";
import type { Ornament, OrnamentColor } from "@/lib/christmas/types";
import { socialLinks } from "@/lib/christmas/social";

// การ์ดคำอวยพรแนวตั้ง 9:16 สำหรับ Story IG / Facebook วาดด้วย canvas ทั้งหมด (ไม่ต้องใช้รูปภายนอก)
const W = 1080;
const H = 1920;
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

async function drawCard(o: Ornament, roomName: string): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load('700 64px "Noto Serif Thai"'), document.fonts.load('400 40px Sarabun')]);
  } catch {
    /* ใช้ฟอนต์สำรองของเครื่อง */
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) return c;

  // พื้นหลังท้องฟ้าต้นสนกับแสงทอง
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c2e22");
  bg.addColorStop(0.6, "#123f2e");
  bg.addColorStop(1, "#071d16");
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 900, 40, W / 2, 900, 820);
  glow.addColorStop(0, "rgba(232,209,154,0.35)");
  glow.addColorStop(1, "rgba(232,209,154,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);

  // เกล็ดหิมะคงที่ตามลำดับ (วาดซ้ำได้ภาพเดิม)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  x.fillStyle = "rgba(255,250,240,0.5)";
  for (let i = 0; i < 90; i++) {
    x.beginPath();
    x.arc(rnd() * W, rnd() * H, 1.5 + rnd() * 4, 0, Math.PI * 2);
    x.fill();
  }

  // หัวการ์ด: ชื่อห้อง
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  x.fillStyle = "#e8d19a";
  x.font = '600 46px Sarabun, "Segoe UI", sans-serif';
  x.fillText(`ต้นคริสต์มาส${roomName}`, W / 2, 170);
  x.font = '400 34px Sarabun, "Segoe UI", sans-serif';
  x.fillStyle = "rgba(232,209,154,0.85)";
  x.fillText("คำอวยพรคริสต์มาส", W / 2, 232);

  // คำอวยพรต้องวัดก่อน เพื่อให้แผงกระดาษสูงพอดีกับเนื้อหา
  const px = 90;
  const py = 300;
  const pw = W - 180;
  x.font = '700 66px "Noto Serif Thai", Georgia, serif';
  const wish = o.wish?.trim() || "ขอให้มีความสุขในวันคริสต์มาส";
  const lines = wrapLines(x, `“${wish}”`, pw - 200, 7);
  const afterQuote = 560 + lines.length * 94 + 60;
  const ph = afterQuote + 240 - py;

  // แผงกระดาษ
  roundRect(x, px, py, pw, ph, 56);
  x.fillStyle = "#fffaf0";
  x.fill();
  x.lineWidth = 3;
  x.strokeStyle = "rgba(184,144,74,0.7)";
  x.stroke();

  // ลูกบอลที่แขวนไว้ ใช้สีจริงของลูกบอล
  const ballY = py + 20;
  x.strokeStyle = "#b8904a";
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(W / 2, py - 40);
  x.lineTo(W / 2, ballY - 46);
  x.stroke();
  const grad = x.createRadialGradient(W / 2 - 14, ballY - 10, 6, W / 2, ballY, 52);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.25, COLOR_HEX[o.color]);
  grad.addColorStop(1, "#3a2a14");
  x.fillStyle = grad;
  x.beginPath();
  x.arc(W / 2, ballY + 40, 52, 0, Math.PI * 2);
  x.fill();

  // คำอวยพร
  x.fillStyle = "#b8904a";
  x.font = '600 34px Sarabun, "Segoe UI", sans-serif';
  x.fillText("คำอวยพรจาก", W / 2, 470);
  x.fillStyle = "#1d2b22";
  x.font = '700 66px "Noto Serif Thai", Georgia, serif';
  lines.forEach((line, i) => x.fillText(line, W / 2, 560 + i * 94));

  // ชื่อและโซเชียล
  x.strokeStyle = "rgba(184,144,74,0.6)";
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(W / 2 - 120, afterQuote);
  x.lineTo(W / 2 + 120, afterQuote);
  x.stroke();
  x.fillStyle = "#1d2b22";
  x.font = '700 56px Sarabun, "Segoe UI", sans-serif';
  x.fillText(o.name, W / 2, afterQuote + 90);
  const links = socialLinks(o.social)
    .map((l) => l.label)
    .join("  ·  ");
  if (links) {
    x.fillStyle = "#3d5a48";
    x.font = '400 36px Sarabun, "Segoe UI", sans-serif';
    x.fillText(links, W / 2, afterQuote + 150);
  }
  x.fillStyle = "#7a7566";
  x.font = '400 32px Sarabun, "Segoe UI", sans-serif';
  const when = new Date(o.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  x.fillText(`แขวนเมื่อ ${when} · ลูก${COLOR_LABEL[o.color]}`, W / 2, afterQuote + 184);

  // เครดิตด้านล่างการ์ด
  x.fillStyle = "#fffaf0";
  x.font = '700 50px Sarabun, "Segoe UI", sans-serif';
  x.fillText("Power by DevEveryDay ❤️", W / 2, py + ph + 200);
  x.fillStyle = "#cbb57a";
  x.font = '400 34px Sarabun, "Segoe UI", sans-serif';
  const host = typeof window !== "undefined" ? window.location.host : "";
  x.fillText(`${host}/Christmas`, W / 2, py + ph + 270);
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
