// โมเดล 3 มิติของของตกแต่งบนฐาน Exclusive: แต่ละชนิดแยกสีตามส่วนที่กำหนดไว้ใน ITEM_SPECS
// ทุกชิ้นมีจุดกำเนิดอยู่ที่ผิวฐาน (y = 0) เพื่อให้วางลงบนฐานได้พอดี
import * as THREE from "three";
import { PALETTE, type PaletteKey } from "@/lib/christmas/giant";
import { snowSurface, std } from "./zoneScenery";
import { buildSnowman } from "./snowmanModel";

const colorOf = (k: string | undefined, fallback: PaletteKey): number => {
  const key = (k && k in PALETTE ? k : fallback) as PaletteKey;
  return PALETTE[key];
};
const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
const glowMat = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.9, roughness: 0.4 });

// ตุ๊กตาหิมะ: ใช้โมเดลเดียวกับตุ๊กตาบนลาน ย่อขนาดลง (สีหมวกและผ้าพันคอตามที่เลือก)
const SNOW_HAT: Record<string, string> = { black: "black", red: "red", green: "green", blue: "navy", gold: "gold" };
const SNOW_SCARF: Record<string, string> = { red: "red", green: "green", blue: "blue", pink: "pink", gold: "gold", mint: "green", orange: "candy" };
function snowmanModel(p: Parts): THREE.Group {
  const s = buildSnowman({ hat: "top", hatColor: SNOW_HAT[p.hat ?? "black"] ?? "black", scarf: SNOW_SCARF[p.scarf ?? "red"] ?? "red", nose: "carrot", arms: "sticks", body: "white", legs: "none", acc: "none" }, { contact: false });
  s.scale.setScalar(0.42);
  const g = new THREE.Group();
  g.add(s);
  return g;
}

// ต้นสนเล็ก: ใบ (leaf) ลูกประดับ (ball) และดาวยอด (top)
function pineModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const leaf = std(colorOf(p.leaf, "forest"), 0.85);
  const ball = std(colorOf(p.ball, "red"), 0.3, 0.4);
  const topMat = std(colorOf(p.top, "gold"), 0.3, 0.5);
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 8), std(0x5b3a1e, 0.9), 0, 0.07, 0));
  const tiers = [
    { bottom: 0.14, h: 0.3, r: 0.3 },
    { bottom: 0.3, h: 0.28, r: 0.24 },
    { bottom: 0.44, h: 0.24, r: 0.18 },
  ];
  tiers.forEach((t, i) => {
    g.add(mesh(new THREE.ConeGeometry(t.r, t.h, 18), leaf, 0, t.bottom + t.h / 2, 0));
    // ลูกประดับวางบนผิวกรวย หมุนมุมให้แต่ละชั้นไม่ซ้ำกัน
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + i * 0.9;
      const f = 0.42;
      const rr = t.r * (1 - f) * 0.92;
      g.add(mesh(new THREE.SphereGeometry(0.028, 10, 8), ball, Math.cos(a) * rr, t.bottom + t.h * f, Math.sin(a) * rr));
    }
  });
  g.add(mesh(new THREE.OctahedronGeometry(0.05), topMat, 0, 0.73, 0));
  return g;
}

// กล่องของขวัญ: กล่อง (box) และริบบิ้นสองเส้นกับโบว์ (ribbon)
function giftModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const box = std(colorOf(p.box, "red"), 0.55);
  const rib = std(colorOf(p.ribbon, "gold"), 0.35, 0.3);
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.27, 0.3), box, 0, 0.135, 0));
  g.add(mesh(new THREE.BoxGeometry(0.31, 0.275, 0.05), rib, 0, 0.135, 0));
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.275, 0.31), rib, 0, 0.135, 0));
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 14), rib, s * 0.035, 0.29, 0);
    loop.rotation.z = s * 0.4;
    g.add(loop);
  }
  g.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), rib, 0, 0.285, 0));
  return g;
}

