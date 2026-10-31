"use client";

import { useEffect, useRef, useState } from "react";

// ห้องประชุมพิกเซล: ทีม 5 คนคุยงานกัน แล้วแต่ละคนส่งชิ้นงานขึ้นจอใหญ่
// ชื่อทีมค่อยๆ render ออกมาทีละส่วนจนครบ จากนั้นทุกคนฉลอง แล้วเริ่มรอบใหม่
type Layout = {
  W: number;
  H: number;
  FLOOR: number;
  CELL: number;
  SCREEN: { x: number; y: number; w: number; h: number };
  TABLE: { x: number; w: number };
  SEATS: number[];
  LEAD_X: number;
  PLANTS: number[];
};

// จอกว้าง (เดสก์ท็อปและแท็บเล็ต)
const WIDE: Layout = {
  W: 480,
  H: 220,
  FLOOR: 186,
  CELL: 4,
  SCREEN: { x: 90, y: 12, w: 300, h: 124 },
  TABLE: { x: 116, w: 248 },
  SEATS: [148, 210, 272, 334],
  LEAD_X: 60,
  PLANTS: [8, 452],
};

// จอแคบ (มือถือ) จัดสัดส่วนให้คนและโต๊ะยังสมดุล
const NARROW: Layout = {
  W: 320,
  H: 200,
  FLOOR: 160,
  CELL: 3,
  SCREEN: { x: 40, y: 10, w: 240, h: 96 },
  TABLE: { x: 56, w: 208 },
  SEATS: [84, 136, 188, 240],
  LEAD_X: 20,
  PLANTS: [292],
};

const WORD = "DevEveryDay";
const GLYPHS: Record<string, string[]> = {
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  y: ["00000", "10001", "10001", "01111", "00001", "00001", "11110"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
};

// ไอคอนฟองพูด 5x5 ใช้แทนอารมณ์ เพราะฟอนต์พิกเซลไม่มีตัวอักษรไทย
const ICONS = {
  bang: ["00100", "00100", "00100", "00000", "00100"],
  ask: ["01110", "10001", "00110", "00000", "00100"],
  check: ["00001", "00010", "10100", "01000", "00000"],
  heart: ["01010", "11111", "11111", "01110", "00100"],
  star: ["00100", "10101", "01110", "10101", "00100"],
  zap: ["00010", "00100", "01110", "00100", "01000"],
  dots: ["00000", "00000", "10101", "00000", "00000"],
};
type Icon = keyof typeof ICONS;

const SCREEN_LOGO = ["#3b9cff", "#8f85ff", "#3dffb0", "#ededed"];

type Px = { x: number; y: number; c: number };
type Shown = Px & { born: number };

function logoPixels(L: Layout): Px[] {
  const out: Px[] = [];
  const total = WORD.length * 6 - 1;
  const ix = L.SCREEN.x + 8;
  const iw = L.SCREEN.w - 16;
  const iy = L.SCREEN.y + 8;
  const ih = L.SCREEN.h - 16 - 10;
  const ox = Math.round(ix + (iw - total * L.CELL) / 2);
  const oy = Math.round(iy + (ih - 7 * L.CELL) / 2);
  [...WORD].forEach((ch, li) => {
    const g = GLYPHS[ch];
    if (!g) return;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] === "1") out.push({ x: ox + (li * 6 + c) * L.CELL, y: oy + r * L.CELL, c: li % 4 });
      }
    }
  });
  return out;
}

type Pal = {
  wall: string; wallDark: string; floor: string; floorLine: string;
  frame: string; desk: string; deskDark: string; laptop: string; code: string[];
  skin: string; hair: string[]; shirt: string[]; pants: string; ink: string;
  plant: string; pot: string; cup: string; bubble: string; shadow: string;
};

