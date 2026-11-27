// ซานตาและกวางเรนเดียร์ลากเลื่อนบินข้ามท้องฟ้าเหนือต้นคริสต์มาส ทิ้งหิมะโปรยไว้เป็นทางให้ค่อย ๆ หายไป
// ทุกชิ้นสร้างด้วยโค้ด ไม่มีไฟล์โมเดลภายนอก การเคลื่อนไหวมีแรงเฉื่อย การโยก และการสปริงตามกัน
import * as THREE from "three";

export type SleighFlight = {
  group: THREE.Group;
  update: (progress: number | null, t: number, dt: number) => void;
  isActive: () => boolean;
};

const SCALE = 1.9; // ขนาดของทั้งขบวนบนฉาก ให้เห็นชัดแม้อยู่ไกล

// ---------- เท็กซ์เจอร์ ----------
let glowCache: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowCache) return glowCache;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowCache = new THREE.CanvasTexture(c);
  glowCache.colorSpace = THREE.SRGBColorSpace;
  return glowCache;
}

// เกล็ดหิมะหกแฉกที่วาดด้วยแคนวาส มีกิ่งย่อยเล็ก ๆ
let flakeCache: THREE.Texture | null = null;
function flakeTexture(): THREE.Texture {
  if (flakeCache) return flakeCache;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.translate(64, 64);
  g.strokeStyle = "#ffffff";
  g.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate((i / 6) * Math.PI * 2);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -50);
    g.stroke();
    g.lineWidth = 3.5;
    for (const [y, l] of [
      [-22, 12],
      [-36, 9],
    ]) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(l, y - l * 0.6);
      g.moveTo(0, y);
      g.lineTo(-l, y - l * 0.6);
      g.stroke();
    }
    g.restore();
  }
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, 60);
  halo.addColorStop(0, "rgba(255,255,255,0.35)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = halo;
  g.beginPath();
  g.arc(0, 0, 60, 0, Math.PI * 2);
  g.fill();
  flakeCache = new THREE.CanvasTexture(c);
  flakeCache.colorSpace = THREE.SRGBColorSpace;
  return flakeCache;
}

// ---------- วัสดุและตัวช่วยสร้างรูปทรง ----------
const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const fur = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.96, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xdfeeff) });

const add = <T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x = 0, y = 0, z = 0): T => {
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};
const ball = (r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
  m.scale.set(sx, sy, sz);
  return m;
};
// ท่อนแขนขาที่เชื่อมจุด a ไปจุด b
function limb(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, a.distanceTo(b), 12), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(m);
  return m;
}

