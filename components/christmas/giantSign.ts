// ป้ายและบ้านของ Exclusive แบบ 3 มิติ ใช้ร่วมกันทั้งบนฉากจริงและในหน้าต่างตัวอย่าง
// ป้ายเป็นแผ่นไม้โค้งมุมมีขอบ มีหิมะเกาะด้านบน ห้อยจากแขนไม้ด้วยโซ่ทองและโบว์แดง
import * as THREE from "three";
import { drawGiantBoard, fonts, type BoardStyle } from "./skyArt";
import { buildCottage, snowSurface, std, type Scenery } from "./zoneScenery";
import type { GiantLook } from "@/lib/christmas/giant";

// ขนาดบ้านทั้งหลังบนฉาก (ย่อจากขนาดจริงเล็กน้อย เพื่อให้วงบ้านไม่ทับกัน)
export const GIANT_SCALE = 0.95;
// ขนาดแผ่นป้ายในโลก: ให้เล็กกว่าบ้านมาก ตัวอักษรจึงไม่ดูใหญ่เกินไป
export const BOARD_W = 0.96;
export const BOARD_H = 0.55;
const BOARD_DEPTH = 0.07;
const WOOD = 0x7a4a24;
const GOLD = 0xd9b45a;

// สร้างเท็กซ์เจอร์จากภาพวาดบนแคนวาส
export function makeCanvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// สี่เหลี่ยมมุมโค้งเป็นรูปร่างสำหรับ extrude
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// แผ่นป้ายไม้ 3 มิติ: ตัวไม้มีขอบมน หน้าและหลังเป็นภาพเดียวกัน มีหิมะเกาะด้านบน
// จุดกึ่งกลางอยู่ที่กึ่งกลางป้าย หน้าป้ายหันไปทางแกน +z
export function buildBoard(tex: THREE.Texture, w: number, h: number, wood: number, depth = BOARD_DEPTH): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.ExtrudeGeometry(roundedRect(w + 0.07, h + 0.07, Math.min(w, h) * 0.12), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 3,
    curveSegments: 8,
  });
  body.translate(0, 0, -depth / 2);
  g.add(new THREE.Mesh(body, std(wood, 0.55)));

  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.04 });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
  front.position.z = depth / 2 + 0.018;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
  back.rotation.y = Math.PI;
  back.position.z = -depth / 2 - 0.018;
  g.add(front, back);

  // หิมะเกาะบนขอบบนของป้าย
  const snow = snowSurface();
  for (let i = 0; i < 7; i++) {
    const t = -0.42 + i * 0.14;
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.075 + (i % 3) * 0.018, 12, 8), snow);
    lump.scale.set(1.25, 0.5, 0.9);
    lump.position.set(t * w, h / 2 + 0.035 - Math.abs(t) * 0.05, 0);
    g.add(lump);
  }
  return g;
}

// โซ่โลหะที่เชื่อมจุด a ไปจุด b
function chain(a: THREE.Vector3, b: THREE.Vector3, r = 0.011): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), std(GOLD, 0.3, 0.8));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

// โบว์ริบบิ้นแดงสองปีกกับหาง
function bow(size: number): THREE.Group {
  const g = new THREE.Group();
  const red = std(0xdc2643, 0.5);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(size * 0.55, size * 0.16, 8, 16), red);
    loop.position.x = s * size * 0.55;
    loop.rotation.z = s * 0.3;
    g.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 10, 8), red);
  g.add(knot);
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(size * 0.18, size * 0.9, size * 0.08), red);
    tail.position.set(s * size * 0.18, -size * 0.6, -0.02);
    tail.rotation.z = s * 0.25;
    g.add(tail);
  }
  return g;
}

