// ฉากประกอบของโซนคำอวยพรและ Exclusive: บ้านหิมะ ต้นสนเรืองแสง และของตกแต่งแบบ 3 มิติ
// ทุกชิ้นสร้างจากรูปทรงจริงด้วยโค้ด (ไม่มีสติ๊กเกอร์แบน ๆ และไม่หันตามกล้อง) และมีเงาตกกระทบบนหิมะ
import * as THREE from "three";
// สีของบ้านหิมะในฉากคงที่ (ผนัง และไฟประดับ) ไม่ขึ้นกับการเลือกของ Exclusive
const GIANT_BODY_HEX: Record<string, number> = { cream: 0xf6e3c0, mint: 0xd1fae5, sky: 0xdbeafe, blush: 0xfce7f3, pearl: 0xfff6e6, ice: 0xd6f3ff };
const GIANT_LIGHT_HEX: Record<string, number[]> = { red: [0xff3b5c], gold: [0xffd76a], blue: [0x7dd3fc], multi: [0xff3b5c, 0xffd76a, 0x7dd3fc, 0x86efac] };

export type Updater = (t: number, reduced: boolean) => void;
export type Scenery = { group: THREE.Group; update: Updater };

// ---------- เท็กซ์เจอร์และวัสดุ ----------
// แสงนุ่มรอบดวงไฟ ใช้เฉพาะเอฟเฟกต์เรืองแสง ไม่ใช่ตัวโมเดล
let glowTexture: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// ลายไม้เท้าน้ำตาลแดง ลายทแยงขาวแดง
let candyTexture: THREE.Texture | null = null;
export function candyStripes(): THREE.Texture {
  if (candyTexture) return candyTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fbfcff";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#dc2643";
  g.lineWidth = 30;
  for (let x = -128; x < 256; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 128, 128);
    g.stroke();
  }
  candyTexture = new THREE.CanvasTexture(c);
  candyTexture.colorSpace = THREE.SRGBColorSpace;
  candyTexture.wrapS = THREE.RepeatWrapping;
  candyTexture.wrapT = THREE.RepeatWrapping;
  candyTexture.repeat.set(4, 1);
  return candyTexture;
}

export const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const snowSurface = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xdfeeff) });

// ให้ทุกชิ้นทิ้งเงาและรับเงาได้ (ใช้กับทุกชิ้นของฉากนี้)
export function shade<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