const LIGHT: Pal = {
  wall: "#eef1f7", wallDark: "#dde3ee", floor: "#d9dfea", floorLine: "#cdd4e2",
  frame: "#8e99b2", desk: "#b4bdd1", deskDark: "#959fb8", laptop: "#7d879f",
  code: ["#17c964", "#0070f3", "#f5a524"],
  skin: "#f2c7a5", hair: ["#2b2b33", "#7a4522"], shirt: ["#0070f3", "#17c964", "#ff4d8d", "#f5a524"],
  pants: "#2b3142", ink: "#1b1f2b",
  plant: "#22a06b", pot: "#8e99b2", cup: "#ffffff", bubble: "#ffffff", shadow: "rgba(27,31,43,0.14)",
};
const DARK: Pal = {
  wall: "#0f1219", wallDark: "#0a0d13", floor: "#151a26", floorLine: "#1d2433",
  frame: "#2a3142", desk: "#2a3142", deskDark: "#1d2330", laptop: "#3a4158",
  code: ["#3dffb0", "#6fb6ff", "#ffc857"],
  skin: "#e9b894", hair: ["#0c0c10", "#5a3418"], shirt: ["#3b9cff", "#3dffb0", "#ff6ea8", "#ffc857"],
  pants: "#1b2030", ink: "#0a0c12",
  plant: "#2fd98e", pot: "#3a4158", cup: "#e6e9f2", bubble: "#e6e9f2", shadow: "rgba(0,0,0,0.35)",
};

type Act = "type" | "listen" | "talk" | "point" | "sip" | "cheer" | "stand";
type Mood = "focus" | "happy" | "surprise";
type Look = -1 | 0 | 1;
type Pose = { act: Act; mood?: Mood; icon?: Icon; look?: Look };
type Beat = { dur: number; poses: Pose[]; start?: () => void };

type Person = {
  x: number; y: number; seated: boolean;
  act: Act; mood: Mood; icon: Icon | null; iconT: number; look: Look;
  shirt: number; hair: number; phase: number;
};

type Proj = {
  sx: number; sy: number; tx: number; ty: number; t: number; dur: number; c: number;
  onLand: () => void;
};
type Particle = {
  x: number; y: number; vx: number; vy: number; c: string; life: number; kind: "confetti" | "spark";
};