// ป้ายข้างบ้าน: เสาไม้ แขนไม้ โซ่ และแผ่นป้ายที่ห้อยลงมา
// side = +1 ถ้าบ้านอยู่ทางซ้ายของป้าย (ป้ายอยู่ด้านขวา) และ -1 ถ้ากลับกัน
function buildSignArm(tex: THREE.Texture, side: number): THREE.Group {
  const g = new THREE.Group();
  const poleX = side * 2.05;
  const armY = 1.74;
  const boardX = side * 1.52;
  const boardY = 1.16;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, armY + 0.02, 10), std(WOOD, 0.8));
  pole.position.set(poleX, (armY + 0.02) / 2, 0.3);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.05), std(WOOD, 0.8));
  arm.position.set(poleX - side * 0.31, armY, 0.3);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0xffffff, 0.4));
  cap.position.set(poleX, armY + 0.04, 0.3);
  g.add(pole, arm, cap);

  const board = buildBoard(tex, BOARD_W, BOARD_H, WOOD);
  board.position.set(boardX, boardY, 0.3);
  board.rotation.y = side * -0.18;
  g.add(board);
  const topY = boardY + BOARD_H / 2 + 0.02;
  const ax = poleX - side * 0.12;
  for (const dx of [-0.32, 0.32]) {
    const bx = boardX + dx;
    const from = new THREE.Vector3(ax - side * (dx > 0 ? 0.1 : 0.22), armY - 0.03, 0.3);
    const to = new THREE.Vector3(bx, topY, 0.3);
    g.add(chain(from, to));
  }
  const bw = bow(0.1);
  bw.position.set(boardX, topY + 0.02, 0.36);
  g.add(bw);
  return g;
}

// ตัวป้ายของ Exclusive: ชื่อและข้อความขึ้นบนแผ่นไม้ 3 มิติ
function giantBoardTexture(name: string, message: string, style: BoardStyle): THREE.CanvasTexture {
  return makeCanvasTexture(1024, Math.round((1024 * BOARD_H) / BOARD_W), (g, w, h) => {
    drawGiantBoard(g, 16, 16, w - 32, h - 32, { name, message, style });
  });
}

// ตั้งบ้านหิมะพร้อมป้ายตามลุคที่เลือก ทั้งบนฉากและในหน้าตัวอย่าง
export function buildGiantFigure(opts: { look: GiantLook; name: string; message: string; side: number }): Scenery {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(GIANT_SCALE);
  group.add(body);
  const cottage = buildCottage({ body: opts.look.body, lights: opts.look.lights, deco: opts.look.deco });
  body.add(cottage.group);
  const tex = giantBoardTexture(opts.name, opts.message, (opts.look.board as BoardStyle) ?? "spruce");
  body.add(buildSignArm(tex, opts.side));
  return {
    group,
    update: (t, reduced) => cottage.update(t, reduced),
  };
}

// ---------- ป้ายชื่อโซนคำอวยพร: แผ่นไม้เขียวเข้มขอบทอง วางบนยอดซุ้มประตู ----------
export const ZONE_SIGN_W = 3.1;
export const ZONE_SIGN_H = 0.82;

function drawZoneSign(g: CanvasRenderingContext2D, w: number, h: number) {
  const f = fonts().sky;
  const r = h * 0.14;
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#1b5a44");
  grd.addColorStop(1, "#0b2e22");
  g.fillStyle = grd;
  g.beginPath();
  g.roundRect(8, 8, w - 16, h - 16, r);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = "#e3c27a";
  g.beginPath();
  g.roundRect(8, 8, w - 16, h - 16, r);
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = "rgba(246,217,138,0.7)";
  g.beginPath();
  g.roundRect(34, 34, w - 68, h - 68, r * 0.6);
  g.stroke();
  // ดาวและเกล็ดหิมะที่มุมและกลาง
  const star = (x: number, y: number, s: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? s * 0.42 : s;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  star(w * 0.07, h * 0.5, h * 0.12, "#f6d98a");
  star(w * 0.93, h * 0.5, h * 0.12, "#f6d98a");
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#f6e7bf";
  g.font = `700 ${Math.round(h * 0.36)}px ${f}`;
  g.fillText("โซนคำอวยพร", w / 2, h * 0.5);
  g.fillStyle = "rgba(246,217,138,0.85)";
  g.font = `500 ${Math.round(h * 0.11)}px ${f}`;
  g.letterSpacing = `${Math.round(h * 0.02)}px`;
  g.fillText("ส่งคำอวยพรจากใจถึงทุกคนในห้อง", w / 2, h * 0.8);
}

export function buildZoneSign(): THREE.Group {
  const tex = makeCanvasTexture(1400, Math.round((1400 * ZONE_SIGN_H) / ZONE_SIGN_W), drawZoneSign);
  const g = buildBoard(tex, ZONE_SIGN_W, ZONE_SIGN_H, 0x0f3d2e, 0.12);
  // โบว์แดงที่มุมซ้ายบน
  const bw = bow(0.16);
  bw.position.set(-ZONE_SIGN_W / 2 + 0.22, ZONE_SIGN_H / 2 - 0.02, 0.1);
  g.add(bw);
  return g;
}

