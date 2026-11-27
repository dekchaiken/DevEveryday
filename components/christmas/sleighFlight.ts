// ซานตากับกวางเรนเดียร์ลากเลื่อนบินผ่านท้องฟ้าเหนือต้นคริสต์มาส ทิ้งทางประกายแสงไว้ข้างหลัง
// ทุกชิ้นสร้างด้วยโค้ด ไม่มีไฟล์โมเดลภายนอก
import * as THREE from "three";

export type SleighFlight = {
  group: THREE.Group;
  start: (now: number) => void;
  update: (now: number, reduced: boolean) => void;
  isActive: () => boolean;
};

const DURATION = 11000; // ms ที่ใช้บินข้ามท้องฟ้าหนึ่งรอบ
const X0 = -14;
const X1 = 14;
const Z = -8;
const BASE_Y = 3.85;
const TRAIL_N = 360;

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

const mat = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const add = <T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x = 0, y = 0, z = 0): T => {
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};

// กวางเรนเดียร์หนึ่งตัว: ลำตัว คอ หัว เขา จมูกเรืองแสง และขาสี่ข้างที่ก้าววิ่ง
function buildReindeer(): { group: THREE.Group; legs: THREE.Group[]; nose: THREE.Mesh } {
  const g = new THREE.Group();
  const fur = mat(0x9a6a3a, 0.9);
  const dark = mat(0x4a2f18, 0.8);
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), fur), 0, 0, 0).scale.set(1.5, 0.8, 0.85);
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat(0xf4efe6, 0.9)), -0.33, 0.06, 0).scale.set(1, 1, 1);
  const neck = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.34, 10), fur), 0.27, 0.2, 0);
  neck.rotation.z = -0.65;
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), fur), 0.41, 0.37, 0).scale.set(1.45, 1, 1);
  const nose = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2e4d })), 0.56, 0.35, 0);
  add(g, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), fur), 0.36, 0.48, 0.1).rotation.z = 0.8;
  add(g, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), fur), 0.36, 0.48, -0.1).rotation.z = 0.8;
  // เขาสองข้างแตกกิ่ง
  for (const s of [-1, 1]) {
    const pts = [new THREE.Vector3(0.4, 0.46, s * 0.06), new THREE.Vector3(0.36, 0.62, s * 0.1), new THREE.Vector3(0.3, 0.78, s * 0.08), new THREE.Vector3(0.22, 0.86, s * 0.06)];
    add(g, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 6, false), dark));
    const branch = [new THREE.Vector3(0.36, 0.62, s * 0.1), new THREE.Vector3(0.44, 0.7, s * 0.14)];
    add(g, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branch), 6, 0.013, 6, false), dark));
  }
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xffffff, 0.6)), -0.3, 0.04, 0);
  // ขาสี่ข้าง จุดหมุนอยู่ที่สะโพก
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [0.13, 0.1],
    [0.13, -0.1],
    [-0.13, 0.1],
    [-0.13, -0.1],
  ]) {
    const pivot = add(g, new THREE.Group(), x, -0.12, z);
    add(pivot, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.36, 8), fur), 0, -0.18, 0);
    add(pivot, new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dark), 0, -0.37, 0);
    legs.push(pivot);
  }
  return { group: g, legs, nose };
}