// สร้างฉากทั้งหมดบน canvas และคืนฟังก์ชันสำหรับหยุดแอนิเมชัน
function createScene(canvas: HTMLCanvasElement, L: Layout, reduce: boolean): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const { W, H, FLOOR, CELL, SCREEN, TABLE, SEATS, LEAD_X, PLANTS } = L;
  const T = FLOOR - 10; // ระดับหน้าโต๊ะ ทำให้คนนั่งเห็นแค่หัวและไหล่
  const IX = SCREEN.x + 8;
  const IY = SCREEN.y + 8;
  const IW = SCREEN.w - 16;
  const IH = SCREEN.h - 16;
  const PIX = logoPixels(L);
  // แบ่งโลโก้เป็น 5 ส่วน ให้แต่ละคนรับผิดชอบคนละส่วน
  const CHUNKS = [0, 1, 2, 3, 4].map((k) =>
    PIX.slice(Math.floor((k * PIX.length) / 5), Math.floor(((k + 1) * PIX.length) / 5)),
  );

  const person = (x: number, y: number, seated: boolean, i: number): Person => ({
    x, y, seated, act: seated ? "type" : "stand", mood: "focus", icon: null, iconT: 0,
    look: 0, shirt: i === 4 ? 2 : i, hair: i % 2, phase: i,
  });
  const P: Person[] = [
    ...SEATS.map((x, i) => person(x, T - 10, true, i)),
    person(LEAD_X, FLOOR - 14, false, 4),
  ];

  let placed: Shown[] = [];
  let pending: Px[] = [];
  let erasing = false;
  let projs: Proj[] = [];
  let parts: Particle[] = [];
  let t = 0;
  let beatIdx = 0;
  let beatT = 0;

  const pick = (): Pal => (document.documentElement.dataset.theme === "dark" ? DARK : LIGHT);

  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  function say(q: Person, icon: Icon, n: number) {
    q.icon = icon;
    q.iconT = n;
  }

  // ทิศทางสายตาไปหาอีกคน
  const toward = (i: number, j: number): Look => (P[j].x > P[i].x + 2 ? 1 : P[j].x < P[i].x - 2 ? -1 : 0);
  const rest = (i: number): Pose => ({ act: P[i].seated ? "type" : "stand" });

  function launch(c: number, k: number) {
    const q = P[c];
    const cells = CHUNKS[k];
    const tx = cells.reduce((s, px) => s + px.x, 0) / cells.length;
    const ty = cells.reduce((s, px) => s + px.y, 0) / cells.length;
    projs.push({
      sx: q.x + 4,
      sy: q.seated ? T - 4 : q.y + 6,
      tx,
      ty,
      t: 0,
      dur: 40,
      c: k,
      onLand: () => {
        pending.push(...cells);
        sparkAt(tx, ty);
      },
    });
  }

  function sparkAt(x: number, y: number) {
    parts.push({ x, y, vx: 0, vy: -0.1, c: SCREEN_LOGO[2], life: 24, kind: "spark" });
  }

  function startParty() {
    const p = pick();
    for (let i = 0; i < 70; i++) {
      parts.push({
        x: IX + Math.random() * IW,
        y: IY + Math.random() * IH * 0.3,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -(1 + Math.random() * 2.2),
        c: i % 2 ? SCREEN_LOGO[i % 4] : p.code[i % p.code.length],
        life: 120 + Math.random() * 60,
        kind: "confetti",
      });
    }
  }

  // ---------- บทของการประชุม (วนเป็นรอบ) ----------
  const beats: Beat[] = [];
  beats.push({
    dur: 150,
    poses: P.map((_, i) => (i === 4 ? { act: "point", mood: "happy", icon: "bang" } : { act: "listen", look: toward(i, 4) })),
  });
  beats.push({
    dur: 100,
    poses: P.map((_, i) => (i === 4 ? { act: "talk", icon: "ask" } : { act: "listen", look: toward(i, 4) })),
  });

  const ORDER = [0, 1, 2, 3, 4];
  ORDER.forEach((c, k) => {
    const n = (c + 1) % 5;
    beats.push({
      dur: 50,
      poses: P.map((_, i) => {
        if (i === c) return { act: "point", mood: "happy", icon: "zap" };
        if (i === 4) return { act: "stand", look: toward(i, c) };
        return { act: "type" };
      }),
      start: () => launch(c, k),
    });
    beats.push({
      dur: 60,
      poses: P.map((_, i) => {
        if (i === c) return { act: "type", mood: "happy", icon: "check" };
        if (i === n) return { act: "talk", icon: "ask" };
        if (i === 4) return { act: "stand", look: toward(i, n) };
        return { act: "listen", look: toward(i, n) };
      }),
    });
    if (k === 1) {
      beats.push({
        dur: 50,
        poses: P.map((_, i) => (i === 2 ? { act: "sip", mood: "happy" } : rest(i))),
      });
    }
  });

  beats.push({
    dur: 170,
    poses: P.map(() => ({ act: "cheer", mood: "happy", icon: "heart" })),
    start: startParty,
  });
  beats.push({
    dur: 160,
    poses: P.map((_, i) => (i === 4 ? { act: "talk", mood: "happy", icon: "star" } : { act: "type", mood: "happy" })),
  });
  beats.push({
    dur: 60,
    poses: P.map((_, i) => rest(i)),
    start: () => {
      pending = [];
      erasing = true;
    },
  });

  function applyBeat(b: Beat) {
    b.poses.forEach((ps, i) => {
      const q = P[i];
      q.act = ps.act;
      q.mood = ps.mood ?? "focus";
      q.look = ps.look ?? 0;
      if (ps.icon) say(q, ps.icon, b.dur);
      else q.iconT = 0;
    });
    b.start?.();
  }

  // ---------- การอัปเดต ----------
  function update() {
    t++;

    if (beatT === 0) applyBeat(beats[beatIdx]);
    beatT++;
    if (beatT >= beats[beatIdx].dur) {
      beatT = 0;
      beatIdx = (beatIdx + 1) % beats.length;
    }

    projs = projs.filter((pr) => {
      pr.t++;
      if (pr.t >= pr.dur) {
        pr.onLand();
        return false;
      }
      return true;
    });

    // ค่อยๆ render พิกเซลทีละตัวบนจอ
    if (pending.length) {
      const px = pending.shift();
      if (px) placed.push({ ...px, born: t });
    }
    if (erasing) {
      for (let k = 0; k < 3 && placed.length; k++) placed.pop();
      if (!placed.length) erasing = false;
    }

    parts = parts.filter((q) => {
      q.x += q.vx;
      q.y += q.vy;
      if (q.kind === "confetti") q.vy += 0.08;
      q.life--;
      return q.life > 0;
    });
    for (const q of P) {
      if (q.iconT > 0 && --q.iconT === 0) q.icon = null;
    }
  }

  // ---------- การวาด ----------
  // ยกตัวขึ้นตอนดีใจ
  function lift(q: Person): number {
    if (q.act === "cheer") return Math.round(Math.abs(Math.sin((t + q.phase * 17) * 0.18)) * 8);
    return 0;
  }

  function drawPlant(px: number, p: Pal) {
    const sway = Math.round(Math.sin(t / 40 + px));
    rect(px + 2, FLOOR - 12, 8, 8, p.pot);
    rect(px + 5, FLOOR - 20, 2, 8, p.plant);
    rect(px + 1 + sway, FLOOR - 28, 10, 7, p.plant);
    rect(px + 3 + sway, FLOOR - 32, 6, 4, p.plant);
  }

  function drawScreen(p: Pal) {
    rect(SCREEN.x - 3, SCREEN.y - 3, SCREEN.w + 6, SCREEN.h + 6, p.frame);
    rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, "#05070d");
    // ขาตั้งจอ
    rect(SCREEN.x + SCREEN.w / 2 - 2, SCREEN.y + SCREEN.h + 3, 4, 4, p.frame);
    rect(SCREEN.x + SCREEN.w / 2 - 14, SCREEN.y + SCREEN.h + 7, 28, 2, p.frame);

    for (const px of placed) {
      const age = t - px.born;
      // พิกเซลใหม่กะพริบสีขาวก่อนติดถาวร
      const c = age < 8 && age % 2 === 0 ? "#ffffff" : SCREEN_LOGO[px.c];
      rect(px.x, px.y, CELL, CELL, c);
    }

    // เส้นสแกนขณะกำลัง render
    if (pending.length && !erasing) {
      rect(IX, IY + ((t * 2) % IH), IW, 1, "rgba(61,255,176,0.35)");
    }
    // แถบความคืบหน้า
    rect(IX, IY + IH - 4, IW, 2, "#1d2a44");
    rect(IX, IY + IH - 4, (IW * placed.length) / PIX.length, 2, SCREEN_LOGO[2]);
  }

  function drawRoom(p: Pal) {
    rect(0, 0, W, FLOOR, p.wall);
    rect(0, FLOOR - 3, W, 3, p.wallDark);
    rect(0, FLOOR, W, H - FLOOR, p.floor);
    for (let y = FLOOR + 10; y < H; y += 14) rect(0, y, W, 1, p.floorLine);
    for (let x = 0; x < W; x += 40) rect(x, FLOOR, 1, H - FLOOR, p.floorLine);
    drawScreen(p);
    for (const px of PLANTS) drawPlant(px, p);
  }

  function drawChair(q: Person, p: Pal) {
    const x = Math.round(q.x);
    const y = Math.round(q.y);
    rect(x - 5, y + 4, 10, T + 4 - (y + 4), p.deskDark);
  }

  function drawPerson(q: Person, p: Pal) {
    const x = Math.round(q.x);
    const y = Math.round(q.y) - lift(q);
    const shirt = p.shirt[q.shirt];
    const skin = p.skin;

    if (!q.seated) rect(x - 1, Math.round(q.y) + 14, 10, 1, p.shadow);

    // ผมและหน้า
    rect(x + 1, y, 6, 2, p.hair[q.hair]);
    rect(x + 1, y + 2, 6, 4, skin);
    const ex1 = x + 2 + q.look;
    const ex2 = x + 5 + q.look;
    if (q.mood === "happy") {
      rect(ex1, y + 3, 1, 1, p.ink);
      rect(ex2, y + 3, 1, 1, p.ink);
      rect(x + 3, y + 5, 2, 1, p.ink);
    } else if (q.mood === "surprise") {
      rect(ex1, y + 3, 1, 2, p.ink);
      rect(ex2, y + 3, 1, 2, p.ink);
      rect(x + 3, y + 5, 1, 1, p.ink);
    } else {
      rect(ex1, y + 4, 1, 1, p.ink);
      rect(ex2, y + 4, 1, 1, p.ink);
      if (q.act === "talk" && Math.floor(t / 6) % 2) rect(x + 3, y + 5, 2, 1, p.ink);
    }

    // ลำตัวและแขนตามท่า
    rect(x, y + 6, 8, 5, shirt);
    switch (q.act) {
      case "type": {
        const up = Math.floor(t / 5) % 2;
        rect(x - 1, y + 8 + up, 2, 2, skin);
        rect(x + 7, y + 9 - up, 2, 2, skin);
        break;
      }
      case "listen":
        rect(x - 1, y + 8, 2, 2, skin);
        rect(x + 7, y + 8, 2, 2, skin);
        break;
      case "talk": {
        const g = Math.floor(t / 8) % 2;
        rect(x - 2, y + 3 + g, 2, 3, skin);
        rect(x + 7, y + 8, 2, 2, skin);
        break;
      }
      case "point":
        rect(x + 7, y + 1, 2, 5, skin);
        rect(x - 1, y + 8, 2, 2, skin);
        break;
      case "sip":
        rect(x + 7, y + 3, 2, 2, skin);
        rect(x + 8, y, 3, 3, p.cup);
        rect(x - 1, y + 8, 2, 2, skin);
        break;
      case "cheer":
        rect(x - 2, y - 2, 2, 4, skin);
        rect(x + 8, y - 2, 2, 4, skin);
        break;
      case "stand":
        rect(x - 1, y + 8, 2, 3, skin);
        rect(x + 7, y + 8, 2, 3, skin);
        break;
    }

    if (!q.seated) rect(x + 1, y + 11, 6, 3, p.pants);

    if (q.icon && q.iconT > 0) {
      rect(x - 1, y - 9, 11, 8, p.bubble);
      rect(x + 3, y - 1, 2, 1, p.bubble);
      ICONS[q.icon].forEach((row, r) => {
        for (let c = 0; c < 5; c++) {
          if (row[c] === "1") rect(x + 2 + c, y - 8 + r, 1, 1, p.ink);
        }
      });
    }
  }

  // โน้ตบุ๊กบนโต๊ะ หน้าจอจะกะพริบตอนกำลังพิมพ์
  function drawLaptop(q: Person, p: Pal) {
    const x = Math.round(q.x);
    rect(x - 3, T - 4, 7, 4, p.laptop);
    const glow = q.act === "type" ? p.code[(Math.floor(t / 4) + q.phase) % p.code.length] : p.frame;
    rect(x - 2, T - 3, 5, 1, glow);
  }

  function drawTable(p: Pal) {
    rect(TABLE.x, T, TABLE.w, 3, p.desk);
    rect(TABLE.x, T + 3, TABLE.w, 1, p.deskDark);
    rect(TABLE.x + 5, T + 4, 3, FLOOR + 4 - (T + 4), p.deskDark);
    rect(TABLE.x + TABLE.w - 8, T + 4, 3, FLOOR + 4 - (T + 4), p.deskDark);
  }

  // ชิ้นงานที่ลอยจากโน้ตบุ๊กขึ้นไปยังจอ
  function drawProjs() {
    for (const pr of projs) {
      const k = pr.t / pr.dur;
      const at = (kk: number) => ({
        x: pr.sx + (pr.tx - pr.sx) * kk,
        y: pr.sy + (pr.ty - pr.sy) * kk - Math.sin(kk * Math.PI) * 40,
      });
      const color = SCREEN_LOGO[pr.c % SCREEN_LOGO.length];
      for (let j = 3; j >= 1; j--) {
        const pos = at(Math.max(0, k - j * 0.03));
        rect(pos.x + 1, pos.y + 1, 2, 2, color);
      }
      const head = at(k);
      rect(head.x, head.y, 3, 3, color);
    }
  }

  function drawParticles() {
    for (const q of parts) {
      const x = Math.round(q.x);
      const y = Math.round(q.y);
      if (q.kind === "confetti") {
        rect(x, y, 2, 2, q.c);
      } else {
        rect(x - 1, y, 3, 1, q.c);
        rect(x, y - 1, 1, 3, q.c);
      }
    }
  }

  function draw() {
    const p = pick();
    ctx!.clearRect(0, 0, W, H);
    drawRoom(p);
    P.filter((q) => q.seated).forEach((q) => drawChair(q, p));
    P.forEach((q) => drawPerson(q, p));
    P.filter((q) => q.seated).forEach((q) => drawLaptop(q, p));
    drawTable(p);
    drawProjs();
    drawParticles();
  }

  if (reduce) {
    // ผู้ใช้ที่ปิดแอนิเมชัน: แสดงชื่อทีมครบแบบนิ่งๆ
    placed = PIX.map((px) => ({ ...px, born: -100 }));
    P.forEach((q) => {
      q.act = q.seated ? "type" : "stand";
    });
    draw();
    return () => {};
  }

  const STEP = 1000 / 60;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  const loop = (now: number) => {
    acc += Math.min(now - last, 100);
    last = now;
    while (acc >= STEP) {
      update();
      acc -= STEP;
    }
    draw();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

export function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const L = narrow ? NARROW : WIDE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return createScene(canvas, L, reduce);
  }, [L]);

  return (
    <div className="pixel-stage" aria-hidden>
      <canvas ref={canvasRef} width={L.W} height={L.H} />
    </div>
  );
}
