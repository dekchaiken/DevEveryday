// ฉากประกอบของโซนคำอวยพรและ Exclusive: บ้านหิมะโมเดลในโค้ด ต้นสนเรืองแสง ของตกแต่ง
// ทุกชิ้นสร้างจากรูปทรงพื้นฐานและเท็กซ์เจอร์ที่วาดเอง ไม่ต้องโหลดไฟล์โมเดลจากภายนอก
import * as THREE from "three";
import { STICKER_KINDS } from "@/lib/christmas/cardSpec";
import { STICKER_SVG } from "@/lib/christmas/stickerArt";
import { GIANT_BODY_HEX, GIANT_LIGHT_HEX } from "@/lib/christmas/giant";

export type Updater = (t: number, reduced: boolean) => void;
export type Scenery = { group: THREE.Group; update: Updater };

// ---------- เท็กซ์เจอร์ที่ใช้ซ้ำ สร้างครั้งเดียวทั้งแอป ----------
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

// สติ๊กเกอร์ SVG ที่วาดแล้วเป็นเท็กซ์เจอร์ของ sprite เก็บไว้ใช้ซ้ำ
const stickerCache = new Map<string, THREE.Texture>();
function stickerTexture(kind: string): THREE.Texture {
  const hit = stickerCache.get(kind);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  stickerCache.set(kind, tex);
  const inner = STICKER_SVG[kind as keyof typeof STICKER_SVG];
  if (inner) {
    const img = new Image();
    img.onload = () => {
      const g = c.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, 128, 128);
      g.drawImage(img, 0, 0, 128, 128);
      tex.needsUpdate = true;
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${inner}</svg>`)}`;
  }
  return tex;
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

// ---------- บ้านหิมะ: หน้าบ้านหันไปทางแกน +z ----------
const W = 2.2; // ความกว้างผนัง
const H = 1.3; // ความสูงผนัง
const D = 1.8; // ความลึกบ้าน
const ROOF_H = 1.0; // ความสูงของหลังคา
const OVER = 0.25; // ชายคายื่นออกจากผนัง

export function buildCottage(look: { body: string; lights: string }): Scenery {
  const group = new THREE.Group();
  const updates: Updater[] = [];
  const add = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0): T => {
    o.position.set(x, y, z);
    group.add(o);
    return o;
  };
  const plain = (color: number, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

  // ผนังและจั่วหน้าบ้าน
  const wallMat = plain(GIANT_BODY_HEX[look.body] ?? GIANT_BODY_HEX.cream, 0.85);
  add(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat), 0, H / 2, 0);
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-W / 2, 0);
  gableShape.lineTo(W / 2, 0);
  gableShape.lineTo(0, ROOF_H);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.06, bevelEnabled: false });
  add(new THREE.Mesh(gableGeo, wallMat), 0, H, D / 2);
  add(new THREE.Mesh(gableGeo, wallMat), 0, H, -D / 2 - 0.06);

  // หลังคาหิมะสองด้าน ปลายชายคายื่นออกเล็กน้อย
  const E = W / 2 + OVER;
  const slopeLen = Math.hypot(E, ROOF_H);
  const slopeAng = Math.atan2(ROOF_H, E);
  const roofMat = plain(0xf4f8ff, 0.5);
  const slopeGeo = new THREE.BoxGeometry(slopeLen, 0.16, D + 0.5);
  const left = add(new THREE.Mesh(slopeGeo, roofMat), -E / 2, H + ROOF_H / 2, 0);
  left.rotation.z = slopeAng;
  const right = add(new THREE.Mesh(slopeGeo, roofMat), E / 2, H + ROOF_H / 2, 0);
  right.rotation.z = -slopeAng;
  const roofAt = (x: number) => H + ROOF_H * (1 - Math.abs(x) / E);

  // ปล่องไฟ และควันที่ลอยขึ้นเรื่อย ๆ
  const chimX = 0.62;
  const chimZ = -0.35;
  const chimTop = roofAt(chimX) + 0.78;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.34), plain(0x9b3a2b, 0.9)), chimX, roofAt(chimX) + 0.25, chimZ);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), plain(0x6b2a20, 0.9)), chimX, chimTop, chimZ);
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

  // ประตูแดงมีพวงหรีด
  add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.06), plain(0x5b1a1f, 0.6)), 0, 0.4, D / 2 + 0.03);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20), plain(0x1f7a3a, 0.8)), 0, 1.04, D / 2 + 0.07);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), plain(0xdc2643, 0.5)), 0.12, 0.9, D / 2 + 0.09);

  // หน้าต่างสองบานมีกรอบไม้และแสงอุ่น
  const winGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const barMat = plain(0x7a4a24, 0.8);
  for (const wx of [-0.62, 0.62]) {
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.42), winGlowMat), wx, 0.78, D / 2 + 0.012);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.02), barMat), wx, 0.78, D / 2 + 0.03);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.02), barMat), wx, 0.78, D / 2 + 0.03);
    const haze = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffc857, transparent: true, opacity: 0.35, depthWrite: false })), wx, 0.78, D / 2 + 0.15);
    haze.scale.set(1.2, 1.2, 1);
  }
  // หน้าต่างกลมบนจั่ว
  add(new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), winGlowMat), 0, H + 0.3, D / 2 + 0.07);

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
  frame(0, 0.4, 0.52, 0.84, D / 2 + 0.07);
  frame(-0.62, 0.78, 0.52, 0.52, D / 2 + 0.05);
  frame(0.62, 0.78, 0.52, 0.52, D / 2 + 0.05);
  for (let x = -E + 0.1; x <= E - 0.1; x += 0.14) bulbs.push(new THREE.Vector3(x, H - 0.03, D / 2 + 0.24));
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs.length);
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

  // ตะเกียงแขวนสองข้างประตู ส่องแสงเป็นจังหวะเบา ๆ
  const lanterns: THREE.Sprite[] = [];
  for (const lx of [-1.14, 1.14]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), barMat), lx, 1.2, D / 2 + 0.1);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), new THREE.MeshBasicMaterial({ color: 0xffd166 })), lx, 1.06, D / 2 + 0.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 6), plain(0x3b2a1a, 0.6)), lx, 1.2, D / 2 + 0.2);
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffc857, transparent: true, opacity: 0.5, depthWrite: false })), lx, 1.06, D / 2 + 0.22);
    sp.scale.set(0.9, 0.9, 1);
    lanterns.push(sp);
  }
  updates.push((t, reduced) => {
    lanterns.forEach((sp, i) => {
      (sp.material as THREE.SpriteMaterial).opacity = reduced ? 0.5 : 0.42 + 0.12 * Math.sin(t * 7 + i * 2);
    });
  });

  // กองหิมะและของขวัญที่หน้าบ้าน
  const mound = new THREE.SphereGeometry(0.3, 12, 8);
  for (const [mx, mz] of [
    [-1.45, D / 2 + 0.3],
    [1.4, D / 2 + 0.35],
  ]) {
    add(new THREE.Mesh(mound, roofMat), mx, 0.05, mz).scale.set(1.1, 0.35, 1.1);
  }
  const gift = (x: number, z: number, s: number, c: number) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.9, s), plain(c, 0.6)));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.92, s * 0.16), plain(0xf5c542, 0.4)));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.16, s * 0.94, s * 1.02), plain(0xf5c542, 0.4)));
    add(g, x, (s * 0.9) / 2, z);
  };
  gift(-1.2, D / 2 + 0.55, 0.3, 0xdc2643);
  gift(-0.9, D / 2 + 0.62, 0.22, 0x3b82f6);

  return {
    group,
    update: (t, reduced) => updates.forEach((u) => u(t, reduced)),
  };
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
    const v = i / N; // 0 ที่โคน 1 ที่ยอด
    const tier = (v * TIERS) % 1;
    const r = (1 - v) * 0.95 * (0.55 + 0.45 * (1 - tier)) + 0.04;
    const a = i * 2.39996 + (rand() - 0.5) * 0.25; // มุมทองทำให้เกลียวกระจายสม่ำเสมอ
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
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.12, map: glow(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
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

// ---------- ฉากทั้งลาน: บ้านอยู่ด้านหลังกลางลาน ต้นสนเรืองแสงที่มุม ของตกแต่งกระจายทั่วลาน ----------
// ลานมีขนาด ±8 หน่วยรอบจุดกลางโซน ช่องการ์ดอยู่บนรั้วด้านนอก จึงวางฉากไว้ด้านในได้โดยไม่บังการ์ด
export function buildYardScenery(): Scenery {
  const group = new THREE.Group();
  const updates: Updater[] = [];

  const cottage = buildCottage({ body: "cream", lights: "gold" });
  cottage.group.position.set(0, 0, -2.4);
  cottage.group.scale.setScalar(0.85);
  group.add(cottage.group);
  updates.push(cottage.update);

  const trees: [number, number, number, number][] = [
    [-4.6, -4.4, 3.0, 0xff5fb3],
    [4.6, -4.4, 2.6, 0x9aa8ff],
    [-4.9, 3.0, 2.3, 0x9aa8ff],
    [5.1, 2.6, 3.2, 0xff5fb3],
  ];
  trees.forEach(([x, z, h, c], i) => {
    const tree = buildGlowTree(c, h, `yard-tree-${i}`);
    tree.group.position.set(x, 0, z);
    group.add(tree.group);
    updates.push(tree.update);
  });

  // พื้นที่ที่ห้ามวางของตกแต่ง: บ้าน ต้นสน และทางเดินกลางลาน
  const blocked = (x: number, z: number) =>
    (Math.abs(x) < 1.7 && z < 0.4 && z > -4.6) || trees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 1.6);

  const pr = rng("yard-props");
  const range = 6.2;
  const stickers: { s: THREE.Sprite; y: number }[] = [];
  for (let tries = 0, placed = 0; placed < 26 && tries < 500; tries++) {
    const x = (pr() - 0.5) * range * 2;
    const z = (pr() - 0.5) * range * 2;
    if (blocked(x, z)) continue;
    const kind = STICKER_KINDS[Math.floor(pr() * STICKER_KINDS.length)];
    const size = 0.5 + pr() * 0.35;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stickerTexture(kind), transparent: true, depthWrite: false }));
    s.scale.set(size, size, 1);
    const y = size / 2 + 0.02;
    s.position.set(x, y, z);
    group.add(s);
    stickers.push({ s, y });
    placed++;
  }
  updates.push((t, reduced) => {
    stickers.forEach(({ s, y }, i) => {
      s.position.y = y + (reduced ? 0 : Math.sin(t * 1.4 + i) * 0.035);
    });
  });

  // ของขวัญกองเล็กและกองหิมะกระจายตามลาน
  const pr2 = rng("yard-gifts");
  const giftCols = [0xdc2643, 0xf5c542, 0x3b82f6, 0x16a34a, 0xa855f7];
  for (let i = 0, placed = 0; placed < 6 && i < 300; i++) {
    const x = (pr2() - 0.5) * range * 2;
    const z = (pr2() - 0.5) * range * 2;
    if (blocked(x, z)) continue;
    const sz = 0.3 + pr2() * 0.25;
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: giftCols[Math.floor(pr2() * giftCols.length)], roughness: 0.6 });
    const ribbon = new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.4 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(sz, sz * 0.9, sz), m));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(sz * 1.02, sz * 0.92, sz * 0.16), ribbon));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(sz * 0.16, sz * 0.94, sz * 1.02), ribbon));
    g.position.set(x, (sz * 0.9) / 2, z);
    g.rotation.y = pr2() * 0.6;
    group.add(g);
    placed++;
  }
  const moundGeo = new THREE.SphereGeometry(0.4, 12, 8);
  const moundMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.5 });
  for (let i = 0, placed = 0; placed < 8 && i < 300; i++) {
    const x = (pr2() - 0.5) * range * 2;
    const z = (pr2() - 0.5) * range * 2;
    if (blocked(x, z)) continue;
    const mound = new THREE.Mesh(moundGeo, moundMat);
    mound.position.set(x, 0.05, z);
    mound.scale.set(0.9 + pr2() * 0.5, 0.3, 0.9 + pr2() * 0.5);
    group.add(mound);
    placed++;
  }

  return {
    group,
    update: (t, reduced) => updates.forEach((u) => u(t, reduced)),
  };
}
