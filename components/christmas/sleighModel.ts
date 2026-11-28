// โมเดลขบวนซานตา: เลื่อนวิกตอเรียนแดงขอบทอง ซานตา และกวางเรนเดียร์ห้าตัว (ตัวนำจมูกแดงเรืองแสง)
// สร้างด้วยโค้ดล้วน ชิ้นที่ไม่ขยับรวมเป็นก้อนเดียวต่อวัสดุ (ลดจำนวนครั้งที่ต้องวาด จึงลื่นแม้บนมือถือ)
// แกนของโมเดล: +x = ด้านหน้า, +y = ด้านบน, z = ซ้ายขวา
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// ---------- วัสดุ (สร้างครั้งเดียวต่อขบวน) ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
function plaid() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "#9b1c31";
    g.fillRect(0, 0, 128, 128);
    g.globalAlpha = 0.55;
    g.fillStyle = "#14532d";
    g.fillRect(0, 40, 128, 34);
    g.fillRect(40, 0, 34, 128);
    g.globalAlpha = 0.9;
    g.fillStyle = "#f5c542";
    g.fillRect(0, 96, 128, 4);
    g.fillRect(96, 0, 4, 128);
    g.globalAlpha = 0.35;
    g.fillStyle = "#000";
    g.fillRect(0, 56, 128, 3);
    g.fillRect(56, 0, 3, 128);
  }, 2);
}
export type SleighMats = ReturnType<typeof makeMats>;
export function makeMats() {
  return {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xa3122c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf2c25a, roughness: 0.22, metalness: 0.9 }),
    velvet: new THREE.MeshPhysicalMaterial({ color: 0x7c0d22, roughness: 0.85, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xff8fa3) }),
    plaid: new THREE.MeshStandardMaterial({ map: plaid(), roughness: 0.9, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.8 }),
    sack: new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.95 }),
    giftR: new THREE.MeshStandardMaterial({ color: 0xc41e3a, roughness: 0.45 }),
    giftG: new THREE.MeshStandardMaterial({ color: 0x1f6b45, roughness: 0.45 }),
    giftC: new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 0.5 }),
    coat: new THREE.MeshPhysicalMaterial({ color: 0xc8202f, roughness: 0.62, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xff9aa5) }),
    fur: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xdfeeff) }),
    skin: new THREE.MeshStandardMaterial({ color: 0xf6cfb3, roughness: 0.6 }),
    blush: new THREE.MeshStandardMaterial({ color: 0xff8f9b, roughness: 0.8 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x8e1b2a, roughness: 0.55 }),
    deer: new THREE.MeshStandardMaterial({ color: 0x8c5a37, roughness: 0.85 }),
    deerLight: new THREE.MeshStandardMaterial({ color: 0xe9cfa9, roughness: 0.9 }),
    deerDark: new THREE.MeshStandardMaterial({ color: 0x3d2616, roughness: 0.8 }),
    antler: new THREE.MeshStandardMaterial({ color: 0xc9a77c, roughness: 0.7 }),
    hoof: new THREE.MeshStandardMaterial({ color: 0x1f1610, roughness: 0.7 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.15 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    noseRed: new THREE.MeshStandardMaterial({ color: 0xff2e4d, emissive: 0xff2e4d, emissiveIntensity: 1.2, roughness: 0.3 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb347, emissiveIntensity: 2.2, roughness: 0.3 }),
  };
}