// ไม้เท้าขนม: ตัวไม้สีขาวและลายเกลียวสี (stripe)
function candyModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(0, 0.42, 0),
    new THREE.Vector3(0.04, 0.5, 0),
    new THREE.Vector3(0.1, 0.46, 0),
    new THREE.Vector3(0.11, 0.4, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(path, 60, 0.02, 8, false), std(colorOf(p.base, "white"), 0.4), 0, 0, 0));
  // ลายเกลียวพันรอบตัวไม้ตามกรอบของเส้นทาง
  const N = 160;
  const frames = path.computeFrenetFrames(N, false);
  const helix: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const c = path.getPointAt(t);
    const a = t * 9 * Math.PI * 2;
    const n = frames.normals[i];
    const b = frames.binormals[i];
    helix.push(c.clone().addScaledVector(n, Math.cos(a) * 0.021).addScaledVector(b, Math.sin(a) * 0.021));
  }
  const stripe = new THREE.CatmullRomCurve3(helix);
  g.add(mesh(new THREE.TubeGeometry(stripe, 320, 0.0105, 6, false), std(colorOf(p.stripe, "red"), 0.45), 0, 0, 0));
  return g;
}

// ลูกแก้วแขวนบนขาตั้งหิมะ: ลูกแก้ว (ball) และฝาครอบ (cap)
function baubleModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const cap = std(colorOf(p.cap, "gold"), 0.3, 0.6);
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.02, 18), snowSurface(), 0, 0.01, 0));
  g.add(mesh(new THREE.SphereGeometry(0.1, 20, 14), std(colorOf(p.ball, "red"), 0.2, 0.4), 0, 0.13, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.04, 12), cap, 0, 0.24, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10), cap, 0, 0.28, 0));
  return g;
}

// โคมไฟเสาไม้: โครง (frame) และแสงในโคม (glow)
function lanternModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const frame = std(colorOf(p.frame, "gold"), 0.35, 0.6);
  const glowHex = colorOf(p.glow, "warm");
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), std(0x5b3a1e, 0.9), 0, 0.18, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.02, 8), frame, 0, 0.36, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.16, 8, 1, true), glowMat(glowHex), 0, 0.28, 0));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), frame, Math.cos(a) * 0.07, 0.28, Math.sin(a) * 0.07));
  }
  g.add(mesh(new THREE.ConeGeometry(0.11, 0.08, 8), frame, 0, 0.42, 0));
  return g;
}

// ดาวดวงใหญ่บนเสาไม้เล็ก: ดาว (star)
function starModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 12), std(0x5b3a1e, 0.9), 0, 0.01, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), std(0x5b3a1e, 0.9), 0, 0.12, 0));
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.045 : 0.1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -0.015);
  const starHex = colorOf(p.star, "gold");
  g.add(mesh(geo, new THREE.MeshStandardMaterial({ color: starHex, emissive: starHex, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.4 }), 0, 0.3, 0));
  return g;
}

// กระดิ่งทองบนแท่น: กระดิ่ง (bell) และโบว์ (ribbon)
function bellModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 14), std(0x5b3a1e, 0.9), 0, 0.02, 0));
  const profile = [
    new THREE.Vector2(0.02, 0.13),
    new THREE.Vector2(0.03, 0.125),
    new THREE.Vector2(0.05, 0.1),
    new THREE.Vector2(0.07, 0.05),
    new THREE.Vector2(0.1, -0.01),
    new THREE.Vector2(0.115, -0.04),
    new THREE.Vector2(0, -0.04),
  ];
  const bellMat = std(colorOf(p.bell, "gold"), 0.3, 0.6);
  bellMat.side = THREE.DoubleSide;
  const bell = mesh(new THREE.LatheGeometry(profile, 18), bellMat, 0, 0.12, 0);
  g.add(bell);
  const bow = std(colorOf(p.ribbon, "red"), 0.5);
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 12), bow, s * 0.03, 0.24, 0);
    loop.rotation.z = s * 0.5;
    g.add(loop);
  }
  g.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), bow, 0, 0.23, 0));
  return g;
}

