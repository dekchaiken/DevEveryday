// หมู่บ้านคำอวยพรแบบวงกลม (ผังจาก layout.ts)
// - กำแพงการ์ดสามวงรอบต้นสนกลางลาน มีทางเดินวงแหวนสองวงคั่น ทุกหน้าการ์ดหันเข้าหาทางเดิน จึงไม่มีการ์ดถูกบัง
// - วงนอกสุดเป็นขอบหมู่บ้าน ด้านนอกแต่งพวงมาลัย มีซุ้มประตูไม้เท้าลูกกวาดหันเข้าหาต้นคริสต์มาสหลัก
// - ซองการ์ดวาดแบบ instancing จากแผ่นรวมลายซอง (แผ่นละ 400 ใบ) การแกว่งคำนวณบนการ์ดจอ
// - ไฟกะพริบและประกายแสงคำนวณบนการ์ดจอทั้งหมด (glowPoints) ต่อเฟรมเหลือแค่ตั้งค่าเวลา
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ZONE, ZONE_CARD_SLOTS, ZONE_GATE_ANGLE, ZONE_RAIL_Y, ZONE_RINGS, ZONE_WALL_R, ZONE_WALL_TOP, ZONE_WALKWAYS, ZONE_WALLS, type ZoneCardSlot } from "@/lib/christmas/layout";
import { buildTreeModel } from "./treeModel";
import { buildCottage, candyStripes, giftBox, miniPine, woodMaterial } from "./zoneScenery";
import { buildZoneSign, ZONE_SIGN_H } from "./giantSign";
import { glowPoints } from "./glowPoints";

export type VillageCard = { id: string; envelope: string; name: string };
export type CardEntry = { id: string; pos: THREE.Vector3; normal: THREE.Vector3; stop: number };
export type WishVillage = {
  group: THREE.Group; // วางไว้ที่จุดกลางโซน
  staticRoot: THREE.Group; // ชิ้นที่ไม่ขยับ (ให้ฉากรวมเมชเพื่อลดจำนวนการวาด)
  setCards: (list: VillageCard[]) => void;
  pickCard: (ray: THREE.Raycaster) => string | null;
  cardEntries: () => CardEntry[];
  highlight: (id: string | null) => void;
  update: (t: number, reduced: boolean, camPos: THREE.Vector3) => void;
  dispose: () => void;
};

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

