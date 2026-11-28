// ซานตาและกวางเรนเดียร์ลากเลื่อนบินข้ามท้องฟ้าเหนือต้นคริสต์มาส ทิ้งหิมะโปรยไว้เป็นทางให้ค่อย ๆ หายไป
// ทุกชิ้นสร้างด้วยโค้ด ไม่มีไฟล์โมเดลภายนอก การเคลื่อนไหวมีแรงเฉื่อย การโยก และการสปริงตามกัน
import * as THREE from "three";
import { buildSleighRig } from "./sleighModel";

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
  // โมเดลเลื่อน ซานตา และกวาง (ดู sleighModel.ts)
  const model = buildSleighRig();
  rig.add(model.group);

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

        // ซานตา กวาง บังเหียน และโคมไฟขยับตามเวลา
        model.animate(t, dt);

        // ทางหิมะ: ปล่อยเกล็ดจากท้ายเลื่อนทุกเฟรม ลมพัดไปทางหลัง แล้วค่อย ๆ ลอยลงและจางหาย
        rig.updateMatrixWorld(true);
        tailPos.copy(model.tailLocal).applyMatrix4(rig.matrixWorld);
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
