// หมู่บ้านคำอวยพร: โซนการ์ดแบบใหม่ที่เข้าธีมเดียวกับต้นคริสต์มาสหลัก
// - กำแพงไม้รอบโซน ซุ้มประตูไม้เท้าลูกกวาด และป้ายชื่อโซน
// - กำแพงการ์ดสองหน้ามีหลังคาจั่ว วางสองวงรอบต้นสนกลางลาน (ผังมาจาก layout.ts)
// - บ้านหิมะ 4 มุม เสาไฟถนน ต้นสน ของขวัญ และประกายไฟลอยในอากาศ
// - ซองการ์ดวาดแบบ instancing: ชื่อทุกใบวาดลงแผ่นรวม (atlas) แผ่นละ 400 ใบ จึงรองรับได้มากกว่า 1,000 ใบ
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ZONE, ZONE_CARD_SLOTS, ZONE_GATE_HALF, ZONE_RAIL_Y, ZONE_WALLS, type ZoneCardSlot } from "@/lib/christmas/layout";
import { buildTreeModel } from "./treeModel";
import { buildCottage, candyStripes, giftBox, miniPine, snowman, woodMaterial } from "./zoneScenery";
import { buildZoneSign, ZONE_SIGN_H } from "./giantSign";

export type VillageCard = { id: string; envelope: string; name: string };
export type CardEntry = { id: string; pos: THREE.Vector3; normal: THREE.Vector3 };
export type WishVillage = {
  group: THREE.Group; // วางไว้ที่จุดกลางโซน
  staticRoot: THREE.Group; // ชิ้นที่ไม่ขยับ (ให้ฉากรวมเมชเพื่อลดจำนวนการวาด)
  setCards: (list: VillageCard[]) => void;
  pickCard: (ray: THREE.Raycaster) => string | null;
  cardEntries: () => CardEntry[];
  update: (t: number, reduced: boolean, camPos: THREE.Vector3) => void;
  dispose: () => void;
};

const HALF = ZONE.half;
const WALL_TOP = 2.5; // ความสูงกำแพงการ์ด (ราวบนสุดอยู่ที่ 2.25)
const CARD_W = 0.42;
const CARD_H = 0.27;
const CARD_DROP = 0.27; // ซองห้อยต่ำกว่าราว
const CARD_OUT = 0.03; // ซองอยู่หน้ากำแพงเล็กน้อย

// สีซอง: [พื้น, ฝาซอง, ตัวอักษร]
const ENV_HEX: Record<string, [string, string, string]> = {
  red: ["#b91c3c", "#9b1630", "#ffffff"],
  gold: ["#d9a93a", "#b98a2a", "#ffffff"],
  green: ["#1f7a4d", "#16603b", "#ffffff"],
  white: ["#f4efe3", "#e0d6bf", "#3b2a14"],
  pink: ["#f9a8d4", "#f472b6", "#5b1a3a"],
  blue: ["#93c5fd", "#60a5fa", "#0f2a4a"],
};

// ---------- แผ่นรวมลายซอง: ช่องละ 128×80 พิกเซล 16 คอลัมน์ × 25 แถว ----------
const ATLAS_W = 2048;
const ATLAS_H = 2048;
const CELL_W = 128;
const CELL_H = 80;
const COLS = ATLAS_W / CELL_W;
const ROWS = Math.floor(ATLAS_H / CELL_H);
const PER_ATLAS = COLS * ROWS;

