// ทางรถไฟคริสต์มาสรอบขอบลาน: รางวงกลมระหว่างขอบลาน (รัศมี 56) กับแนวเขา (59) จึงไม่ทับช่องตุ๊กตาหรือบ้านหิมะ
// รถไฟไอน้ำสีแดงทองลากตู้โดยสารไฟอุ่น ตู้ของขวัญ และตู้ท้าย วิ่งรอบลานตามนาฬิกาเซิร์ฟเวอร์ (ทุกคนเห็นตำแหน่งเดียวกัน)
// เสาไฟทางเรียงตามราง ให้ขอบลานสว่างมีชีวิต เห็นชัดตอนซูมออกไกล
// ความลื่น: ชิ้นที่ไม่ขยับรวมเป็นก้อนเดียวต่อวัสดุ ไม้หมอนและเสาไฟใช้ InstancedMesh
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const RAIL_R = 57.5;
const LAP_SEC = 110; // วิ่งครบรอบใน 110 วินาที

const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
// รวมชิ้นตามวัสดุ (ลดจำนวนครั้งที่วาด)
class Bake {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], r: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    tm.compose(new THREE.Vector3(...p), tq.setFromEuler(te.set(...r)), new THREE.Vector3(...s));
    g = g.applyMatrix4(tm);
    const l = this.parts.get(mat) ?? [];
    l.push(g);
    this.parts.set(mat, l);
  }
  build() {
    const grp = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const m = mergeGeometries(list, false);
      if (m) {
        const mesh = new THREE.Mesh(m, mat);
        mesh.castShadow = false;
        grp.add(mesh);
      }
    }
    return grp;
  }
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRailway(opts: { small: boolean }) {
  const group = new THREE.Group();
  group.name = "railway";
  group.position.y = 0.1; // ยกพ้นลอนหิมะที่ขอบลานเล็กน้อย
  const R = RAIL_R;
  const glow = glowTexture();
  const M = {
    gravel: new THREE.MeshStandardMaterial({ color: 0x6d675f, roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.3, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.9 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xb3162f, roughness: 0.35, clearcoat: 0.8 }),
    green: new THREE.MeshPhysicalMaterial({ color: 0x1b5e3c, roughness: 0.4, clearcoat: 0.6 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.5 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf2c25a, roughness: 0.25, metalness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.3 }),
    snow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    window: new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 1.5 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffe7b0, emissive: 0xffc46b, emissiveIntensity: 1.8 }),
    bulbR: new THREE.MeshStandardMaterial({ color: 0xff5a6e, emissive: 0xff3b50, emissiveIntensity: 1.4 }),
    bulbG: new THREE.MeshStandardMaterial({ color: 0x8dffb0, emissive: 0x3ee07a, emissiveIntensity: 1.4 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x1f6b3f, roughness: 0.8 }),
    giftA: new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.5 }),
    giftB: new THREE.MeshStandardMaterial({ color: 0xe25da0, roughness: 0.5 }),
  };

  // ---------- ทางรถไฟ: หินโรยราง ไม้หมอน และรางเหล็กสองเส้น ----------
  const bed = new THREE.Mesh(new THREE.RingGeometry(R - 1.05, R + 1.05, 256, 1), M.gravel);
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = 0.06;
  bed.receiveShadow = true;
  group.add(bed);
  for (const off of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R + off, 0.045, 5, 400), M.rail);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.2;
    group.add(rail);
  }
  const nSleep = Math.round((Math.PI * 2 * R) / 0.75);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.09, 1.3), M.wood, nSleep);
  const d = new THREE.Object3D();
  for (let i = 0; i < nSleep; i++) {
    const a = (i / nSleep) * Math.PI * 2;
    d.position.set(Math.cos(a) * R, 0.12, Math.sin(a) * R);
    d.rotation.set(0, -a, 0);
    d.updateMatrix();
    sleepers.setMatrixAt(i, d.matrix);
  }
  group.add(sleepers);

  // ---------- เสาไฟทางสองฝั่งราง สลับกัน ----------
  const nLamp = opts.small ? 40 : 56;
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 6), M.black, nLamp);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.36, 0.32), M.lamp, nLamp);
  const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 0.26, 4), M.black, nLamp);
  const glowPos = new Float32Array(nLamp * 3);
  for (let i = 0; i < nLamp; i++) {
    const a = (i / nLamp) * Math.PI * 2 + 0.03;
    const r = i % 2 ? R + 1.45 : R - 1.45;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    d.rotation.set(0, 0, 0);
    d.position.set(x, 1.3, z);
    d.updateMatrix();
    posts.setMatrixAt(i, d.matrix);
    d.position.set(x, 2.75, z);
    d.updateMatrix();
    heads.setMatrixAt(i, d.matrix);
    d.position.set(x, 3.05, z);
    d.rotation.set(0, Math.PI / 4, 0);
    d.updateMatrix();
    caps.setMatrixAt(i, d.matrix);
    glowPos.set([x, 2.75, z], i * 3);
  }
  group.add(posts, heads, caps);
  const lampGlowGeo = new THREE.BufferGeometry();
  lampGlowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  const lampGlow = new THREE.Points(lampGlowGeo, new THREE.PointsMaterial({ color: 0xffc46b, size: 3.2, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  lampGlow.frustumCulled = false;
  group.add(lampGlow);

  // ---------- ขบวนรถไฟ (แกน +x = หน้ารถ) ----------
  const wheels = (b: Bake, xs: number[], r = 0.26) => {
    for (const x of xs)
      for (const z of [-0.5, 0.5]) {
        b.add(new THREE.CylinderGeometry(r, r, 0.1, 14), M.black, [x, r + 0.12, z], [Math.PI / 2, 0, 0]);
        b.add(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.12, 8), M.gold, [x, r + 0.12, z], [Math.PI / 2, 0, 0]);
      }
  };
  const loco = () => {
    const b = new Bake();
    b.add(new THREE.BoxGeometry(3.3, 0.3, 1.15), M.black, [0, 0.62, 0]);
    b.add(new THREE.CylinderGeometry(0.48, 0.48, 2.0, 20), M.red, [0.45, 1.25, 0], [0, 0, Math.PI / 2]);
    for (const x of [-0.3, 0.4, 1.1]) b.add(new THREE.TorusGeometry(0.49, 0.035, 6, 24), M.gold, [x, 1.25, 0], [0, Math.PI / 2, 0]);
    b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20), M.gold, [1.46, 1.25, 0], [0, 0, Math.PI / 2]);
    // ปล่องควันทรงบานและขอบทอง
    b.add(new THREE.CylinderGeometry(0.3, 0.17, 0.6, 14), M.black, [1.05, 1.95, 0]);
    b.add(new THREE.TorusGeometry(0.3, 0.04, 6, 18), M.gold, [1.05, 2.25, 0], [Math.PI / 2, 0, 0]);
    b.add(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold, [0.35, 1.7, 0]);
    // ห้องคนขับ หลังคาเขียว หน้าต่างไฟ
    b.add(new THREE.BoxGeometry(1.05, 1.15, 1.25), M.red, [-0.9, 1.35, 0]);
    b.add(new THREE.BoxGeometry(1.3, 0.12, 1.45), M.green, [-0.9, 1.98, 0]);
    b.add(new THREE.BoxGeometry(1.3, 0.08, 1.45), M.snow, [-0.9, 2.08, 0]);
    for (const z of [-0.63, 0.63]) b.add(new THREE.BoxGeometry(0.55, 0.42, 0.02), M.window, [-0.9, 1.55, z]);
    // ไฟหน้า กันชนทอง พวงหรีดหน้ารถ
    b.add(new THREE.BoxGeometry(0.22, 0.24, 0.24), M.lamp, [1.52, 1.82, 0]);
    b.add(new THREE.ConeGeometry(0.55, 0.6, 4), M.gold, [1.85, 0.5, 0], [0, Math.PI / 4, -Math.PI / 2], [1, 1, 1.4]);
    b.add(new THREE.TorusGeometry(0.3, 0.09, 8, 20), M.leaf, [1.52, 1.25, 0], [0, Math.PI / 2, 0]);
    b.add(new THREE.SphereGeometry(0.1, 8, 6), M.red, [1.56, 0.98, 0]);
    wheels(b, [0.95, 0.25], 0.3);
    wheels(b, [-0.55, -1.2], 0.38);
    return b.build();
  };
  const tender = () => {
    const b = new Bake();
    b.add(new THREE.BoxGeometry(1.7, 0.3, 1.1), M.black, [0, 0.62, 0]);
    b.add(new THREE.BoxGeometry(1.6, 0.75, 1.15), M.green, [0, 1.15, 0]);
    b.add(new THREE.BoxGeometry(1.64, 0.06, 1.19), M.gold, [0, 1.52, 0]);
    // กล่องของขวัญกองแทนถ่านหิน
    b.add(new THREE.BoxGeometry(0.5, 0.4, 0.5), M.red, [-0.4, 1.72, 0.2]);
    b.add(new THREE.BoxGeometry(0.45, 0.35, 0.45), M.giftA, [0.2, 1.7, -0.2]);
    b.add(new THREE.BoxGeometry(0.38, 0.32, 0.38), M.giftB, [0.5, 1.68, 0.25]);
    b.add(new THREE.BoxGeometry(0.52, 0.05, 0.1), M.gold, [-0.4, 1.93, 0.2]);
    wheels(b, [0.5, -0.5]);
    return b.build();
  };
  const coach = (body: THREE.Material) => {
    const b = new Bake();
    b.add(new THREE.BoxGeometry(2.7, 0.28, 1.1), M.black, [0, 0.62, 0]);
    b.add(new THREE.BoxGeometry(2.6, 1.05, 1.2), body, [0, 1.3, 0]);
    b.add(new THREE.BoxGeometry(2.64, 0.06, 1.24), M.gold, [0, 0.82, 0]);
    b.add(new THREE.BoxGeometry(2.64, 0.06, 1.24), M.gold, [0, 1.8, 0]);
    // หลังคาโค้งมีหิมะเกาะ
    b.add(new THREE.CylinderGeometry(0.66, 0.66, 2.7, 16, 1, false, 0, Math.PI), M.cream, [0, 1.82, 0], [Math.PI / 2, 0, Math.PI / 2], [1, 1, 0.35]);
    b.add(new THREE.CylinderGeometry(0.5, 0.5, 2.6, 12, 1, false, 0, Math.PI), M.snow, [0, 1.9, 0], [Math.PI / 2, 0, Math.PI / 2], [1, 1, 0.3]);
    for (const z of [-0.61, 0.61]) for (const x of [-0.85, -0.28, 0.28, 0.85]) b.add(new THREE.BoxGeometry(0.4, 0.42, 0.02), M.window, [x, 1.38, z]);
    // ไฟประดับเรียงตามชายหลังคา
    for (const z of [-0.64, 0.64]) for (let k = 0; k < 9; k++) b.add(new THREE.SphereGeometry(0.045, 6, 4), k % 2 ? M.bulbR : M.bulbG, [-1.2 + k * 0.3, 1.86, z]);
    wheels(b, [0.85, -0.85]);
    return b.build();
  };
  const giftCar = () => {
    const b = new Bake();
    b.add(new THREE.BoxGeometry(2.4, 0.28, 1.1), M.black, [0, 0.62, 0]);
    b.add(new THREE.BoxGeometry(2.4, 0.18, 1.2), M.wood, [0, 0.85, 0]);
    // ต้นคริสต์มาสจิ๋วกับกองของขวัญ
    b.add(new THREE.ConeGeometry(0.42, 1.1, 10), M.leaf, [-0.5, 1.5, 0]);
    b.add(new THREE.OctahedronGeometry(0.12), M.lamp, [-0.5, 2.1, 0]);
    b.add(new THREE.BoxGeometry(0.5, 0.45, 0.5), M.red, [0.35, 1.17, 0.22]);
    b.add(new THREE.BoxGeometry(0.42, 0.4, 0.42), M.giftA, [0.75, 1.15, -0.2]);
    b.add(new THREE.BoxGeometry(0.35, 0.3, 0.35), M.giftB, [0.4, 1.55, 0.1]);
    b.add(new THREE.BoxGeometry(0.06, 0.47, 0.52), M.gold, [0.35, 1.17, 0.22]);
    for (let k = 0; k < 6; k++) b.add(new THREE.SphereGeometry(0.05, 6, 4), k % 2 ? M.bulbR : M.lamp, [-0.5 + Math.cos(k) * 0.3, 1.2 + k * 0.12, Math.sin(k) * 0.3]);
    wheels(b, [0.75, -0.75]);
    return b.build();
  };
  const caboose = () => {
    const b = new Bake();
    b.add(new THREE.BoxGeometry(2.0, 0.28, 1.1), M.black, [0, 0.62, 0]);
    b.add(new THREE.BoxGeometry(1.9, 1.0, 1.2), M.red, [0, 1.28, 0]);
    b.add(new THREE.BoxGeometry(2.1, 0.1, 1.35), M.green, [0, 1.84, 0]);
    b.add(new THREE.BoxGeometry(0.8, 0.5, 0.9), M.red, [0, 2.12, 0]);
    b.add(new THREE.BoxGeometry(0.95, 0.08, 1.05), M.snow, [0, 2.42, 0]);
    for (const z of [-0.61, 0.61]) for (const x of [-0.5, 0.5]) b.add(new THREE.BoxGeometry(0.42, 0.42, 0.02), M.window, [x, 1.38, z]);
    b.add(new THREE.SphereGeometry(0.12, 8, 6), M.bulbR, [-1.02, 1.7, 0]);
    wheels(b, [0.6, -0.6]);
    return b.build();
  };
  const cars: { obj: THREE.Group; len: number }[] = [
    { obj: loco(), len: 3.9 },
    { obj: tender(), len: 1.9 },
    { obj: coach(M.green), len: 2.9 },
    { obj: coach(M.red), len: 2.9 },
    { obj: giftCar(), len: 2.6 },
    { obj: coach(M.cream), len: 2.9 },
    { obj: caboose(), len: 2.3 },
  ];
  const train = new THREE.Group();
  group.add(train);
  for (const c of cars) train.add(c.obj);
  // แสงหัวรถและควันจากปล่อง
  const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  headGlow.scale.setScalar(2.6);
  train.add(headGlow);
  const puffs: THREE.Sprite[] = [];
  const puffMat = new THREE.SpriteMaterial({ map: glow, color: 0xe9eef3, transparent: true, depthWrite: false, opacity: 0.6 });
  for (let k = 0; k < 7; k++) {
    const p = new THREE.Sprite(puffMat.clone());
    group.add(p);
    puffs.push(p);
  }
  const tmpV = new THREE.Vector3();
  const chimney = new THREE.Vector3(1.05, 2.3, 0);
  const front = new THREE.Vector3(1.62, 1.82, 0);
  // วางตู้ตามแนววงกลม: หน้ารถหันตามทิศที่วิ่ง (ทวนเข็มเมื่อมองจากด้านบน)
  const place = (o: THREE.Object3D, a: number) => {
    o.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    o.rotation.set(0, -a - Math.PI / 2, 0);
  };

  return {
    group,
    update: (serverSec: number, reduced: boolean) => {
      const head = reduced ? 0.3 : ((serverSec % LAP_SEC) / LAP_SEC) * Math.PI * 2;
      let a = head;
      cars.forEach((c, i) => {
        if (i > 0) a -= (cars[i - 1].len / 2 + c.len / 2 + 0.25) / R;
        place(c.obj, a);
        c.obj.updateMatrix();
      });
      const loc = cars[0].obj;
      loc.updateMatrixWorld();
      headGlow.position.copy(front).applyMatrix4(loc.matrix);
      // ควันลอยขึ้นจากปล่องแล้วจางหาย
      const cp = tmpV.copy(chimney).applyMatrix4(loc.matrix);
      puffs.forEach((p, k) => {
        const ph = ((reduced ? 0.5 : serverSec * 0.8) + k / puffs.length) % 1;
        const back = ph * 1.6;
        p.position.set(cp.x - Math.cos(head + Math.PI / 2) * back * 0.4, cp.y + ph * 2.2, cp.z - Math.sin(head + Math.PI / 2) * back * 0.4);
        p.scale.setScalar(0.6 + ph * 2.2);
        (p.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - ph);
      });
      (lampGlow.material as THREE.PointsMaterial).opacity = reduced ? 0.85 : 0.75 + 0.1 * Math.sin(serverSec * 1.7);
    },
  };
}
