"use client";

import { useEffect, useRef } from "react";

// ออฟฟิศพิกเซล: ทีมนักพัฒนาเดินไปมา นั่งพิมพ์โค้ด และช่วยกันวาง logo DevEveryDay ทีละพิกเซล
const W = 320;
const H = 180;
const FLOOR = 120;
const DESK_Y = 98;
const DESKS = [22, 112, 202];
const COFFEE_X = 262;
const BUILD_X = 150;
const BOARD = { x: 56, y: 14, w: 208, h: 50 };
const CELL = 3;
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

type Px = { x: number; y: number; c: number };

// สร้างลำดับพิกเซลของโลโก้ (เรียงจากซ้ายไปขวา ตัวอักษรต่อตัว)
function buildLogo(): Px[] {
  const out: Px[] = [];
  const total = WORD.length * 6 - 1;
  const ox = Math.round(BOARD.x + (BOARD.w - total * CELL) / 2);
  const oy = Math.round(BOARD.y + (BOARD.h - 7 * CELL) / 2);
  [...WORD].forEach((ch, li) => {
    const g = GLYPHS[ch];
    if (!g) return;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] === "1") out.push({ x: ox + (li * 6 + c) * CELL, y: oy + r * CELL, c: li % 4 });
      }
    }
  });
  return out;
}
const PIX = buildLogo();

type Pal = {
  wall: string; wallDark: string; floor: string; floorLine: string;
  board: string; boardFrame: string; desk: string; deskDark: string;
  monitor: string; screen: string; code: string[];
  skin: string; hair: string[]; shirt: string[]; pants: string; ink: string;
  plant: string; pot: string; machine: string; cup: string; logo: string[];
};

const LIGHT: Pal = {
  wall: "#eef1f7", wallDark: "#dde3ee", floor: "#d9dfea", floorLine: "#cdd4e2",
  board: "#ffffff", boardFrame: "#c3cbdc", desk: "#b4bdd1", deskDark: "#959fb8",
  monitor: "#2b3142", screen: "#0c1322", code: ["#3ddc97", "#7aa7ff", "#ffb86b"],
  skin: "#f2c7a5", hair: ["#2b2b33", "#7a4522"], shirt: ["#0070f3", "#17c964", "#ff4d8d", "#f5a524"], pants: "#2b3142", ink: "#1b1f2b",
  plant: "#22a06b", pot: "#8e99b2", machine: "#6b7591", cup: "#ffffff",
  logo: ["#0070f3", "#7c6cff", "#17c964", "#09090b"],
};
const DARK: Pal = {
  wall: "#0f1219", wallDark: "#0a0d13", floor: "#151a26", floorLine: "#1d2433",
  board: "#141a27", boardFrame: "#2a3142", desk: "#2a3142", deskDark: "#1d2330",
  monitor: "#0a0c12", screen: "#0b1020", code: ["#3dffb0", "#6fb6ff", "#ffc857"],
  skin: "#e9b894", hair: ["#0c0c10", "#5a3418"], shirt: ["#3b9cff", "#3dffb0", "#ff6ea8", "#ffc857"], pants: "#1b2030", ink: "#0a0c12",
  plant: "#2fd98e", pot: "#3a4158", machine: "#3a4158", cup: "#e6e9f2",
  logo: ["#3b9cff", "#8f85ff", "#3dffb0", "#ededed"],
};

type Dev = {
  x: number; y: number; tx: number; ty: number;
  home: number; state: "sit" | "walk" | "idle" | "build";
  after: "sit" | "idle"; timer: number; walking: boolean; typing: boolean;
  throwT: number; facing: 1 | -1; frame: number;
  shirt: number; hair: number; role: "worker" | "builder";
  phase: "go" | "place" | "hold" | "clear" | "return"; cool: number; idx: number;
};

type Proj = { sx: number; sy: number; tx: number; ty: number; t: number; dur: number; c: number; px: Px };

const seat = (i: number) => ({ x: DESKS[i] + 10, y: DESK_Y - 13 });
const COFFEE = { x: COFFEE_X - 14, y: FLOOR - 14 };

function makeDev(i: number): Dev {
  const s = seat(i);
  return {
    x: s.x, y: s.y, tx: s.x, ty: s.y, home: i,
    state: "sit", after: "sit", timer: 60 + i * 90, walking: false, typing: true,
    throwT: 0, facing: 1, frame: 0, shirt: i % 4, hair: i % 2,
    role: "worker", phase: "go", cool: 0, idx: 0,
  };
}