function put<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x = 0, y = 0, z = 0): T {
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

// สุ่มแบบกำหนดค่าได้จากข้อความ เพื่อให้ฉากเหมือนเดิมทุกครั้งที่เปิด
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- บ้านหิมะ: หน้าบ้านหันไปทางแกน +z ขนาดอ้างอิงตามตัวบ้าน ----------
const W = 2.2; // ความกว้างผนัง
const H = 1.3; // ความสูงผนัง
const D = 1.8; // ความลึกบ้าน
const ROOF_H = 1.0; // ความสูงหลังคา
const OVER = 0.25; // ชายคายื่นจากผนัง
const FRONT = D / 2; // ผิวหน้าผนัง

// จุดวางของตกแต่งที่คงที่ ไม่ซ้อนกันและอยู่ห่างจากประตูและป้าย
// 4 จุดแรกวางบนลาน ส่วนจุดสุดท้ายเป็นยอดหลังคา
const DECO_ANCHORS: { x: number; z: number; rot: number; roof?: boolean }[] = [
  { x: -0.95, z: FRONT + 0.42, rot: 0.2 },
  { x: 0.95, z: FRONT + 0.42, rot: -0.2 },
  { x: -1.5, z: FRONT + 0.9, rot: 0.5 },
  { x: 1.5, z: FRONT + 0.9, rot: -0.5 },
  { x: 0, z: 0, rot: 0, roof: true },
];
const GIFT_COLORS = [0xdc2643, 0x3b82f6, 0xf5c542, 0x22c55e];

export function buildCottage(look: { body: string; lights: string; deco?: string[] }): Scenery {
  const group = new THREE.Group();
  const updates: Updater[] = [];
  const add = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0): T => put(group, o, x, y, z);

  const wallMat = std(GIANT_BODY_HEX[look.body] ?? GIANT_BODY_HEX.cream, 0.88);
  const trimMat = std(0xfff8ee, 0.55);
  const woodMat = std(0x7a4a24, 0.8);
  const roofMat = std(0xf4f8ff, 0.5);
  const snowMat = snowSurface();
  const doorMat = std(0x7a1d2a, 0.55);
  const stoneMat = std(0xd9d4c7, 0.9);
  const winGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });

  // ผนังและจั่วหน้าบ้านหลังบ้าน
  add(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat), 0, H / 2, 0);
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-W / 2, 0);
  gableShape.lineTo(W / 2, 0);
  gableShape.lineTo(0, ROOF_H);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.06, bevelEnabled: false });
  add(new THREE.Mesh(gableGeo, wallMat), 0, H, FRONT);
  add(new THREE.Mesh(gableGeo, wallMat), 0, H, -FRONT - 0.06);
  // ขอบไม้สีครีมที่มุมผนังทั้งสี่
  for (const cx of [-W / 2, W / 2]) for (const cz of [-FRONT, FRONT]) add(new THREE.Mesh(new THREE.BoxGeometry(0.07, H, 0.07), trimMat), cx, H / 2, cz);

  // หลังคาหิมะสองด้านและสันหลังคา
  const E = W / 2 + OVER;
  const slopeLen = Math.hypot(E, ROOF_H);
  const slopeAng = Math.atan2(ROOF_H, E);
  const slopeGeo = new THREE.BoxGeometry(slopeLen, 0.16, D + 0.5);
  const left = add(new THREE.Mesh(slopeGeo, roofMat), -E / 2, H + ROOF_H / 2, 0);
  left.rotation.z = slopeAng;
  const right = add(new THREE.Mesh(slopeGeo, roofMat), E / 2, H + ROOF_H / 2, 0);
  right.rotation.z = -slopeAng;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, D + 0.52), trimMat), 0, H + ROOF_H + 0.02, 0);
  const roofAt = (x: number) => H + ROOF_H * (1 - Math.abs(x) / E);
  // ก้อนหิมะที่เกาะตามชายคาด้านหน้าและหลัง
  for (let x = -E + 0.16; x <= E - 0.1; x += 0.3) {
    for (const z of [FRONT + 0.22, -FRONT - 0.22]) {
      const lump = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), snowMat), x, H + 0.03, z);
      lump.scale.set(1, 0.6, 1);
    }
  }

  // ปล่องไฟอิฐ มีฝาปิดและควันที่ลอยขึ้น
  const chimX = 0.62;
  const chimZ = -0.35;
  const chimTop = roofAt(chimX) + 0.78;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.34), std(0x9b3a2b, 0.9)), chimX, roofAt(chimX) + 0.25, chimZ);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), std(0x5b2119, 0.9)), chimX, chimTop, chimZ);
  const puffs: { s: THREE.Sprite; off: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xe6ecf3, transparent: true, opacity: 0, depthWrite: false })), chimX, chimTop, chimZ);
    puffs.push({ s, off: i / 4 });
  }
  updates.push((t, reduced) => {
    for (const p of puffs) {
      const f = reduced ? 0.45 : (t * 0.28 + p.off) % 1;
      p.s.position.set(chimX + Math.sin((t + p.off * 5) * 0.6) * 0.14 * f, chimTop + f * 1.6, chimZ);
      p.s.scale.setScalar(0.25 + f * 0.9);
      (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(f * Math.PI) * 0.45;
    }
  });

  // ประตูแดงเข้ม กรอบครีม ลูกบิดทอง พวงหรีดและหลังคาคุ้มประตู
  add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.06), doorMat), 0, 0.4, FRONT + 0.03);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.05), trimMat), -0.26, 0.43, FRONT + 0.04);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.05), trimMat), 0.26, 0.43, FRONT + 0.04);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.05), trimMat), 0, 0.84, FRONT + 0.04);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), std(0xf5c542, 0.3, 0.8)), 0.16, 0.4, FRONT + 0.08);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 8, 22), std(0x1f7a3a, 0.75)), 0, 0.6, FRONT + 0.06);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xdc2643, 0.5)), 0.1, 0.5, FRONT + 0.08);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), woodMat), 0, 0.92, FRONT + 0.2);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.44), snowMat), 0, 0.97, FRONT + 0.2);
  // ขั้นบันไดหินหน้าประตู
  add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.3), stoneMat), 0, 0.03, FRONT + 0.2);

  // หน้าต่างสองบานมีกรอบครีม คานไม้ และแสงอุ่น
  for (const wx of [-0.62, 0.62]) {
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.42), winGlowMat), wx, 0.78, FRONT + 0.012);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.02), woodMat), wx, 0.78, FRONT + 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.02), woodMat), wx, 0.78, FRONT + 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), trimMat), wx - 0.225, 0.78, FRONT + 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), trimMat), wx + 0.225, 0.78, FRONT + 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), trimMat), wx, 1.025, FRONT + 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), trimMat), wx, 0.535, FRONT + 0.03);
    // ขอบหิมะเล็ก ๆ บนกรอบหน้าต่าง
    add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.1), snowMat), wx, 0.52, FRONT + 0.08);
    const haze = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffc857, transparent: true, opacity: 0.32, depthWrite: false })), wx, 0.78, FRONT + 0.16);
    haze.scale.set(1.2, 1.2, 1);
  }
  // หน้าต่างด้านหลังบ้าน ให้เห็นความละเอียดเมื่อหมุนดูรอบบ้าน
  for (const wx of [-0.62, 0.62]) {
    const bz = -FRONT - 0.012;
    const pane = add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.42), winGlowMat), wx, 0.78, bz);
    pane.rotation.y = Math.PI;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.02), woodMat), wx, 0.78, -FRONT - 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.02), woodMat), wx, 0.78, -FRONT - 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), trimMat), wx, 1.025, -FRONT - 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), trimMat), wx, 0.535, -FRONT - 0.03);
  }
  // หน้าต่างกลมบนจั่ว
  add(new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), winGlowMat), 0, H + 0.3, FRONT + 0.07);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 24), trimMat), 0, H + 0.3, FRONT + 0.08);

  // สายไฟประดับเรียงตามกรอบประตู หน้าต่าง และชายคา ให้กระพริบทีละดวง
  const palette = GIANT_LIGHT_HEX[look.lights] ?? GIANT_LIGHT_HEX.red;
  const bulbs: THREE.Vector3[] = [];
  const frame = (cx: number, cy: number, w: number, h: number, z: number, step = 0.12) => {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const y0 = cy - h / 2;
    const y1 = cy + h / 2;
    for (let x = x0; x <= x1 + 1e-6; x += step) {
      bulbs.push(new THREE.Vector3(x, y1, z));
      bulbs.push(new THREE.Vector3(x, y0, z));
    }
    for (let y = y0 + step; y < y1 - 1e-6; y += step) {
      bulbs.push(new THREE.Vector3(x0, y, z));
      bulbs.push(new THREE.Vector3(x1, y, z));
    }
  };
  frame(-0.62, 0.78, 0.5, 0.5, FRONT + 0.1);
  frame(0.62, 0.78, 0.5, 0.5, FRONT + 0.1);
  for (let x = -E + 0.1; x <= E - 0.1; x += 0.14) bulbs.push(new THREE.Vector3(x, H - 0.03, FRONT + 0.26));
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs.length);
  const dummy = new THREE.Object3D();
  bulbs.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    bulbMesh.setMatrixAt(i, dummy.matrix);
    bulbMesh.setColorAt(i, new THREE.Color(palette[i % palette.length]));
  });
  bulbMesh.instanceMatrix.needsUpdate = true;
  if (bulbMesh.instanceColor) bulbMesh.instanceColor.needsUpdate = true;
  group.add(bulbMesh);
  updates.push((t, reduced) => {
    bulbs.forEach((p, i) => {
      const s = reduced ? 1 : 0.7 + 0.45 * Math.sin(t * 2.6 + i * 0.9);
      dummy.position.copy(p);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      bulbMesh.setMatrixAt(i, dummy.matrix);
    });
    bulbMesh.instanceMatrix.needsUpdate = true;
  });

  // ตะเกียงแขวนสองข้างประตู มีเปลวไฟที่แกว่งเบา ๆ
  const flames: THREE.Sprite[] = [];
  for (const lx of [-1.14, 1.14]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.24), woodMat), lx, 1.2, FRONT + 0.1);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), new THREE.MeshBasicMaterial({ color: 0xffd166 })), lx, 1.06, FRONT + 0.2);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.02, 0.17), std(0x2b2118, 0.6, 0.4)), lx, 0.96, FRONT + 0.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.08, 6), std(0x2b2118, 0.6, 0.4)), lx, 1.2, FRONT + 0.2);
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffc857, transparent: true, opacity: 0.5, depthWrite: false })), lx, 1.06, FRONT + 0.24);
    sp.scale.set(0.9, 0.9, 1);
    flames.push(sp);
  }
  updates.push((t, reduced) => {
    flames.forEach((sp, i) => {
      (sp.material as THREE.SpriteMaterial).opacity = reduced ? 0.5 : 0.42 + 0.12 * Math.sin(t * 7 + i * 2);
    });
  });

  // กองหิมะและของขวัญที่หน้าบ้าน
  const mound = new THREE.SphereGeometry(0.3, 14, 10);
  for (const [mx, mz] of [
    [-1.45, FRONT + 0.3],
    [1.4, FRONT + 0.35],
  ]) {
    add(new THREE.Mesh(mound, snowMat), mx, 0.05, mz).scale.set(1.1, 0.35, 1.1);
  }
  // ของตกแต่งตามที่ผู้ซื้อเลือกไว้ที่จุดคงที่ (ยอดหลังคามีดาวที่หมุนช้า ๆ)
  DECO_ANCHORS.forEach((a, i) => {
    const kind = look.deco?.[i] ?? "none";
    if (kind === "none") return;
    if (a.roof) {
      if (kind !== "star") return;
      const star = add(starMesh(), a.x, H + ROOF_H + 0.26, a.z);
      updates.push((t, reduced) => {
        star.rotation.y = reduced ? 0 : t * 0.8;
      });
      return;
    }
    const item = decoItem(kind, i);
    if (!item) return;
    item.position.set(a.x, 0, a.z);
    item.rotation.y = a.rot;
    group.add(item);
  });

  return {
    group: shade(group),
    update: (t, reduced) => updates.forEach((u) => u(t, reduced)),
  };
}