// ---------- รวมชิ้นตามวัสดุ ----------
// วัสดุธรรมดาสีต่างกันแต่ผิวคล้ายกัน (ด้าน/กึ่งเงา/เงา) รวมเป็นวัสดุเดียวที่ใช้สีจากจุดยอด จึงวาดครั้งเดียวต่อชิ้น
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const shared = new Map<string, THREE.MeshStandardMaterial>();
function bucketOf(mat: THREE.Material): string | null {
  const m = mat as THREE.MeshStandardMaterial;
  if (m.type !== "MeshStandardMaterial" || m.map || m.metalness > 0.5 || m.emissive.getHex() !== 0) return null;
  return m.roughness < 0.3 ? "gloss" : m.roughness < 0.6 ? "satin" : "matte";
}
function sharedMat(bucket: string) {
  let m = shared.get(bucket);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: bucket === "gloss" ? 0.18 : bucket === "satin" ? 0.45 : 0.85 });
    shared.set(bucket, m);
  }
  return m;
}
class Bake {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number] = [0, 0, 0], r: [number, number, number] = [0, 0, 0], s: number | [number, number, number] = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const sc = typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    tmpM.compose(new THREE.Vector3(...p), tmpQ.setFromEuler(tmpE.set(...r)), sc);
    g = g.applyMatrix4(tmpM);
    const bucket = bucketOf(mat);
    let target = mat;
    if (bucket) {
      const c = (mat as THREE.MeshStandardMaterial).color;
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      target = sharedMat(bucket);
    }
    const list = this.parts.get(target) ?? [];
    list.push(g);
    this.parts.set(target, list);
  }
  build(): THREE.Group {
    const grp = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) grp.add(new THREE.Mesh(merged, mat));
    }
    this.parts.clear();
    return grp;
  }
}

// ท่อที่ค่อย ๆ เรียวจากรัศมี r0 ไป r1 ตามเส้นโค้ง
function taper(curve: THREE.Curve<THREE.Vector3>, segs: number, r0: number, r1: number, radial = 10) {
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, c);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const curve = (...pts: [number, number, number][]) => new THREE.CatmullRomCurve3(pts.map((p) => V(...p)));
const sph = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
// ท่อเชื่อมจุด a ไป b
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, radial = 8) {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), radial);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

// กล่องของขวัญผูกริบบิ้นพร้อมโบว์
function gift(b: Bake, mat: THREE.Material, ribbon: THREE.Material, p: [number, number, number], s: [number, number, number], ry = 0) {
  const [w, h, d] = s;
  const rot: [number, number, number] = [0, ry, 0];
  b.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.08), mat, p, rot);
  b.add(new THREE.BoxGeometry(w * 1.02, h * 1.02, d * 0.16), ribbon, p, rot);
  b.add(new THREE.BoxGeometry(w * 0.16, h * 1.02, d * 1.02), ribbon, p, rot);
  for (const sgn of [-1, 1]) {
    const tor = new THREE.TorusGeometry(Math.min(w, d) * 0.16, Math.min(w, d) * 0.045, 6, 14);
    b.add(tor, ribbon, [p[0] + Math.cos(ry) * sgn * w * 0.12, p[1] + h / 2 + Math.min(w, d) * 0.1, p[2] - Math.sin(ry) * sgn * w * 0.12], [0, ry + Math.PI / 2, sgn * 0.6]);
  }
}

