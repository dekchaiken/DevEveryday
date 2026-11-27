// ลูกบอลคำอวยพรบนต้น: รองรับได้ถึง 999 ลูกโดยวาดแบบ instancing แยกตามรูปทรง (คำสั่งวาดไม่กี่ครั้งต่อเฟรม)
// แต่ละลูกห้อยจากปลายกิ่งด้วยลวดเกี่ยว มีฝาโลหะด้านบน แกว่งเบา ๆ ตามลม และหล่นลงมาตอนแขวนใหม่
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Ornament, OrnamentShape } from "@/lib/christmas/types";
import { ORNAMENT_HEX, ornamentPosition } from "./geometry";

const SHAPES: OrnamentShape[] = ["ball", "star", "bell", "gift"];
// ระยะจากจุดกึ่งกลางชิ้นงานถึงขอบบน (ตำแหน่งฝา)
const TOP: Record<OrnamentShape, number> = { ball: 0.085, star: 0.1, bell: 0.075, gift: 0.07 };
// ย่อทุกชิ้นลงจากขนาดโมเดล ให้สมส่วนกับกิ่งสนจริงและแขวนได้แน่นถึง 999 ลูก
const SIZE = 0.8;

type Item = {
  o: Ornament;
  shape: number;
  slot: number; // ลำดับใน InstancedMesh ของรูปทรงนั้น
  giftSlot: number; // ลำดับของริบบิ้น (เฉพาะกล่องของขวัญ)
  anchor: THREE.Vector3; // จุดเกี่ยวบนกิ่ง
  len: number; // ความยาวลวดจากกิ่งถึงฝา
  yaw: number;
  color: number;
  born: number; // 0 = แขวนอยู่แล้ว
  sx: number;
  sz: number;
  vx: number;
  vz: number;
};

export type OrnamentLayer = {
  group: THREE.Group;
  set: (list: Ornament[], animateNew: boolean) => void;
  add: (o: Ornament, animate: boolean) => void; // แขวนเพิ่มทันที (ก่อนสถานะจากเซิร์ฟเวอร์มาถึง)
  update: (now: number, t: number, reduced: boolean) => void;
  pick: (raycaster: THREE.Raycaster) => Ornament | null;
  worldPosition: (id: string) => THREE.Vector3 | null;
  get: (id: string) => Ornament | undefined;
  count: () => number;
  dispose: () => void;
};

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? 0.1 : 0.045;
    const ang = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) s.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    else s.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  g.center();
  return g;
}