// ---------- ของตกแต่งแบบ 3 มิติ: แต่ละชิ้นตั้งอยู่บนพื้น จุดกึ่งกลางที่ฐาน ----------
export function giftBox(size: number, color: number, ribbon: number): THREE.Group {
  const g = new THREE.Group();
  const body = std(color, 0.55);
  const rib = std(ribbon, 0.35, 0.3);
  put(g, new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.9, size), body), 0, (size * 0.9) / 2, 0);
  put(g, new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 0.92, size * 0.13), rib), 0, (size * 0.9) / 2, 0);
  put(g, new THREE.Mesh(new THREE.BoxGeometry(size * 0.13, size * 0.94, size * 1.02), rib), 0, (size * 0.9) / 2, 0);
  for (const s of [-1, 1]) {
    const loop = put(g, new THREE.Mesh(new THREE.TorusGeometry(size * 0.13, size * 0.04, 8, 16), rib), s * size * 0.14, size * 0.92, 0);
    loop.rotation.x = Math.PI / 2;
    loop.rotation.z = s * 0.5;
  }
  put(g, new THREE.Mesh(new THREE.SphereGeometry(size * 0.07, 10, 8), rib), 0, size * 0.93, 0);
  return g;
}

export function candyCane(): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(0, 0.42, 0),
    new THREE.Vector3(0.04, 0.52, 0),
    new THREE.Vector3(0.13, 0.52, 0),
    new THREE.Vector3(0.17, 0.44, 0),
  ]);
  const mat = new THREE.MeshStandardMaterial({ map: candyStripes(), roughness: 0.35 });
  put(g, new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.032, 12, false), mat), 0, 0, 0);
  return g;
}

