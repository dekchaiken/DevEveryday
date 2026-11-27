// ซานตาและกวางเรนเดียร์ลากเลื่อนบินข้ามท้องฟ้าเหนือต้นคริสต์มาส ทิ้งหิมะโปรยไว้เป็นทางให้ค่อย ๆ หายไป
// ทุกชิ้นสร้างด้วยโค้ด ไม่มีไฟล์โมเดลภายนอก การเคลื่อนไหวมีแรงเฉื่อย การโยก และการสปริงตามกัน
import * as THREE from "three";

export type SleighFlight = {
  group: THREE.Group;
  start: (now: number) => void;
  update: (now: number, reduced: boolean) => void;
  isActive: () => boolean;
};

const DURATION = 12000; // ms ที่ใช้บินข้ามท้องฟ้าหนึ่งรอบ
const X0 = -15;
const X1 = 15;
const SCALE = 1.45; // ขนาดของทั้งขบวนบนฉาก

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
  // หัวและหน้า
  const head = new THREE.Group();
  g.add(head);
  head.position.set(0, 0.7, 0.02);
  add(head, ball(0.22, skin, 1, 0.98, 0.95), 0, 0, 0);
  add(head, ball(0.23, whiteFur, 1.02, 1.06, 0.82), 0, -0.1, 0.1); // เคราหลัก
  add(head, ball(0.17, whiteFur, 1.05, 0.9, 0.85), 0, -0.2, 0.12);
  add(head, ball(0.1, whiteFur, 1.25, 0.6, 0.6), -0.07, -0.02, 0.2); // หนวด
  add(head, ball(0.1, whiteFur, 1.25, 0.6, 0.6), 0.07, -0.02, 0.2);
  for (const s of [-1, 1]) {
    add(head, ball(0.045, cheek, 1, 0.7, 0.5), s * 0.12, -0.03, 0.17); // แก้มชมพู
    add(head, ball(0.028, black), s * 0.07, 0.05, 0.2); // ตา
    add(head, ball(0.009, std(0xffffff)), s * 0.065, 0.06, 0.225); // ประกายในตา
  }
  add(head, ball(0.05, red, 1, 0.9, 1), 0, -0.02, 0.22); // จมูกแดงกลม
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

// ---------- กวางเรนเดียร์: หัวกลมน่ารัก จมูกแดงเรืองแสง เขาแตกกิ่ง ขาวิ่งก้าวจริง ----------
function buildReindeer() {
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: 0xa26a3d, roughness: 0.92 });
  const light = new THREE.MeshStandardMaterial({ color: 0xe2bf98, roughness: 0.92 });
  const dark = std(0x3a2616, 0.8);
  const hoof = std(0x1d1410, 0.6);
  const antler = std(0x7a5232, 0.75);
  const black = std(0x101010, 0.3);
  // ลำตัวอวบ ท้องสีอ่อน
  add(g, ball(0.2, coat, 1.5, 0.82, 0.88), 0, 0, 0);
  add(g, ball(0.17, light, 1.35, 0.55, 0.78), 0, -0.07, 0.01);
  add(g, ball(0.13, coat, 1, 1, 1), 0.24, 0.02, 0); // อก
  const tail = add(g, ball(0.05, light), -0.31, 0.08, 0);
  // คอและหัว (หัวจะขยับตามการวิ่ง)
  limb(g, new THREE.Vector3(0.24, 0.06, 0), new THREE.Vector3(0.35, 0.26, 0), 0.07, coat);
  const head = new THREE.Group();
  head.position.set(0.39, 0.3, 0);
  g.add(head);
  add(head, ball(0.125, coat, 1.3, 1.02, 1.0), 0, 0, 0);
  add(head, ball(0.075, light, 1.25, 0.9, 1), 0.1, -0.05, 0); // ปาก
  const nose = add(head, ball(0.04, new THREE.MeshStandardMaterial({ color: 0xff2e4d, emissive: 0xff2e4d, emissiveIntensity: 0.9, roughness: 0.3 })), 0.165, -0.02, 0);
  for (const s of [-1, 1]) {
    add(head, ball(0.024, black), 0.07, 0.04, s * 0.06); // ตาดำ
    add(head, ball(0.008, std(0xffffff)), 0.085, 0.05, s * 0.07);
    // หูรูปใบบาง
    const ear = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 8), coat), -0.01, 0.1, s * 0.11);
    ear.rotation.set(s * 0.6, 0, s * 1.1);
    // เขาแตกกิ่ง 2 ง่าม
    const base = new THREE.Vector3(0, 0.12, s * 0.05);
    const p1 = new THREE.Vector3(-0.02, 0.26, s * 0.1);
    const p2 = new THREE.Vector3(-0.07, 0.36, s * 0.14);
    const tine = new THREE.Vector3(0.04, 0.4, s * 0.2);
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, p1, p2]), 12, 0.014, 6, false), antler));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p1, new THREE.Vector3(0.03, 0.33, s * 0.16)]), 6, 0.011, 6, false), antler));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p2, tine]), 6, 0.011, 6, false), antler));
  }
  // ขาสี่ข้าง จุดหมุนอยู่ที่สะโพกและไหล่
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [0.16, 0.09],
    [0.16, -0.09],
    [-0.15, 0.09],
    [-0.15, -0.09],
  ]) {
    const pivot = add(g, new THREE.Group(), x, -0.1, z);
    add(pivot, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.3, 10), coat), 0, -0.15, 0);
    add(pivot, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.07, 10), dark), 0, -0.32, 0);
    add(pivot, ball(0.03, hoof, 1.1, 0.7, 1.1), 0, -0.37, 0);
    legs.push(pivot);
  }
  return { group: g, legs, head, nose, tail };
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

