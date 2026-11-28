// ฉากรอบลานต้นคริสต์มาส: เสาไฟโบราณรอบลานพร้อมสายไฟห้อยระหว่างเสา ม้านั่งหันหาต้น
// ลูกบอลประดับยักษ์วางบนหิมะ ป่าสนหิมะเกาะเป็นกลุ่ม และเนินหิมะ
// ตำแหน่งทั้งหมดสุ่มแบบคงที่ ทุกเครื่องจึงเห็นเหมือนกัน และหลบทางเดินกับโซนคำอวยพร
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Opts = {
  glowTex: THREE.Texture;
  small: boolean;
  gate: { x: number; z: number }; // ประตูโซนคำอวยพร (ทางเดินจากต้นไปทิศนี้)
  blocked: (x: number, z: number, pad: number) => boolean; // ทางเดินหรือโซน ห้ามวางของ
};

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ต้นสนหิมะเกาะ: ชั้นใบขอบหยัก 5 ชั้น มีหิมะเกาะบนแต่ละชั้น ใช้สีที่จุดยอดจึงวาดทั้งป่าได้ในครั้งเดียว
function pineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, hex: number) => {
    const c = new THREE.Color(hex);
    const n = g.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.deleteAttribute("uv");
    return g;
  };
  const jag = (g: THREE.BufferGeometry, amp: number, k: number) => {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const f = 1 + amp * Math.sin(a * k) + amp * 0.5 * Math.sin(a * k * 2.3 + 1);
      p.setX(i, x * f);
      p.setZ(i, z * f);
    }
    g.computeVertexNormals();
    return g;
  };
  parts.push(paint(new THREE.CylinderGeometry(0.07, 0.11, 0.6, 7).translate(0, 0.3, 0).toNonIndexed(), 0x4a2f1a));
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const r = 0.95 - k * 0.62;
    const h = 0.9 - k * 0.3;
    const y = 0.35 + k * 2.1;
    const tone = [0x174a2e, 0x1a5233, 0x1d5a37, 0x1f6139, 0x22683d][t];
    parts.push(paint(jag(new THREE.ConeGeometry(r, h, 14, 1, true).translate(0, y + h / 2, 0), 0.12, 7), tone).toNonIndexed());
    // หิมะเกาะบนชั้นใบ: กรวยเตี้ยสีขาวทับส่วนบนของชั้น
    parts.push(paint(jag(new THREE.ConeGeometry(r * 0.72, h * 0.34, 14, 1, true).translate(0, y + h * 0.83, 0), 0.16, 7), 0xf2f7fc).toNonIndexed());
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