export function snowman(): THREE.Group {
  const g = new THREE.Group();
  const snow = snowSurface();
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), snow), 0, 0.2, 0);
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), snow), 0, 0.5, 0);
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), snow), 0, 0.7, 0);
  const hat = std(0x1f2937, 0.5);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.15, 18), hat), 0, 0.84, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.025, 18), hat), 0, 0.77, 0);
  const nose = put(g, new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.1, 10), std(0xf97316, 0.6)), 0.12, 0.7, 0);
  nose.rotation.z = -Math.PI / 2;
  const scarf = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 10, 24), std(0xdc2643, 0.6)), 0, 0.6, 0);
  scarf.rotation.x = Math.PI / 2;
  for (const z of [-0.04, 0.04]) put(g, new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), std(0x111827, 0.4)), 0.095, 0.73, z);
  for (const y of [0.5, 0.42]) put(g, new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), std(0x111827, 0.4)), 0.14, y, 0);
  return g;
}

export function miniPine(h: number, sc: number, foliage = 0x0f3d24): THREE.Group {
  const g = new THREE.Group();
  const green = std(foliage, 0.85);
  const white = std(0xeef5fb, 0.7);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), std(0x5b3a1e, 0.9)), 0, 0.07, 0);
  for (let t = 0; t < 3; t++) {
    const rad = (0.42 - t * 0.1) * sc;
    const y = 0.12 + t * h * 0.24;
    put(g, new THREE.Mesh(new THREE.ConeGeometry(rad, h * 0.42, 14), green), 0, y + h * 0.2, 0);
    put(g, new THREE.Mesh(new THREE.ConeGeometry(rad * 0.45, h * 0.12, 14), white), 0, y + h * 0.42, 0);
  }
  return g;
}