// ---------- ซานตาคลอส: ตัวกลม แก้มชมพู หนวดเคราขาวยาว หมวกโค้งมีพู่ ----------
function buildSanta() {
  const g = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: 0xd42a2a, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 });
  const whiteFur = fur();
  const skin = std(0xf7d3b8, 0.62);
  const cheek = new THREE.MeshStandardMaterial({ color: 0xff8f9b, roughness: 0.8, emissive: 0x3a0a10, emissiveIntensity: 0.25 });
  const black = std(0x151515, 0.35);
  const gold = std(0xf2c14e, 0.22, 0.85);
  // ลำตัวกลมอ้วน เข็มขัดดำหัวทอง และขอบขนขาวด้านล่าง
  add(g, ball(0.27, red, 0.98, 1.08, 0.92), 0, 0.3, 0);
  const belt = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.085, 28, 1, true), black), 0, 0.14, 0);
  belt.scale.set(1, 1, 0.9);
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), gold), 0, 0.14, 0.245);
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), black), 0, 0.14, 0.26);
  const hem = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 28, 1, true), whiteFur), 0, 0.02, 0);
  hem.scale.set(1, 1, 0.92);
  // หัวและหน้า: เคราเป็นส่วนล่างของทรงกลม ไม่บังดวงตา
  const head = new THREE.Group();
  g.add(head);
  head.position.set(0, 0.7, 0.02);
  add(head, ball(0.22, skin, 1, 0.98, 0.95), 0, 0, 0);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.236, 28, 18, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), whiteFur);
  beard.position.set(0, 0, 0.03);
  beard.scale.set(1.03, 1.05, 0.9);
  head.add(beard);
  add(head, ball(0.1, whiteFur, 1.1, 0.85, 0.85), 0, -0.2, 0.12); // ปลายเคราด้านล่าง
  for (const s of [-1, 1]) {
    add(head, ball(0.075, whiteFur, 1.4, 0.55, 0.7), s * 0.07, 0.0, 0.205); // หนวด
    add(head, ball(0.04, cheek, 1, 0.7, 0.5), s * 0.13, 0.03, 0.15); // แก้มชมพู
    add(head, ball(0.03, black), s * 0.075, 0.1, 0.2); // ตา
    add(head, ball(0.009, std(0xffffff)), s * 0.068, 0.11, 0.223); // ประกายในตา
  }
  add(head, ball(0.05, red, 1, 0.9, 1), 0, 0.04, 0.23); // จมูกแดง
  // หมวกโค้งลงด้านหลัง มีขอบขนและพู่ขาว
  const hatCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0.02, 0.26, -0.03), new THREE.Vector3(0.12, 0.34, -0.1), new THREE.Vector3(0.22, 0.28, -0.14)]);
  const hat = new THREE.Group();
  head.add(hat);
  hat.position.set(0, 0.16, -0.01);
  hat.add(new THREE.Mesh(new THREE.TubeGeometry(hatCurve, 24, 0.17, 16, false), red));
  const brim = add(hat, new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.06, 12, 28), whiteFur), 0, 0.02, 0);
  brim.rotation.x = Math.PI / 2;
  brim.scale.set(1, 1, 0.92);
  add(hat, ball(0.07, whiteFur), 0.22, 0.2, -0.14); // พู่ขาวที่ปลายหมวก
  // แขนสองข้าง แขนเสื้อแดง ปลอกขาว มือถือบังเหียน
  const shoulderR = new THREE.Vector3(0.24, 0.42, 0.13);
  const shoulderL = new THREE.Vector3(0.24, 0.42, -0.13);
  const armR = new THREE.Group();
  const armL = new THREE.Group();
  g.add(armR, armL);
  armR.position.copy(shoulderR);
  armL.position.copy(shoulderL);
  const handR = new THREE.Vector3(0.38, 0.27, 0.03).sub(shoulderR);
  const handL = new THREE.Vector3(0.38, 0.27, -0.03).sub(shoulderL);
  limb(armR, new THREE.Vector3(), handR, 0.075, red);
  limb(armL, new THREE.Vector3(), handL, 0.075, red);
  add(armR, ball(0.085, red), 0, 0, 0);
  add(armL, ball(0.085, red), 0, 0, 0);
  add(armR, ball(0.07, whiteFur), handR.x, handR.y, handR.z);
  add(armL, ball(0.07, whiteFur), handL.x, handL.y, handL.z);
  // ขาสั้นอ้วน รองเท้าบู๊ตดำขอบขาว
  for (const z of [-0.12, 0.12]) {
    limb(g, new THREE.Vector3(0.05, 0.05, z), new THREE.Vector3(0.24, 0.02, z), 0.085, red);
    add(g, ball(0.085, black, 1.2, 0.7, 1.35), 0.27, 0.02, z);
    add(g, new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), whiteFur), 0.25, 0.09, z).rotation.y = Math.PI / 2;
  }
  return { group: g, hat, head, armR, armL };
}

