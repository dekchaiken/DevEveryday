// โมเดลต้นคริสต์มาสหลัก: พุ่มสนจากกิ่งจริงหลายร้อยกิ่ง (วาดใบสนลงเท็กซ์เจอร์ แล้ววาดกิ่งแบบ instancing)
// มีลำต้น หิมะบนกิ่ง ไฟประดับ สายลูกปัดหรือริบบิ้น ของประดับบนกิ่ง ดาวบนยอด ผ้าคลุมโคน และกล่องของขวัญ
// เลือกได้ 3 ธีม ทุกธีมใช้รูปทรงเดียวกับ geometry.ts จึงแขวนลูกบอลได้ตำแหน่งเดียวกัน
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { radiusAt, TREE_BASE_Y, TREE_H, TREE_R0, TREE_TOP_Y } from "./geometry";

export type TreeVariant = "classic" | "frosted" | "vintage";

type Theme = {
  needles: [string, string, string]; // เข้ม กลาง ปลายใบ
  twig: string;
  snow: number; // 0..1 ความหนาของหิมะที่เกาะบนกิ่ง
  core: number; // สีพุ่มด้านใน (อุดช่องว่าง)
  lights: number[];
  bulb: number; // ขนาดหลอดไฟ
  garland: "beads" | "ribbon";
  garlandColor: number;
  props: ("berries" | "pinecones" | "candy")[];
  skirt: number;
  skirtSheen: number;
  trim: number;
  star: number;
  starEmissive: number;
  gifts: number[];
  giftRibbon: number;
};

const THEMES: Record<TreeVariant, Theme> = {
  classic: {
    needles: ["#0d3b22", "#1c6b3a", "#5aa36a"],
    twig: "#4a3a22",
    snow: 0.28,
    core: 0x0b2a18,
    lights: [0xffd9a0, 0xffe7c2, 0xffc46b],
    bulb: 0.028,
    garland: "beads",
    garlandColor: 0xe9c25a,
    props: ["berries"],
    skirt: 0x9e1b2f,
    skirtSheen: 0xff8a9a,
    trim: 0xfbf8f2,
    star: 0xffd76a,
    starEmissive: 0xffa31a,
    gifts: [0xb91c3c, 0x1e5f3a, 0xe9c25a, 0xf3efe6, 0x2a4f8f, 0xb91c3c, 0x1e5f3a],
    giftRibbon: 0xe9c25a,
  },
  frosted: {
    needles: ["#123a33", "#2f6b5c", "#8fbfb0"],
    twig: "#3d3a32",
    snow: 0.85,
    core: 0x0e2a26,
    lights: [0xe8f4ff, 0xbfe3ff, 0xffffff, 0x9fd8ff],
    bulb: 0.026,
    garland: "beads",
    garlandColor: 0xdfe6ee,
    props: ["pinecones"],
    skirt: 0xeef3f8,
    skirtSheen: 0xffffff,
    trim: 0xc9d8e6,
    star: 0xfff1c8,
    starEmissive: 0xc8e4ff,
    gifts: [0x3b6ea8, 0xdfe6ee, 0x8aa8c8, 0xc9a24a, 0x2d4e6f, 0xeef3f8],
    giftRibbon: 0xc9d8e6,
  },
  vintage: {
    needles: ["#0f3a1e", "#22713b", "#6ab46b"],
    twig: "#4d3520",
    snow: 0,
    core: 0x0c2815,
    lights: [0xff4d4d, 0x4db8ff, 0xffd24d, 0x59e08a, 0xff9de0, 0xff8c3a],
    bulb: 0.04,
    garland: "ribbon",
    garlandColor: 0xc4182f,
    props: ["candy", "pinecones"],
    skirt: 0x7a1424,
    skirtSheen: 0xffc0c8,
    trim: 0x1b5a33,
    star: 0xffd76a,
    starEmissive: 0xff8a00,
    gifts: [0xc4182f, 0x1b5a33, 0xffd24d, 0x2f6fd6, 0xf4ead6, 0xc4182f, 0x8a4fbf],
    giftRibbon: 0xf4ead6,
  },
};