function mushroom(): THREE.Group {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.18, 14), std(0xfff3dc, 0.8)), 0, 0.09, 0);
  const cap = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xdc2643, 0.5)), 0, 0.18, 0);
  cap.scale.set(1, 0.8, 1);
  for (const [x, y, z] of [
    [0.07, 0.25, 0.05],
    [-0.06, 0.27, 0.07],
    [0.02, 0.29, -0.08],
    [-0.1, 0.22, -0.02],
  ]) {
    put(g, new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xffffff, 0.5)), x, y, z);
  }
  return g;
}

function lantern(): { group: THREE.Group; flame: THREE.Sprite } {
  const g = new THREE.Group();
  const iron = std(0x2b2118, 0.5, 0.4);
  put(g, new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.18), iron), 0, 0.015, 0);
  put(g, new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.13), new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.95 })), 0, 0.14, 0);
  for (const [x, z] of [
    [-0.07, -0.07],
    [0.07, -0.07],
    [-0.07, 0.07],
    [0.07, 0.07],
  ]) {
    put(g, new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.22, 0.018), iron), x, 0.14, z);
  }
  put(g, new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.08, 4), iron), 0, 0.29, 0).rotation.y = Math.PI / 4;
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), std(0xf5c542, 0.3, 0.8)), 0, 0.34, 0);
  const flame = put(g, new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffc857, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })), 0, 0.14, 0);
  flame.scale.set(0.7, 0.7, 1);
  return { group: g, flame };
}