// ---------- กวางเรนเดียร์: ตัวอวบ หัวใหญ่ ตาโต จมูกแดงเรืองแสง ขาสั้นอ้วนก้าววิ่งจริง ----------
function buildReindeer() {
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: 0xb07043, roughness: 0.9 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf0d2ac, roughness: 0.9 });
  const dark = std(0x4a2e1a, 0.8);
  const hoof = std(0x1d1410, 0.6);
  const antler = std(0x8a5f36, 0.7);
  const black = std(0x101010, 0.3);
  const pink = new THREE.MeshStandardMaterial({ color: 0xff9aa8, roughness: 0.8 });
  const nose = new THREE.MeshStandardMaterial({ color: 0xff2e4d, emissive: 0xff2e4d, emissiveIntensity: 0.9, roughness: 0.3 });
  // ลำตัวกลมอวบ ท้องและอกสีอ่อน
  add(g, ball(0.25, coat, 1.3, 0.9, 0.92), 0, 0.06, 0);
  add(g, ball(0.2, light, 1.15, 0.5, 0.78), 0, -0.02, 0.02);
  add(g, ball(0.16, coat, 1, 1, 1), 0.25, 0.1, 0);
  const tail = add(g, ball(0.075, light), -0.36, 0.12, 0); // หางกลม
  // คอหนาและหัวใหญ่
  limb(g, new THREE.Vector3(0.26, 0.12, 0), new THREE.Vector3(0.37, 0.36, 0), 0.105, coat);
  const head = new THREE.Group();
  head.position.set(0.42, 0.42, 0);
  g.add(head);
  add(head, ball(0.17, coat, 1.2, 1.05, 1.02), 0, 0, 0);
  add(head, ball(0.1, light, 1.25, 0.85, 1), 0.12, -0.06, 0); // ปาก
  const noseMesh = add(head, ball(0.05, nose), 0.23, -0.02, 0);
  for (const s of [-1, 1]) {
    add(head, ball(0.036, black), 0.11, 0.05, s * 0.085); // ตาดำใหญ่
    add(head, ball(0.012, std(0xffffff)), 0.12, 0.065, s * 0.1); // ประกายตา
    add(head, ball(0.035, pink, 1, 0.6, 0.8), 0.1, -0.05, s * 0.13); // แก้มชมพู
    const ear = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 10), coat), -0.03, 0.13, s * 0.15);
    ear.rotation.set(s * 0.5, 0, s * 1.05);
    // เขาแตกกิ่งสองง่าม
    const base = new THREE.Vector3(-0.02, 0.14, s * 0.07);
    const p1 = new THREE.Vector3(-0.03, 0.28, s * 0.12);
    const p2 = new THREE.Vector3(-0.08, 0.38, s * 0.16);
    const tine = new THREE.Vector3(0.03, 0.42, s * 0.22);
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, p1, p2]), 14, 0.021, 8, false), antler));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p1, new THREE.Vector3(0.02, 0.34, s * 0.18)]), 6, 0.017, 8, false), antler));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p2, tine]), 6, 0.017, 8, false), antler));
  }
  // ขาสั้นอ้วน มีข้อเข่าและกีบ จุดหมุนอยู่ที่สะโพกและไหล่
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [0.19, 0.1],
    [0.19, -0.1],
    [-0.18, 0.1],
    [-0.18, -0.1],
  ]) {
    const pivot = add(g, new THREE.Group(), x, -0.08, z);
    limb(pivot, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.2, 0), 0.055, coat);
    add(pivot, ball(0.05, coat), 0, -0.2, 0);
    limb(pivot, new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, -0.36, 0), 0.042, dark);
    add(pivot, ball(0.05, hoof, 1.1, 0.7, 1.2), 0, -0.38, 0);
    legs.push(pivot);
  }
  return { group: g, legs, head, nose: noseMesh, tail };
}