// ---------- เลื่อน ----------
export function buildSleighBody(m: SleighMats) {
  const b = new Bake();
  // แผงข้างทรงหงส์: หน้าโค้งม้วน พนักหลังสูง
  const sh = new THREE.Shape();
  sh.moveTo(-0.74, 0.5);
  sh.lineTo(0.5, 0.5);
  sh.quadraticCurveTo(0.84, 0.52, 0.86, 0.78);
  sh.bezierCurveTo(0.88, 1.0, 0.7, 1.08, 0.62, 0.97);
  sh.quadraticCurveTo(0.57, 0.88, 0.66, 0.86);
  sh.quadraticCurveTo(0.48, 0.78, 0.24, 0.78);
  sh.lineTo(-0.24, 0.8);
  sh.bezierCurveTo(-0.46, 0.8, -0.52, 1.2, -0.7, 1.2);
  sh.quadraticCurveTo(-0.84, 1.18, -0.8, 1.06);
  sh.closePath();
  for (const z of [-0.33, 0.29]) {
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 18 });
    b.add(g, m.paint, [0, 0, z]);
  }
  // พื้น หน้าปัด และพนักหลัง
  b.add(new THREE.BoxGeometry(1.3, 0.05, 0.62), m.paint, [-0.08, 0.52, 0]);
  b.add(new RoundedBoxGeometry(0.06, 0.32, 0.62, 2, 0.02), m.paint, [0.66, 0.68, 0], [0, 0, -0.35]);
  b.add(new RoundedBoxGeometry(0.06, 0.56, 0.62, 2, 0.02), m.paint, [-0.7, 0.84, 0], [0, 0, 0.12]);
  // เบาะกำมะหยี่และพนักพิงบุนุ่ม
  b.add(new RoundedBoxGeometry(0.5, 0.12, 0.58, 3, 0.05), m.velvet, [-0.4, 0.8, 0]);
  b.add(new RoundedBoxGeometry(0.1, 0.36, 0.56, 3, 0.05), m.velvet, [-0.62, 1.02, 0], [0, 0, 0.14]);
  for (const zz of [-0.17, 0, 0.17]) b.add(sph(0.016), m.gold, [-0.565, 1.04, zz]);
  // ขอบทองตามขอบบนของแผงข้าง และลายม้วนทองที่หน้าและหลัง
  for (const z of [-0.345, 0.345]) {
    b.add(taper(curve([0.64, 0.9, z], [0.5, 0.8, z], [0.24, 0.79, z], [-0.24, 0.81, z], [-0.45, 0.95, z], [-0.62, 1.17, z]), 40, 0.014, 0.014, 6), m.gold);
    const sp: [number, number, number][] = [];
    for (let i = 0; i <= 18; i++) {
      const a = i * 0.42;
      const r = 0.1 * (1 - i / 22);
      sp.push([0.1 + Math.cos(a) * r, 0.64 + Math.sin(a) * r * 0.75, z]);
    }
    b.add(taper(curve(...sp), 40, 0.012, 0.006, 6), m.gold);
    const sp2 = sp.map(([x, y]) => [-0.3 - (x - 0.1), y, z] as [number, number, number]);
    b.add(taper(curve(...sp2), 40, 0.012, 0.006, 6), m.gold);
    b.add(taper(curve([0.3, 0.6, z], [-0.1, 0.58, z], [-0.5, 0.6, z]), 20, 0.008, 0.008, 6), m.gold);
  }
  // คันเลื่อนทองม้วนปลายหน้า และขาค้ำ
  for (const z of [-0.26, 0.26]) {
    b.add(taper(curve([-1.18, 0.38, z], [-0.9, 0.31, z], [0.4, 0.3, z], [0.84, 0.38, z], [1.05, 0.6, z], [1.06, 0.82, z], [0.94, 0.88, z], [0.88, 0.76, z], [0.96, 0.72, z], [0.99, 0.77, z]), 80, 0.022, 0.014, 8), m.gold);
    for (const x of [-0.95, -0.5, 0, 0.45]) b.add(rod(V(x, 0.31, z), V(x, x < -0.8 ? 0.52 : 0.5, z), 0.014), m.gold);
  }
  // ท้ายเลื่อน: ดาดฟ้าไม้ วางถุงของขวัญและกล่องของขวัญ
  b.add(new RoundedBoxGeometry(0.46, 0.05, 0.56, 2, 0.015), m.wood, [-0.98, 0.53, 0]);
  for (const z of [-0.27, 0.27]) b.add(taper(curve([-1.2, 0.56, z], [-0.98, 0.6, z], [-0.76, 0.58, z]), 12, 0.012, 0.012, 6), m.gold);
  // ถุงของขวัญ: ทรงถุงจากการหมุนเส้นโค้ง มัดเชือกทอง
  const prof = [V(0, 0, 0), V(0.16, 0.02, 0), V(0.22, 0.14, 0), V(0.2, 0.3, 0), V(0.1, 0.42, 0), V(0.06, 0.46, 0), V(0.1, 0.52, 0), V(0.0001, 0.55, 0)].map((v) => new THREE.Vector2(v.x, v.y));
  b.add(new THREE.LatheGeometry(prof, 16), m.sack, [-1.02, 0.55, -0.1], [0.12, 0, 0.2]);
  // เชือกมัดคอถุง ใช้ตำแหน่ง/มุมเดียวกับถุง
  const tie = new THREE.TorusGeometry(0.066, 0.016, 6, 16).rotateX(Math.PI / 2).translate(0, 0.46, 0);
  b.add(tie, m.gold, [-1.02, 0.55, -0.1], [0.12, 0, 0.2]);
  gift(b, m.giftG, m.gold, [-0.9, 0.66, 0.15], [0.2, 0.2, 0.2], 0.3);
  gift(b, m.giftC, m.giftR, [-1.07, 0.63, 0.17], [0.16, 0.14, 0.16], -0.4);
  gift(b, m.giftR, m.gold, [-0.98, 0.83, 0.16], [0.13, 0.13, 0.13], 0.8);
  // ผ้าห่มลายสก็อตคลุมตักซานตา ห้อยลงหน้าเลื่อน
  const blanket = new THREE.PlaneGeometry(0.62, 0.56, 12, 10);
  const pos = blanket.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, (pos.getY(i) + 0.28) / 0.56)); // 0 = ปลายหน้า, 1 = ตัก (กันค่าเกินจากการปัดเศษ)
    const zz = pos.getX(i);
    const x = -0.22 + (1 - u) * 0.42;
    const y = 0.9 - Math.pow(1 - u, 1.6) * 0.3 + Math.sin(zz * 9) * 0.008;
    pos.setXYZ(i, x, y, zz * 0.95);
  }
  blanket.computeVertexNormals();
  b.add(blanket, m.plaid);
  // เสาโคมไฟหน้าเลื่อน
  b.add(taper(curve([0.62, 0.92, 0.33], [0.72, 1.18, 0.33], [0.82, 1.32, 0.33], [0.92, 1.3, 0.33]), 20, 0.012, 0.01, 6), m.gold);
  b.add(rod(V(0.92, 1.3, 0.33), V(0.92, 1.22, 0.33), 0.004), m.black);
  b.add(new THREE.CylinderGeometry(0.035, 0.05, 0.05, 6), m.black, [0.92, 1.2, 0.33]);
  b.add(new THREE.CylinderGeometry(0.038, 0.038, 0.1, 6), m.lamp, [0.92, 1.13, 0.33]);
  b.add(new THREE.CylinderGeometry(0.045, 0.04, 0.025, 6), m.black, [0.92, 1.07, 0.33]);
  const grp = b.build();
  return { group: grp, lampPos: V(0.92, 1.13, 0.33) };
}