// เดินไปยังจุดหมาย คืน true เมื่อถึง
function step(d: Dev, speed: number): boolean {
  const dx = d.tx - d.x;
  const dy = d.ty - d.y;
  if (Math.abs(dx) > 0.01) d.x += Math.sign(dx) * Math.min(speed, Math.abs(dx));
  if (Math.abs(dy) > 0.01) d.y += Math.sign(dy) * Math.min(speed, Math.abs(dy));
  if (dx < -0.01) d.facing = -1;
  else if (dx > 0.01) d.facing = 1;
  d.walking = true;
  d.typing = false;
  d.frame++;
  const done = Math.abs(d.tx - d.x) < 0.5 && Math.abs(d.ty - d.y) < 0.5;
  if (done) {
    d.x = d.tx;
    d.y = d.ty;
    d.walking = false;
  }
  return done;
}

function tickWorker(d: Dev, devs: Dev[]) {
  if (d.state === "sit") {
    d.typing = true;
    d.walking = false;
    d.frame++;
    if (--d.timer <= 0) {
      if (Math.random() < 0.5) {
        d.tx = COFFEE.x; d.ty = COFFEE.y; d.after = "idle";
      } else {
        const n = (d.home + 1 + Math.floor(Math.random() * 2)) % DESKS.length;
        const busy = devs.some((o) => o !== d && o.role === "worker" && o.home === n && o.state === "sit");
        const s = busy ? seat(d.home) : seat(n);
        d.home = busy ? d.home : n;
        d.tx = s.x; d.ty = s.y; d.after = "sit";
      }
      d.state = "walk";
    }
  } else if (d.state === "walk") {
    if (step(d, 0.5)) {
      if (d.after === "idle") {
        d.state = "idle";
        d.timer = 140;
      } else {
        d.state = "sit";
        d.timer = 260 + Math.floor(Math.random() * 300);
      }
    }
  } else if (d.state === "idle") {
    d.walking = false;
    d.typing = false;
    d.frame++;
    if (--d.timer <= 0) {
      const s = seat(d.home);
      d.tx = s.x; d.ty = s.y; d.after = "sit"; d.state = "walk";
    }
  }
}