// ---------- ระบบอนุภาคหิมะ: จุดที่มีอายุ ค่อย ๆ จางจนหายไป ----------
type Sys = {
  points: THREE.Points;
  geo: THREE.BufferGeometry;
  pos: Float32Array;
  vel: Float32Array;
  col: Float32Array;
  base: Float32Array;
  age: Float32Array;
  life: Float32Array;
  phase: Float32Array;
  cursor: number;
  n: number;
};
function makeSys(n: number, size: number, tex: THREE.Texture, color: number): Sys {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const base = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    base[i * 3] = c.r;
    base[i * 3 + 1] = c.g;
    base[i * 3 + 2] = c.b;
    pos[i * 3 + 1] = -999; // ซ่อนไว้ก่อนใช้งาน
  }
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  points.frustumCulled = false;
  return {
    points,
    geo,
    pos,
    vel: new Float32Array(n * 3),
    col,
    base,
    age: new Float32Array(n).fill(999),
    life: new Float32Array(n),
    phase: Float32Array.from({ length: n }, () => Math.random() * 6.28),
    cursor: 0,
    n,
  };
}
function emitSys(s: Sys, x: number, y: number, z: number, count: number, minLife: number, maxLife: number, vx: number, vy: number, spread: number) {
  for (let k = 0; k < count; k++) {
    const i = s.cursor;
    s.cursor = (s.cursor + 1) % s.n;
    s.pos[i * 3] = x + (Math.random() - 0.5) * spread;
    s.pos[i * 3 + 1] = y + (Math.random() - 0.5) * spread * 0.8;
    s.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
    s.vel[i * 3] = vx * (0.6 + Math.random() * 0.6);
    s.vel[i * 3 + 1] = vy + (Math.random() - 0.5) * 0.25;
    s.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    s.life[i] = minLife + Math.random() * (maxLife - minLife);
    s.age[i] = 0;
  }
}
function stepSys(s: Sys, dt: number, t: number) {
  for (let i = 0; i < s.n; i++) {
    if (s.age[i] >= s.life[i]) {
      s.col[i * 3] = 0;
      s.col[i * 3 + 1] = 0;
      s.col[i * 3 + 2] = 0;
      continue;
    }
    s.age[i] += dt;
    const f = s.age[i] / s.life[i];
    // ลมและแรงโน้มถ่วงทำให้เกล็ดหิมะลอยวนช้า ๆ แล้วค่อยลงพื้น
    s.vel[i * 3] *= 1 - 0.7 * dt;
    s.vel[i * 3 + 1] = s.vel[i * 3 + 1] * (1 - 0.7 * dt) - 0.32 * dt;
    s.vel[i * 3 + 2] *= 1 - 0.7 * dt;
    s.pos[i * 3] += (s.vel[i * 3] + Math.sin(t * 1.7 + s.phase[i]) * 0.18) * dt;
    s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
    s.pos[i * 3 + 2] += (s.vel[i * 3 + 2] + Math.cos(t * 1.3 + s.phase[i]) * 0.12) * dt;
    // เข้าจางช้า ๆ แล้วหายไปตอนท้าย
    const fadeIn = Math.min(1, s.age[i] / 0.35);
    const fadeOut = Math.pow(1 - f, 1.4);
    const k = fadeIn * fadeOut;
    s.col[i * 3] = s.base[i * 3] * k;
    s.col[i * 3 + 1] = s.base[i * 3 + 1] * k;
    s.col[i * 3 + 2] = s.base[i * 3 + 2] * k;
  }
  s.geo.attributes.position.needsUpdate = true;
  s.geo.attributes.color.needsUpdate = true;
}

// ---------- ขบวนทั้งหมด: เส้นทางบิน เลื่อน ซานตา กวางสี่ตัว และระบบหิมะ ----------
// ช่วงบินซิงก์กับนาฬิกาเซิร์ฟเวอร์ ทุกคนในห้องจึงเห็นซานตาอยู่ตำแหน่งเดียวกันในเวลาเดียวกัน
export const FLIGHT_PERIOD_MS = 120000; // ซานตาบินทุก 2 นาที
export const FLIGHT_DURATION_MS = 40000; // แต่ละรอบบินนาน 40 วินาที

// ความคืบหน้าการบินตามเวลาเซิร์ฟเวอร์ (0..1) หรือ null ถ้าตอนนี้ไม่ได้อยู่ในช่วงบิน
export function flightProgressAt(serverMs: number): number | null {
  const phase = ((serverMs % FLIGHT_PERIOD_MS) + FLIGHT_PERIOD_MS) % FLIGHT_PERIOD_MS;
  return phase < FLIGHT_DURATION_MS ? phase / FLIGHT_DURATION_MS : null;
}

// เส้นทาง: ไกลสุดบนขอบฟ้า → เข้ามาใกล้ → วนรอบต้นคริสต์มาส → ลดระดับเหนือโซนอวยพร → บินออกไปไกล
const ROUTE: [number, number, number][] = [
  [-60, 10, -60],
  [-36, 8.4, -38],
  [-20, 7, -24],
  [-10.34, 5.9, -13.76],
  [-5.5, 5.6, -19.53],
  [-0.0, 5.4, -21.0],
  [5.5, 5.4, -19.53],
  [10.34, 5.6, -13.76],
  [10.34, 5.8, -6.24],
  [5.5, 5.9, -0.47],
  [-1.91, 5.7, 0.83],
  [-8.43, 5.5, -2.93],
  [-11.0, 5.2, -10.0],
  [-8, 4.9, -16],
  [-5, 4.8, -19],
  [0, 5.3, -26],
  [14, 6.6, -32],
  [40, 8.4, -36],
  [64, 9.5, -40],
];
// เส้นทางถูกสุ่มตัวอย่างให้ระยะเท่ากันและเกลี่ยเล็กน้อย จึงไม่มีจุดหักมุมกะทันหัน
const ROUTE_RAW = new THREE.CatmullRomCurve3(
  ROUTE.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  "centripetal",
);
const ROUTE_SAMPLES = ROUTE_RAW.getSpacedPoints(400);
const ROUTE_SMOOTH = ROUTE_SAMPLES.map((_, i) => {
  const acc = new THREE.Vector3();
  const W = 14;
  for (let k = -W; k <= W; k++) acc.add(ROUTE_SAMPLES[Math.min(ROUTE_SAMPLES.length - 1, Math.max(0, i + k))]);
  return acc.multiplyScalar(1 / (2 * W + 1));
});
const ROUTE_CURVE = new THREE.CatmullRomCurve3(ROUTE_SMOOTH, false, "catmullrom", 0.5);