// ---------- ซานตา (นั่ง หันไปทาง +x) ----------
export function buildSanta(m: SleighMats) {
  const root = new THREE.Group();
  const body = new Bake();
  // ลำตัวเสื้อคลุมกำมะหยี่ ขอบขนขาว เข็มขัดหัวทอง
  const prof = [[0.0001, 0], [0.25, 0.0], [0.27, 0.14], [0.25, 0.32], [0.2, 0.46], [0.12, 0.56], [0.0001, 0.6]].map(([x, y]) => new THREE.Vector2(x, y));
  body.add(new THREE.LatheGeometry(prof, 24), m.coat, [0, 0, 0], [0, 0, 0], [1, 1, 0.88]);
  body.add(new THREE.TorusGeometry(0.255, 0.04, 8, 28), m.fur, [0, 0.03, 0], [Math.PI / 2, 0, 0], [1, 0.88, 1]);
  body.add(new THREE.CapsuleGeometry(0.03, 0.4, 4, 8), m.fur, [0.215, 0.3, 0], [0, 0, 0.32]);
  body.add(new THREE.CylinderGeometry(0.268, 0.268, 0.07, 28, 1, true), m.black, [0, 0.17, 0], [0, 0, 0], [1, 1, 0.88]);
  body.add(new RoundedBoxGeometry(0.03, 0.09, 0.11, 2, 0.01), m.gold, [0.262, 0.17, 0]);
  body.add(new THREE.BoxGeometry(0.035, 0.05, 0.06), m.black, [0.27, 0.17, 0]);
  // ขานั่งยื่นไปข้างหน้า รองเท้าบู๊ตดำขอบขน
  for (const z of [-0.1, 0.1]) {
    body.add(rod(V(0.05, 0.08, z), V(0.32, 0.07, z), 0.075, 12), m.coat);
    body.add(sph(0.075), m.coat, [0.32, 0.07, z]);
    body.add(rod(V(0.32, 0.07, z), V(0.38, -0.16, z), 0.062, 12), m.coat);
    body.add(new THREE.TorusGeometry(0.066, 0.022, 6, 16), m.fur, [0.38, -0.15, z], [Math.PI / 2, 0, 0.25]);
    body.add(sph(0.075), m.black, [0.43, -0.22, z], [0, 0, 0], [1.35, 0.6, 0.85]);
  }
  root.add(body.build());

  // หัว: หน้ากลม แก้มชมพู แว่นทองกลม เคราขาวฟู
  const head = new THREE.Group();
  head.position.set(0.02, 0.73, 0);
  root.add(head);
  const hb = new Bake();
  hb.add(sph(0.16, 24, 18), m.skin);
  hb.add(sph(0.16, 20, 14), m.fur, [0.02, -0.15, 0], [0, 0, 0], [0.95, 1.0, 1.05]);
  for (const [x, y, z, r] of [[0.1, -0.17, 0, 0.085], [0.07, -0.24, 0.06, 0.07], [0.07, -0.24, -0.06, 0.07], [0.04, -0.29, 0, 0.065], [0.0, -0.08, 0.13, 0.065], [0.0, -0.08, -0.13, 0.065]]) hb.add(sph(r, 12, 10), m.fur, [x, y, z]);
  for (const s of [-1, 1]) {
    hb.add(sph(0.05, 12, 10), m.fur, [0.15, -0.035, s * 0.05], [0, 0, s * 0.35], [1.3, 0.6, 1]); // หนวด
    hb.add(sph(0.032, 10, 8), m.blush, [0.12, 0.0, s * 0.1]);
    hb.add(sph(0.018, 10, 8), m.eye, [0.145, 0.055, s * 0.055]);
    hb.add(sph(0.006, 6, 4), m.shine, [0.161, 0.062, s * 0.05]);
    hb.add(new THREE.CapsuleGeometry(0.012, 0.04, 3, 6), m.fur, [0.145, 0.1, s * 0.058], [Math.PI / 2, 0, s * -0.2]); // คิ้ว
    hb.add(new THREE.TorusGeometry(0.034, 0.005, 6, 18), m.gold, [0.158, 0.055, s * 0.055], [0, Math.PI / 2, 0]); // แว่น
  }
  hb.add(rod(V(0.16, 0.058, -0.022), V(0.16, 0.058, 0.022), 0.004), m.gold);
  hb.add(sph(0.032, 12, 10), m.blush, [0.168, 0.02, 0]);
  head.add(hb.build());
  // หมวกเรียวโค้งไปด้านหลัง ขอบขน พู่ขาว
  const hat = new THREE.Group();
  hat.position.set(-0.01, 0.125, 0);
  hat.rotation.z = 0.12;
  head.add(hat);
  const hatB = new Bake();
  hatB.add(taper(curve([0, 0.0, 0], [-0.02, 0.14, 0], [-0.1, 0.24, 0.03], [-0.22, 0.22, 0.07], [-0.28, 0.12, 0.1]), 30, 0.155, 0.025, 14), m.coat);
  hatB.add(new THREE.TorusGeometry(0.155, 0.045, 10, 28), m.fur, [0, 0.0, 0], [Math.PI / 2, 0, 0]);
  hatB.add(sph(0.055, 14, 10), m.fur, [-0.29, 0.1, 0.1]);
  hat.add(hatB.build());

  // แขนถือบังเหียน (จุดหมุนที่หัวไหล่)
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.02, 0.44, s * 0.2);
    root.add(arm);
    const ab = new Bake();
    const el = V(0.16, -0.12, s * 0.05);
    const hand = V(0.34, -0.06, s * -0.06);
    ab.add(sph(0.07, 12, 10), m.coat);
    ab.add(rod(V(0, 0, 0), el, 0.062, 10), m.coat);
    ab.add(sph(0.062, 12, 10), m.coat, [el.x, el.y, el.z]);
    ab.add(rod(el, hand, 0.055, 10), m.coat);
    ab.add(new THREE.TorusGeometry(0.055, 0.022, 6, 14), m.fur, [hand.x - 0.02, hand.y, hand.z], [0, Math.PI / 2, 0]);
    ab.add(sph(0.05, 12, 10), m.black, [hand.x + 0.03, hand.y, hand.z], [0, 0, 0], [1.2, 0.9, 1]);
    arm.add(ab.build());
    arms.push(arm);
  }
  return { group: root, head, hat, arms };
}