// พวงมาลัย: ตัววงใบ (leaf) และโบว์ตรงมุมล่าง (bow)
function wreathModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const leaf = std(colorOf(p.leaf, "forest"), 0.85);
  const ring = mesh(new THREE.TorusGeometry(0.17, 0.04, 12, 36), leaf, 0, 0.21, 0);
  g.add(ring);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const rr = 0.17 + ((k % 3) - 1) * 0.02;
    const y = 0.21 + Math.sin(k * 1.7) * 0.02;
    const leafBlob = mesh(new THREE.SphereGeometry(0.035, 8, 6), leaf, Math.cos(a) * rr, y, Math.sin(a) * rr);
    leafBlob.scale.set(1.6, 0.6, 0.8);
    g.add(leafBlob);
  }
  const bow = std(colorOf(p.bow, "red"), 0.5);
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.03, 0.012, 8, 12), bow, 0.12 + s * 0.03, 0.06, 0.03);
    loop.rotation.z = s * 0.5;
    g.add(loop);
  }
  g.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), bow, 0.12, 0.05, 0.035));
  return g;
}

// กวางเรนเดียร์ยืน: ตัว (body) จมูก (nose) ผ้าพันคอ (scarf)
function reindeerModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const fur = std(colorOf(p.body, "wood"), 0.8);
  const dark = std(0x3a2416, 0.7);
  const body = mesh(new THREE.CapsuleGeometry(0.075, 0.16, 6, 12), fur, 0, 0.22, 0);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  for (const [x, z] of [
    [0.09, 0.04],
    [0.09, -0.04],
    [-0.09, 0.04],
    [-0.09, -0.04],
  ]) {
    g.add(mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.16, 8), fur, x, 0.08, z));
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), dark, x, 0.01, z));
  }
  const neck = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 10), fur, 0.13, 0.3, 0);
  neck.rotation.z = -0.5;
  g.add(neck);
  const head = mesh(new THREE.SphereGeometry(0.05, 14, 10), fur, 0.18, 0.37, 0);
  head.scale.set(1.3, 1, 0.9);
  g.add(head);
  g.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshStandardMaterial({ color: colorOf(p.nose, "red"), emissive: colorOf(p.nose, "red"), emissiveIntensity: p.nose === "red" ? 0.6 : 0.1, roughness: 0.3 }), 0.245, 0.365, 0));
  for (const z of [-0.025, 0.025]) g.add(mesh(new THREE.SphereGeometry(0.008, 6, 6), std(0x111111, 0.3), 0.21, 0.385, z));
  for (const z of [-1, 1]) {
    const pts = [new THREE.Vector3(0.17, 0.41, z * 0.02), new THREE.Vector3(0.15, 0.5, z * 0.06), new THREE.Vector3(0.12, 0.56, z * 0.08)];
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.008, 5), dark, 0, 0, 0));
    const mid = new THREE.CatmullRomCurve3(pts).getPoint(0.5);
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([mid, mid.clone().add(new THREE.Vector3(0.04, 0.04, z * 0.01))]), 4, 0.006, 5), dark, 0, 0, 0));
  }
  const scarf = mesh(new THREE.TorusGeometry(0.042, 0.014, 8, 18), std(colorOf(p.scarf, "red"), 0.8), 0.13, 0.3, 0);
  scarf.rotation.set(Math.PI / 2, 0.5, 0);
  g.add(scarf);
  g.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), std(0xffffff, 0.9), -0.15, 0.25, 0));
  return g;
}