// ---------- พื้นหมู่บ้าน: หิมะ ลานหินกลาง ทางเดินวงแหวนสองวง และทางจากประตู ----------
const GROUND_R = ZONE_WALL_R + 1.4;
function groundTexture(): THREE.CanvasTexture {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const k = S / (GROUND_R * 2); // พิกเซลต่อหน่วย
  const c = S / 2;
  const base = g.createRadialGradient(c, c, 0, c, c, S * 0.5);
  base.addColorStop(0, "#f2f6fb");
  base.addColorStop(0.92, "#e6eef6");
  base.addColorStop(1, "rgba(230,238,246,0)");
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? "200,214,230" : "255,255,255"},${0.25 + rnd() * 0.4})`;
    g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
  }
  const stone = (x: number, y: number, w: number, h: number, rot: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const tone = 166 + Math.floor(rnd() * 40);
    g.fillStyle = `rgb(${tone + 14},${tone + 4},${tone - 10})`;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.35);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.26)";
    g.beginPath();
    g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h * 0.35, Math.min(w, h) * 0.3);
    g.fill();
    g.restore();
  };
  const ring = (r0: number, r1: number) => {
    g.fillStyle = "rgba(110,100,88,0.32)";
    g.beginPath();
    g.arc(c, c, r1 * k, 0, Math.PI * 2);
    if (r0 > 0) g.arc(c, c, r0 * k, 0, Math.PI * 2, true);
    g.fill();
    for (let r = Math.max(r0, 0.3) + 0.2; r < r1 - 0.1; r += 0.42) {
      const n = Math.floor((Math.PI * 2 * r) / 0.5);
      const off = rnd();
      for (let i = 0; i < n; i++) {
        const a = ((i + off) / n) * Math.PI * 2;
        stone(c + Math.cos(a) * r * k, c + Math.sin(a) * r * k, 0.44 * k, 0.34 * k, a + Math.PI / 2 + (rnd() - 0.5) * 0.2);
      }
    }
  };
  ring(0, 3.6);
  for (const w of ZONE_WALKWAYS) ring(w.inner + 0.25, w.outer - 0.25);
  // ทางตรงจากประตูถึงลานกลาง (แกน x ของภาพ = x โลก, แกน y ของภาพ = z โลก)
  const ga = ZONE_GATE_ANGLE;
  for (let d = 3.4; d < GROUND_R; d += 0.42) {
    for (let s = -1.25; s <= 1.26; s += 0.5) {
      const off = Math.round(d / 0.42) % 2 ? 0.25 : 0;
      const px = Math.cos(ga) * d - Math.sin(ga) * (s + off);
      const pz = Math.sin(ga) * d + Math.cos(ga) * (s + off);
      stone(c + px * k, c + pz * k, 0.44 * k, 0.34 * k, ga + Math.PI / 2 + (rnd() - 0.5) * 0.15);
    }
  }
  g.strokeStyle = "rgba(201,162,74,0.8)";
  g.lineWidth = 0.08 * k;
  g.beginPath();
  g.arc(c, c, 3.62 * k, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// การแกว่งของซองทำบนการ์ดจอ: หมุนรอบจุดแขวน (จุดกำเนิดของแต่ละ instance) ตามเวลาและลำดับใบ
function swayMaterial(mat: THREE.Material, time: { value: number }) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nattribute vec4 aCell;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat swA = sin(uTime * 1.5 + float(gl_InstanceID) * 0.7) * 0.05;\nfloat swC = cos(swA);\nfloat swS = sin(swA);\ntransformed.xy = vec2(swC * transformed.x - swS * transformed.y, swS * transformed.x + swC * transformed.y);",
      )
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aCell.xy + vMapUv * aCell.zw;\n#endif");
  };
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
  const glows: { setTime: (t: number, r: boolean) => void; dispose: () => void }[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const M = <T extends THREE.Material>(m: T) => (mats.push(m), m);
  const T = <X extends THREE.Texture>(t: X) => (texs.push(t), t);
  const updaters: ((t: number, reduced: boolean) => void)[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);

  const wood = woodMaterial();
  const walnut = M(new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.85 }));
  const roofRed = M(new THREE.MeshStandardMaterial({ color: 0x8e1b2a, roughness: 0.7 }));
  const gold = M(new THREE.MeshStandardMaterial({ color: 0xd4a94a, roughness: 0.32, metalness: 0.8 }));
  const snow = M(new THREE.MeshStandardMaterial({ color: 0xf6faff, roughness: 0.55 }));
  const stoneMat = M(new THREE.MeshStandardMaterial({ color: 0xcfc6b6, roughness: 0.9 }));
  const pine = M(new THREE.MeshStandardMaterial({ color: 0x1d5a35, roughness: 0.85 }));
  const berry = M(new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.35 }));

  // ---------- พื้นหมู่บ้าน ----------
  const groundGeo = G(new THREE.CircleGeometry(GROUND_R, 96));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, M(new THREE.MeshStandardMaterial({ map: T(groundTexture()), roughness: 0.85, transparent: true, depthWrite: false })));
  ground.position.y = 0.02;
  ground.receiveShadow = true;
  ground.renderOrder = 1;
  ground.userData.animated = true; // โปร่งใส ไม่รวมกับชิ้นอื่น
  group.add(ground);

  // หลอดไฟทั้งหมดรวมเป็นชุดเดียว
  const bulbPos: number[] = [];
  const bulbCol: number[] = [];
  const BULB_COLS = [0xffd76a, 0xff5a6e, 0xfff1d0, 0x86efac, 0xffb347].map((h) => new THREE.Color(h));
  const WARM = [new THREE.Color(0xffd38a), new THREE.Color(0xfff1d0)];
  const pushBulb = (p: THREE.Vector3, c: THREE.Color) => {
    bulbPos.push(p.x, p.y, p.z);
    bulbCol.push(c.r, c.g, c.b);
  };
  const lampTops: THREE.Vector3[] = [];

  // ---------- ชิ้นส่วนกำแพงทั้งหมด รวมเป็นเมชเดียวต่อวัสดุ ----------
  const parts: Record<"wood" | "walnut" | "roof" | "snow" | "gold" | "stone" | "pine" | "berry", THREE.BufferGeometry[]> = {
    wood: [],
    walnut: [],
    roof: [],
    snow: [],
    gold: [],
    stone: [],
    pine: [],
    berry: [],
  };
  const put = (k: keyof typeof parts, geo: THREE.BufferGeometry, mtx?: THREE.Matrix4) => parts[k].push(mtx ? geo.applyMatrix4(mtx) : geo);
  const tmp = new THREE.Vector3();

  ZONE_WALLS.forEach((w) => {
    const ring = ZONE_RINGS[w.ring];
    const outer = w.ring === ZONE_RINGS.length - 1;
    const mtx = new THREE.Matrix4().compose(tmp.set(w.x - ZONE.x, 0, w.z - ZONE.z), q.setFromAxisAngle(up, w.ry), one);
    const L = w.len + 0.1;
    // ฉากหลังไม้เข้ม ราวกลมด้านที่แขวนซอง คิ้วบนและฐาน
    put("walnut", new THREE.BoxGeometry(L, ZONE_WALL_TOP - 0.15, 0.06).translate(0, 0.15 + (ZONE_WALL_TOP - 0.15) / 2, 0), mtx);
    for (const side of ring.faces) {
      for (const y of ZONE_RAIL_Y) put("wood", new THREE.CylinderGeometry(0.03, 0.03, L - 0.1, 6).rotateZ(Math.PI / 2).translate(0, y + 0.02, side * 0.06), mtx);
    }
    put("wood", new THREE.BoxGeometry(L + 0.06, 0.12, 0.2).translate(0, ZONE_WALL_TOP, 0), mtx);
    put("wood", new THREE.BoxGeometry(L, 0.16, 0.16).translate(0, 0.1, 0), mtx);
    if (outer) {
      // วงนอกสุด: ด้านนอกเป็นแผ่นไม้ตั้งแบบรั้วจริง แต่งพวงมาลัยห้อยโค้งและพวงหรีด
      for (let s = 0.18; s < L - 0.1; s += 0.36) put("wood", new THREE.BoxGeometry(0.28, ZONE_WALL_TOP - 0.3, 0.03).translate(-L / 2 + s, 0.16 + (ZONE_WALL_TOP - 0.3) / 2, 0.045), mtx);
      put("snow", new THREE.BoxGeometry(L + 0.04, 0.07, 0.22).translate(0, ZONE_WALL_TOP + 0.09, 0), mtx);
      const swag: THREE.Vector3[] = [];
      for (let j = 0; j <= 12; j++) {
        const t = j / 12;
        swag.push(new THREE.Vector3(-L / 2 + L * t, ZONE_WALL_TOP - 0.2 - Math.sin(t * Math.PI) * 0.45, 0.12));
      }
      put("pine", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(swag), 16, 0.07, 6, false), mtx);
      put("pine", new THREE.TorusGeometry(0.22, 0.07, 6, 16).translate(0, 1.55, 0.12), mtx);
      put("berry", new THREE.SphereGeometry(0.07, 8, 6).translate(0, 1.32, 0.16), mtx);
      for (let s = 0.25; s < L; s += 0.5) {
        tmp.set(-L / 2 + s, ZONE_WALL_TOP + 0.17, 0).applyMatrix4(mtx);
        pushBulb(tmp.clone(), WARM[Math.round(s * 2) % 2]);
      }
    } else {
      // วงในมีหลังคาจั่วสีแดงหิมะเกาะ ไฟใต้ชายคาทั้งสองด้าน
      const span = 0.36;
      const pitch = 0.55;
      for (const s of [-1, 1]) {
        put("roof", new THREE.BoxGeometry(L + 0.5, 0.05, span).rotateX(s * pitch).translate(0, ZONE_WALL_TOP + 0.3, s * Math.cos(pitch) * span * 0.5), mtx);
        put("snow", new THREE.BoxGeometry(L + 0.46, 0.05, span * 0.9).rotateX(s * pitch).translate(0, ZONE_WALL_TOP + 0.34, s * Math.cos(pitch) * span * 0.47), mtx);
        put("pine", new THREE.TorusGeometry(0.13, 0.045, 6, 16).translate(0, ZONE_WALL_TOP + 0.12, s * 0.13), mtx);
        put("berry", new THREE.SphereGeometry(0.04, 8, 6).translate(0, ZONE_WALL_TOP - 0.01, s * 0.17), mtx);
        const n = 9;
        for (let i = 0; i <= n; i++) {
          tmp.set(-L / 2 - 0.2 + ((L + 0.4) * i) / n, ZONE_WALL_TOP + 0.1 - 0.05 * Math.sin((i / n) * Math.PI), s * 0.36).applyMatrix4(mtx);
          pushBulb(tmp.clone(), BULB_COLS[(i + (s > 0 ? 0 : 2)) % BULB_COLS.length]);
        }
      }
      put("gold", new THREE.CylinderGeometry(0.03, 0.03, L + 0.5, 6).rotateZ(Math.PI / 2).translate(0, ZONE_WALL_TOP + 0.4, 0), mtx);
    }
  });

  // เสาระหว่างแผง: วงนอกเป็นเสาหินมีโคมบนหัว วงในเป็นเสาไม้หัวทอง
  ZONE_RINGS.forEach((ring, ri) => {
    const outer = ri === ZONE_RINGS.length - 1;
    for (let k = 0; k < ring.count; k++) {
      const a = ZONE_GATE_ANGLE + ((k + 0.5) / ring.count) * Math.PI * 2;
      const x = Math.cos(a) * ring.r;
      const z = Math.sin(a) * ring.r;
      const mtx = new THREE.Matrix4().compose(tmp.set(x, 0, z), q.setFromAxisAngle(up, Math.atan2(Math.cos(a), Math.sin(a))), one);
      if (outer) {
        put("stone", new THREE.BoxGeometry(0.5, ZONE_WALL_TOP + 0.35, 0.5).translate(0, (ZONE_WALL_TOP + 0.35) / 2, 0), mtx);
        put("stone", new THREE.BoxGeometry(0.6, 0.1, 0.6).translate(0, ZONE_WALL_TOP + 0.4, 0), mtx);
        put("snow", new THREE.BoxGeometry(0.54, 0.08, 0.54).translate(0, ZONE_WALL_TOP + 0.49, 0), mtx);
        put("walnut", new THREE.BoxGeometry(0.2, 0.26, 0.2).translate(0, ZONE_WALL_TOP + 0.66, 0), mtx);
        put("gold", new THREE.ConeGeometry(0.17, 0.14, 4).rotateY(Math.PI / 4).translate(0, ZONE_WALL_TOP + 0.86, 0), mtx);
        lampTops.push(new THREE.Vector3(x, ZONE_WALL_TOP + 0.66, z));
      } else {
        put("wood", new THREE.CylinderGeometry(0.08, 0.1, ZONE_WALL_TOP + 0.4, 8).translate(0, (ZONE_WALL_TOP + 0.4) / 2, 0), mtx);
        put("stone", new THREE.BoxGeometry(0.3, 0.24, 0.3).translate(0, 0.12, 0), mtx);
        put("gold", new THREE.SphereGeometry(0.075, 10, 8).translate(0, ZONE_WALL_TOP + 0.46, 0), mtx);
      }
    }
  });

  // ---------- ซุ้มประตูที่วงนอก หันหน้าเข้าหาต้นคริสต์มาสหลัก ----------
  const ga = ZONE_GATE_ANGLE;
  const gateMtx = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(ga) * ZONE_WALL_R, 0, Math.sin(ga) * ZONE_WALL_R), new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(Math.cos(ga), Math.sin(ga))), one);
  const GP = Math.sin(Math.PI / ZONE_RINGS[2].count) * ZONE_WALL_R + 0.05; // ระยะครึ่งช่องประตูถึงเสา
  const GATE_H = 3.6;
  for (const s of [-1, 1]) {
    put("stone", new THREE.BoxGeometry(0.72, GATE_H, 0.72).translate(s * GP, GATE_H / 2, 0), gateMtx);
    put("stone", new THREE.BoxGeometry(0.88, 0.14, 0.88).translate(s * GP, GATE_H + 0.07, 0), gateMtx);
    put("snow", new THREE.BoxGeometry(0.82, 0.1, 0.82).translate(s * GP, GATE_H + 0.19, 0), gateMtx);
    put("walnut", new THREE.BoxGeometry(0.26, 0.32, 0.26).translate(s * GP, GATE_H + 0.4, 0), gateMtx);
    put("gold", new THREE.ConeGeometry(0.22, 0.18, 4).rotateY(Math.PI / 4).translate(s * GP, GATE_H + 0.65, 0), gateMtx);
    lampTops.push(new THREE.Vector3(s * GP, GATE_H + 0.4, 0).applyMatrix4(gateMtx));
  }
  const ARCH_RX = GP - 0.45;
  const archPts = (rx: number, ry: number, z: number, n = 48) =>
    Array.from({ length: n }, (_, i) => {
      const th = Math.PI - (i / (n - 1)) * Math.PI;
      return new THREE.Vector3(Math.cos(th) * rx, GATE_H + 0.1 + Math.sin(th) * ry, z);
    });
  const caneMat = M(new THREE.MeshStandardMaterial({ map: T(candyStripes()), roughness: 0.35 }));
  for (const z of [-0.18, 0.18]) {
    const arch = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts(ARCH_RX, 1.05, z)), 64, 0.1, 10, false).applyMatrix4(gateMtx)), caneMat);
    arch.castShadow = true;
    staticRoot.add(arch);
  }
  put("pine", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts(ARCH_RX, 1.05, 0.32)), 64, 0.09, 6, false), gateMtx);
  archPts(ARCH_RX, 1.05, 0.42, 22).forEach((p, i) => pushBulb(p.applyMatrix4(gateMtx), BULB_COLS[i % BULB_COLS.length]));
  put("wood", new THREE.BoxGeometry((GP - 0.36) * 2, 0.16, 0.24).translate(0, GATE_H - 0.1, 0), gateMtx);
  const SIGN_K = 0.9;
  const sign = buildZoneSign();
  sign.scale.setScalar(SIGN_K);
  sign.position.set(0, GATE_H - 0.02 + (ZONE_SIGN_H * SIGN_K) / 2, 0.06);
  const signHolder = new THREE.Group();
  signHolder.applyMatrix4(gateMtx);
  signHolder.add(sign);
  group.add(signHolder);
  for (const s of [-1, 1]) {
    const bell = new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0.16), new THREE.Vector2(0.05, 0.15), new THREE.Vector2(0.08, 0.06), new THREE.Vector2(0.12, 0), new THREE.Vector2(0.11, -0.01)],
      12,
    );
    put("gold", bell.translate(s * (GP - 0.9), GATE_H - 0.42, 0.16), gateMtx);
    put("gold", new THREE.CylinderGeometry(0.01, 0.01, 0.14, 5).translate(s * (GP - 0.9), GATE_H - 0.21, 0.16), gateMtx);
    put("berry", new THREE.SphereGeometry(0.06, 8, 6).translate(s * (GP - 0.9), GATE_H - 0.12, 0.16), gateMtx);
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
    const cane = new THREE.Mesh(G(new THREE.TubeGeometry(path, 40, 0.07, 8, false)), caneMat);
    const local = new THREE.Matrix4().compose(new THREE.Vector3(s * (GP + 1.0), 0, 0.9), new THREE.Quaternion().setFromAxisAngle(up, s > 0 ? Math.PI : 0), one);
    cane.applyMatrix4(new THREE.Matrix4().multiplyMatrices(gateMtx, local));
    cane.castShadow = true;
    staticRoot.add(cane);
  }

  // รวมชิ้นส่วนตามวัสดุ
  const partMat: Record<keyof typeof parts, THREE.Material> = { wood, walnut, roof: roofRed, snow, gold, stone: stoneMat, pine, berry };
  (Object.keys(parts) as (keyof typeof parts)[]).forEach((k) => {
    const list = parts[k];
    if (!list.length) return;
    const flat = list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const name of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(name)) n.deleteAttribute(name);
      if (!n.getAttribute("uv")) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2));
      return n;
    });
    const merged = mergeGeometries(flat);
    list.forEach((g) => g.dispose());
    flat.forEach((g) => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(G(merged), partMat[k]);
    mesh.castShadow = k !== "snow";
    mesh.receiveShadow = true;
    mesh.userData.animated = true;
    group.add(mesh);
  });

  // ---------- ต้นสนกลางลานบนแท่นหินกลมสองชั้น ----------
  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(G(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    staticRoot.add(m);
    return m;
  };
  addMesh(new THREE.CylinderGeometry(2.4, 2.55, 0.16, 48), stoneMat, 0, 0.08, 0);
  addMesh(new THREE.CylinderGeometry(1.95, 2.05, 0.16, 48), stoneMat, 0, 0.24, 0);
  addMesh(new THREE.TorusGeometry(1.97, 0.035, 6, 64).rotateX(Math.PI / 2), gold, 0, 0.32, 0);
  const miniTree = buildTreeModel({ variant: "vintage", small: true, glowTex, starLight: false });
  miniTree.group.scale.setScalar(0.62);
  miniTree.group.position.y = 0.3;
  miniTree.group.userData.animated = true;
  group.add(miniTree.group);
  updaters.push(miniTree.update);
  const giftCols = [0xdc2643, 0x1f7a4d, 0xf5c542, 0x3b82f6, 0xfff6e6];
  for (let i = 0; i < 8; i++) {
    const a = ga + ((i + 0.5) / 8) * Math.PI * 2;
    const gb = giftBox(0.32 + (i % 3) * 0.07, giftCols[i % giftCols.length], i % 2 ? 0xf5c542 : 0xfff6e6);
    gb.position.set(Math.cos(a) * 2.75, 0, Math.sin(a) * 2.75);
    gb.rotation.y = a * 1.7;
    staticRoot.add(gb);
  }

  // ---------- บ้านหิมะสองหลังข้างประตู และต้นสนรอบนอกหมู่บ้าน ----------
  const looks = [
    { body: "cream", lights: "gold", deco: ["gift", "snowman", "pine", "none", "star"] },
    { body: "blush", lights: "multi", deco: ["pine", "gift", "none", "snowman", "star"] },
  ];
  [-1, 1].forEach((s, i) => {
    const a = ga + s * 0.42;
    const c = buildCottage(looks[i]);
    c.group.position.set(Math.cos(a) * (ZONE_WALL_R + 1.6), 0, Math.sin(a) * (ZONE_WALL_R + 1.6));
    c.group.scale.setScalar(0.9);
    c.group.rotation.y = Math.atan2(Math.cos(ga), Math.sin(ga)) - s * 0.25;
    c.group.userData.animated = true;
    group.add(c.group);
    updaters.push(c.update);
  });
  for (let k = 0; k < 14; k++) {
    const a = ga + Math.PI * 0.32 + (k / 13) * Math.PI * 1.36;
    const r = ZONE_WALL_R + 1.5 + (k % 3) * 0.5;
    const t = miniPine(3.2 + (k % 4) * 0.45, 1.6 + (k % 2) * 0.3);
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    staticRoot.add(t);
  }
  staticRoot.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });

  // ---------- โคมบนหัวเสา: แก้วเรืองแสงและแสงฟุ้ง ----------
  const glassMesh = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.15, 0.22, 0.15)), M(new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })), lampTops.length);
  lampTops.forEach((p, i) => glassMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  glassMesh.computeBoundingSphere();
  group.add(glassMesh);
  const warmGlow = new THREE.Color(0xffc46b);
  const lampGlow = glowPoints({ positions: lampTops.flatMap((p) => [p.x, p.y, p.z]), colors: lampTops.flatMap(() => [warmGlow.r, warmGlow.g, warmGlow.b]), size: 1.4, map: glowTex, opacity: 0.75, twinkle: 0.15 });
  group.add(lampGlow.points);
  glows.push(lampGlow);

  // ---------- หลอดไฟ: เม็ดหลอดจริง (instancing) และแสงฟุ้งที่กะพริบบนการ์ดจอ ----------
  const nb = bulbPos.length / 3;
  const bulbs = new THREE.InstancedMesh(G(new THREE.SphereGeometry(0.045, 6, 4)), M(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), Math.max(1, nb));
  for (let i = 0; i < nb; i++) {
    bulbs.setMatrixAt(i, m4.makeTranslation(bulbPos[i * 3], bulbPos[i * 3 + 1], bulbPos[i * 3 + 2]));
    bulbs.setColorAt(i, new THREE.Color(bulbCol[i * 3], bulbCol[i * 3 + 1], bulbCol[i * 3 + 2]));
  }
  bulbs.computeBoundingSphere();
  group.add(bulbs);
  const halos = glowPoints({ positions: bulbPos, colors: bulbCol, size: 0.42, map: glowTex });
  group.add(halos.points);
  glows.push(halos);

  // ---------- ประกายแสงลอยขึ้นช้า ๆ เหนือลาน ----------
  const SPARK = small ? 110 : 220;
  const sp: number[] = [];
  const sc: number[] = [];
  const spark = new THREE.Color(0xffe6a8);
  for (let i = 0; i < SPARK; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (ZONE_WALL_R - 0.5);
    sp.push(Math.cos(a) * r, Math.random() * 5.5, Math.sin(a) * r);
    sc.push(spark.r, spark.g, spark.b);
  }
  const sparks = glowPoints({ positions: sp, colors: sc, size: 0.16, map: glowTex, opacity: 0.8, rise: 0.22, riseHeight: 5.5 });
  group.add(sparks.points);
  glows.push(sparks);

  // ---------- ซองการ์ด (instancing จากแผ่นรวมลาย) ----------
  const swayTime = { value: 0 };
  const cardGeo = G(new THREE.PlaneGeometry(CARD_W, CARD_H).translate(0, -CARD_DROP, CARD_OUT));
  // คลิปทองเล็ก ๆ จากราวลงมาจับขอบบนของซอง (กล่องบาง 12 สามเหลี่ยม)
  const clipLen = CARD_DROP - CARD_H / 2 + 0.02;
  const clipGeo = G(new THREE.BoxGeometry(0.035, clipLen, 0.012).translate(0, -clipLen / 2 + 0.02, CARD_OUT * 0.7));
  const clipMat = M(new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.3, metalness: 0.8 }));
  swayMaterial(clipMat, swayTime);
  type Atlas = { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; mat: THREE.MeshStandardMaterial; mesh: THREE.InstancedMesh | null };
  const atlases: Atlas[] = [];
  let clipMesh: THREE.InstancedMesh | null = null;
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
    swayMaterial(mat, swayTime);
    return { canvas, tex, mat, mesh: null };
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
    if (clipMesh) {
      group.remove(clipMesh);
      clipMesh.dispose();
      clipMesh = null;
    }
  }
  const cE = new THREE.Euler(0, 0, 0, "YXZ");
  const cQ = new THREE.Quaternion();
  const cP = new THREE.Vector3();
  const cardMatrix = (slot: ZoneCardSlot, out: THREE.Matrix4) => {
    cE.set(0, slot.ry, 0, "YXZ");
    return out.compose(cP.set(slot.x - ZONE.x, slot.y, slot.z - ZONE.z), cQ.setFromEuler(cE), one);
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
      counts[a]++;
      const slot = ZONE_CARD_SLOTS[i];
      const normal = new THREE.Vector3(Math.sin(slot.ry), 0, Math.cos(slot.ry));
      const pos = new THREE.Vector3(slot.x, slot.y - CARD_DROP, slot.z).addScaledVector(normal, CARD_OUT);
      entries.push({ id: c.id, pos, normal, stop: slot.stop, slot, atlas: a, local: i % PER_ATLAS });
    });
    for (let a = 0; a < need; a++) {
      const at = atlases[a];
      const g = at.canvas.getContext("2d");
      if (g) {
        g.clearRect(0, 0, ATLAS_W, ATLAS_H);
        entries.forEach((en, i) => {
          if (en.atlas === a) drawEnvelope(g, (en.local % COLS) * CELL_W, Math.floor(en.local / COLS) * CELL_H, shown[i].envelope, shown[i].name);
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
        mesh.setMatrixAt(j, cardMatrix(en.slot, m4));
        j++;
      }
      geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 4));
      mesh.receiveShadow = true;
      mesh.userData.atlas = a;
      mesh.computeBoundingSphere();
      at.mesh = mesh;
      group.add(mesh);
    }
    clipMesh = new THREE.InstancedMesh(clipGeo, clipMat, entries.length);
    entries.forEach((en, i) => clipMesh!.setMatrixAt(i, cardMatrix(en.slot, m4)));
    clipMesh.computeBoundingSphere();
    group.add(clipMesh);
  }
  function pickCard(ray: THREE.Raycaster): string | null {
    const meshes = atlases.map((a) => a.mesh).filter((m): m is THREE.InstancedMesh => Boolean(m));
    if (!meshes.length) return null;
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const a = hit.object.userData.atlas as number;
    return entries.find((en) => en.atlas === a && en.local === hit.instanceId)?.id ?? null;
  }

  // กรอบแสงทองรอบซองที่เลือก (ตอนพาไปดูการ์ดของเรา)
  const hlMat = M(new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const hl = new THREE.Mesh(G(new THREE.PlaneGeometry(0.9, 0.7)), hlMat);
  hl.visible = false;
  group.add(hl);
  let hlAt = -1;
  function highlight(id: string | null) {
    const en = id ? entries.find((e) => e.id === id) : null;
    if (!en) {
      hl.visible = false;
      return;
    }
    hl.position.set(en.pos.x - ZONE.x, en.pos.y, en.pos.z - ZONE.z).addScaledVector(en.normal, -0.005);
    hl.rotation.set(0, en.slot.ry, 0);
    hl.visible = true;
    hlAt = -2;
  }

  function update(t: number, reduced: boolean, camPos: THREE.Vector3) {
    swayTime.value = reduced ? 0 : t;
    for (const gl of glows) gl.setTime(t, reduced);
    if (hl.visible) {
      if (hlAt === -2) hlAt = t;
      hlMat.opacity = 0.9 * (reduced ? 1 : 0.6 + 0.4 * Math.sin((t - hlAt) * 4));
    }
    // ต้นสนกลางลานและบ้านหิมะขยับเฉพาะตอนกล้องอยู่ใกล้
    if (camPos.distanceTo(group.position) < 45) updaters.forEach((u) => u(t, reduced));
  }

  function dispose() {
    clearCards();
    atlases.forEach((a) => {
      a.tex.dispose();
      a.mat.dispose();
    });
    glows.forEach((g) => g.dispose());
    miniTree.dispose();
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((tx) => tx.dispose());
  }

  return { group, staticRoot, setCards, pickCard, cardEntries: () => entries, highlight, update, dispose };
}