// ---------- กวางเรนเดียร์ (หันไปทาง +x) ----------
export function buildReindeer(m: SleighMats, lead = false) {
  const root = new THREE.Group();
  const body = new Bake();
  body.add(sph(0.24, 24, 16), m.deer, [0, 0, 0], [0, 0, 0], [1.42, 0.86, 0.78]);
  body.add(sph(0.2, 18, 12), m.deerLight, [0.02, -0.07, 0], [0, 0, 0], [1.3, 0.55, 0.7]);
  body.add(sph(0.17, 18, 12), m.deer, [0.22, 0.03, 0]);
  body.add(sph(0.18, 18, 12), m.deer, [-0.22, 0.03, 0], [0, 0, 0], [1, 1, 0.95]);
  body.add(taper(curve([0.24, 0.06, 0], [0.33, 0.22, 0], [0.4, 0.38, 0]), 12, 0.1, 0.07, 12), m.deer);
  body.add(taper(curve([0.28, 0.02, 0], [0.36, 0.2, 0]), 8, 0.075, 0.05, 10), m.deerLight, [0.02, 0, 0]);
  body.add(sph(0.06, 10, 8), m.fur, [-0.38, 0.12, 0], [0, 0, 0.5], [1, 1.2, 1]); // หางขาว
  // สายรัดหนังแดงพร้อมกระดิ่งทอง
  body.add(new THREE.TorusGeometry(0.1, 0.022, 8, 22), m.leather, [0.3, 0.17, 0], [Math.PI / 2, 0, -0.95], [1, 1.15, 1]);
  for (const s of [-1, 0, 1]) body.add(sph(0.026, 10, 8), m.gold, [0.35 + s * 0.0, 0.1 - Math.abs(s) * 0.01, s * 0.07]);
  body.add(new THREE.TorusGeometry(1, 0.11, 8, 28), m.leather, [0.04, 0, 0], [0, Math.PI / 2, 0], [0.205, 0.205, 0.19]);
  body.add(new THREE.TorusGeometry(0.03, 0.008, 6, 12), m.gold, [0.04, 0.21, 0]);
  root.add(body.build());

  const head = new THREE.Group();
  head.position.set(0.44, 0.43, 0);
  root.add(head);
  const hb = new Bake();
  hb.add(sph(0.1, 18, 14), m.deer, [0, 0, 0], [0, 0, 0], [1.1, 1, 0.92]);
  hb.add(sph(0.07, 16, 12), m.deerLight, [0.1, -0.04, 0], [0, 0, 0.25], [1.4, 0.8, 0.85]);
  if (!lead) hb.add(sph(0.026, 10, 8), m.deerDark, [0.2, -0.02, 0]);
  for (const s of [-1, 1]) {
    hb.add(sph(0.022, 10, 8), m.eye, [0.06, 0.035, s * 0.07]);
    hb.add(sph(0.007, 6, 4), m.shine, [0.074, 0.045, s * 0.08]);
    const ear = new THREE.ConeGeometry(0.03, 0.11, 8);
    hb.add(ear, m.deer, [-0.04, 0.08, s * 0.09], [s * 0.9, 0, s * 0.5], [1, 1, 0.5]);
    // เขาแตกกิ่งหลายง่าม
    const base = V(-0.02, 0.08, s * 0.045);
    const p1 = V(-0.05, 0.2, s * 0.11);
    const p2 = V(-0.1, 0.31, s * 0.15);
    const p3 = V(-0.07, 0.42, s * 0.19);
    hb.add(taper(new THREE.CatmullRomCurve3([base, p1, p2, p3]), 20, 0.018, 0.007, 7), m.antler);
    for (const [from, to] of [
      [p1, V(0.04, 0.27, s * 0.13)],
      [p2, V(0.0, 0.38, s * 0.14)],
      [p2, V(-0.18, 0.37, s * 0.2)],
      [p3, V(0.0, 0.47, s * 0.2)],
    ] as [THREE.Vector3, THREE.Vector3][]) {
      const mid = from.clone().lerp(to, 0.5).add(V(0, 0.02, 0));
      hb.add(taper(new THREE.CatmullRomCurve3([from, mid, to]), 8, 0.011, 0.005, 6), m.antler);
    }
  }
  head.add(hb.build());
  let nose: THREE.Mesh | null = null;
  if (lead) {
    nose = new THREE.Mesh(sph(0.034, 14, 10), m.noseRed);
    nose.position.set(0.205, -0.02, 0);
    head.add(nose);
  }

  // ขาเรียวมีข้อเข่า หมุนได้สองท่อน (สะโพก/ไหล่ และเข่า)
  const legs: { upper: THREE.Group; lower: THREE.Group; front: boolean }[] = [];
  for (const [x, z] of [
    [0.2, 0.09],
    [0.2, -0.09],
    [-0.21, 0.09],
    [-0.21, -0.09],
  ]) {
    const front = x > 0;
    const upper = new THREE.Group();
    upper.position.set(x, -0.08, z);
    root.add(upper);
    const ub = new Bake();
    ub.add(taper(curve([0, 0.04, 0], [0, -0.1, 0], [0, -0.2, 0]), 8, front ? 0.055 : 0.065, 0.032, 10), m.deer);
    upper.add(ub.build());
    const lower = new THREE.Group();
    lower.position.set(0, -0.2, 0);
    upper.add(lower);
    const lb = new Bake();
    lb.add(sph(0.034, 10, 8), m.deer);
    lb.add(taper(curve([0, 0, 0], [0, -0.1, 0], [0, -0.17, 0]), 6, 0.028, 0.02, 8), m.deerDark);
    lb.add(sph(0.032, 10, 8), m.hoof, [0.01, -0.19, 0], [0, 0, 0], [1.2, 0.75, 1]);
    lower.add(lb.build());
    legs.push({ upper, lower, front });
  }
  return { group: root, head, legs, nose };
}