export function buildSurroundings(opts: Opts): { group: THREE.Group; update: (t: number, reduced: boolean) => void; dispose: () => void } {
  const { glowTex, small, gate, blocked } = opts;
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const M = <T extends THREE.Material>(m: T) => (mats.push(m), m);
  const r = rng(424242);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const gateA = Math.atan2(gate.z, gate.x);
  const angDiff = (a: number, b: number) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  };

  // ---------- เสาไฟโบราณรอบลาน และสายไฟห้อยโค้งระหว่างเสา ----------
  const LAMP_R = 7.7;
  const LAMP_H = 2.9;
  const lampAngles: number[] = [];
  const N_LAMP = 10; // 10 ต้น: มุมกล้องหน้าต้น (ทิศ +z) อยู่กึ่งกลางระหว่างเสาพอดี ไม่มีเสาบังต้น
  for (let i = 0; i < N_LAMP; i++) {
    const a = gateA + ((i + 0.5) / N_LAMP) * Math.PI * 2;
    lampAngles.push(a);
  }
  const lampPts = lampAngles.map((a) => new THREE.Vector2(Math.cos(a) * LAMP_R, Math.sin(a) * LAMP_R));
  const ironParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const glassPos: THREE.Vector3[] = [];
  for (const p of lampPts) {
    ironParts.push(new THREE.CylinderGeometry(0.2, 0.26, 0.34, 10).translate(p.x, 0.17, p.y).toNonIndexed());
    ironParts.push(new THREE.CylinderGeometry(0.05, 0.075, LAMP_H, 8).translate(p.x, LAMP_H / 2, p.y).toNonIndexed());
    ironParts.push(new THREE.TorusGeometry(0.1, 0.02, 6, 14).rotateX(Math.PI / 2).translate(p.x, LAMP_H * 0.62, p.y).toNonIndexed());
    // แขนโคมสองข้างแบบเสาไฟถนนยุโรป
    for (const s of [-1, 1]) {
      const dir = new THREE.Vector2(-p.y, p.x).normalize().multiplyScalar(s);
      ironParts.push(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 6).rotateZ(Math.PI / 2).rotateY(-Math.atan2(dir.y, dir.x)).translate(p.x + dir.x * 0.25, LAMP_H - 0.05, p.y + dir.y * 0.25).toNonIndexed());
      const lx = p.x + dir.x * 0.5;
      const lz = p.y + dir.y * 0.5;
      ironParts.push(new THREE.ConeGeometry(0.17, 0.18, 6).translate(lx, LAMP_H + 0.27, lz).toNonIndexed());
      ironParts.push(new THREE.CylinderGeometry(0.1, 0.07, 0.05, 6).translate(lx, LAMP_H - 0.12, lz).toNonIndexed());
      goldParts.push(new THREE.SphereGeometry(0.035, 8, 6).translate(lx, LAMP_H + 0.4, lz).toNonIndexed());
      glassPos.push(new THREE.Vector3(lx, LAMP_H + 0.06, lz));
    }
    goldParts.push(new THREE.SphereGeometry(0.06, 10, 8).translate(p.x, LAMP_H + 0.1, p.y).toNonIndexed());
    // พวงหรีดเล็กที่เสา
    goldParts.push(new THREE.TorusGeometry(0.14, 0.03, 6, 16).translate(p.x, LAMP_H * 0.45, p.y).toNonIndexed());
  }
  const ironMesh = new THREE.Mesh(G(mergeGeometries(ironParts)!), M(new THREE.MeshStandardMaterial({ color: 0x1d2420, roughness: 0.45, metalness: 0.65 })));
  ironMesh.castShadow = true;
  const goldMesh = new THREE.Mesh(G(mergeGeometries(goldParts)!), M(new THREE.MeshStandardMaterial({ color: 0xd4a94a, roughness: 0.3, metalness: 0.85 })));
  ironParts.forEach((g) => g.dispose());
  goldParts.forEach((g) => g.dispose());
  group.add(ironMesh, goldMesh);
  const glass = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.16, 0.24, 0.16)), M(new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })), glassPos.length);
  glassPos.forEach((p, i) => glass.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  glass.frustumCulled = false;
  group.add(glass);
  const glowGeo = G(new THREE.BufferGeometry());
  glowGeo.setAttribute("position", new THREE.Float32BufferAttribute(glassPos.flatMap((p) => [p.x, p.y, p.z]), 3));
  const lampGlow = new THREE.Points(glowGeo, M(new THREE.PointsMaterial({ color: 0xffc46b, size: 1.6, map: glowTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
  lampGlow.frustumCulled = false;
  group.add(lampGlow);

  // สายไฟห้อยระหว่างเสา (เว้นช่วงที่ทางเดินไปโซนลอดผ่าน)
  const bulbPos: THREE.Vector3[] = [];
  const bulbCol: THREE.Color[] = [];
  const COLS = [0xffd76a, 0xff5a6e, 0xfff1d0, 0x86efac, 0x7dd3fc];
  const wire: THREE.Vector3[][] = [];
  for (let i = 0; i < N_LAMP; i++) {
    const a = lampPts[i];
    const b = lampPts[(i + 1) % N_LAMP];
    const midA = (lampAngles[i] + lampAngles[(i + 1) % N_LAMP] + (i === N_LAMP - 1 ? Math.PI * 2 : 0)) / 2;
    // เว้นช่วงทางเดินไปโซน และช่วงหน้ากล้องหลัก (ทิศ +z) ไม่ให้สายไฟพาดบังโคนต้น
    if (angDiff(midA, gateA) < 0.2 || angDiff(midA, Math.PI / 2) < 0.2) continue;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, LAMP_H - 0.25 - Math.sin(t * Math.PI) * 0.75, a.y + (b.y - a.y) * t));
    }
    wire.push(pts);
    for (let k = 1; k < 16; k++) {
      const p = pts[k].clone();
      p.y -= 0.05;
      bulbPos.push(p);
      bulbCol.push(new THREE.Color(COLS[(i * 3 + k) % COLS.length]));
    }
  }
  if (wire.length) {
    const wireGeo = mergeGeometries(wire.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 4, false)));
    if (wireGeo) group.add(new THREE.Mesh(G(wireGeo), M(new THREE.MeshBasicMaterial({ color: 0x1b2a22 }))));
  }
  const bulbs = new THREE.InstancedMesh(G(new THREE.SphereGeometry(0.045, 8, 6)), M(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), Math.max(1, bulbPos.length));
  bulbPos.forEach((p, i) => {
    bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    bulbs.setColorAt(i, bulbCol[i]);
  });
  bulbs.frustumCulled = false;
  group.add(bulbs);
  const haloPos = new Float32Array(bulbPos.length * 3);
  bulbPos.forEach((p, i) => haloPos.set([p.x, p.y, p.z], i * 3));
  const haloGeo = G(new THREE.BufferGeometry());
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bulbPos.length * 3), 3));
  const halos = new THREE.Points(haloGeo, M(new THREE.PointsMaterial({ size: 0.5, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  halos.frustumCulled = false;
  group.add(halos);
  const haloAttr = haloGeo.getAttribute("color") as THREE.BufferAttribute;

  // ---------- ม้านั่งไม้ขาเหล็กหันหาต้น วางระหว่างเสาไฟ ----------
  const benchWood: THREE.BufferGeometry[] = [];
  const benchIron: THREE.BufferGeometry[] = [];
  const benchSnow: THREE.BufferGeometry[] = [];
  for (let i = 0; i < N_LAMP; i += 3) {
    const a = gateA + ((i + 1.5) / N_LAMP) * Math.PI * 2 + Math.PI / N_LAMP;
    if (angDiff(a, gateA) < 0.7 || angDiff(a, Math.PI / 2) < 0.3) continue;
    const R = LAMP_R + 0.7;
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R), q.setFromAxisAngle(up, Math.PI / 2 - a), new THREE.Vector3(1, 1, 1));
    for (let s = 0; s < 3; s++) benchWood.push(new THREE.BoxGeometry(1.5, 0.05, 0.12).translate(0, 0.44, -0.14 + s * 0.14).applyMatrix4(mtx).toNonIndexed());
    for (let s = 0; s < 2; s++) benchWood.push(new THREE.BoxGeometry(1.5, 0.11, 0.04).translate(0, 0.62 + s * 0.16, 0.24).applyMatrix4(mtx).toNonIndexed());
    for (const x of [-0.65, 0.65]) {
      benchIron.push(new THREE.BoxGeometry(0.05, 0.44, 0.44).translate(x, 0.22, 0).applyMatrix4(mtx).toNonIndexed());
      benchIron.push(new THREE.BoxGeometry(0.05, 0.42, 0.05).translate(x, 0.65, 0.26).applyMatrix4(mtx).toNonIndexed());
    }
    benchSnow.push(new THREE.BoxGeometry(1.4, 0.04, 0.36).translate(0.02, 0.485, 0).applyMatrix4(mtx).toNonIndexed());
  }
  const addMerged = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
    if (!list.length) return;
    const m = new THREE.Mesh(G(mergeGeometries(list)!), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    list.forEach((g) => g.dispose());
  };
  addMerged(benchWood, M(new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 })));
  addMerged(benchIron, M(new THREE.MeshStandardMaterial({ color: 0x1d2420, roughness: 0.45, metalness: 0.6 })));
  addMerged(benchSnow, M(new THREE.MeshStandardMaterial({ color: 0xf6faff, roughness: 0.55 })));

  // ---------- ลูกบอลประดับยักษ์วางบนหิมะเป็นกลุ่ม ----------
  const baubleCols = [0xc8102e, 0xd4a94a, 0x1f7a4d, 0x2f6fd6, 0xf2f2f2];
  const baubleMats = baubleCols.map((c) => M(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.12, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06 })));
  const capMat = M(new THREE.MeshStandardMaterial({ color: 0xd4a94a, roughness: 0.3, metalness: 0.85 }));
  const ballGeo = G(new THREE.SphereGeometry(1, 32, 22));
  const capGeo = G(new THREE.CylinderGeometry(0.22, 0.28, 0.2, 14));
  const loopGeo = G(new THREE.TorusGeometry(0.14, 0.035, 8, 16));
  const clusterAngles = [gateA + Math.PI * 0.62, gateA + Math.PI, gateA - Math.PI * 0.6];
  clusterAngles.forEach((a, ci) => {
    const R = 11.2;
    const cx = Math.cos(a) * R;
    const cz = Math.sin(a) * R;
    if (blocked(cx, cz, 2)) return;
    [
      [0, 0, 0.62],
      [0.95, 0.35, 0.44],
      [-0.7, 0.55, 0.36],
    ].forEach(([dx, dz, s], k) => {
      const ball = new THREE.Group();
      const body = new THREE.Mesh(ballGeo, baubleMats[(ci * 2 + k) % baubleMats.length]);
      body.scale.setScalar(s);
      body.position.y = s * 0.92;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.scale.setScalar(s);
      // ลูกบอลเอียงเล็กน้อยเหมือนวางทิ้งไว้บนหิมะ หัวโลหะจึงชี้ไปด้านข้าง
      cap.position.set(0, s * 1.88, 0);
      const loop = new THREE.Mesh(loopGeo, capMat);
      loop.scale.setScalar(s);
      loop.position.set(0, s * 2.02, 0);
      ball.add(body, cap, loop);
      ball.rotation.z = 0.25 + k * 0.2;
      ball.rotation.y = r() * Math.PI * 2;
      ball.position.set(cx + dx, -s * 0.12, cz + dz);
      ball.traverse((o) => {
        o.castShadow = true;
      });
      group.add(ball);
    });
  });

  // ---------- ป่าสนหิมะเกาะ: กลุ่มใหญ่รอบลาน และต้นเดี่ยวกระจายไกลออกไป ----------
  const pineGeo = G(pineGeometry());
  const pineMat = M(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  const pineMtx: THREE.Matrix4[] = [];
  const tryPine = (x: number, z: number, s: number) => {
    if (blocked(x, z, 2.2) || Math.hypot(x, z) < 14) return;
    pineMtx.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, r() * Math.PI * 2), new THREE.Vector3(s, s * (0.9 + r() * 0.3), s)));
  };
  const groves = small ? 6 : 9;
  for (let g = 0; g < groves; g++) {
    const a = gateA + 0.55 + (g / groves) * (Math.PI * 2 - 1.1) + (r() - 0.5) * 0.25;
    const R = 16 + r() * 6;
    const n = (small ? 4 : 6) + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) tryPine(Math.cos(a) * R + (r() - 0.5) * 5, Math.sin(a) * R + (r() - 0.5) * 5, 1.1 + r() * 1.3);
  }
  for (let k = 0; k < (small ? 30 : 60); k++) {
    const a = r() * Math.PI * 2;
    const R = 26 + r() * 22;
    tryPine(Math.cos(a) * R, Math.sin(a) * R, 1.4 + r() * 1.6);
  }
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, Math.max(1, pineMtx.length));
  pineMtx.forEach((mm, i) => pines.setMatrixAt(i, mm));
  pines.count = pineMtx.length;
  pines.castShadow = true;
  pines.receiveShadow = true;
  group.add(pines);

  // ---------- เนินหิมะนุ่ม ๆ ใกล้ต้นสนและริมลาน ----------
  const moundGeo = G(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2));
  const moundMtx: THREE.Matrix4[] = [];
  for (let k = 0; k < (small ? 24 : 40); k++) {
    const a = r() * Math.PI * 2;
    const R = 12 + r() * 20;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    if (blocked(x, z, 1.5)) continue;
    const s = 0.6 + r() * 1.2;
    moundMtx.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -0.05, z), q.setFromAxisAngle(up, r() * 3), new THREE.Vector3(s * (1.2 + r()), s * 0.32, s)));
  }
  const mounds = new THREE.InstancedMesh(moundGeo, M(new THREE.MeshStandardMaterial({ color: 0xf3f7fb, roughness: 0.9 })), Math.max(1, moundMtx.length));
  moundMtx.forEach((mm, i) => mounds.setMatrixAt(i, mm));
  mounds.count = moundMtx.length;
  mounds.receiveShadow = true;
  group.add(mounds);

  const phase = bulbPos.map((_, i) => (i * 2.399) % (Math.PI * 2));
  function update(t: number, reduced: boolean) {
    for (let i = 0; i < bulbCol.length; i++) {
      const b = reduced ? 0.85 : 0.5 + 0.5 * Math.max(0, Math.sin(t * 2 + phase[i]));
      haloAttr.setXYZ(i, bulbCol[i].r * b, bulbCol[i].g * b, bulbCol[i].b * b);
    }
    haloAttr.needsUpdate = true;
    (lampGlow.material as THREE.PointsMaterial).opacity = reduced ? 0.7 : 0.62 + 0.08 * Math.sin(t * 4.3) * Math.sin(t * 1.7);
  }
  function dispose() {
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
  return { group, update, dispose };
}