function drawEnvelope(g: CanvasRenderingContext2D, x0: number, y0: number, env: string, name: string) {
  const w = CELL_W - 4;
  const h = CELL_H - 4;
  const x = x0 + 2;
  const y = y0 + 2;
  const [c1, c2, ink] = ENV_HEX[env] ?? ENV_HEX.red;
  g.fillStyle = c1;
  g.fillRect(x, y, w, h);
  g.fillStyle = c2;
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x + w / 2, y + h * 0.52);
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w / 2, y + h * 0.52);
  g.lineTo(x + w, y);
  g.closePath();
  g.fill();
  // ขอบทองบาง ๆ และตราประทับ
  g.strokeStyle = "rgba(255,215,106,0.85)";
  g.lineWidth = 2;
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = "#ffd76a";
  g.beginPath();
  g.arc(x + w / 2, y + h * 0.56, 6.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#b3261e";
  g.beginPath();
  g.arc(x + w / 2, y + h * 0.56, 3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ink;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "700 10px 'IBM Plex Sans Thai', sans-serif";
  g.fillText("✦ อวยพร ✦", x + w / 2, y + 11);
  g.font = "600 13px 'IBM Plex Sans Thai', sans-serif";
  g.fillText(name.slice(0, 14), x + w / 2, y + h - 12, w - 8);
}

// ---------- พื้นลานหมู่บ้าน: หิมะ ทางหินวงกลมรอบต้นสน ทางเดินวงแหวน และทางจากประตู ----------
function groundTexture(): THREE.CanvasTexture {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const k = S / (HALF * 2 + 0.6); // พิกเซลต่อหน่วย
  const c = S / 2;
  // หิมะ: ไล่สีเบา ๆ และจุดประกาย
  const base = g.createRadialGradient(c, c, 0, c, c, S * 0.7);
  base.addColorStop(0, "#f4f8fc");
  base.addColorStop(1, "#e2ebf4");
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? "200,214,230" : "255,255,255"},${0.25 + rnd() * 0.4})`;
    g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
  }
  // หินปูพื้น: วาดเป็นก้อนโค้งมนเรียงตามวงหรือแนวตรง มีหิมะบางเกาะตามร่อง
  const stone = (x: number, y: number, w: number, h: number, rot: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const tone = 168 + Math.floor(rnd() * 40);
    g.fillStyle = `rgb(${tone + 14},${tone + 4},${tone - 10})`;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.35);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.beginPath();
    g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h * 0.35, Math.min(w, h) * 0.3);
    g.fill();
    g.restore();
  };
  const ringStones = (r0: number, r1: number) => {
    for (let r = r0; r < r1; r += 0.42) {
      const n = Math.floor((Math.PI * 2 * r) / 0.5);
      const off = rnd() * 0.5;
      for (let i = 0; i < n; i++) {
        const a = ((i + off) / n) * Math.PI * 2;
        stone(c + Math.cos(a) * r * k, c + Math.sin(a) * r * k, 0.44 * k, 0.34 * k, a + Math.PI / 2 + (rnd() - 0.5) * 0.2);
      }
    }
  };
  g.fillStyle = "rgba(120,110,96,0.35)";
  g.beginPath();
  g.arc(c, c, 4.7 * k, 0, Math.PI * 2);
  g.fill();
  ringStones(0.3, 4.6);
  // ทางเดินวงแหวนระหว่างกำแพงสองวง
  g.fillStyle = "rgba(120,110,96,0.3)";
  g.beginPath();
  g.arc(c, c, 9.35 * k, 0, Math.PI * 2);
  g.arc(c, c, 7.35 * k, 0, Math.PI * 2, true);
  g.fill();
  ringStones(7.45, 9.3);
  // ทางจากประตู (ด้าน +z ของโซน = ด้านล่างของภาพ) เข้ามาถึงลานกลาง
  for (let z = 4.6; z < HALF + 0.3; z += 0.42) {
    for (let x = -1.25; x <= 1.26; x += 0.5) {
      stone(c + (x + (Math.round(z / 0.42) % 2 ? 0.25 : 0)) * k, c + z * k, 0.44 * k, 0.34 * k, (rnd() - 0.5) * 0.15);
    }
  }
  // ขอบทองบาง ๆ รอบลานกลาง
  g.strokeStyle = "rgba(201,162,74,0.75)";
  g.lineWidth = 0.08 * k;
  g.beginPath();
  g.arc(c, c, 4.68 * k, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildWishVillage(opts: { glowTex: THREE.Texture; small: boolean }): WishVillage {
  const { glowTex, small } = opts;
  const group = new THREE.Group();
  group.position.set(ZONE.x, 0, ZONE.z);
  const staticRoot = new THREE.Group();
  group.add(staticRoot);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const M = <T extends THREE.Material>(m: T) => (mats.push(m), m);
  const T = <X extends THREE.Texture>(t: X) => (texs.push(t), t);
  const updaters: ((t: number, reduced: boolean) => void)[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // วัสดุหลักของหมู่บ้าน (โทนเดียวกับต้นหลัก: ไม้อุ่น แดงเข้ม ทอง เขียวสน)
  const wood = woodMaterial();
  const walnut = M(new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.85 }));
  const roofRed = M(new THREE.MeshStandardMaterial({ color: 0x8e1b2a, roughness: 0.7 }));
  const gold = M(new THREE.MeshStandardMaterial({ color: 0xd4a94a, roughness: 0.32, metalness: 0.8 }));
  const snow = M(new THREE.MeshStandardMaterial({ color: 0xf6faff, roughness: 0.55 }));
  const stoneMat = M(new THREE.MeshStandardMaterial({ color: 0xcfc6b6, roughness: 0.9 }));
  const iron = M(new THREE.MeshStandardMaterial({ color: 0x1f2320, roughness: 0.45, metalness: 0.6 }));
  const pine = M(new THREE.MeshStandardMaterial({ color: 0x1d5a35, roughness: 0.85 }));
  const berry = M(new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.35 }));

  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(G(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ---------- พื้นลาน ----------
  const groundGeo = G(new THREE.PlaneGeometry(HALF * 2 + 0.6, HALF * 2 + 0.6));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, M(new THREE.MeshStandardMaterial({ map: T(groundTexture()), roughness: 0.85 })));
  ground.position.y = 0.02;
  ground.receiveShadow = true;
  staticRoot.add(ground);

  // ไฟประดับทั้งหมดของหมู่บ้านรวมเป็นชุดเดียว (หลอด + แสงฟุ้ง) กระพริบด้วยการเปลี่ยนสี
  const bulbPos: THREE.Vector3[] = [];
  const bulbCol: THREE.Color[] = [];
  const BULB_COLS = [0xffd76a, 0xff5a6e, 0xfff1d0, 0x86efac, 0xffb347];
  const warmCols = [0xffd38a, 0xfff1d0];
  const pushBulb = (p: THREE.Vector3, hex: number) => {
    bulbPos.push(p);
    bulbCol.push(new THREE.Color(hex));
  };

  // ---------- กำแพงการ์ด: เสาไม้สองต้น ฉากหลังไม้เข้ม ราว 4 ชั้น หลังคาจั่วสีแดงมีหิมะ ----------
  const wallParts = { wood: [] as THREE.BufferGeometry[], walnut: [] as THREE.BufferGeometry[], roof: [] as THREE.BufferGeometry[], snow: [] as THREE.BufferGeometry[], gold: [] as THREE.BufferGeometry[], stone: [] as THREE.BufferGeometry[], pine: [] as THREE.BufferGeometry[], berry: [] as THREE.BufferGeometry[] };
  const place = (geo: THREE.BufferGeometry, mtx: THREE.Matrix4) => geo.applyMatrix4(mtx);
  function wallGeometry(len: number, mtx: THREE.Matrix4, withRoof: boolean) {
    const L = len + 0.2;
    for (const s of [-1, 1]) {
      const px = s * (L / 2);
      wallParts.wood.push(place(new THREE.CylinderGeometry(0.08, 0.1, WALL_TOP + 0.35, 10).translate(px, (WALL_TOP + 0.35) / 2, 0), mtx));
      wallParts.stone.push(place(new THREE.BoxGeometry(0.3, 0.24, 0.3).translate(px, 0.12, 0), mtx));
      wallParts.gold.push(place(new THREE.SphereGeometry(0.07, 10, 8).translate(px, WALL_TOP + 0.4, 0), mtx));
    }
    // ฉากหลังไม้เข้ม ทำให้ซองสีสดเด่นขึ้น
    wallParts.walnut.push(place(new THREE.BoxGeometry(L - 0.1, WALL_TOP - 0.2, 0.05).translate(0, 0.2 + (WALL_TOP - 0.2) / 2, 0), mtx));
    // ราวกลมทั้งสองหน้าสำหรับแขวนซอง
    for (const y of ZONE_RAIL_Y) {
      for (const s of [-1, 1]) {
        wallParts.wood.push(place(new THREE.CylinderGeometry(0.032, 0.032, L - 0.12, 8).rotateZ(Math.PI / 2).translate(0, y + 0.02, s * 0.06), mtx));
      }
    }
    // คิ้วบนและฐานกำแพง
    wallParts.wood.push(place(new THREE.BoxGeometry(L, 0.1, 0.16).translate(0, WALL_TOP, 0), mtx));
    wallParts.wood.push(place(new THREE.BoxGeometry(L, 0.14, 0.14).translate(0, 0.12, 0), mtx));
    if (withRoof) {
      // หลังคาจั่ว: สองแผ่นเอียงพบกันที่สันหลังคา มีหิมะทับด้านบน
      const span = 0.36;
      const pitch = 0.55;
      for (const s of [-1, 1]) {
        const roof = new THREE.BoxGeometry(L + 0.5, 0.05, span);
        roof.rotateX(s * pitch);
        roof.translate(0, WALL_TOP + 0.3, s * Math.cos(pitch) * span * 0.5);
        wallParts.roof.push(place(roof, mtx));
        const cap = new THREE.BoxGeometry(L + 0.46, 0.05, span * 0.9);
        cap.rotateX(s * pitch);
        cap.translate(0, WALL_TOP + 0.34, s * Math.cos(pitch) * span * 0.47);
        wallParts.snow.push(place(cap, mtx));
      }
      wallParts.gold.push(place(new THREE.CylinderGeometry(0.03, 0.03, L + 0.5, 8).rotateZ(Math.PI / 2).translate(0, WALL_TOP + 0.4, 0), mtx));
      // พวงหรีดเล็กบนหน้าจั่วทั้งสองด้าน
      for (const s of [-1, 1]) {
        wallParts.pine.push(place(new THREE.TorusGeometry(0.13, 0.045, 8, 20).translate(0, WALL_TOP + 0.12, s * 0.13), mtx));
        wallParts.berry.push(place(new THREE.SphereGeometry(0.04, 8, 6).translate(0, WALL_TOP - 0.01, s * 0.17), mtx));
      }
    }
  }
  const tmpPos = new THREE.Vector3();
  for (const w of ZONE_WALLS) {
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(w.x - ZONE.x, 0, w.z - ZONE.z), q.setFromAxisAngle(up, w.ry), new THREE.Vector3(1, 1, 1));
    wallGeometry(w.len, mtx, true);
    // ไฟใต้ชายคาทั้งสองหน้า
    const n = Math.round(w.len / 0.42);
    for (let i = 0; i <= n; i++) {
      const tx = -w.len / 2 - 0.2 + ((w.len + 0.4) * i) / n;
      for (const s of [-1, 1]) {
        tmpPos.set(tx, WALL_TOP + 0.1 - 0.05 * Math.sin((i / n) * Math.PI), s * 0.36).applyMatrix4(mtx);
        pushBulb(tmpPos.clone(), BULB_COLS[(i + (s > 0 ? 0 : 2)) % BULB_COLS.length]);
      }
    }
  }

  // ---------- กำแพงรอบโซน: แผงไม้ต่อเนื่อง เสาหินทุกช่วง ไฟบนสันกำแพง พวงมาลัยด้านนอก ----------
  type Seg = { a: THREE.Vector2; b: THREE.Vector2; out: THREE.Vector2 };
  const segs: Seg[] = [
    { a: new THREE.Vector2(-HALF, HALF), b: new THREE.Vector2(-ZONE_GATE_HALF - 0.3, HALF), out: new THREE.Vector2(0, 1) },
    { a: new THREE.Vector2(ZONE_GATE_HALF + 0.3, HALF), b: new THREE.Vector2(HALF, HALF), out: new THREE.Vector2(0, 1) },
    { a: new THREE.Vector2(-HALF, -HALF), b: new THREE.Vector2(HALF, -HALF), out: new THREE.Vector2(0, -1) },
    { a: new THREE.Vector2(-HALF, -HALF), b: new THREE.Vector2(-HALF, HALF), out: new THREE.Vector2(-1, 0) },
    { a: new THREE.Vector2(HALF, -HALF), b: new THREE.Vector2(HALF, HALF), out: new THREE.Vector2(1, 0) },
  ];
  const pillarSpots: THREE.Vector2[] = [];
  const swagPts: THREE.Vector3[][] = [];
  for (const sg of segs) {
    const d = sg.b.clone().sub(sg.a);
    const len = d.length();
    const dir = d.clone().normalize();
    const mid = sg.a.clone().add(sg.b).multiplyScalar(0.5);
    // ด้านในของกำแพงหันเข้าลาน: หมุนให้แกน +z ของกำแพงชี้ออกนอกโซน
    const ry = Math.atan2(sg.out.x, sg.out.y);
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(mid.x, 0, mid.y), q.setFromAxisAngle(up, ry), new THREE.Vector3(1, 1, 1));
    // แผงหลังและราวด้านใน (ซองแขวนด้านใน ราวด้านนอกไว้แขวนพวงมาลัย)
    wallParts.walnut.push(place(new THREE.BoxGeometry(len, WALL_TOP - 0.1, 0.06).translate(0, 0.1 + (WALL_TOP - 0.1) / 2, 0.02), mtx));
    for (const y of ZONE_RAIL_Y) wallParts.wood.push(place(new THREE.CylinderGeometry(0.032, 0.032, len - 0.1, 8).rotateZ(Math.PI / 2).translate(0, y + 0.02, -0.06), mtx));
    wallParts.wood.push(place(new THREE.BoxGeometry(len, 0.12, 0.22).translate(0, WALL_TOP + 0.02, 0.02), mtx));
    wallParts.snow.push(place(new THREE.BoxGeometry(len, 0.07, 0.24).translate(0, WALL_TOP + 0.11, 0.02), mtx));
    wallParts.wood.push(place(new THREE.BoxGeometry(len, 0.16, 0.16).translate(0, 0.1, 0.02), mtx));
    // แผ่นไม้ตั้งด้านนอก ให้ดูเป็นรั้วไม้จริงจากฝั่งต้นไม้
    for (let s = 0.2; s < len - 0.1; s += 0.36) {
      wallParts.wood.push(place(new THREE.BoxGeometry(0.28, WALL_TOP - 0.25, 0.03).translate(-len / 2 + s, 0.15 + (WALL_TOP - 0.25) / 2, 0.065), mtx));
    }
    const nP = Math.max(1, Math.round(len / 3.3));
    for (let i = 0; i <= nP; i++) pillarSpots.push(sg.a.clone().addScaledVector(dir, (len * i) / nP));
    // พวงมาลัยห้อยเป็นโค้งระหว่างเสา ด้านนอก
    for (let i = 0; i < nP; i++) {
      const pa = sg.a.clone().addScaledVector(dir, (len * i) / nP);
      const pb = sg.a.clone().addScaledVector(dir, (len * (i + 1)) / nP);
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 12; j++) {
        const t = j / 12;
        const p = pa.clone().lerp(pb, t);
        pts.push(new THREE.Vector3(p.x + sg.out.x * 0.16, WALL_TOP - 0.18 - Math.sin(t * Math.PI) * 0.42, p.y + sg.out.y * 0.16));
      }
      swagPts.push(pts);
    }
    // ไฟบนสันกำแพง
    for (let s = 0.3; s < len; s += 0.55) {
      const p = sg.a.clone().addScaledVector(dir, s);
      pushBulb(new THREE.Vector3(p.x, WALL_TOP + 0.19, p.y), warmCols[Math.floor(s / 0.55) % 2]);
    }
  }
  // เสาหินมีหัวเสาและโคมไฟ (ไม่ซ้ำตำแหน่ง)
  const seen = new Set<string>();
  const lampTops: THREE.Vector3[] = [];
  for (const p of pillarSpots) {
    const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mtx = new THREE.Matrix4().makeTranslation(p.x, 0, p.y);
    wallParts.stone.push(place(new THREE.BoxGeometry(0.46, WALL_TOP + 0.3, 0.46).translate(0, (WALL_TOP + 0.3) / 2, 0), mtx));
    wallParts.stone.push(place(new THREE.BoxGeometry(0.56, 0.1, 0.56).translate(0, WALL_TOP + 0.35, 0), mtx));
    wallParts.snow.push(place(new THREE.BoxGeometry(0.5, 0.08, 0.5).translate(0, WALL_TOP + 0.44, 0), mtx));
    wallParts.walnut.push(place(new THREE.BoxGeometry(0.2, 0.26, 0.2).translate(0, WALL_TOP + 0.61, 0), mtx));
    wallParts.gold.push(place(new THREE.ConeGeometry(0.17, 0.14, 4).rotateY(Math.PI / 4).translate(0, WALL_TOP + 0.81, 0), mtx));
    lampTops.push(new THREE.Vector3(p.x, WALL_TOP + 0.61, p.y));
  }
  for (const pts of swagPts) {
    wallParts.pine.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.07, 6, false));
    const midP = pts[6];
    wallParts.berry.push(new THREE.SphereGeometry(0.06, 8, 6).translate(midP.x, midP.y - 0.04, midP.z));
  }

  // ---------- ซุ้มประตู: เสาหินคู่ โค้งไม้เท้าลูกกวาด พวงมาลัย ระฆังทอง และป้ายชื่อโซน ----------
  const GATE_Z = HALF;
  const GP = ZONE_GATE_HALF + 0.3;
  const GATE_H = 3.2;
  for (const s of [-1, 1]) {
    const mtx = new THREE.Matrix4().makeTranslation(s * GP, 0, GATE_Z);
    wallParts.stone.push(place(new THREE.BoxGeometry(0.7, GATE_H, 0.7).translate(0, GATE_H / 2, 0), mtx));
    wallParts.stone.push(place(new THREE.BoxGeometry(0.86, 0.14, 0.86).translate(0, GATE_H + 0.07, 0), mtx));
    wallParts.snow.push(place(new THREE.BoxGeometry(0.8, 0.1, 0.8).translate(0, GATE_H + 0.19, 0), mtx));
    wallParts.stone.push(place(new THREE.BoxGeometry(0.86, 0.22, 0.86).translate(0, 0.11, 0), mtx));
    lampTops.push(new THREE.Vector3(s * GP, GATE_H + 0.42, GATE_Z));
    wallParts.walnut.push(place(new THREE.BoxGeometry(0.26, 0.32, 0.26).translate(0, GATE_H + 0.4, 0), mtx));
    wallParts.gold.push(place(new THREE.ConeGeometry(0.22, 0.18, 4).rotateY(Math.PI / 4).translate(0, GATE_H + 0.65, 0), mtx));
  }
  const archPts = (rx: number, ry: number, z: number, n = 48) =>
    Array.from({ length: n }, (_, i) => {
      const th = Math.PI - (i / (n - 1)) * Math.PI;
      return new THREE.Vector3(Math.cos(th) * rx, GATE_H + 0.1 + Math.sin(th) * ry, z);
    });
  const ARCH_RX = GP - 0.45; // โค้งตั้งอยู่ด้านในของเสา ไม่ชนโคมบนหัวเสา
  const caneMat = M(new THREE.MeshStandardMaterial({ map: T(candyStripes()), roughness: 0.35 }));
  for (const z of [GATE_Z - 0.18, GATE_Z + 0.18]) {
    const arch = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts(ARCH_RX, 1.05, z)), 96, 0.1, 12, false)), caneMat);
    arch.castShadow = true;
    staticRoot.add(arch);
  }
  wallParts.pine.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts(ARCH_RX, 1.05, GATE_Z + 0.32)), 96, 0.09, 8, false));
  archPts(ARCH_RX, 1.05, GATE_Z + 0.4, 22).forEach((p, i) => pushBulb(p, BULB_COLS[i % BULB_COLS.length]));
  // คานไม้ขวางระหว่างเสา ป้ายชื่อโซนตั้งบนคานภายในโค้ง
  wallParts.wood.push(new THREE.BoxGeometry((GP - 0.35) * 2, 0.16, 0.24).translate(0, GATE_H - 0.1, GATE_Z));
  const SIGN_K = 0.9;
  const sign = buildZoneSign();
  sign.position.set(0, GATE_H - 0.02 + (ZONE_SIGN_H * SIGN_K) / 2, GATE_Z + 0.06);
  sign.scale.setScalar(SIGN_K);
  group.add(sign);
  for (const s of [-1, 1]) {
    // ระฆังทองคู่ห้อยใต้คาน
    const bell = new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0.16), new THREE.Vector2(0.05, 0.15), new THREE.Vector2(0.08, 0.06), new THREE.Vector2(0.12, 0), new THREE.Vector2(0.11, -0.01)],
      14,
    );
    wallParts.gold.push(bell.translate(s * 1.55, GATE_H - 0.42, GATE_Z + 0.16));
    wallParts.gold.push(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 5).translate(s * 1.55, GATE_H - 0.21, GATE_Z + 0.16));
    wallParts.berry.push(new THREE.SphereGeometry(0.06, 8, 6).translate(s * 1.55, GATE_H - 0.12, GATE_Z + 0.16));
  }
  // ไม้เท้าลูกกวาดยักษ์คู่หน้าประตู
  for (const s of [-1, 1]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(0.06, 1.72, 0),
      new THREE.Vector3(0.3, 1.86, 0),
      new THREE.Vector3(0.52, 1.72, 0),
      new THREE.Vector3(0.56, 1.5, 0),
    ]);
    const cane = new THREE.Mesh(G(new THREE.TubeGeometry(path, 48, 0.07, 10, false)), caneMat);
    cane.position.set(s * (GP + 1.0), 0, GATE_Z + 0.9);
    cane.rotation.y = s > 0 ? Math.PI : 0;
    cane.castShadow = true;
    staticRoot.add(cane);
  }

  // รวมชิ้นกำแพงทั้งหมดเป็นเมชเดียวต่อวัสดุ
  const partMat: Record<keyof typeof wallParts, THREE.Material> = { wood, walnut, roof: roofRed, snow, gold, stone: stoneMat, pine, berry };
  (Object.keys(wallParts) as (keyof typeof wallParts)[]).forEach((k) => {
    const list = wallParts[k];
    if (!list.length) return;
    const nonIdx = list.map((g) => (g.index ? g.toNonIndexed() : g));
    // ทุกชิ้นต้องมีชุดแอตทริบิวต์เดียวกันจึงจะรวมได้
    nonIdx.forEach((g) => {
      for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    });
    const merged = mergeGeometries(nonIdx);
    list.forEach((g) => g.dispose());
    nonIdx.forEach((g) => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(G(merged), partMat[k]);
    mesh.castShadow = k !== "snow";
    mesh.receiveShadow = true;
    mesh.userData.animated = true; // รวมแล้ว ไม่ต้องรวมซ้ำ
    group.add(mesh);
  });

  // ---------- ต้นสนกลางลาน บนแท่นหินกลมสองชั้น ----------
  add(staticRoot, new THREE.CylinderGeometry(2.6, 2.75, 0.16, 48), stoneMat, 0, 0.08, 0);
  add(staticRoot, new THREE.CylinderGeometry(2.1, 2.2, 0.16, 48), stoneMat, 0, 0.24, 0);
  add(staticRoot, new THREE.TorusGeometry(2.12, 0.035, 8, 64).rotateX(Math.PI / 2), gold, 0, 0.32, 0, false);
  const miniTree = buildTreeModel({ variant: "vintage", small: true, glowTex });
  miniTree.group.scale.setScalar(0.7);
  miniTree.group.position.y = 0.3;
  miniTree.group.userData.animated = true;
  group.add(miniTree.group);
  updaters.push(miniTree.update);
  // ของขวัญรอบแท่น
  const giftCols = [0xdc2643, 0x1f7a4d, 0xf5c542, 0x3b82f6, 0xfff6e6];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    if (Math.abs(Math.sin(a) - 1) < 0.06) continue;
    const gb = giftBox(0.34 + (i % 3) * 0.08, giftCols[i % giftCols.length], i % 2 ? 0xf5c542 : 0xfff6e6);
    gb.position.set(Math.cos(a) * 2.95, 0, Math.sin(a) * 2.95);
    gb.rotation.y = a * 1.7;
    staticRoot.add(gb);
  }

  // ---------- เสาไฟถนนแบบโบราณ: ตามทางเดินวงแหวน และสองข้างทางจากประตู ----------
  const lampSpots: THREE.Vector2[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.1) continue;
    lampSpots.push(new THREE.Vector2(Math.cos(a) * 8.35, Math.sin(a) * 8.35));
  }
  for (const s of [-1, 1]) {
    lampSpots.push(new THREE.Vector2(s * 1.7, 5.4), new THREE.Vector2(s * 1.7, 11.6));
  }
  const lampParts: THREE.BufferGeometry[] = [];
  const LAMP_H = 2.7;
  for (const p of lampSpots) {
    lampParts.push(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10).translate(p.x, 0.15, p.y));
    lampParts.push(new THREE.CylinderGeometry(0.045, 0.06, LAMP_H, 8).translate(p.x, LAMP_H / 2, p.y));
    lampParts.push(new THREE.CylinderGeometry(0.15, 0.1, 0.06, 8).translate(p.x, LAMP_H + 0.02, p.y));
    lampParts.push(new THREE.ConeGeometry(0.2, 0.2, 6).translate(p.x, LAMP_H + 0.44, p.y));
    lampParts.push(new THREE.SphereGeometry(0.04, 8, 6).translate(p.x, LAMP_H + 0.58, p.y));
    for (const [dx, dz] of [
      [0.1, 0.1],
      [-0.1, 0.1],
      [0.1, -0.1],
      [-0.1, -0.1],
    ]) {
      lampParts.push(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4).translate(p.x + dx, LAMP_H + 0.2, p.y + dz));
    }
    lampTops.push(new THREE.Vector3(p.x, LAMP_H + 0.2, p.y));
  }
  const lampGeo = mergeGeometries(lampParts.map((g) => g.toNonIndexed()));
  lampParts.forEach((g) => g.dispose());
  if (lampGeo) {
    const lampMesh = new THREE.Mesh(G(lampGeo), iron);
    lampMesh.castShadow = true;
    lampMesh.userData.animated = true;
    group.add(lampMesh);
  }
  // แก้วโคมเรืองแสง
  const glassGeo = G(new THREE.BoxGeometry(0.17, 0.26, 0.17));
  const glassMesh = new THREE.InstancedMesh(glassGeo, M(new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })), lampTops.length);
  lampTops.forEach((p, i) => glassMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  glassMesh.frustumCulled = false;
  group.add(glassMesh);
  const lampGlowGeo = G(new THREE.BufferGeometry());
  lampGlowGeo.setAttribute("position", new THREE.Float32BufferAttribute(lampTops.flatMap((p) => [p.x, p.y, p.z]), 3));
  const lampGlow = new THREE.Points(lampGlowGeo, M(new THREE.PointsMaterial({ color: 0xffc46b, size: 1.5, map: glowTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
  lampGlow.frustumCulled = false;
  group.add(lampGlow);
  // แสงจริงสองดวงให้พื้นลานอุ่นขึ้น (จอเล็กไม่ใช้ เพื่อประหยัด)
  if (!small) {
    for (const [x, z] of [
      [0, 6],
      [0, -6],
    ]) {
      const pl = new THREE.PointLight(0xffc27a, 6, 14, 2);
      pl.position.set(x, 3.2, z);
      group.add(pl);
    }
  }

  // ---------- บ้านหิมะ 4 มุม หันหน้าเข้าหาต้นสนกลางลาน ----------
  const looks = [
    { body: "cream", lights: "gold", deco: ["gift", "snowman", "pine", "none", "star"] },
    { body: "blush", lights: "multi", deco: ["pine", "gift", "none", "snowman", "star"] },
    { body: "mint", lights: "red", deco: ["snowman", "none", "gift", "pine", "star"] },
    { body: "sky", lights: "blue", deco: ["gift", "pine", "snowman", "none", "star"] },
  ];
  [
    [-10.7, 10.4],
    [10.7, 10.4],
    [-10.7, -10.7],
    [10.7, -10.7],
  ].forEach(([x, z], i) => {
    const c = buildCottage(looks[i]);
    c.group.position.set(x, 0, z);
    c.group.scale.setScalar(0.95);
    c.group.rotation.y = Math.atan2(-x, -z);
    c.group.userData.animated = true;
    group.add(c.group);
    updaters.push(c.update);
  });

  // ---------- ต้นสน ตุ๊กตาหิมะ และกองของขวัญ ระหว่างกำแพงวงนอกกับรั้ว ----------
  const propSpots: [number, number, string][] = [
    [-11.5, 0, "snowman"],
    [11.5, 0, "snowman"],
    [0, -11.5, "snowman"],
    [-8.3, 11.3, "gift"],
    [8.3, 11.3, "gift"],
    [-8.2, -11.3, "gift"],
    [8.4, -11.3, "gift"],
  ];
  propSpots.forEach(([x, z, kind], i) => {
    let o: THREE.Object3D;
    if (kind === "pine") o = miniPine(2.6 + (i % 3) * 0.35, 1.5);
    else if (kind === "snowman") {
      o = snowman();
      o.scale.setScalar(1.8);
      o.rotation.y = Math.atan2(-x, -z) - Math.PI / 2;
    } else {
      const gg = new THREE.Group();
      [
        [0, 0, 0.5, 0],
        [0.45, 0.15, 0.36, 1],
        [-0.38, 0.2, 0.32, 2],
        [0.08, 0.45, 0.28, 3],
      ].forEach(([gx, gz, sz, ci]) => {
        const b = giftBox(sz, giftCols[ci % giftCols.length], ci % 2 ? 0xfff6e6 : 0xf5c542);
        b.position.set(gx, 0, gz);
        b.rotation.y = ci * 0.6;
        gg.add(b);
      });
      o = gg;
    }
    o.position.set(x, 0, z);
    staticRoot.add(o);
  });
  // ต้นสนใหญ่ด้านนอกรั้ว ให้หมู่บ้านดูอยู่กลางป่าหิมะ
  const outer: [number, number, number][] = [
    [-HALF - 1.8, 8, 1.3],
    [-HALF - 2.2, 1, 1.6],
    [-HALF - 1.6, -6, 1.2],
    [-HALF - 2.4, -11, 1.5],
    [HALF + 1.8, 8.5, 1.4],
    [HALF + 2.3, 1.5, 1.2],
    [HALF + 1.7, -5.5, 1.6],
    [HALF + 2.2, -11.5, 1.3],
    [-9, -HALF - 2, 1.5],
    [-2, -HALF - 2.4, 1.3],
    [5, -HALF - 1.9, 1.6],
    [11, -HALF - 2.3, 1.2],
    [-9.5, HALF + 2.2, 1.1],
    [9.8, HALF + 2.0, 1.2],
  ];
  outer.forEach(([x, z, sc]) => {
    const t = miniPine(3.6 * sc, 2.0 * sc);
    t.position.set(x, 0, z);
    staticRoot.add(t);
  });
  staticRoot.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });

  // ---------- หลอดไฟและแสงฟุ้งทั้งหมด ----------
  const bulbs = new THREE.InstancedMesh(G(new THREE.SphereGeometry(0.045, 8, 6)), M(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), Math.max(1, bulbPos.length));
  bulbPos.forEach((p, i) => {
    bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    bulbs.setColorAt(i, bulbCol[i]);
  });
  bulbs.frustumCulled = false;
  group.add(bulbs);
  const haloPos = new Float32Array(bulbPos.length * 3);
  const haloCol = new Float32Array(bulbPos.length * 3);
  bulbPos.forEach((p, i) => haloPos.set([p.x, p.y, p.z], i * 3));
  const haloGeo = G(new THREE.BufferGeometry());
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  const halos = new THREE.Points(haloGeo, M(new THREE.PointsMaterial({ size: 0.42, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  halos.frustumCulled = false;
  group.add(halos);
  const haloAttr = haloGeo.getAttribute("color") as THREE.BufferAttribute;
  const phase = bulbPos.map((_, i) => (i * 2.399) % (Math.PI * 2));

  // ---------- ประกายแสงลอยขึ้นช้า ๆ เหนือลาน ----------
  const SPARK = small ? 120 : 260;
  const sparkPos = new Float32Array(SPARK * 3);
  const sparkSeed = new Float32Array(SPARK * 3);
  for (let i = 0; i < SPARK; i++) {
    sparkSeed[i * 3] = (Math.random() * 2 - 1) * (HALF - 0.5);
    sparkSeed[i * 3 + 1] = Math.random();
    sparkSeed[i * 3 + 2] = (Math.random() * 2 - 1) * (HALF - 0.5);
  }
  const sparkGeo = G(new THREE.BufferGeometry());
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, M(new THREE.PointsMaterial({ color: 0xffe6a8, size: 0.16, map: glowTex, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })));
  sparks.frustumCulled = false;
  group.add(sparks);

  // ---------- ซองการ์ด (instancing) ----------
  const cardGeo = G(new THREE.PlaneGeometry(CARD_W, CARD_H).translate(0, -CARD_DROP, CARD_OUT));
  const hookGeo = (() => {
    const hook = new THREE.TorusGeometry(0.05, 0.008, 6, 14).rotateY(Math.PI / 2).translate(0, 0, 0).toNonIndexed();
    const chainLen = CARD_DROP - CARD_H / 2 - 0.02;
    const chain = new THREE.CylinderGeometry(0.005, 0.005, chainLen, 5).translate(0, -0.03 - chainLen / 2, CARD_OUT * 0.6).toNonIndexed();
    for (const g of [hook, chain]) g.deleteAttribute("uv");
    const merged = mergeGeometries([hook, chain])!;
    hook.dispose();
    chain.dispose();
    return G(merged);
  })();
  const hookMat = M(new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.3, metalness: 0.8 }));
  type Atlas = { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; mat: THREE.MeshStandardMaterial; mesh: THREE.InstancedMesh | null; cellAttr: THREE.InstancedBufferAttribute | null };
  const atlases: Atlas[] = [];
  let hookMesh: THREE.InstancedMesh | null = null;
  let entries: (CardEntry & { slot: ZoneCardSlot; atlas: number; local: number })[] = [];
  let lastKey = "";
  function makeAtlas(): Atlas {
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_W;
    canvas.height = ATLAS_H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    // เลือกช่องในแผ่นรวมจากแอตทริบิวต์ของแต่ละใบ
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nattribute vec4 aCell;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aCell.xy + vMapUv * aCell.zw;\n#endif");
    };
    return { canvas, tex, mat, mesh: null, cellAttr: null };
  }
  function clearCards() {
    for (const a of atlases) {
      if (a.mesh) {
        group.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.dispose();
        a.mesh = null;
      }
    }
    if (hookMesh) {
      group.remove(hookMesh);
      hookMesh.dispose();
      hookMesh = null;
    }
  }
  const cE = new THREE.Euler(0, 0, 0, "YXZ");
  const cQ = new THREE.Quaternion();
  const cP = new THREE.Vector3();
  const cS = new THREE.Vector3(1, 1, 1);
  const cardMatrix = (slot: ZoneCardSlot, swing: number, out: THREE.Matrix4) => {
    cE.set(0, slot.ry, swing, "YXZ");
    return out.compose(cP.set(slot.x - ZONE.x, slot.y, slot.z - ZONE.z), cQ.setFromEuler(cE), cS);
  };
  function setCards(list: VillageCard[]) {
    const shown = list.slice(0, ZONE_CARD_SLOTS.length);
    const key = shown.map((c) => `${c.id}:${c.envelope}:${c.name}`).join("|");
    if (key === lastKey) return;
    lastKey = key;
    clearCards();
    entries = [];
    if (!shown.length) return;
    const need = Math.ceil(shown.length / PER_ATLAS);
    while (atlases.length < need) atlases.push(makeAtlas());
    const counts = new Array(need).fill(0);
    shown.forEach((c, i) => {
      const a = Math.floor(i / PER_ATLAS);
      const local = i % PER_ATLAS;
      counts[a]++;
      const slot = ZONE_CARD_SLOTS[i];
      const normal = new THREE.Vector3(Math.sin(slot.ry), 0, Math.cos(slot.ry));
      const pos = new THREE.Vector3(slot.x, slot.y - CARD_DROP, slot.z).addScaledVector(normal, CARD_OUT);
      entries.push({ id: c.id, pos, normal, slot, atlas: a, local });
    });
    for (let a = 0; a < need; a++) {
      const at = atlases[a];
      const g = at.canvas.getContext("2d");
      if (g) {
        g.clearRect(0, 0, ATLAS_W, ATLAS_H);
        entries.forEach((en, i) => {
          if (en.atlas !== a) return;
          drawEnvelope(g, (en.local % COLS) * CELL_W, Math.floor(en.local / COLS) * CELL_H, shown[i].envelope, shown[i].name);
        });
      }
      at.tex.needsUpdate = true;
      const geo = cardGeo.clone();
      const cell = new Float32Array(counts[a] * 4);
      const mesh = new THREE.InstancedMesh(geo, at.mat, counts[a]);
      let j = 0;
      for (const en of entries) {
        if (en.atlas !== a) continue;
        const cx = en.local % COLS;
        const cy = Math.floor(en.local / COLS);
        // พิกัด uv ของ three นับจากล่าง ส่วนผืนผ้าใบนับจากบน
        cell.set([(cx * CELL_W + 2) / ATLAS_W, 1 - ((cy + 1) * CELL_H - 2) / ATLAS_H, (CELL_W - 4) / ATLAS_W, (CELL_H - 4) / ATLAS_H], j * 4);
        mesh.setMatrixAt(j, cardMatrix(en.slot, 0, m4));
        j++;
      }
      const attr = new THREE.InstancedBufferAttribute(cell, 4);
      geo.setAttribute("aCell", attr);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData.atlas = a;
      at.mesh = mesh;
      at.cellAttr = attr;
      group.add(mesh);
    }
    hookMesh = new THREE.InstancedMesh(hookGeo, hookMat, entries.length);
    entries.forEach((en, i) => hookMesh!.setMatrixAt(i, cardMatrix(en.slot, 0, m4)));
    hookMesh.frustumCulled = false;
    group.add(hookMesh);
  }
  function pickCard(ray: THREE.Raycaster): string | null {
    const meshes = atlases.map((a) => a.mesh).filter((m): m is THREE.InstancedMesh => Boolean(m));
    if (!meshes.length) return null;
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const a = hit.object.userData.atlas as number;
    let k = -1;
    for (const en of entries) {
      if (en.atlas !== a) continue;
      k++;
      if (k === hit.instanceId) return en.id;
    }
    return null;
  }

  const zoneCenter = new THREE.Vector3(ZONE.x, 1, ZONE.z);
  let frame = 0;
  function update(t: number, reduced: boolean, camPos: THREE.Vector3) {
    frame++;
    const near = camPos.distanceTo(zoneCenter) < HALF * 3.2;
    updaters.forEach((u) => u(t, reduced));
    // ไฟกระพริบเป็นจังหวะคลื่น
    for (let i = 0; i < bulbCol.length; i++) {
      const b = reduced ? 0.85 : 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.2 + phase[i]));
      haloAttr.setXYZ(i, bulbCol[i].r * b, bulbCol[i].g * b, bulbCol[i].b * b);
    }
    haloAttr.needsUpdate = true;
    (lampGlow.material as THREE.PointsMaterial).opacity = reduced ? 0.7 : 0.6 + 0.1 * Math.sin(t * 4.7) * Math.sin(t * 1.9);
    if (!near) return;
    // ประกายลอยขึ้นแล้ววนกลับลงพื้น
    for (let i = 0; i < SPARK; i++) {
      const h = (sparkSeed[i * 3 + 1] + (reduced ? 0 : t * 0.04)) % 1;
      sparkPos[i * 3] = sparkSeed[i * 3] + Math.sin(t * 0.5 + i) * 0.3;
      sparkPos[i * 3 + 1] = 0.3 + h * 5.5;
      sparkPos[i * 3 + 2] = sparkSeed[i * 3 + 2] + Math.cos(t * 0.4 + i * 1.3) * 0.3;
    }
    (sparkGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    // ซองแกว่งเบา ๆ (คำนวณทุกสองเฟรม เพื่อประหยัดเมื่อมีการ์ดหลายร้อยใบ)
    if (reduced || frame % 2 || !entries.length) return;
    const counters = atlases.map(() => 0);
    entries.forEach((en, i) => {
      const swing = Math.sin(t * 1.5 + i * 0.7) * 0.06;
      cardMatrix(en.slot, swing, m4);
      const mesh = atlases[en.atlas].mesh;
      if (mesh) mesh.setMatrixAt(counters[en.atlas]++, m4);
      hookMesh?.setMatrixAt(i, m4);
    });
    atlases.forEach((a) => a.mesh && (a.mesh.instanceMatrix.needsUpdate = true));
    if (hookMesh) hookMesh.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    clearCards();
    atlases.forEach((a) => {
      a.tex.dispose();
      a.mat.dispose();
    });
    miniTree.dispose();
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((tx) => tx.dispose());
  }

  return { group, staticRoot, setCards, pickCard, cardEntries: () => entries, update, dispose };
}