// ภาพเรืองแสงทรงกลมสำหรับโคมและจมูก (ใช้กับ Sprite)
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
  glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;
  return glowTex;
}

// ---------- ขบวนทั้งชุด พร้อมการเคลื่อนไหว ----------
export type SleighRig = { group: THREE.Group; animate: (t: number, dt: number) => void; tailLocal: THREE.Vector3 };
export function buildSleighRig(): SleighRig {
  const m = makeMats();
  const group = new THREE.Group();
  const sleigh = buildSleighBody(m);
  group.add(sleigh.group);
  const santa = buildSanta(m);
  santa.group.position.set(-0.36, 0.84, 0);
  group.add(santa.group);
  const glow = (color: number, size: number, pos: THREE.Vector3, parent: THREE.Object3D) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(size);
    s.position.copy(pos);
    parent.add(s);
    return s;
  };
  const lampGlow = glow(0xffb347, 0.5, sleigh.lampPos, group);

  // กวางห้าตัว: สองคู่ และตัวนำจมูกแดงด้านหน้า
  const team: { d: ReturnType<typeof buildReindeer>; x: number; z: number; phase: number; y: number; vy: number; k: number }[] = [];
  const slots: [number, number][] = [
    [1.75, 0.2],
    [1.75, -0.2],
    [2.6, 0.2],
    [2.6, -0.2],
    [3.45, 0],
  ];
  slots.forEach(([x, z], i) => {
    const d = buildReindeer(m, i === 4);
    d.group.position.set(x, 0.95, z);
    group.add(d.group);
    team.push({ d, x, z, phase: i * 0.9 + (z > 0 ? 0 : 0.35), y: 0, vy: 0, k: 44 - i * 3 });
  });
  const lead = team[4].d;
  const noseGlow = lead.nose ? glow(0xff3b4f, 0.45, lead.nose.position, lead.head) : null;
  // บังเหียนทอง: จากปลอกคอกวางแต่ละตัวมาหน้าเลื่อน
  const reinGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 5);
  const reins = team.map(() => {
    const r = new THREE.Mesh(reinGeo, m.gold);
    group.add(r);
    return r;
  });
  const a = new THREE.Vector3();
  const bpt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  return {
    group,
    tailLocal: new THREE.Vector3(-1.25, 0.7, 0),
    animate: (t, dt) => {
      // ซานตาโยกตามจังหวะวิ่ง พู่หมวกพลิ้ว แขนกระตุกบังเหียน
      santa.group.position.y = 0.84 + Math.sin(t * 8.4 + 0.6) * 0.01;
      santa.head.rotation.z = Math.sin(t * 2.4) * 0.05;
      santa.head.rotation.y = Math.sin(t * 0.7) * 0.12;
      santa.hat.rotation.z = 0.1 + Math.sin(t * 3.2) * 0.08;
      santa.hat.rotation.x = Math.sin(t * 2.1 + 1) * 0.08;
      santa.arms.forEach((arm, i) => (arm.rotation.z = Math.sin(t * 8.4 + i * 0.5) * 0.05 - 0.04));
      lampGlow.material.opacity = 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
      // กวางวิ่งควบ: ขาหน้าพับเข่าไปหลัง ขาหลังดีดไปหน้า ลำตัวโยกขึ้นลงแบบสปริง
      for (const c of team) {
        const ph = t * 8.4 + c.phase;
        const target = Math.sin(ph * 2) * 0.035 + Math.sin(ph) * 0.05;
        c.vy += ((target - c.y) * c.k - c.vy * 5) * dt;
        c.y += c.vy * dt;
        c.d.group.position.set(c.x, 0.95 + c.y, c.z);
        c.d.group.rotation.z = Math.sin(ph + 0.6) * 0.07;
        for (let li = 0; li < 4; li++) {
          const L = c.d.legs[li];
          const lp = ph + (L.front ? 0 : Math.PI * 0.9) + (li % 2) * 0.35;
          L.upper.rotation.z = Math.sin(lp) * (L.front ? 0.75 : 0.65);
          const bend = Math.max(0, Math.sin(lp + 1.4));
          L.lower.rotation.z = L.front ? -bend * 1.3 : bend * 1.1;
        }
        c.d.head.rotation.z = Math.sin(ph + 1.1) * 0.08 - 0.05;
      }
      if (lead.nose) {
        (lead.nose.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(t * 5) * 0.3;
        if (noseGlow) noseGlow.material.opacity = 0.75 + Math.sin(t * 5) * 0.2;
      }
      team.forEach((c, i) => {
        a.set(c.x + 0.3, 0.95 + c.y + 0.16, c.z * 0.9);
        bpt.set(0.7, 0.88, c.z * 0.5);
        dir.subVectors(a, bpt);
        const r = reins[i];
        r.scale.set(1, dir.length(), 1);
        r.position.copy(a).add(bpt).multiplyScalar(0.5);
        r.quaternion.setFromUnitVectors(yAxis, dir.normalize());
      });
    },
  };
}