export function buildSleighFlight(): SleighFlight {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(SCALE);
  group.add(rig);

  // ตัวเลื่อนสีแดงเงาวาว โค้งหน้าขึ้น ขอบทอง
  const profile = new THREE.Shape();
  profile.moveTo(-0.62, 0.62);
  profile.lineTo(0.5, 0.62);
  profile.quadraticCurveTo(0.76, 0.62, 0.8, 0.94);
  profile.lineTo(0.68, 0.96);
  profile.quadraticCurveTo(0.64, 0.8, 0.44, 0.8);
  profile.lineTo(-0.62, 0.8);
  profile.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.56, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3, curveSegments: 12 });
  bodyGeo.translate(0, 0, -0.28);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xc41e3a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  add(rig, new THREE.Mesh(bodyGeo, paint));
  const gold = std(0xf5c542, 0.25, 0.85);
  for (const z of [-0.3, 0.3]) add(rig, new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.03), gold), -0.05, 0.8, z);
  // เบาะนั่งขาวขนนุ่ม
  add(rig, new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), fur()), -0.1, 0.84, 0);
  // คันเลื่อนสองเส้นที่ต่อกับตัวเลื่อนด้วยขาค้ำ
  for (const z of [-0.2, 0.2]) {
    const runner = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.9, 0.5, z),
      new THREE.Vector3(-0.45, 0.44, z),
      new THREE.Vector3(0.3, 0.44, z),
      new THREE.Vector3(0.72, 0.56, z),
      new THREE.Vector3(0.94, 0.8, z),
    ]);
    add(rig, new THREE.Mesh(new THREE.TubeGeometry(runner, 40, 0.03, 8, false), gold));
    for (const x of [-0.55, 0, 0.45]) limb(rig, new THREE.Vector3(x, 0.63, z), new THREE.Vector3(x, 0.46, z), 0.02, gold);
  }
  // ถุงของขวัญข้างหลังมีโบว์ทอง
  const sack = add(rig, ball(0.22, std(0x9a6b3a, 0.95), 1.1, 0.9, 1), -0.62, 0.98, 0);
  sack.rotation.z = 0.2;
  add(rig, new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), gold), -0.62, 1.16, 0).rotation.x = Math.PI / 2;

  const santa = buildSanta();
  santa.group.position.set(-0.12, 0.84, 0);
  rig.add(santa.group);

  // กวางสี่ตัววิ่งนำหน้า ต่อบังเหียนทองมาที่หน้าเลื่อน
  const deer: { group: THREE.Group; legs: THREE.Group[]; head: THREE.Group; nose: THREE.Mesh; tail: THREE.Mesh; baseX: number; baseZ: number; y: number; vy: number; pitch: number; vp: number; phase: number; k: number }[] = [];
  const reinGold = std(0xd9b45a, 0.3, 0.7);
  const reinLines: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const d = buildReindeer();
    const baseX = 1.6 + i * 0.95;
    const baseZ = (i % 2 === 0 ? 0.13 : -0.13) * (i < 2 ? 1 : 1.15);
    d.group.position.set(baseX, 1.0, baseZ);
    rig.add(d.group);
    deer.push({ ...d, baseX, baseZ, y: 0, vy: 0, pitch: 0, vp: 0, phase: i * 1.37, k: 46 - i * 4 });
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), reinGold);
    rig.add(line);
    reinLines.push(line);
  }

  // ระบบหิมะ 3 ชั้น: เกล็ดใหญ่ เกล็ดกลาง และละอองทองเล็ก ๆ
  const flakes = makeSys(300, 0.34, flakeTexture(), 0xffffff);
  const mid = makeSys(300, 0.2, flakeTexture(), 0xe8f4ff);
  const dust = makeSys(180, 0.12, glow(), 0xffe9a8);
  for (const s of [flakes, mid, dust]) group.add(s.points);

  const routeLen = ROUTE_CURVE.getLength();
  const flightSec = FLIGHT_DURATION_MS / 1000;
  const v3 = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const basisX = new THREE.Vector3();
  const basisY = new THREE.Vector3();
  const basisZ = new THREE.Vector3();
  const basisM = new THREE.Matrix4();
  const qBasis = new THREE.Quaternion();
  const qBank = new THREE.Quaternion();
  const tmpTan = new THREE.Vector3();
  // ทิศทางการบินในแนวราบ (มุมรอบแกนตั้ง) ใช้คำนวณการเอียงตัวตอนเลี้ยว
  const headingAt = (u: number) => {
    ROUTE_CURVE.getTangentAt(Math.min(1, Math.max(0, u)), tmpTan);
    return Math.atan2(tmpTan.z, tmpTan.x);
  };
  // ผลต่างมุมแบบวนรอบ (ป้องกันการกระโดดตอนมุมข้ามแกน ±π)
  const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const headingDelta = (u: number, du: number) => {
    return wrapAngle(headingAt(u + du) - headingAt(u - du));
  };
  // ฟังก์ชันขั้นบันไดแบบนุ่ม ใช้ทำให้ขบวนค่อย ๆ ปรากฏและค่อย ๆ หายไป
  const smooth = (x: number) => {
    const c = Math.min(1, Math.max(0, x));
    return c * c * (3 - 2 * c);
  };
  const tailPos = new THREE.Vector3();
  let active = false;

  return {
    group,
    isActive: () => active,
    // progress = null เมื่อไม่อยู่ในช่วงบิน; t = เวลาเซิร์ฟเวอร์ (วินาที) ใช้ทำให้ทุกคนเห็นการเคลื่อนไหวตรงกัน
    update: (progress, t, dt) => {
      active = progress !== null;
      rig.visible = active;
      if (progress !== null) {
        ROUTE_CURVE.getPointAt(progress, v3);
        // ทิศทางเฉลี่ยจากจุดใกล้เคียง เพื่อให้การหันหน้าไม่กระตุกตอนเลี้ยวโค้ง
        const dTan = 0.003;
        ROUTE_CURVE.getTangentAt(progress, tan);
        ROUTE_CURVE.getTangentAt(Math.max(0, progress - dTan), tmpTan);
        tan.add(tmpTan);
        ROUTE_CURVE.getTangentAt(Math.min(1, progress + dTan), tmpTan);
        tan.add(tmpTan).multiplyScalar(0.25).normalize();
        // เลื่อนหันหน้าตามเส้นทาง เอียงซ้ายขวาเบา ๆ และเด้งตามการก้าวของกวาง
        rig.position.set(v3.x, v3.y + Math.sin(t * 9.2) * 0.03 + Math.sin(t * 5.1) * 0.04, v3.z);
        // หันหน้าตามเส้นทางด้วยฐานมุมฉากที่ไม่พลิกกลับหัว (ใช้แทนการหมุนจากเวกเตอร์ที่อาจกลับทิศ)
        basisX.copy(tan);
        basisZ.crossVectors(tan, up).normalize();
        basisY.crossVectors(basisZ, basisX).normalize();
        basisM.makeBasis(basisX, basisY, basisZ);
        qBasis.setFromRotationMatrix(basisM);
        // เอียงตัวเข้าโค้งตามอัตราการเลี้ยว แล้วโยกเบา ๆ ให้เป็นธรรมชาติ
        const du = 0.004;
        const yawRate = (headingDelta(progress, du) / (2 * du)) / (FLIGHT_DURATION_MS / 1000);
        const bank = Math.max(-0.5, Math.min(0.5, -yawRate * 0.9)) + Math.sin(t * 1.3) * 0.04;
        qBank.setFromAxisAngle(basisX, bank);
        rig.quaternion.copy(qBasis).premultiply(qBank);
        // ขบวนค่อย ๆ โผล่จากระยะไกลและค่อย ๆ จางหายตอนท้ายรอบ (ไม่ป็อปหาย)
        rig.scale.setScalar(SCALE * smooth(progress / 0.04) * smooth((1 - progress) / 0.04));

        // ซานตาเด้งตามเลื่อน พู่หมวกและหนวดพลิ้วตามลม
        santa.group.position.y = 0.84 + Math.sin(t * 9.2 + 0.6) * 0.012;
        santa.head.rotation.z = Math.sin(t * 2.6) * 0.04;
        santa.hat.rotation.z = Math.sin(t * 3.4) * 0.12 - 0.05;
        santa.hat.rotation.x = Math.sin(t * 2.2 + 1) * 0.08;
        santa.armR.rotation.x = Math.sin(t * 9.2) * 0.05;
        santa.armL.rotation.x = Math.sin(t * 9.2 + 0.5) * 0.05;

        // กวางแต่ละตัวมีสปริงตามเลื่อน วิ่งก้าวเป็นจังหวะ หัวและหางขยับตาม
        for (const d of deer) {
          const target = Math.sin(t * 9.2 - d.phase * 0.2) * 0.08;
          d.vy += ((target - d.y) * d.k - d.vy * 4.2) * dt;
          d.y += d.vy * dt;
          d.vp += (-d.pitch * 30 - d.vp * 5) * dt;
          d.pitch += d.vp * dt;
          d.group.position.set(d.baseX, 1.0 + d.y, d.baseZ);
          d.group.rotation.z = d.pitch * 0.6 + Math.sin(t * 9.2 + d.phase) * 0.05;
          d.legs.forEach((leg, li) => {
            const front = li < 2;
            const ph = t * 11.5 + d.phase + (front ? 0 : Math.PI * 0.6) + (li % 2) * 0.45;
            leg.rotation.z = Math.sin(ph) * 0.8;
            leg.rotation.x = Math.cos(ph) * 0.2;
          });
          d.head.rotation.z = Math.sin(t * 11.5 + d.phase + 0.8) * 0.06 - 0.08;
          d.head.position.y = Math.sin(t * 23 + d.phase) * 0.012;
          d.tail.position.y = 0.12 + Math.sin(t * 11.5 + d.phase) * 0.02;
          (d.nose.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(t * 6 + d.phase) * 0.25;
        }
        // สายบังเหียนจากอกกวางไปยังหน้าเลื่อน
        deer.forEach((d, i) => {
          const a = new THREE.Vector3(d.baseX - 0.28, 1.0 + d.y + 0.02, d.baseZ);
          const b = new THREE.Vector3(0.82, 0.74, 0);
          const dir = b.clone().sub(a);
          const line = reinLines[i];
          line.scale.set(1, dir.length(), 1);
          line.position.copy(a).add(b).multiplyScalar(0.5);
          line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        });

        // ทางหิมะ: ปล่อยเกล็ดจากท้ายเลื่อนทุกเฟรม ลมพัดไปทางหลัง แล้วค่อย ๆ ลอยลงและจางหาย
        rig.updateMatrixWorld(true);
        tailPos.set(-1.45, 0.8, 0).applyMatrix4(rig.matrixWorld);
        const wind = routeLen / flightSec;
        const back = tan.clone().multiplyScalar(-1);
        emitSys(flakes, tailPos.x, tailPos.y, tailPos.z, Math.round(4 + dt * 50), 2.8, 4.4, back.x * (0.6 + 0.02 * wind) - 0.2, back.y * 0.2 - 0.05, 0.8);
        emitSys(mid, tailPos.x, tailPos.y - 0.1, tailPos.z, Math.round(3 + dt * 38), 2.2, 3.6, back.x * (0.9 + 0.02 * wind) - 0.3, back.y * 0.2, 1.2);
        emitSys(dust, tailPos.x + 0.2, tailPos.y, tailPos.z, Math.round(2 + dt * 22), 0.9, 1.6, back.x * 1.2, 0.2, 0.6);
      }
      stepSys(flakes, dt, t);
      stepSys(mid, dt, t);
      stepSys(dust, dt, t);
    },
  };
}