export const TREE_VARIANT_INFO: { id: TreeVariant; name: string; note: string }[] = [
  { id: "classic", name: "คลาสสิกแดงทอง", note: "หิมะบาง ไฟวอร์มไวท์ สายลูกปัดทอง เบอร์รี่แดง ผ้าคลุมกำมะหยี่แดง" },
  { id: "frosted", name: "หิมะเงิน", note: "หิมะเกาะหนา ไฟขาวฟ้า สายลูกปัดเงิน ลูกสน ผ้าคลุมขาว" },
  { id: "vintage", name: "วินเทจหลากสี", note: "ไฟดวงใหญ่หลากสี ริบบิ้นแดงพันเกลียว ไม้เท้าลูกกวาด ลูกสน" },
];

export type TreeModel = {
  group: THREE.Group;
  hitMesh: THREE.Mesh; // กรวยมองไม่เห็นสำหรับรับการแตะบนผิวต้น
  starPosition: THREE.Vector3;
  update: (t: number, reduced: boolean) => void;
  dispose: () => void;
};

// สุ่มแบบกำหนดค่าเริ่มได้ ทุกเครื่องได้ต้นไม้หน้าตาเดียวกัน
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixHex = (a: string, b: string, t: number, jitter = 0) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(Math.min(255, Math.max(0, v + (cb[i] - v) * t + jitter))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

type Twig = { x0: number; y0: number; x1: number; y1: number };

// กิ่งสนหนึ่งช่อ: กิ่งหลักกับกิ่งแขนง ใช้ทั้งวาดใบและวาดหิมะให้ตรงกัน
function sprigTwigs(seed: number, W: number, H: number): Twig[] {
  const r = rng(seed);
  const twigs: Twig[] = [];
  const mx0 = W / 2;
  const my0 = H - 6;
  const mx1 = W / 2 + (r() - 0.5) * 14;
  const my1 = 14;
  twigs.push({ x0: mx0, y0: my0, x1: mx1, y1: my1 });
  const pairs = 6;
  for (let i = 0; i < pairs; i++) {
    const t = 0.12 + (i / pairs) * 0.66;
    const px = mx0 + (mx1 - mx0) * t;
    const py = my0 + (my1 - my0) * t;
    for (const side of [-1, 1]) {
      const ang = -Math.PI / 2 + side * (0.55 + r() * 0.3);
      const len = H * (0.24 + r() * 0.12) * (1 - t * 0.55);
      twigs.push({ x0: px, y0: py, x1: px + Math.cos(ang) * len, y1: py + Math.sin(ang) * len });
    }
  }
  return twigs;
}

// เท็กซ์เจอร์ใบสน (หรือหิมะบนกิ่ง) วาดบนแคนวาส: โคนกิ่งอยู่ด้านล่าง ปลายกิ่งอยู่ด้านบน
function sprigTexture(theme: Theme, seed: number, kind: "needles" | "snow"): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = rng(seed * 7 + (kind === "snow" ? 3 : 1));
  const twigs = sprigTwigs(seed, W, H);
  g.lineCap = "round";
  if (kind === "needles") {
    const [dark, mid, tip] = theme.needles;
    twigs.forEach((tw, ti) => {
      const dx = tw.x1 - tw.x0;
      const dy = tw.y1 - tw.y0;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const steps = Math.floor(len / 4.2);
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        const px = tw.x0 + dx * f;
        const py = tw.y0 + dy * f;
        for (const side of [-1, 1]) {
          const a = ang + side * (0.8 + r() * 0.35);
          const nl = (ti === 0 ? 24 : 19) * (0.75 + r() * 0.4) * (1 - f * 0.35);
          // ใบอ่อนที่ปลายกิ่งสีสว่างกว่าโคน
          const shade = f < 0.55 ? mixHex(dark, mid, f / 0.55, (r() - 0.5) * 18) : mixHex(mid, tip, (f - 0.55) / 0.45, (r() - 0.5) * 18);
          g.strokeStyle = shade;
          g.lineWidth = 2.4 + r() * 1.4;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(a) * nl, py + Math.sin(a) * nl);
          g.stroke();
        }
      }
      g.strokeStyle = theme.twig;
      g.lineWidth = ti === 0 ? 3.6 : 2.4;
      g.beginPath();
      g.moveTo(tw.x0, tw.y0);
      g.lineTo(tw.x1, tw.y1);
      g.stroke();
    });
  } else {
    // หิมะเป็นก้อนนุ่ม ๆ เกาะตามแนวกิ่ง หนาที่ปลายกิ่ง (ตามค่า snow ของธีม)
    const amount = theme.snow;
    twigs.forEach((tw, ti) => {
      const dx = tw.x1 - tw.x0;
      const dy = tw.y1 - tw.y0;
      const len = Math.hypot(dx, dy);
      const steps = Math.floor(len / 9);
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        if (r() > amount * (0.55 + f * 0.6)) continue;
        const px = tw.x0 + dx * f + (r() - 0.5) * 8;
        const py = tw.y0 + dy * f + (r() - 0.5) * 8;
        const rad = (ti === 0 ? 11 : 8) * (0.6 + r() * 0.7) * (0.6 + amount * 0.6);
        const grd = g.createRadialGradient(px - rad * 0.25, py - rad * 0.3, rad * 0.1, px, py, rad);
        grd.addColorStop(0, "rgba(255,255,255,1)");
        grd.addColorStop(0.7, "rgba(236,244,252,0.96)");
        grd.addColorStop(1, "rgba(214,228,242,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(px, py, rad, rad * 0.78, r() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// การ์ดกิ่งหนึ่งแผ่น: แกนยาวตามแกน +X (จากลำต้นออกไป) แผ่นนอนราบ ปลายกิ่งห้อยลงเล็กน้อย
function cardGeometry(width: number, roll: number, droop: number) {
  const g = new THREE.PlaneGeometry(width, 1, 1, 6);
  g.translate(0, 0.5, 0);
  g.rotateZ(-Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  g.rotateX(roll);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setY(i, pos.getY(i) - droop * x * x);
    // แสงตกจากด้านบนเหมือนกันทุกแผ่น ต้นจึงไม่ดูเป็นแผ่นเรียบ ๆ
    nrm.setXYZ(i, 0.32, 1, 0);
  }
  return g;
}

function barkTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5b3a22";
  g.fillRect(0, 0, 64, 256);
  const r = rng(91);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = r() > 0.5 ? "rgba(40,24,12,0.7)" : "rgba(120,86,54,0.5)";
    g.lineWidth = 1 + r() * 2.5;
    const x = r() * 64;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + (r() - 0.5) * 10, 80, x + (r() - 0.5) * 10, 170, x + (r() - 0.5) * 6, 256);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function raysTexture(hex: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  g.translate(128, 128);
  for (let i = 0; i < 12; i++) {
    g.rotate(Math.PI / 6);
    const grd = g.createLinearGradient(0, 0, 0, -128);
    grd.addColorStop(0, `rgba(${rgb},0.55)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-4, 0);
    g.lineTo(0, i % 2 ? -92 : -126);
    g.lineTo(4, 0);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ribbonTexture(hex: number) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 64;
  const g = c.getContext("2d")!;
  const col = new THREE.Color(hex);
  g.fillStyle = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
  g.fillRect(0, 0, 16, 64);
  g.fillStyle = "#e9c25a";
  g.fillRect(0, 0, 16, 6);
  g.fillRect(0, 58, 16, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function candyTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fbfcff";
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#d61f3c";
  g.lineWidth = 14;
  for (let x = -64; x < 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 64, 64);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

// จุดบนผิวพุ่มที่ความสูง h และมุม a (r = สัดส่วนของรัศมี)
function onSurface(h: number, a: number, rk = 1) {
  const r = radiusAt(h) * rk;
  return new THREE.Vector3(Math.cos(a) * r, TREE_BASE_Y + h * TREE_H, Math.sin(a) * r);
}

// starLight: ไฟจุดสีทองจากดาว (ฉากใหญ่ปิดไว้ เพราะไฟจุดหนึ่งดวงทำให้ทุกวัสดุในฉากคำนวณแสงเพิ่ม)
export function buildTreeModel(opts: { variant: TreeVariant; small: boolean; glowTex: THREE.Texture; starLight?: boolean }): TreeModel {
  const theme = THEMES[opts.variant];
  const small = opts.small;
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const keepG = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const keepM = <T extends THREE.Material>(m: T) => (mats.push(m), m);
  const keepT = <T extends THREE.Texture>(t: T) => (texs.push(t), t);
  const r = rng(opts.variant === "classic" ? 11 : opts.variant === "frosted" ? 23 : 37);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();

  // ---------- ลำต้นและรากที่โผล่พ้นหิมะ ----------
  const bark = keepT(barkTexture());
  const barkMat = keepM(new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 }));
  const trunkH = TREE_BASE_Y + 1.7;
  const trunk = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.16, 0.32, trunkH, 14)), barkMat);
  trunk.position.y = trunkH / 2 - 0.02;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const root = new THREE.Mesh(keepG(new THREE.ConeGeometry(0.09, 0.56, 8)), barkMat);
    root.position.set(Math.cos(a) * 0.27, 0.07, Math.sin(a) * 0.27);
    root.rotation.set(0, -a, Math.PI / 2 - 0.35);
    root.rotation.order = "YZX";
    group.add(root);
  }

  // ---------- แกนพุ่มด้านในสีเข้ม อุดช่องว่างระหว่างกิ่ง ----------
  const core = new THREE.Mesh(
    keepG(new THREE.ConeGeometry(TREE_R0 * 0.74, TREE_H * 0.97, 28, 1, true)),
    keepM(new THREE.MeshStandardMaterial({ color: theme.core, roughness: 1 })),
  );
  core.position.y = TREE_BASE_Y + (TREE_H * 0.97) / 2;
  core.castShadow = true;
  group.add(core);

  // ---------- กิ่งสน: การ์ดสามแผ่นไขว้กันต่อกิ่ง วาดทั้งต้นด้วย instancing ----------
  const needleTex = keepT(sprigTexture(theme, 5, "needles"));
  const branchGeo = keepG(mergeGeometries([cardGeometry(0.62, 0, 0.16), cardGeometry(0.5, 0.95, 0.12), cardGeometry(0.5, -0.95, 0.12)])!);
  const needleMat = keepM(new THREE.MeshStandardMaterial({ map: needleTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.86, metalness: 0 }));
  type Branch = { m: THREE.Matrix4; tone: number };
  const branches: Branch[] = [];
  const tiers = small ? 24 : 34;
  for (let k = 0; k < tiers; k++) {
    const h = 0.015 + (k / (tiers - 1)) * 0.9;
    const count = Math.max(5, Math.round((small ? 14 : 19) * Math.pow(1 - h, 0.75) + 4));
    for (let j = 0; j < count; j++) {
      const az = (j / count) * Math.PI * 2 + k * 2.399 + (r() - 0.5) * 0.35;
      const len = radiusAt(h) * (1.0 + (r() - 0.5) * 0.18) + 0.08;
      const tilt = -0.42 + h * 0.62 + (r() - 0.5) * 0.18; // กิ่งล่างห้อย กิ่งบนชี้ขึ้น
      e.set((r() - 0.5) * 0.5, -az, tilt, "YZX");
      q.setFromEuler(e);
      v.set(0, TREE_BASE_Y + h * TREE_H + (r() - 0.5) * 0.06, 0);
      sc.set(len, len * (0.85 + r() * 0.3), len);
      branches.push({ m: new THREE.Matrix4().compose(v.clone(), q.clone(), sc.clone()), tone: 0.86 + h * 0.18 + (r() - 0.5) * 0.14 });
    }
  }
  // กิ่งสั้นสีเข้มชั้นใน เติมความแน่นของพุ่ม
  const fill = small ? 110 : 220;
  for (let i = 0; i < fill; i++) {
    const h = r() * 0.9;
    const az = r() * Math.PI * 2;
    const len = radiusAt(h) * (0.62 + r() * 0.2);
    e.set((r() - 0.5) * 0.6, -az, -0.25 + h * 0.4, "YZX");
    q.setFromEuler(e);
    v.set(0, TREE_BASE_Y + h * TREE_H, 0);
    sc.set(len, len, len);
    branches.push({ m: new THREE.Matrix4().compose(v.clone(), q.clone(), sc.clone()), tone: 0.62 + r() * 0.12 });
  }
  // ยอดต้น: กิ่งชี้ขึ้นเป็นกระจุก
  for (let i = 0; i < 7; i++) {
    const az = (i / 7) * Math.PI * 2;
    e.set(0, -az, 1.15 + r() * 0.2, "YZX");
    q.setFromEuler(e);
    v.set(0, TREE_TOP_Y - 0.42, 0);
    sc.set(0.52, 0.52, 0.52);
    branches.push({ m: new THREE.Matrix4().compose(v.clone(), q.clone(), sc.clone()), tone: 1.05 });
  }
  const branchMesh = new THREE.InstancedMesh(branchGeo, needleMat, branches.length);
  branches.forEach((b, i) => {
    branchMesh.setMatrixAt(i, b.m);
    branchMesh.setColorAt(i, col.setScalar(b.tone));
  });
  branchMesh.castShadow = true;
  branchMesh.receiveShadow = true;
  branchMesh.customDepthMaterial = keepM(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: needleTex, alphaTest: 0.42 }));
  branchMesh.frustumCulled = false;
  group.add(branchMesh);

  // ---------- หิมะเกาะบนกิ่ง (เฉพาะแผ่นที่นอนราบด้านบน) ----------
  if (theme.snow > 0) {
    const snowTex = keepT(sprigTexture(theme, 5, "snow"));
    const snowGeo = keepG(cardGeometry(0.62, 0, 0.16));
    const snowMat = keepM(new THREE.MeshStandardMaterial({ map: snowTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75, color: 0xffffff }));
    const lift = new THREE.Matrix4().makeTranslation(0, 0.012, 0);
    const outer = branches.filter((b) => b.tone > 0.8);
    const snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, outer.length);
    outer.forEach((b, i) => snowMesh.setMatrixAt(i, m4.multiplyMatrices(b.m, lift)));
    snowMesh.frustumCulled = false;
    snowMesh.receiveShadow = true;
    group.add(snowMesh);
  }

  // ---------- ไฟประดับ: สองเกลียวสลับกัน หลอดเล็กมีแสงฟุ้ง กระพริบเบา ๆ ----------
  const LIGHTS = small ? 230 : 380;
  const lightPos: THREE.Vector3[] = [];
  const lightBase: THREE.Color[] = [];
  const lightPhase: number[] = [];
  for (let i = 0; i < LIGHTS; i++) {
    const s = (i + 0.5) / LIGHTS;
    const h = 0.03 + s * 0.9;
    const a = s * Math.PI * 2 * 10 + (i % 2) * Math.PI + (r() - 0.5) * 0.25;
    lightPos.push(onSurface(h + (r() - 0.5) * 0.012, a, 0.97));
    lightBase.push(new THREE.Color(theme.lights[i % theme.lights.length]));
    lightPhase.push(r() * Math.PI * 2);
  }
  const bulbMesh = new THREE.InstancedMesh(keepG(new THREE.SphereGeometry(theme.bulb, 6, 4)), keepM(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), LIGHTS);
  lightPos.forEach((p, i) => {
    bulbMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    bulbMesh.setColorAt(i, lightBase[i]);
  });
  bulbMesh.frustumCulled = false;
  group.add(bulbMesh);
  const haloPos = new Float32Array(LIGHTS * 3);
  const haloCol = new Float32Array(LIGHTS * 3);
  lightPos.forEach((p, i) => {
    haloPos.set([p.x, p.y, p.z], i * 3);
    haloCol.set([lightBase[i].r, lightBase[i].g, lightBase[i].b], i * 3);
  });
  const haloGeo = keepG(new THREE.BufferGeometry());
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  const halos = new THREE.Points(
    haloGeo,
    keepM(new THREE.PointsMaterial({ size: theme.bulb * 9, map: opts.glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })),
  );
  halos.frustumCulled = false;
  group.add(halos);

  // ---------- สายลูกปัดห้อยเป็นโค้งรอบต้น หรือริบบิ้นพันเกลียว ----------
  if (theme.garland === "beads") {
    const beads: THREE.Vector3[] = [];
    const rows = [0.1, 0.24, 0.38, 0.52, 0.66, 0.79];
    rows.forEach((h, ri) => {
      const n = Math.round(5 + 6 * (1 - h));
      const off = ri * 0.7;
      for (let j = 0; j < n; j++) {
        const a0 = (j / n) * Math.PI * 2 + off;
        const a1 = ((j + 1) / n) * Math.PI * 2 + off;
        const sag = 0.1 + 0.12 * (1 - h);
        const mid = (a0 + a1) / 2;
        const curve = new THREE.QuadraticBezierCurve3(onSurface(h, a0, 1.0), onSurface(h - sag / TREE_H, mid, 1.08), onSurface(h, a1, 1.0));
        const n2 = Math.max(6, Math.round(curve.getLength() / 0.05));
        for (let k = 0; k < n2; k++) beads.push(curve.getPoint(k / n2));
      }
    });
    const beadMesh = new THREE.InstancedMesh(
      keepG(new THREE.SphereGeometry(0.022, 6, 4)), // ลูกปัดเล็กมากบนจอ ใช้รูปทรงหยาบได้
      keepM(new THREE.MeshStandardMaterial({ color: theme.garlandColor, metalness: 0.85, roughness: 0.22 })),
      beads.length,
    );
    beads.forEach((p, i) => beadMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
    beadMesh.frustumCulled = false;
    beadMesh.castShadow = true;
    group.add(beadMesh);
  } else {
    // ริบบิ้นแบนพันรอบต้น วางแนบผิวพุ่ม มีลอนพลิ้วเล็กน้อย
    const pts: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const SEG = 420;
    const turns = 3.4;
    const half = 0.075;
    const gen = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      const h = 0.06 + s * 0.8;
      const a = s * Math.PI * 2 * turns + 0.6;
      const c = onSurface(h, a, 1.03 + 0.02 * Math.sin(s * 90));
      gen.set(-Math.cos(a) * TREE_R0, TREE_H, -Math.sin(a) * TREE_R0).normalize();
      const p0 = c.clone().addScaledVector(gen, -half);
      const p1 = c.clone().addScaledVector(gen, half);
      pts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      uvs.push(s * 60, 0, s * 60, 1);
      if (i < SEG) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const rg = keepG(new THREE.BufferGeometry());
    rg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    rg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const ribbon = new THREE.Mesh(rg, keepM(new THREE.MeshStandardMaterial({ map: keepT(ribbonTexture(theme.garlandColor)), roughness: 0.38, metalness: 0.15, side: THREE.DoubleSide })));
    ribbon.castShadow = true;
    group.add(ribbon);
  }

  // ---------- ของประดับบนกิ่ง: เบอร์รี่ ลูกสน ไม้เท้าลูกกวาด ----------
  const hangDown = (p: THREE.Vector3, size: number, spin: number) => {
    e.set(0, spin, 0);
    q.setFromEuler(e);
    return new THREE.Matrix4().compose(p, q, new THREE.Vector3(size, size, size));
  };
  if (theme.props.includes("berries")) {
    const list: THREE.Matrix4[] = [];
    for (let i = 0; i < (small ? 40 : 70); i++) {
      const h = 0.06 + r() * 0.82;
      const a = r() * Math.PI * 2;
      const base = onSurface(h, a, 0.99);
      for (let k = 0; k < 3; k++) list.push(hangDown(base.clone().add(new THREE.Vector3((r() - 0.5) * 0.06, (r() - 0.5) * 0.05, (r() - 0.5) * 0.06)), 1, 0));
    }
    const berryMesh = new THREE.InstancedMesh(
      keepG(new THREE.SphereGeometry(0.026, 7, 5)),
      keepM(new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 })),
      list.length,
    );
    list.forEach((mm, i) => berryMesh.setMatrixAt(i, mm));
    berryMesh.frustumCulled = false;
    group.add(berryMesh);
  }
  if (theme.props.includes("pinecones")) {
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      prof.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.05 * (1 - t * 0.35) * (1 + 0.18 * Math.sin(t * 28)), -t * 0.13));
    }
    const coneGeo = keepG(new THREE.LatheGeometry(prof, 10));
    const list: THREE.Matrix4[] = [];
    for (let i = 0; i < (small ? 36 : 60); i++) {
      const h = 0.08 + r() * 0.8;
      list.push(hangDown(onSurface(h, r() * Math.PI * 2, 1.0), 0.9 + r() * 0.4, r() * 6));
    }
    const pineMesh = new THREE.InstancedMesh(coneGeo, keepM(new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.9 })), list.length);
    list.forEach((mm, i) => pineMesh.setMatrixAt(i, mm));
    pineMesh.castShadow = true;
    pineMesh.frustumCulled = false;
    group.add(pineMesh);
  }
  if (theme.props.includes("candy")) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.22, 0),
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(0.02, 0.04, 0),
      new THREE.Vector3(0.06, 0.05, 0),
      new THREE.Vector3(0.085, 0.02, 0),
      new THREE.Vector3(0.09, -0.02, 0),
    ]);
    const caneGeo = keepG(new THREE.TubeGeometry(path, 24, 0.012, 8, false));
    const list: THREE.Matrix4[] = [];
    for (let i = 0; i < (small ? 20 : 32); i++) {
      const h = 0.1 + r() * 0.75;
      const a = r() * Math.PI * 2;
      list.push(hangDown(onSurface(h, a, 1.0), 1, -a + Math.PI / 2));
    }
    const caneMesh = new THREE.InstancedMesh(caneGeo, keepM(new THREE.MeshStandardMaterial({ map: keepT(candyTexture()), roughness: 0.35 })), list.length);
    list.forEach((mm, i) => caneMesh.setMatrixAt(i, mm));
    caneMesh.frustumCulled = false;
    group.add(caneMesh);
  }

  // ---------- ดาวบนยอด: ดาวทองสามมิติ แสงฟุ้ง และรัศมีที่หมุนช้า ๆ ----------
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? 0.34 : 0.15;
    const ang = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) starShape.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    else starShape.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  starShape.closePath();
  const starGeo = keepG(new THREE.ExtrudeGeometry(starShape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.03, bevelSegments: 3 }));
  starGeo.center();
  const star = new THREE.Mesh(
    starGeo,
    keepM(new THREE.MeshPhysicalMaterial({ color: theme.star, metalness: 0.9, roughness: 0.16, emissive: theme.starEmissive, emissiveIntensity: 0.5, clearcoat: 1 })),
  );
  const starPosition = new THREE.Vector3(0, TREE_TOP_Y + 0.34, 0);
  star.position.copy(starPosition);
  star.scale.setScalar(1.3);
  star.castShadow = true;
  group.add(star);
  const starGlow = new THREE.Sprite(keepM(new THREE.SpriteMaterial({ map: opts.glowTex, color: theme.starEmissive, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })));
  starGlow.scale.set(2.5, 2.5, 1);
  starGlow.position.copy(starPosition);
  group.add(starGlow);
  const rays = new THREE.Sprite(keepM(new THREE.SpriteMaterial({ map: keepT(raysTexture(theme.star)), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
  rays.scale.set(3.4, 3.4, 1);
  rays.position.copy(starPosition);
  group.add(rays);
  const starLight = new THREE.PointLight(theme.starEmissive, 2.6, 9, 2);
  starLight.position.copy(starPosition).add(new THREE.Vector3(0, 0.1, 0.35));
  if (opts.starLight !== false) group.add(starLight);

  // ---------- ผ้าคลุมโคนต้นขอบหยัก ขลิบขนนุ่ม และกล่องของขวัญ ----------
  const skirtR = 2.2;
  const skirtGeo = keepG(new THREE.CircleGeometry(skirtR, 96));
  const sp = skirtGeo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 1; i < sp.count; i++) {
    const a = Math.atan2(sp.getY(i), sp.getX(i));
    const k = 1 + 0.045 * Math.sin(a * 9);
    sp.setXY(i, sp.getX(i) * k, sp.getY(i) * k);
  }
  skirtGeo.rotateX(-Math.PI / 2);
  const skirt = new THREE.Mesh(skirtGeo, keepM(new THREE.MeshPhysicalMaterial({ color: theme.skirt, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(theme.skirtSheen), sheenRoughness: 0.45 })));
  skirt.position.y = 0.014;
  skirt.receiveShadow = true;
  group.add(skirt);
  const trimPts: THREE.Vector3[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const k = 1 + 0.045 * Math.sin(a * 9);
    trimPts.push(new THREE.Vector3(Math.cos(a) * skirtR * k, 0.045, -Math.sin(a) * skirtR * k));
  }
  const trim = new THREE.Mesh(
    keepG(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts, true), 220, 0.07, 8, true)),
    keepM(new THREE.MeshStandardMaterial({ color: theme.trim, roughness: 1 })),
  );
  trim.receiveShadow = true;
  group.add(trim);
  const giftSpots: [number, number, number][] = [
    [1.3, 0.55, 0.38],
    [-1.15, 1.0, 0.33],
    [0.35, 1.7, 0.28],
    [-1.55, -0.35, 0.36],
    [0.75, -1.4, 0.3],
    [1.7, -0.45, 0.26],
    [-0.55, -1.62, 0.26],
    [1.75, 0.2, 0.22],
    [-1.75, 0.45, 0.24],
    [-0.35, 1.85, 0.2],
  ];
  giftSpots.forEach(([gx, gz, size], i) => {
    const color = theme.gifts[i % theme.gifts.length];
    const box = new THREE.Group();
    const body = new THREE.Mesh(keepG(new RoundedBoxGeometry(size, size * 0.86, size, 3, size * 0.06)), keepM(new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.5 })));
    body.position.y = (size * 0.86) / 2;
    const ribMat = keepM(new THREE.MeshStandardMaterial({ color: theme.giftRibbon, roughness: 0.3, metalness: 0.45 }));
    const rib1 = new THREE.Mesh(keepG(new THREE.BoxGeometry(size * 1.02, size * 0.88, size * 0.14)), ribMat);
    rib1.position.y = body.position.y;
    const rib2 = new THREE.Mesh(keepG(new THREE.BoxGeometry(size * 0.14, size * 0.88, size * 1.02)), ribMat);
    rib2.position.y = body.position.y;
    box.add(body, rib1, rib2);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(keepG(new THREE.TorusGeometry(size * 0.14, size * 0.045, 8, 16)), ribMat);
      loop.position.set(s * size * 0.14, size * 0.9, 0);
      loop.rotation.set(Math.PI / 2, 0, s * 0.55);
      box.add(loop);
    }
    box.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    box.position.set(gx, 0.02, gz);
    box.rotation.y = i * 0.9 + 0.3;
    group.add(box);
  });

  // ---------- กรวยรับการแตะบนผิวต้น (ไม่แสดงผล) ----------
  const hitMesh = new THREE.Mesh(
    keepG(new THREE.ConeGeometry(TREE_R0 + 0.08, TREE_H, 40, 1, true)),
    keepM(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })),
  );
  hitMesh.position.y = TREE_BASE_Y + TREE_H / 2;
  group.add(hitMesh);

  const haloAttr = haloGeo.getAttribute("color") as THREE.BufferAttribute;
  function update(t: number, reduced: boolean) {
    for (let i = 0; i < LIGHTS; i++) {
      const b = reduced ? 1 : 0.62 + 0.38 * Math.sin(t * 2.2 + lightPhase[i]);
      const c = lightBase[i];
      haloAttr.setXYZ(i, c.r * b, c.g * b, c.b * b);
    }
    haloAttr.needsUpdate = true;
    star.rotation.y = reduced ? 0 : t * 0.5;
    rays.material.rotation = reduced ? 0 : t * 0.15;
    starGlow.material.opacity = 0.7 + 0.18 * Math.sin(t * 2);
    starLight.intensity = 2.0 + 0.5 * Math.sin(t * 2);
  }

  function dispose() {
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((tx) => tx.dispose());
  }

  return { group, hitMesh, starPosition, update, dispose };
}