// เลื่อนพร้อมซานตา ถุงของขวัญ และกวางสี่ตัวลากข้างหน้า
export function buildSleighFlight(): SleighFlight {
  const group = new THREE.Group();
  group.visible = false;
  const rig = new THREE.Group();
  rig.scale.setScalar(1.45); // ให้เห็นชัดจากมุมกล้องหลัก
  group.add(rig);

  // ตัวเลื่อนสีแดงเงาวาวมีขอบทอง
  const profile = new THREE.Shape();
  profile.moveTo(-0.62, 0.62);
  profile.lineTo(0.5, 0.62);
  profile.quadraticCurveTo(0.74, 0.62, 0.78, 0.92);
  profile.lineTo(0.66, 0.94);
  profile.quadraticCurveTo(0.62, 0.8, 0.44, 0.8);
  profile.lineTo(-0.62, 0.8);
  profile.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.56, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
  bodyGeo.translate(0, 0, -0.28);
  const redPaint = new THREE.MeshPhysicalMaterial({ color: 0xc41e3a, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.18 });
  add(rig, new THREE.Mesh(bodyGeo, redPaint));
  const gold = mat(0xf5c542, 0.25, 0.85);
  for (const z of [-0.3, 0.3]) add(rig, new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.03), gold), -0.05, 0.8, z);
  // คันเลื่อนทองโค้งตามพื้น
  const runner = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.92, 0.2, 0), new THREE.Vector3(-0.3, 0.05, 0), new THREE.Vector3(0.5, 0.05, 0), new THREE.Vector3(0.98, 0.5, 0)]);
  add(rig, new THREE.Mesh(new THREE.TubeGeometry(runner, 40, 0.035, 8, false), gold));
  // ถุงของขวัญข้างหลังและซานตาที่นั่งอยู่
  const sack = add(rig, new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), mat(0x9a6b3a, 0.95)), -0.58, 0.95, 0);
  sack.scale.set(1.1, 0.9, 1);
  add(rig, new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), gold), -0.58, 1.14, 0).rotation.x = Math.PI / 2;
  const santaRed = new THREE.MeshPhysicalMaterial({ color: 0xd62839, roughness: 0.5, clearcoat: 0.3 });
  add(rig, new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), santaRed), -0.12, 0.95, 0).scale.set(0.95, 1.15, 0.9);
  add(rig, new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.36), mat(0x111111, 0.5)), -0.12, 0.84, 0);
  add(rig, new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mat(0xf2c9a0, 0.7)), -0.1, 1.2, 0);
  add(rig, new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), mat(0xffffff, 0.95)), -0.08, 1.12, 0.07).scale.set(1.1, 0.9, 0.7);
  const hat = add(rig, new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 14), santaRed), -0.14, 1.36, -0.02);
  hat.rotation.z = 0.35;
  add(rig, new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 18), mat(0xffffff, 0.9)), -0.1, 1.23, 0).rotation.x = Math.PI / 2;
  add(rig, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xffffff, 0.9)), -0.02, 1.5, -0.06);
  // แขนสองข้างจับบังเหียน
  for (const z of [-0.2, 0.2]) {
    const arm = add(rig, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 8), santaRed), 0.12, 1.0, z);
    arm.rotation.z = -1.1;
    add(rig, new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xf2c9a0, 0.7)), 0.3, 0.9, z * 0.6);
  }

  // กวางเรนเดียร์สี่ตัว วิ่งนำหน้าเลื่อน ต่อบังเหียนมาที่หน้าเลื่อน
  const deer: { group: THREE.Group; legs: THREE.Group[]; nose: THREE.Mesh; phase: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const d = buildReindeer();
    const x = 1.45 + i * 0.85;
    const z = i % 2 === 0 ? 0.12 : -0.12;
    d.group.position.set(x, 0.95 + (i % 2) * 0.06, z);
    d.group.rotation.y = i % 2 ? -0.08 : 0.08;
    rig.add(d.group);
    deer.push({ ...d, phase: i * 1.7 });
    // บังเหียนเชือกสีทอง จากอกกวางไปยังหน้าเลื่อน
    const reinA = new THREE.Vector3(x - 0.28, 0.9 + (i % 2) * 0.06, z);
    const reinB = new THREE.Vector3(0.78, 0.7, 0);
    const dir = reinB.clone().sub(reinA);
    const rein = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, dir.length(), 4), gold);
    rein.position.copy(reinA).add(reinB).multiplyScalar(0.5);
    rein.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    rig.add(rein);
  }

  // ทางประกายที่ไหลตามเลื่อน: จุดแสงแต่ละจุดมีอายุและค่อย ๆ จาง
  const pos = new Float32Array(TRAIL_N * 3);
  const col = new Float32Array(TRAIL_N * 3);
  const baseCol = new Float32Array(TRAIL_N * 3);
  const vel = new Float32Array(TRAIL_N * 3);
  const life = new Float32Array(TRAIL_N);
  const age = new Float32Array(TRAIL_N).fill(999);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const trail = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({ size: 0.34, map: glow(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
  );
  trail.frustumCulled = false;
  group.add(trail);

  let active = false;
  let startedAt = 0;
  let lastNow = 0;
  let cursor = 0;
  const gold3 = new THREE.Color(0xffd98a);
  const white3 = new THREE.Color(0xffffff);

  const emit = (x: number, y: number, z: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const i = cursor;
      cursor = (cursor + 1) % TRAIL_N;
      pos[i * 3] = x + (Math.random() - 0.5) * 0.25;
      pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
      vel[i * 3] = -0.4 - Math.random() * 0.5;
      vel[i * 3 + 1] = (Math.random() - 0.3) * 0.25;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      life[i] = 1.2 + Math.random() * 1.2;
      age[i] = 0;
      const c = Math.random() < 0.7 ? gold3 : white3;
      baseCol[i * 3] = c.r;
      baseCol[i * 3 + 1] = c.g;
      baseCol[i * 3 + 2] = c.b;
    }
  };

  return {
    group,
    start: (now) => {
      active = true;
      startedAt = now;
      lastNow = now;
      group.visible = true;
    },
    isActive: () => active,
    update: (now, reduced) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      if (active) {
        const p = (now - startedAt) / DURATION;
        if (p >= 1 || reduced) {
          active = false;
          group.visible = false;
        } else {
          const e = p; // ความเร็วคงที่ข้ามท้องฟ้า
          const x = X0 + (X1 - X0) * e;
          const y = BASE_Y + Math.sin(e * Math.PI * 2) * 0.35;
          const t = now / 1000;
          rig.position.set(x, y + Math.sin(t * 6) * 0.05, Z);
          rig.rotation.z = Math.cos(e * Math.PI * 2) * 0.06;
          // กวางวิ่งก้าวเป็นจังหวะ และจมูกเรืองแสง
          for (const d of deer) {
            d.legs.forEach((leg, li) => {
              leg.rotation.z = Math.sin(t * 13 + d.phase + (li % 2) * Math.PI) * 0.55;
              leg.rotation.x = Math.cos(t * 13 + d.phase + (li < 2 ? 0 : Math.PI)) * 0.15;
            });
            (d.nose.material as THREE.MeshBasicMaterial).color.setHSL(0.98, 1, 0.55 + Math.sin(t * 8 + d.phase) * 0.12);
          }
          emit(x - 1.5, y + 0.85, Z, 14);
        }
      }
      // ปรับอายุ ตำแหน่ง และความสว่างของประกายแต่ละจุด (จางลงเรื่อย ๆ ตามอายุ)
      for (let i = 0; i < TRAIL_N; i++) {
        if (age[i] >= life[i]) {
          col[i * 3] = 0;
          col[i * 3 + 1] = 0;
          col[i * 3 + 2] = 0;
          continue;
        }
        age[i] += dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 0.05 * dt;
        const f = 1 - age[i] / life[i];
        const k = f * f;
        col[i * 3] = baseCol[i * 3] * k;
        col[i * 3 + 1] = baseCol[i * 3 + 1] * k;
        col[i * 3 + 2] = baseCol[i * 3 + 2] * k;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;
    },
  };
}