function bauble(color: number): THREE.Group {
  const g = new THREE.Group();
  const gold = std(0xf5c542, 0.25, 0.8);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 14), gold), 0, 0.04, 0);
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 })), 0, 0.23, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), gold), 0, 0.4, 0);
  return g;
}

function decoItem(kind: string, index: number): THREE.Group | null {
  switch (kind) {
    case "gift":
      return giftBox(0.28, GIFT_COLORS[index % GIFT_COLORS.length], 0xfff6e6);
    case "snowman":
      return snowman();
    case "pine":
      return miniPine(0.9, 0.85);
    case "candy":
      return candyCane();
    case "lantern":
      return lantern().group;
    default:
      return null;
  }
}

function starMesh(): THREE.Mesh {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.22 : 0.09;
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  geo.center();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.25, metalness: 0.7, emissive: 0x6b4a00, emissiveIntensity: 0.6 }));
}

function starPost(): { group: THREE.Group; star: THREE.Mesh } {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.0, 10), std(0x7a4a24, 0.8)), 0, 0.5, 0);
  const star = put(g, starMesh(), 0, 1.08, 0);
  return { group: g, star };
}

// ---------- ต้นสนเรืองแสง: จุดประกายเรียงเป็นเกลียวและเป็นชั้น ----------
export function buildGlowTree(hex: number, height: number, seed: string): Scenery {
  const group = new THREE.Group();
  const rand = rng(seed);
  const N = 600;
  const TIERS = 5;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const base = new THREE.Color(hex);
  for (let i = 0; i < N; i++) {
    const v = i / N;
    const tier = (v * TIERS) % 1;
    const r = (1 - v) * 0.95 * (0.55 + 0.45 * (1 - tier)) + 0.04;
    const a = i * 2.39996 + (rand() - 0.5) * 0.25;
    pos[i * 3] = Math.cos(a) * r * (0.9 + rand() * 0.2);
    pos[i * 3 + 1] = v * height;
    pos[i * 3 + 2] = Math.sin(a) * r * (0.9 + rand() * 0.2);
    const k = 0.5 + 0.5 * v + rand() * 0.25;
    col[i * 3] = base.r * k;
    col[i * 3 + 1] = base.g * k;
    col[i * 3 + 2] = base.b * k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, map: glow(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(pts);

  const top = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  top.position.set(0, height + 0.08, 0);
  top.scale.set(0.9, 0.9, 1);
  group.add(top);
  const floor = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: hex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  floor.position.set(0, 0.05, 0);
  floor.scale.set(2.4, 2.4, 1);
  group.add(floor);

  const phase = rand() * 6;
  return {
    group,
    update: (t, reduced) => {
      (pts.material as THREE.PointsMaterial).opacity = reduced ? 0.9 : 0.78 + 0.22 * Math.sin(t * 1.7 + phase);
      group.rotation.y = reduced ? 0 : t * 0.12 + phase;
    },
  };
}

// ---------- ฉากทั้งลาน: บ้านด้านหลังกลางลาน ต้นสนเรืองแสงที่มุม ของตกแต่ง 3 มิติกระจายทั่วลาน ----------
// ลานกว้าง ±8 หน่วยรอบจุดกลางโซน ช่องการ์ดอยู่บนรั้วด้านนอก จึงวางฉากด้านในได้โดยไม่บังการ์ด
export function buildYardScenery(): Scenery {
  const group = new THREE.Group();
  const updates: Updater[] = [];

  const cottage = buildCottage({ body: "cream", lights: "gold", deco: ["gift", "none", "snowman", "pine", "star"] });
  // บ้านอยู่มุมหลังด้านขวาของลาน ไม่อยู่หลังป้ายประตู จึงเห็นได้ชัดจากทุกมุม
  const COTTAGE = { x: 2.6, z: -2.6 };
  cottage.group.position.set(COTTAGE.x, 0, COTTAGE.z);
  cottage.group.scale.setScalar(0.9);
  cottage.group.rotation.y = -0.18;
  group.add(cottage.group);
  updates.push(cottage.update);

  const trees: [number, number, number, number][] = [
    [-4.6, -4.4, 3.0, 0xff5fb3],
    [6.1, -5.2, 2.7, 0x9aa8ff],
    [-4.9, 3.0, 2.3, 0x9aa8ff],
    [5.1, 2.6, 3.2, 0xff5fb3],
  ];
  trees.forEach(([x, z, h, c], i) => {
    const tree = buildGlowTree(c, h, `yard-tree-${i}`);
    tree.group.position.set(x, 0, z);
    group.add(tree.group);
    updates.push(tree.update);
  });

  // พื้นที่ห้ามวางของ: บ้าน ต้นสน และระยะรอบตัวบ้าน
  const blocked = (x: number, z: number) =>
    (Math.abs(x - COTTAGE.x) < 2.0 && Math.abs(z - COTTAGE.z) < 2.2) || trees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 1.7);
  const spots: { x: number; z: number }[] = [];
  const free = (x: number, z: number, gap: number) => !blocked(x, z) && spots.every((s) => Math.hypot(s.x - x, s.z - z) >= gap);

  const pr = rng("yard-props-3d");
  const range = 6.2;
  const kinds = ["gift", "gift", "gift", "pine", "pine", "snowman", "candy", "candy", "mushroom", "lantern", "lantern", "bauble", "star"] as const;
  const flames: THREE.Sprite[] = [];
  const spinners: { obj: THREE.Object3D; base: number; phase: number }[] = [];
  const giftColors = [0xdc2643, 0xf5c542, 0x3b82f6, 0x16a34a, 0xa855f7];
  const baubleColors = [0xdc2643, 0xf5c542, 0x3b82f6, 0xf472b6];

  let placed = 0;
  for (let tries = 0; placed < 30 && tries < 900; tries++) {
    const x = (pr() - 0.5) * range * 2;
    const z = (pr() - 0.5) * range * 2;
    if (!free(x, z, 1.05)) continue;
    const kind = kinds[Math.floor(pr() * kinds.length)];
    const rot = pr() * Math.PI * 2;
    let obj: THREE.Object3D;
    switch (kind) {
      case "gift": {
        const sz = 0.3 + pr() * 0.22;
        const g = new THREE.Group();
        g.add(giftBox(sz, giftColors[Math.floor(pr() * giftColors.length)], pr() < 0.5 ? 0xf5c542 : 0xfff6e6));
        if (pr() < 0.55) g.add(put(new THREE.Group(), giftBox(sz * 0.7, giftColors[Math.floor(pr() * giftColors.length)], 0xf5c542), 0.02, sz * 0.9, -0.01));
        obj = g;
        break;
      }
      case "pine":
        obj = miniPine(0.9 + pr() * 0.7, 0.8 + pr() * 0.3);
        break;
      case "snowman":
        obj = snowman();
        break;
      case "candy":
        obj = candyCane();
        break;
      case "mushroom":
        obj = mushroom();
        break;
      case "lantern": {
        const l = lantern();
        flames.push(l.flame);
        obj = l.group;
        break;
      }
      case "bauble":
        obj = bauble(baubleColors[Math.floor(pr() * baubleColors.length)]);
        break;
      default: {
        const s = starPost();
        spinners.push({ obj: s.star, base: 1.08, phase: pr() * 6 });
        obj = s.group;
      }
    }
    obj.position.set(x, 0, z);
    obj.rotation.y = rot;
    group.add(shade(obj));
    spots.push({ x, z });
    placed++;
  }

  // ก้อนหิมะกระจายทั่วลาน เพื่อให้พื้นดูมีมิติ
  const pr2 = rng("yard-mounds");
  const moundMat = snowSurface();
  for (let i = 0, n = 0; n < 9 && i < 300; i++) {
    const x = (pr2() - 0.5) * range * 2;
    const z = (pr2() - 0.5) * range * 2;
    if (!free(x, z, 0.9)) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10), moundMat);
    m.position.set(x, 0.05, z);
    m.scale.set(0.9 + pr2() * 0.5, 0.3, 0.9 + pr2() * 0.5);
    group.add(shade(m));
    spots.push({ x, z });
    n++;
  }

  updates.push((t, reduced) => {
    flames.forEach((f, i) => {
      (f.material as THREE.SpriteMaterial).opacity = reduced ? 0.6 : 0.5 + 0.14 * Math.sin(t * 6 + i * 1.7);
    });
    spinners.forEach((s) => {
      s.obj.rotation.y = reduced ? 0 : t * 0.6 + s.phase;
      s.obj.position.y = s.base + (reduced ? 0 : Math.sin(t * 1.3 + s.phase) * 0.04);
    });
  });

  return {
    group,
    update: (t, reduced) => updates.forEach((u) => u(t, reduced)),
  };
}