export function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const devs = [0, 1, 2].map(makeDev);
    let placed: Px[] = reduce ? [...PIX] : [];
    let projs: Proj[] = [];
    let t = 0;
    let buildTimer = 180;
    let raf = 0;

    const pick = (): Pal => (document.documentElement.dataset.theme === "dark" ? DARK : LIGHT);

    function spawn(d: Dev, px: Px) {
      projs.push({ sx: d.x + 6, sy: d.y + 5, tx: px.x, ty: px.y, t: 0, dur: 16, c: px.c, px });
      d.throwT = 6;
    }

    function tickBuilder(d: Dev) {
      if (d.phase === "go") {
        if (step(d, 0.7)) {
          d.phase = "place"; d.cool = 0; d.idx = 0;
        }
      } else if (d.phase === "place") {
        d.walking = false;
        d.typing = false;
        if (d.throwT > 0) d.throwT--;
        if (--d.cool <= 0 && d.idx < PIX.length) {
          spawn(d, PIX[d.idx++]);
          d.cool = 4;
        }
        if (d.idx >= PIX.length && projs.length === 0) {
          d.phase = "hold"; d.timer = 220;
        }
      } else if (d.phase === "hold") {
        d.walking = false;
        if (--d.timer <= 0) d.phase = "clear";
      } else if (d.phase === "clear") {
        if (t % 2 === 0) placed.pop();
        if (placed.length === 0) {
          const s = seat(d.home);
          d.tx = s.x; d.ty = s.y; d.phase = "return";
        }
      } else if (d.phase === "return") {
        if (step(d, 0.7)) {
          d.role = "worker"; d.state = "sit"; d.after = "sit"; d.timer = 200; d.typing = true;
          buildTimer = 500;
        }
      }
    }

    function update() {
      t++;
      if (!reduce) {
        if (buildTimer > 0 && !devs.some((d) => d.role === "builder")) buildTimer--;
        if (buildTimer === 0) {
          const pool = devs.filter((d) => d.role === "worker" && d.state === "sit");
          if (pool.length) {
            const b = pool[Math.floor(Math.random() * pool.length)];
            b.role = "builder"; b.phase = "go";
            b.tx = BUILD_X; b.ty = FLOOR - 14;
            buildTimer = -1;
          }
        }
        devs.forEach((d) => (d.role === "builder" ? tickBuilder(d) : tickWorker(d, devs)));
        projs = projs.filter((p) => {
          p.t++;
          if (p.t >= p.dur) {
            placed.push(p.px);
            return false;
          }
          return true;
        });
        devs.forEach((d) => { if (d.throwT > 0 && d.role !== "builder") d.throwT--; });
      }
    }

    function rect(x: number, y: number, w: number, h: number, c: string) {
      ctx!.fillStyle = c;
      ctx!.fillRect(Math.round(x), Math.round(y), w, h);
    }

    function drawRoom(p: Pal) {
      rect(0, 0, W, FLOOR, p.wall);
      rect(0, FLOOR - 3, W, 3, p.wallDark);
      rect(0, FLOOR, W, H - FLOOR, p.floor);
      for (let y = FLOOR + 10; y < H; y += 14) rect(0, y, W, 1, p.floorLine);
      for (let x = 0; x < W; x += 40) rect(x, FLOOR, 1, H - FLOOR, p.floorLine);
      // กระดานไวท์บอร์ด
      rect(BOARD.x - 3, BOARD.y - 3, BOARD.w + 6, BOARD.h + 6, p.boardFrame);
      rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, p.board);
      rect(BOARD.x, BOARD.y + BOARD.h + 3, BOARD.w, 2, p.boardFrame);
      // ต้นไม้และเครื่องชงกาแฟ
      rect(10, FLOOR - 26, 4, 14, p.plant);
      rect(6, FLOOR - 30, 12, 6, p.plant);
      rect(8, FLOOR - 12, 8, 8, p.pot);
      rect(COFFEE_X, FLOOR - 26, 22, 22, p.machine);
      rect(COFFEE_X + 4, FLOOR - 20, 14, 6, p.screen);
      rect(COFFEE_X + 6, FLOOR - 8, 10, 2, p.cup);
    }

    function drawDeskBack(i: number, p: Pal) {
      const dx = DESKS[i];
      rect(dx + 2, DESK_Y + 3, 3, FLOOR - DESK_Y - 3, p.deskDark);
      rect(dx + 39, DESK_Y + 3, 3, FLOOR - DESK_Y - 3, p.deskDark);
      rect(dx + 14, DESK_Y - 12, 16, 10, p.monitor);
      rect(dx + 15, DESK_Y - 11, 14, 8, p.screen);
      for (let k = 0; k < 4; k++) {
        const w = 3 + ((Math.floor(t / 9) + k * 4 + i * 3) % 9);
        rect(dx + 16, DESK_Y - 10 + k * 2, Math.min(w, 12), 1, p.code[k % p.code.length]);
      }
      rect(dx + 20, DESK_Y - 2, 8, 2, p.monitor);
    }

    function drawDeskTop(i: number, p: Pal) {
      const dx = DESKS[i];
      rect(dx, DESK_Y, 44, 3, p.desk);
      rect(dx + 16, DESK_Y + 1, 10, 1, p.deskDark);
    }

    function drawDev(d: Dev, p: Pal) {
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      const shirt = p.shirt[d.shirt];
      rect(x + 1, y, 6, 2, p.hair[d.hair]);
      rect(x + 1, y + 2, 6, 4, p.skin);
      rect(x + 2 + (d.facing > 0 ? 1 : 0), y + 4, 1, 1, p.ink);
      rect(x + 5 + (d.facing > 0 ? 1 : 0), y + 4, 1, 1, p.ink);
      rect(x, y + 6, 8, 5, shirt);
      // ขา
      if (d.walking) {
        const f = Math.floor(d.frame / 6) % 2;
        rect(x + 1, y + 11, 2, f ? 2 : 3, p.pants);
        rect(x + 5, y + 11, 2, f ? 3 : 2, p.pants);
      } else {
        rect(x + 1, y + 11, 6, 3, p.pants);
      }
      // แขน
      if (d.role === "builder" && d.phase === "place" && d.throwT > 0) {
        rect(x + 8, y + 2, 2, 4, p.skin);
        rect(x + 9, y, 2, 2, p.skin);
      } else if (d.typing) {
        const up = Math.floor(t / 5) % 2;
        rect(x - 1, y + 8 + up, 2, 2, p.skin);
        rect(x + 7, y + 9 - up, 2, 2, p.skin);
      } else {
        const sw = d.walking ? Math.floor(d.frame / 6) % 2 : 0;
        rect(x - 1, y + 7 + sw, 2, 3, p.skin);
        rect(x + 7, y + 8 - sw, 2, 3, p.skin);
      }
    }

    function drawLogo(p: Pal) {
      // กระดานมีโลโก้เฉพาะพิกเซลที่วางแล้ว
      for (const px of placed) rect(px.x, px.y, CELL, CELL, p.logo[px.c]);
      for (const pr of projs) {
        const k = pr.t / pr.dur;
        const x = pr.sx + (pr.tx - pr.sx) * k;
        const y = pr.sy + (pr.ty - pr.sy) * k - Math.sin(k * Math.PI) * 26;
        rect(x, y, CELL, CELL, p.logo[pr.c]);
      }
    }

    function draw() {
      const p = pick();
      ctx!.clearRect(0, 0, W, H);
      drawRoom(p);
      drawLogo(p);
      DESKS.forEach((_, i) => drawDeskBack(i, p));
      const order = [...devs].sort((a, b) => a.y - b.y);
      order.forEach((d) => drawDev(d, p));
      DESKS.forEach((_, i) => drawDeskTop(i, p));
    }

    function loop() {
      update();
      draw();
      raf = requestAnimationFrame(loop);
    }

    if (reduce) {
      draw();
    } else {
      loop();
    }
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pixel-stage" aria-hidden>
      <canvas ref={canvasRef} width={W} height={H} />
    </div>
  );
}