// ---------- ขบวนทั้งหมด: เลื่อน ซานตา กวางสี่ตัว และระบบหิมะ ----------
export function buildSleighFlight(): SleighFlight {
  const group = new THREE.Group();
  group.visible = false;
  const rig = new THREE.Group();
  rig.scale.setScalar(SCALE);
  group.add(rig);

  // ตัวเลื่อนสีแดงเงาวาว โค้งหน้าขึ้น มีขอบทองและคันเลื่อนทอง
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
  const runner = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.92, 0.2, 0), new THREE.Vector3(-0.3, 0.05, 0), new THREE.Vector3(0.5, 0.05, 0), new THREE.Vector3(0.98, 0.5, 0)]);
  add(rig, new THREE.Mesh(new THREE.TubeGeometry(runner, 48, 0.035, 10, false), gold));
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
    const baseX = 1.55 + i * 0.92;
    const baseZ = (i % 2 === 0 ? 0.13 : -0.13) * (i < 2 ? 1 : 1.15);
    d.group.position.set(baseX, 1.0, baseZ);
    rig.add(d.group);
    deer.push({ ...d, baseX, baseZ, y: 0, vy: 0, pitch: 0, vp: 0, phase: i * 1.37, k: 46 - i * 4 });
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), reinGold);
    rig.add(line);
    reinLines.push(line);
  }

  // ระบบหิมะ 3 ชั้น: เกล็ดใหญ่ เกล็ดกลาง และละอองทองเล็ก ๆ
  const flakes = makeSys(260, 0.34, flakeTexture(), 0xffffff);
  const mid = makeSys(260, 0.2, flakeTexture(), 0xe8f4ff);
  const dust = makeSys(160, 0.12, glow(), 0xffe9a8);
  for (const s of [flakes, mid, dust]) group.add(s.points);

  let active = false;
  let startedAt = 0;
  let lastNow = 0;
  let lastX = X0;
  const tmp = new THREE.Vector3();

  // เส้นทางโค้งนุ่มของเลื่อนที่ความคืบหน้า e (0..1)
  const path = (e: number) => {
    const x = X0 + (X1 - X0) * e;
    const y = 2.45 + Math.sin(e * Math.PI * 2 * 0.85 + 0.4) * 0.4 + Math.sin(e * Math.PI * 2 * 2.1) * 0.08;
    const z = -2.5 + Math.sin(e * Math.PI * 2 * 0.55) * 1.0;
    return new THREE.Vector3(x, y, z);
  };

  return {
    group,
    start: (now) => {
      active = true;
      startedAt = now;
      lastNow = now;
      lastX = X0;
      group.visible = true;
    },
    isActive: () => active,
    update: (now, reduced) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      const t = now / 1000;
      if (active) {
        const p = (now - startedAt) / DURATION;
        if (p >= 1 || reduced) {
          active = false;
          group.visible = false;
        } else {
          // ความเร็วเริ่มช้าตอนต้นและค่อย ๆ ช้าตอนท้าย เหมือนลมค่อย ๆ พาไป
          // ความเร็วไม่คงที่เล็กน้อย: ช้าลงเล็กน้อยตอนต้นและตอนท้ายของทาง
          const e = p - 0.03 * Math.sin(p * Math.PI * 2);
          const here = path(Math.min(1, Math.max(0, e)));
          const ahead = path(Math.min(1, e + 0.002));
          const slope = ahead.clone().sub(here);
          rig.position.copy(here);
          // เชิดหน้าตามทิศทางการบิน โยกตัวเป็นจังหวะ และเอียงตามเส้นทาง
          rig.rotation.z = Math.atan2(slope.y, slope.x) * 0.9 + Math.sin(t * 2.2) * 0.035;
          rig.rotation.x = Math.sin(t * 1.7) * 0.05;
          rig.rotation.y = -Math.atan2(slope.z, slope.x) * 0.5;
          // เลื่อนสั่นเบา ๆ ตามการก้าวของกวาง
          rig.position.y += Math.sin(t * 9.2) * 0.02 + Math.sin(t * 5.4) * 0.03;

          // ซานตาเด้งตามเลื่อน พู่หมวกและหนวดพลิ้วตามลม
          santa.group.position.y = 0.84 + Math.sin(t * 9.2 + 0.6) * 0.012;
          santa.head.rotation.z = Math.sin(t * 2.6) * 0.04;
          santa.hat.rotation.z = Math.sin(t * 3.4) * 0.12 - 0.05;
          santa.hat.rotation.x = Math.sin(t * 2.2 + 1) * 0.08;
          santa.armR.rotation.x = Math.sin(t * 9.2) * 0.05;
          santa.armL.rotation.x = Math.sin(t * 9.2 + 0.5) * 0.05;

          // กวางแต่ละตัวมีสปริงตามการเคลื่อนไหว วิ่งก้าวเป็นจังหวะ หัวและหางขยับตาม
          for (const d of deer) {
            const target = Math.sin(t * 9.2 - d.phase * 0.2) * 0.08;
            d.vy += ((target - d.y) * d.k - d.vy * 4.2) * dt;
            d.y += d.vy * dt;
            d.vp += (-d.pitch * 30 - d.vp * 5) * dt;
            d.pitch += d.vp * dt;
            d.group.position.set(d.baseX, 1.0 + d.y, d.baseZ);
            d.group.rotation.z = d.pitch * 0.6 + Math.sin(t * 9.2 + d.phase) * 0.06;
            d.legs.forEach((leg, li) => {
              const front = li < 2;
              const ph = t * 11.5 + d.phase + (front ? 0 : Math.PI * 0.6) + (li % 2) * 0.45;
              leg.rotation.z = Math.sin(ph) * 0.75;
              leg.rotation.x = Math.cos(ph) * 0.18;
            });
            d.head.rotation.z = Math.sin(t * 11.5 + d.phase + 0.8) * 0.06 - 0.08;
            d.head.position.y = Math.sin(t * 23 + d.phase) * 0.012;
            d.tail.position.y = 0.08 + Math.sin(t * 11.5 + d.phase) * 0.02;
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

          // ทางหิมะ: ปล่อยเกล็ดจากท้ายเลื่อนตามความเร็ว แล้วให้ลอยวนช้าและจางไป
          tmp.set(rig.position.x - 1.4 * SCALE, rig.position.y + 0.75 * SCALE, rig.position.z);
          const speed = Math.max(0.5, Math.abs(here.x - lastX) / Math.max(dt, 1e-3));
          emitSys(flakes, tmp.x, tmp.y, tmp.z, Math.round(4 + dt * 40), 2.8, 4.2, -0.35 - 0.03 * Math.min(speed, 8), 0.05, 0.6);
          emitSys(mid, tmp.x, tmp.y - 0.1, tmp.z, Math.round(3 + dt * 30), 2.0, 3.2, -0.6 - 0.03 * Math.min(speed, 8), 0.08, 1.0);
          emitSys(dust, tmp.x + 0.2, tmp.y, tmp.z, Math.round(2 + dt * 18), 0.8, 1.5, -1.0, 0.2, 0.5);
          lastX = here.x;
        }
      }
      stepSys(flakes, dt, t);
      stepSys(mid, dt, t);
      stepSys(dust, dt, t);
    },
  };
}