// ---------- ไม้ของรั้วและเสา: เท็กซ์เจอร์ลายไม้ที่วาดเอง พร้อมลายนูนเล็กน้อย ----------
let woodCache: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
export function woodTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (woodCache) return woodCache;
  const W = 256;
  const H = 512;
  const rnd = rng("fence-wood");
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const cMap = mk();
  const cBump = mk();
  const g = cMap.getContext("2d")!;
  const b = cBump.getContext("2d")!;
  // พื้นไม้สีน้ำตาลอุ่นพร้อมไล่สีเล็กน้อย
  const base = g.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0, "#6e4322");
  base.addColorStop(0.5, "#8a5a2e");
  base.addColorStop(1, "#5f3a1c");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, W, H);
  // เส้นลายไม้แนวตั้งที่คดเล็กน้อย
  for (let i = 0; i < 140; i++) {
    const x0 = rnd() * W;
    const dark = rnd() < 0.7;
    const amp = 1 + rnd() * 4;
    const freq = 0.01 + rnd() * 0.02;
    const ph = rnd() * 6;
    g.strokeStyle = dark ? `rgba(40,18,6,${0.16 + rnd() * 0.3})` : `rgba(235,190,130,${0.08 + rnd() * 0.16})`;
    g.lineWidth = 0.8 + rnd() * 2.4;
    g.beginPath();
    for (let y = 0; y <= H; y += 8) {
      const x = x0 + Math.sin(y * freq + ph) * amp;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    b.strokeStyle = dark ? "#303030" : "#c8c8c8";
    b.lineWidth = g.lineWidth;
    b.beginPath();
    for (let y = 0; y <= H; y += 8) {
      const x = x0 + Math.sin(y * freq + ph) * amp;
      if (y === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.stroke();
  }
  // รอยแตกและจุดด่างเล็ก ๆ ให้ดูเป็นไม้ที่ผ่านอากาศมานาน
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    g.fillStyle = `rgba(30,14,4,${0.1 + rnd() * 0.25})`;
    g.fillRect(x, y, 1 + rnd() * 2, 2 + rnd() * 9);
    b.fillStyle = rnd() < 0.5 ? "#2a2a2a" : "#b0b0b0";
    b.fillRect(x, y, 1 + rnd() * 2, 2 + rnd() * 9);
  }
  // ตาไม้ (knot) วงรีเข้ม
  for (let i = 0; i < 5; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const rx = 4 + rnd() * 5;
    const ry = rx * (1.8 + rnd());
    g.fillStyle = "rgba(60,30,12,0.45)";
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(40,20,8,0.5)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(x, y, rx * 1.5, ry * 1.5, 0, 0, Math.PI * 2);
    g.stroke();
    b.fillStyle = "#202020";
    b.beginPath();
    b.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    b.fill();
  }
  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  const bump = new THREE.CanvasTexture(cBump);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  woodCache = { map, bump };
  return woodCache;
}

// ไม้แท่งกลม (log) ใช้ทำราวรั้วและเสา
export function woodMaterial(): THREE.MeshStandardMaterial {
  const { map, bump } = woodTextures();
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.4, roughness: 0.85, metalness: 0 });
}
