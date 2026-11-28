// ลานรอบต้นคริสต์มาสและทางเดินไปโซนคำอวยพร
// - ลานหินลายวงทองและเกล็ดหิมะ (แผ่นพื้นแบบลายเดียว)
// - รั้วไม้เท้าลูกกวาดสลับโคมไฟรอบผ้าคลุมโคนต้น (อยู่ในเขตที่ห้ามวางตุ๊กตาอยู่แล้ว)
// - อุโมงค์ซุ้มไฟตามทางเดินจากต้นไปประตูโซน ไฟวิ่งเป็นจังหวะจากต้นไปหาโซน
// ทุกชิ้นวาดแบบรวมหรือ instancing เพื่อให้คำสั่งวาดน้อย
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Plaza = { group: THREE.Group; update: (t: number, reduced: boolean) => void; dispose: () => void };

const PLAZA_R = 6.8;

// ลายพื้นลาน: หินปูสีอ่อน รอยต่อเป็นวงและเส้นรัศมี วงทอง และเกล็ดหิมะทอง 8 จุด ขอบนอกจางเข้าหิมะ
function plazaTexture() {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const C = S / 2;
  const R = S / 2;
  const base = g.createRadialGradient(C, C, 0, C, C, R);
  base.addColorStop(0, "rgba(226,233,240,1)");
  base.addColorStop(0.82, "rgba(214,224,233,1)");
  base.addColorStop(1, "rgba(214,224,233,0)");
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  // รอยต่อหินเป็นวงและเส้นรัศมีสลับกันทีละวง
  g.strokeStyle = "rgba(150,166,182,0.55)";
  g.lineWidth = 2;
  const rings = [0.34, 0.44, 0.54, 0.64, 0.74, 0.84];
  rings.forEach((rr, i) => {
    g.beginPath();
    g.arc(C, C, rr * R, 0, Math.PI * 2);
    g.stroke();
    const n = 14 + i * 6;
    const inner = (i === 0 ? 0.3 : rings[i - 1]) * R;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (i % 2) * (Math.PI / n);
      g.beginPath();
      g.moveTo(C + Math.cos(a) * inner, C + Math.sin(a) * inner);
      g.lineTo(C + Math.cos(a) * rr * R, C + Math.sin(a) * rr * R);
      g.stroke();
    }
  });
  // วงทองคู่
  for (const [rr, w] of [
    [0.47, 7],
    [0.5, 3],
  ] as const) {
    g.strokeStyle = "rgba(205,160,62,0.95)";
    g.lineWidth = w;
    g.beginPath();
    g.arc(C, C, rr * R, 0, Math.PI * 2);
    g.stroke();
  }
  // เกล็ดหิมะทอง 8 จุดรอบวง
  const flake = (x: number, y: number, s: number, rot: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.strokeStyle = "rgba(205,160,62,0.95)";
    g.lineWidth = 4;
    g.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -s);
      g.moveTo(0, -s * 0.55);
      g.lineTo(-s * 0.22, -s * 0.75);
      g.moveTo(0, -s * 0.55);
      g.lineTo(s * 0.22, -s * 0.75);
      g.stroke();
    }
    g.restore();
  };
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    flake(C + Math.cos(a) * 0.6 * R, C + Math.sin(a) * 0.6 * R, 26, a);
  }
  // หิมะบาง ๆ ปกคลุมเป็นหย่อม ๆ
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * 0.95 * R;
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`;
    g.beginPath();
    g.arc(C + Math.cos(a) * rr, C + Math.sin(a) * rr, 2 + Math.random() * 7, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ลายหินปูทางเดิน: ก้อนหินกลมรีเรียงสลับ มีหิมะตามร่อง
function pathTexture() {
  const W = 256;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e9eff5";
  g.fillRect(0, 0, W, H);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 ? 3 : 4;
    for (let k = 0; k < cols; k++) {
      const w = W / cols;
      const x = k * w + (r % 2 ? w / 2 - w / 2 : 0) + w / 2;
      const y = (r + 0.5) * (H / rows);
      const shade = 168 + Math.floor(Math.random() * 30);
      g.fillStyle = `rgb(${shade},${shade + 10},${shade + 22})`;
      g.beginPath();
      g.ellipse(x, y, w * 0.44, H / rows / 2.3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.beginPath();
      g.ellipse(x - w * 0.1, y - 8, w * 0.2, 6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function candyTex() {
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
  tex.repeat.set(1, 5);
  return tex;
}

export function buildPlaza(opts: { gate: { x: number; z: number }; glowTex: THREE.Texture; small: boolean }): Plaza {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const M = <T extends THREE.Material>(m: T) => (mats.push(m), m);
  const T = <X extends THREE.Texture>(t: X) => (texs.push(t), t);
  const m4 = new THREE.Matrix4();

  // ---------- พื้นลาน ----------
  const plazaGeo = G(new THREE.CircleGeometry(PLAZA_R, 96));
  plazaGeo.rotateX(-Math.PI / 2);
  const plaza = new THREE.Mesh(plazaGeo, M(new THREE.MeshStandardMaterial({ map: T(plazaTexture()), transparent: true, roughness: 0.9, depthWrite: false })));
  plaza.position.y = 0.006;
  plaza.receiveShadow = true;
  plaza.renderOrder = 1;
  group.add(plaza);

  // ---------- รั้วไม้เท้าลูกกวาดสลับโคมไฟ รอบผ้าคลุมโคน ----------
  const ringR = 2.5;
  const N = 16;
  const PS = 1.35; // ขนาดรั้วไม้เท้าและโคมไฟ (ขยายตามต้นใหญ่)
  const one = new THREE.Vector3(PS, PS, PS);
  const canePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.34, 0),
    new THREE.Vector3(0.03, 0.42, 0),
    new THREE.Vector3(0.09, 0.44, 0),
    new THREE.Vector3(0.13, 0.4, 0),
    new THREE.Vector3(0.135, 0.34, 0),
  ]);
  const caneGeo = G(new THREE.TubeGeometry(canePath, 28, 0.022, 8, false));
  const canes = new THREE.InstancedMesh(caneGeo, M(new THREE.MeshStandardMaterial({ map: T(candyTex()), roughness: 0.35 })), N);
  // โคมไฟเล็ก: ฐานกับหลังคาสีทองเข้ม แก้วเรืองแสงด้านใน
  const lanternFrame = G(
    mergeGeometries([
      new THREE.BoxGeometry(0.16, 0.03, 0.16).translate(0, 0.015, 0),
      new THREE.ConeGeometry(0.12, 0.08, 4).rotateY(Math.PI / 4).translate(0, 0.25, 0),
      new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6).translate(0.06, 0.12, 0.06),
      new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6).translate(-0.06, 0.12, 0.06),
      new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6).translate(0.06, 0.12, -0.06),
      new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6).translate(-0.06, 0.12, -0.06),
    ])!,
  );
  const frames = new THREE.InstancedMesh(lanternFrame, M(new THREE.MeshStandardMaterial({ color: 0x3a2a14, metalness: 0.6, roughness: 0.4 })), N);
  const glass = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.1, 0.15, 0.1)), M(new THREE.MeshBasicMaterial({ color: 0xffcf7a, toneMapped: false })), N);
  const lanternGlowPos: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const x = Math.cos(a) * ringR;
    const z = Math.sin(a) * ringR;
    // ไม้เท้าหันขอเข้าหาต้น
    canes.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI, 0)), one));
    const a2 = a + Math.PI / N;
    const lx = Math.cos(a2) * ringR;
    const lz = Math.sin(a2) * ringR;
    frames.setMatrixAt(i, m4.compose(new THREE.Vector3(lx, 0, lz), new THREE.Quaternion(), one));
    glass.setMatrixAt(i, m4.compose(new THREE.Vector3(lx, 0.12 * PS, lz), new THREE.Quaternion(), one));
    lanternGlowPos.push(lx, 0.13 * PS, lz);
  }
  for (const m of [canes, frames, glass]) {
    m.castShadow = true;
    m.frustumCulled = false;
    group.add(m);
  }
  const lanternGlowGeo = G(new THREE.BufferGeometry());
  lanternGlowGeo.setAttribute("position", new THREE.Float32BufferAttribute(lanternGlowPos, 3));
  const lanternGlow = new THREE.Points(
    lanternGlowGeo,
    M(new THREE.PointsMaterial({ color: 0xffc46b, size: 0.7, map: opts.glowTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  group.add(lanternGlow);

  // ---------- ทางเดินหินและอุโมงค์ซุ้มไฟ จากลานต้นไม้ไปประตูโซน ----------
  const dir = new THREE.Vector3(opts.gate.x, 0, opts.gate.z);
  const total = dir.length();
  dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const s0 = PLAZA_R - 0.3;
  const len = total - s0 - 0.4;
  const pathW = 2.8;
  const pathGeo = G(new THREE.PlaneGeometry(pathW, len, 1, 1));
  pathGeo.rotateX(-Math.PI / 2);
  const ptex = T(pathTexture());
  ptex.repeat.set(1, len / 2);
  const path = new THREE.Mesh(pathGeo, M(new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.92 })));
  const mid = dir.clone().multiplyScalar(s0 + len / 2);
  path.position.set(mid.x, 0.01, mid.z);
  path.rotation.y = Math.atan2(dir.x, dir.z);
  path.receiveShadow = true;
  group.add(path);

  const archHalf = 1.5;
  const archTop = 2.7;
  const parts: THREE.BufferGeometry[] = [];
  const bulbPos: THREE.Vector3[] = [];
  const bulbS: number[] = []; // ระยะตามทางเดิน ใช้ทำไฟวิ่ง
  const yaw = Math.atan2(-side.z, side.x);
  for (let s = s0 + 1.6; s < total - 1.4; s += 2.3) {
    const c = dir.clone().multiplyScalar(s);
    const rot = new THREE.Matrix4().makeRotationY(yaw);
    for (const k of [-1, 1]) {
      const p = c.clone().addScaledVector(side, k * archHalf);
      parts.push(new THREE.CylinderGeometry(0.03, 0.04, archTop, 8).translate(p.x, archTop / 2, p.z));
      for (let y = 0.3; y < archTop; y += 0.2) {
        bulbPos.push(new THREE.Vector3(p.x, y, p.z).addScaledVector(dir, 0.05));
        bulbS.push(s);
      }
    }
    // โค้งด้านบนพาดขวางทางเดิน
    // โค้งของ torus อยู่ในระนาบ XY: หมุนให้แกน X ตรงกับแนวขวางทางเดิน
    const arc = new THREE.TorusGeometry(archHalf, 0.024, 8, 36, Math.PI);
    arc.applyMatrix4(rot);
    arc.translate(c.x, archTop, c.z);
    parts.push(arc);
    for (let k = 0; k <= 20; k++) {
      const a = (k / 20) * Math.PI;
      bulbPos.push(c.clone().addScaledVector(side, Math.cos(a) * archHalf).setY(archTop + Math.sin(a) * archHalf));
      bulbS.push(s);
    }
  }
  if (parts.length) {
    const archMesh = new THREE.Mesh(G(mergeGeometries(parts)!), M(new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.32 })));
    archMesh.castShadow = true;
    group.add(archMesh);
    parts.forEach((p) => p.dispose());
  }
  const bulbs = new THREE.InstancedMesh(G(new THREE.SphereGeometry(0.034, 8, 6)), M(new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false })), Math.max(1, bulbPos.length));
  bulbPos.forEach((p, i) => bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  bulbs.count = bulbPos.length;
  bulbs.frustumCulled = false;
  group.add(bulbs);
  const haloPos = new Float32Array(bulbPos.length * 3);
  const haloCol = new Float32Array(bulbPos.length * 3);
  bulbPos.forEach((p, i) => haloPos.set([p.x, p.y, p.z], i * 3));
  const haloGeo = G(new THREE.BufferGeometry());
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  const halos = new THREE.Points(haloGeo, M(new THREE.PointsMaterial({ size: 0.5, map: opts.glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  halos.frustumCulled = false;
  group.add(halos);
  const warm = new THREE.Color(0xffd38a);
  const haloAttr = haloGeo.getAttribute("color") as THREE.BufferAttribute;

  function update(t: number, reduced: boolean) {
    // ไฟวิ่งจากลานต้นไม้ไปหาประตูโซน เหมือนชี้ทางให้เดินไป
    for (let i = 0; i < bulbS.length; i++) {
      const b = reduced ? 0.85 : 0.45 + 0.55 * Math.max(0, Math.sin(t * 3 - bulbS[i] * 0.9));
      haloAttr.setXYZ(i, warm.r * b, warm.g * b, warm.b * b);
    }
    haloAttr.needsUpdate = true;
    (lanternGlow.material as THREE.PointsMaterial).opacity = reduced ? 0.75 : 0.62 + 0.13 * Math.sin(t * 5.3) * Math.sin(t * 2.1);
  }

  function dispose() {
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((tx) => tx.dispose());
  }

  return { group, update, dispose };
}