// เลื่อนหิมะพร้อมกองของขวัญ: ตัวเลื่อน (body) ของบนเลื่อน (gift)
function sledModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshPhysicalMaterial({ color: colorOf(p.body, "red"), roughness: 0.35, clearcoat: 0.6 });
  const gold = std(0xe8b84a, 0.3, 0.8);
  for (let k = -2; k <= 2; k++) g.add(mesh(new THREE.BoxGeometry(0.3, 0.015, 0.05), bodyM, 0, 0.09, k * 0.055));
  for (const s of [-1, 1]) {
    const pts = [new THREE.Vector3(s * 0.13, 0.01, -0.18), new THREE.Vector3(s * 0.13, 0.01, 0.14), new THREE.Vector3(s * 0.13, 0.07, 0.21), new THREE.Vector3(s * 0.13, 0.12, 0.18)];
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.01, 6), gold, 0, 0, 0));
    for (const z of [-0.1, 0.08]) g.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.08, 6), gold, s * 0.13, 0.05, z));
  }
  const gm = std(colorOf(p.gift, "gold"), 0.45);
  g.add(mesh(new THREE.BoxGeometry(0.13, 0.11, 0.13), gm, -0.04, 0.155, -0.03));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), std(0xffffff, 0.5), 0.07, 0.145, 0.04));
  g.add(mesh(new THREE.BoxGeometry(0.135, 0.02, 0.02), std(0xc8102e, 0.4), -0.04, 0.2, -0.03));
  return g;
}

// เสาไฟถนนแบบโบราณ: เสา (frame) และแสง (glow)
function lamppostModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const frame = std(colorOf(p.frame, "black"), 0.4, 0.6);
  const glowHex = colorOf(p.glow, "warm");
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.06, 12), frame, 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.55, 8), frame, 0, 0.33, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 6), glowMat(glowHex), 0, 0.66, 0));
  g.add(mesh(new THREE.ConeGeometry(0.065, 0.06, 6), frame, 0, 0.74, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.015, 6), frame, 0, 0.605, 0));
  const wr = mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 14), std(0x1b6b3f, 0.8), 0, 0.42, 0.015);
  g.add(wr);
  g.add(mesh(new THREE.SphereGeometry(0.012, 6, 6), std(0xc8102e, 0.4), 0, 0.39, 0.03));
  return g;
}

// ทหารนัทแครกเกอร์: เสื้อ (coat) หมวก (hat)
function nutcrackerModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const coat = new THREE.MeshPhysicalMaterial({ color: colorOf(p.coat, "red"), roughness: 0.35, clearcoat: 0.7 });
  const gold = std(0xe8b84a, 0.3, 0.8);
  const black = new THREE.MeshPhysicalMaterial({ color: 0x1a1a22, roughness: 0.3, clearcoat: 0.8 });
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.03, 16), std(0x2a6b3f, 0.5), 0, 0.015, 0));
  for (const x of [-0.025, 0.025]) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), black, x, 0.1, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.16, 14), coat, 0, 0.24, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.02, 14), gold, 0, 0.17, 0));
  for (let k = 0; k < 3; k++) g.add(mesh(new THREE.SphereGeometry(0.008, 6, 6), gold, 0, 0.21 + k * 0.035, 0.052));
  for (const x of [-1, 1]) {
    const arm = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 8), coat, x * 0.068, 0.25, 0);
    arm.rotation.z = x * 0.15;
    g.add(arm);
    g.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), std(0xffffff, 0.6), x * 0.078, 0.18, 0));
    g.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), gold, x * 0.06, 0.31, 0));
  }
  g.add(mesh(new THREE.SphereGeometry(0.045, 14, 10), std(0xf3d2b3, 0.6), 0, 0.36, 0));
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.04), std(0xffffff, 0.9), 0, 0.33, 0.025));
  for (const x of [-0.016, 0.016]) g.add(mesh(new THREE.SphereGeometry(0.006, 6, 6), black, x, 0.37, 0.042));
  g.add(mesh(new THREE.SphereGeometry(0.01, 6, 6), std(0xe85a6a, 0.5), 0, 0.355, 0.045));
  g.add(mesh(new THREE.CylinderGeometry(0.044, 0.046, 0.1, 14), std(colorOf(p.hat, "black"), 0.5), 0, 0.43, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 14), gold, 0, 0.39, 0));
  g.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), gold, 0, 0.485, 0));
  return g;
}