function bellGeometry() {
  const pts = [
    new THREE.Vector2(0.0, 0.075),
    new THREE.Vector2(0.03, 0.07),
    new THREE.Vector2(0.045, 0.04),
    new THREE.Vector2(0.052, -0.01),
    new THREE.Vector2(0.075, -0.055),
    new THREE.Vector2(0.08, -0.065),
    new THREE.Vector2(0.0, -0.065),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

const easeOutBounce = (t: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

export function createOrnamentLayer(opts: { capacity: number; onLanded?: (pos: THREE.Vector3, color: number) => void }): OrnamentLayer {
  const cap = opts.capacity;
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [
    new THREE.SphereGeometry(TOP.ball, 22, 16),
    starGeometry(),
    bellGeometry(),
    new RoundedBoxGeometry(0.13, 0.13, 0.13, 2, 0.016),
  ];
  // แก้วเคลือบเงา สะท้อนแสงไฟและท้องฟ้า สีมาจาก instanceColor
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.15 });
  const bodies = geos.map((g) => {
    const m = new THREE.InstancedMesh(g, bodyMat, cap);
    m.count = 0;
    m.castShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.userData.ids = [] as string[];
    group.add(m);
    return m;
  });
  // ฝาโลหะทองพร้อมห่วง ลวดเกี่ยวบาง ๆ และริบบิ้นของกล่องของขวัญ
  const capGeo = new THREE.CylinderGeometry(0.019, 0.022, 0.028, 12);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.95, roughness: 0.25 });
  const caps = new THREE.InstancedMesh(capGeo, capMat, cap);
  const wireGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5);
  wireGeo.translate(0, -0.5, 0); // ยอดลวดอยู่ที่จุดเกี่ยว ยืดลงตามความยาว
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xc9c3b4, metalness: 0.8, roughness: 0.35 });
  const wires = new THREE.InstancedMesh(wireGeo, wireMat, cap);
  const ribbonGeo = new THREE.BoxGeometry(0.134, 0.134, 0.03);
  const ribbonGeo2 = new THREE.BoxGeometry(0.03, 0.134, 0.134);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, metalness: 0.3, roughness: 0.4 });
  const ribA = new THREE.InstancedMesh(ribbonGeo, ribMat, cap);
  const ribB = new THREE.InstancedMesh(ribbonGeo2, ribMat, cap);
  for (const m of [caps, wires, ribA, ribB]) {
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
  }

  const items = new Map<string, Item>();
  const order: Item[] = []; // ลำดับเดียวกับ caps/wires
  const perShape: Item[][] = SHAPES.map(() => []);
  const gifts: Item[] = [];

  const col = new THREE.Color();
  const pivot = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();

  function rebuildIndices() {
    perShape.forEach((list, si) => {
      list.forEach((it, i) => {
        it.slot = i;
        bodies[si].setColorAt(i, col.setHex(it.color));
        (bodies[si].userData.ids as string[])[i] = it.o.id;
      });
      bodies[si].count = list.length;
      (bodies[si].userData.ids as string[]).length = list.length;
      if (bodies[si].instanceColor) bodies[si].instanceColor.needsUpdate = true;
    });
    gifts.forEach((it, i) => (it.giftSlot = i));
    caps.count = order.length;
    wires.count = order.length;
    ribA.count = gifts.length;
    ribB.count = gifts.length;
  }

  function add(o: Ornament, animate: boolean) {
    const shape = Math.max(0, SHAPES.indexOf(o.shape));
    const center = ornamentPosition(o.height, o.angle);
    const seed = Math.abs(Math.sin(o.height * 91.7 + o.angle * 37.3));
    const len = 0.06 + seed * 0.05;
    const top = TOP[SHAPES[shape]] * SIZE;
    const it: Item = {
      o,
      shape,
      slot: 0,
      giftSlot: -1,
      anchor: new THREE.Vector3(center.x, center.y + len + top + 0.014, center.z),
      len,
      yaw: -o.angle + Math.PI / 2,
      color: ORNAMENT_HEX[o.color] ?? 0xf5c542,
      born: animate ? performance.now() : 0,
      sx: 0,
      sz: 0,
      vx: 0,
      vz: 0,
    };
    items.set(o.id, it);
    order.push(it);
    perShape[shape].push(it);
    if (SHAPES[shape] === "gift") gifts.push(it);
  }

  function removeFrom<T>(list: T[], v: T) {
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
  }

  function set(list: Ornament[], animateNew: boolean) {
    const ids = new Set(list.map((o) => o.id));
    let changed = false;
    for (const [id, it] of items) {
      if (ids.has(id)) continue;
      items.delete(id);
      removeFrom(order, it);
      removeFrom(perShape[it.shape], it);
      removeFrom(gifts, it);
      changed = true;
    }
    for (const o of list) {
      if (items.has(o.id) || order.length >= cap) continue;
      add(o, animateNew);
      changed = true;
    }
    if (changed) {
      rebuildIndices();
      writeAll(performance.now(), 0, true);
    }
  }

  // เขียนเมทริกซ์ของลูกหนึ่งลูกจากสถานะการแกว่งและการหล่น
  function writeItem(it: Item, i: number, now: number) {
    let drop = 1;
    let scale = 1;
    if (it.born) {
      const k = Math.min((now - it.born) / 1100, 1);
      drop = easeOutBounce(k);
      scale = 0.35 + 0.65 * Math.min(k * 2, 1);
      if (k >= 1) {
        it.born = 0;
        // แรงกระแทกตอนถึงจุดแขวน ทำให้แกว่งออกแล้วค่อย ๆ หยุด
        it.vx = 0.9 * (Math.random() > 0.5 ? 1 : -1);
        it.vz = (Math.random() - 0.5) * 0.9;
        const p = worldOf(it);
        if (p) opts.onLanded?.(p, it.color);
      }
    }
    const L = it.len * drop;
    e.set(it.sx, 0, it.sz);
    q.setFromEuler(e);
    pivot.compose(it.anchor, q, one);
    // ลวด: ยอดอยู่ที่จุดเกี่ยว ยืดยาว L
    local.makeScale(1, Math.max(L, 0.001), 1);
    wires.setMatrixAt(i, out.multiplyMatrices(pivot, local));
    // ฝา: อยู่ปลายลวด
    local.makeTranslation(0, -L - 0.008, 0);
    caps.setMatrixAt(i, out.multiplyMatrices(pivot, local));
    // ตัวชิ้นงาน: ใต้ฝา หมุนหน้าออกจากต้น
    const top = TOP[SHAPES[it.shape]] * SIZE;
    e.set(0, it.yaw, 0);
    q.setFromEuler(e);
    const k = scale * SIZE;
    local.compose(tmpV.set(0, -L - 0.014 - top, 0), q, tmpS.set(k, k, k));
    out.multiplyMatrices(pivot, local);
    bodies[it.shape].setMatrixAt(it.slot, out);
    if (it.giftSlot >= 0) {
      ribA.setMatrixAt(it.giftSlot, out);
      ribB.setMatrixAt(it.giftSlot, out);
    }
  }

  function writeAll(now: number, t: number, force: boolean) {
    void t;
    void force;
    order.forEach((it, i) => writeItem(it, i, now));
    for (const m of [...bodies, caps, wires, ribA, ribB]) m.instanceMatrix.needsUpdate = true;
  }

  function update(now: number, t: number, reduced: boolean) {
    if (!order.length) return;
    let animating = false;
    for (const it of order) {
      if (it.born) {
        animating = true;
        continue;
      }
      if (reduced) continue;
      // สปริง-แดมเปอร์: ดึงกลับสู่แนวดิ่ง มีแรงลมเบา ๆ แต่ละลูกต่างจังหวะกัน
      const wind = Math.sin(t * 0.9 + it.anchor.x * 1.7) * 0.6 + Math.sin(t * 2.3 + it.anchor.z) * 0.25;
      const dt = 1 / 60;
      it.vx += (-18 * it.sx - 1.7 * it.vx + wind * 1.4) * dt;
      it.vz += (-18 * it.sz - 1.7 * it.vz + wind * 0.6) * dt;
      it.sx = Math.max(-0.6, Math.min(0.6, it.sx + it.vx * dt));
      it.sz = Math.max(-0.6, Math.min(0.6, it.sz + it.vz * dt));
    }
    if (reduced && !animating) return;
    writeAll(now, t, false);
  }

  function worldOf(it: Item): THREE.Vector3 | null {
    const m = new THREE.Matrix4();
    bodies[it.shape].getMatrixAt(it.slot, m);
    return new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(group.matrixWorld);
  }

  function pick(raycaster: THREE.Raycaster): Ornament | null {
    const hit = raycaster.intersectObjects(bodies, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const id = ((hit.object as THREE.InstancedMesh).userData.ids as string[])[hit.instanceId];
    return id ? (items.get(id)?.o ?? null) : null;
  }

  function worldPosition(id: string) {
    const it = items.get(id);
    return it ? worldOf(it) : null;
  }

  function dispose() {
    geos.forEach((g) => g.dispose());
    [capGeo, wireGeo, ribbonGeo, ribbonGeo2].forEach((g) => g.dispose());
    [bodyMat, capMat, wireMat, ribMat].forEach((m) => m.dispose());
    for (const m of [...bodies, caps, wires, ribA, ribB]) m.dispose();
  }

  function addOne(o: Ornament, animate: boolean) {
    if (items.has(o.id) || order.length >= cap) return;
    add(o, animate);
    rebuildIndices();
    writeAll(performance.now(), 0, true);
  }

  return { group, set, add: addOne, update, pick, worldPosition, get: (id) => items.get(id)?.o, count: () => order.length, dispose };
}