// กองของขวัญซ้อนกัน: กล่องใหญ่ (box) กล่องเล็ก (box2) ริบบิ้น (ribbon)
function giftstackModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const rib = std(colorOf(p.ribbon, "gold"), 0.35, 0.3);
  const box = (size: number, c: number, x: number, y: number, z: number, r: number) => {
    const b = new THREE.Group();
    b.add(mesh(new THREE.BoxGeometry(size, size * 0.85, size), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.5 }), 0, (size * 0.85) / 2, 0));
    b.add(mesh(new THREE.BoxGeometry(size * 1.01, size * 0.86, size * 0.16), rib, 0, (size * 0.85) / 2, 0));
    b.add(mesh(new THREE.BoxGeometry(size * 0.16, size * 0.86, size * 1.01), rib, 0, (size * 0.85) / 2, 0));
    for (const s of [-1, 1]) {
      const loop = mesh(new THREE.TorusGeometry(size * 0.12, size * 0.04, 6, 12), rib, s * size * 0.12, size * 0.9, 0);
      loop.rotation.z = s * 0.5;
      b.add(loop);
    }
    b.position.set(x, y, z);
    b.rotation.y = r;
    g.add(b);
  };
  box(0.22, colorOf(p.box, "red"), -0.03, 0, 0, 0.2);
  box(0.15, colorOf(p.box2, "gold"), 0.12, 0, 0.08, -0.4);
  box(0.13, colorOf(p.box2, "gold"), -0.03, 0.19, 0, 0.7);
  return g;
}

// ม้านั่งไม้: ไม้ (wood) หมอนอิง (pillow)
function benchModel(p: Parts): THREE.Group {
  const g = new THREE.Group();
  const wood = std(colorOf(p.wood, "wood"), 0.6);
  const iron = std(0x1d2420, 0.45, 0.6);
  for (let k = 0; k < 3; k++) g.add(mesh(new THREE.BoxGeometry(0.4, 0.015, 0.04), wood, 0, 0.13, -0.05 + k * 0.045));
  for (let k = 0; k < 2; k++) g.add(mesh(new THREE.BoxGeometry(0.4, 0.035, 0.012), wood, 0, 0.2 + k * 0.05, -0.08));
  for (const x of [-0.17, 0.17]) {
    g.add(mesh(new THREE.BoxGeometry(0.015, 0.13, 0.13), iron, x, 0.065, 0));
    g.add(mesh(new THREE.BoxGeometry(0.015, 0.14, 0.015), iron, x, 0.2, -0.085));
  }
  const pillow = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), std(colorOf(p.pillow, "red"), 0.9), 0.1, 0.18, -0.06);
  pillow.rotation.x = -0.2;
  g.add(pillow);
  g.add(mesh(new THREE.BoxGeometry(0.38, 0.012, 0.13), snowSurface(), 0, 0.142, 0));
  return g;
}

type Parts = Record<string, string | undefined>;
const MODELS: Record<string, (p: Parts) => THREE.Group> = {
  snowman: snowmanModel,
  pine: pineModel,
  gift: giftModel,
  candy: candyModel,
  bauble: baubleModel,
  lantern: lanternModel,
  star: starModel,
  bell: bellModel,
  wreath: wreathModel,
  reindeer: reindeerModel,
  sled: sledModel,
  lamppost: lamppostModel,
  nutcracker: nutcrackerModel,
  giftstack: giftstackModel,
  bench: benchModel,
};

// สร้างโมเดลของชิ้นหนึ่งตามชนิดและสีของแต่ละส่วน (ไม่รวมวงแหวนไฮไลต์)
export function buildItemModel(kind: string, parts: Parts): THREE.Group {
  const make = MODELS[kind];
  return make ? make(parts) : new THREE.Group();
}
