// บ้านหิมะกลางฐาน Exclusive และรั้วรอบฐาน
// จุดกำเนิดของบ้านอยู่ที่พื้นกลางบ้าน หันหน้าไป +z (ประตูหันเข้าหาด้านหน้าฐาน)
import * as THREE from "three";
import { BASE_R, PALETTE, type PaletteKey } from "@/lib/christmas/giant";

const col = (k: string | undefined, fb: PaletteKey) => PALETTE[(k && k in PALETTE ? k : fb) as PaletteKey];
const std = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const snowMat = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xdcecff), sheenRoughness: 0.4 });
function m(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

type Built = { group: THREE.Group; update: (t: number, reduced: boolean) => void };

// ไฟประดับเส้นหนึ่ง: หลอดสีเรืองแสงที่กะพริบสลับกัน
function lightString(points: THREE.Vector3[], colors: number[]) {
  const g = new THREE.Group();
  const mats: THREE.MeshStandardMaterial[] = [];
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.004, 4), std(0x1b2a22, 0.6));
  g.add(wire);
  const curve = new THREE.CatmullRomCurve3(points);
  const n = Math.max(4, Math.round(curve.getLength() / 0.07));
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    const c = colors[i % colors.length];
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, roughness: 0.3 });
    mats.push(mat);
    g.add(m(new THREE.SphereGeometry(0.014, 8, 6), mat, p.x, p.y - 0.012, p.z));
  }
  return {
    group: g,
    update: (t: number, reduced: boolean) => {
      mats.forEach((mt, i) => (mt.emissiveIntensity = reduced ? 1 : 0.5 + 0.9 * Math.max(0, Math.sin(t * 3 + i * 1.7))));
    },
  };
}
const BULBS = [0xff4d5e, 0xffd166, 0x7dd3fc, 0x86efac, 0xffffff];

// หน้าต่างแสงอุ่น: กรอบขาว กากบาท ขอบหน้าต่างมีหิมะ
function windowPane(w: number, h: number, frame = 0xffffff) {
  const g = new THREE.Group();
  g.add(m(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 1.1 }), 0, 0, 0.002));
  const fm = std(frame, 0.5);
  g.add(m(new THREE.BoxGeometry(w + 0.03, 0.018, 0.02), fm, 0, h / 2, 0.01));
  g.add(m(new THREE.BoxGeometry(w + 0.03, 0.018, 0.02), fm, 0, -h / 2, 0.01));
  g.add(m(new THREE.BoxGeometry(0.018, h, 0.02), fm, -w / 2, 0, 0.01));
  g.add(m(new THREE.BoxGeometry(0.018, h, 0.02), fm, w / 2, 0, 0.01));
  g.add(m(new THREE.BoxGeometry(0.012, h, 0.012), fm, 0, 0, 0.012));
  g.add(m(new THREE.BoxGeometry(w, 0.012, 0.012), fm, 0, 0, 0.012));
  g.add(m(new THREE.BoxGeometry(w + 0.06, 0.02, 0.05), snowMat(), 0, -h / 2 - 0.012, 0.025));
  return g;
}
function wreath(r: number) {
  const g = new THREE.Group();
  g.add(m(new THREE.TorusGeometry(r, r * 0.35, 8, 20), std(0x1b6b3f, 0.8)));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.add(m(new THREE.SphereGeometry(r * 0.16, 8, 6), std(0xc8102e, 0.3), Math.cos(a) * r, Math.sin(a) * r, r * 0.25));
  }
  g.add(m(new THREE.SphereGeometry(r * 0.25, 8, 6), std(0xc8102e, 0.4), 0, -r, r * 0.3));
  return g;
}
// หลังคาจั่ว: สองแผ่นเอียง หิมะหนาทับด้านบน ขอบหิมะย้อยเป็นก้อน และน้ำแข็งย้อยด้านหน้า
function gableRoof(width: number, depth: number, rise: number, roofHex: number, baseY: number, group: THREE.Group) {
  const half = depth / 2 + 0.08;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  const roofM = new THREE.MeshPhysicalMaterial({ color: roofHex, roughness: 0.55, clearcoat: 0.3 });
  const snow = snowMat();
  for (const s of [-1, 1]) {
    const plate = m(new THREE.BoxGeometry(width + 0.16, 0.04, slope), roofM);
    plate.rotation.x = s * ang;
    plate.position.set(0, baseY + rise / 2, (s * half) / 2);
    group.add(plate);
    // หิมะคลุมช่วงบนของหลังคา เห็นสีหลังคาที่ชายคา
    const cap = m(new THREE.BoxGeometry(width + 0.14, 0.045, slope * 0.62), snow);
    cap.rotation.x = s * ang;
    const k = 0.31; // จุดกลางของแผ่นหิมะ (สัดส่วนจากสันหลังคา)
    cap.position.set(0, baseY + rise * (1 - k) + 0.03, s * half * k);
    group.add(cap);
    // หิมะย้อยที่ชายคา
    for (let k = 0; k < 9; k++) {
      const x = -width / 2 - 0.06 + ((width + 0.12) * k) / 8;
      if (k % 2 === 0) {
        const lump = m(new THREE.SphereGeometry(0.03, 10, 8), snow, x, baseY + 0.02, s * (half - 0.01));
        lump.scale.set(1.4, 0.6, 1);
        group.add(lump);
      }
      if (s > 0 && k % 2 === 1) {
        const ice = m(new THREE.ConeGeometry(0.012, 0.07 + (k % 3) * 0.02, 6), new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.05, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.85 }), x + 0.02, baseY - 0.045, half - 0.01);
        ice.rotation.x = Math.PI;
        group.add(ice);
      }
    }
  }
  // สันหลังคา
  group.add(m(new THREE.CylinderGeometry(0.035, 0.035, width + 0.2, 10).rotateZ(Math.PI / 2), snow, 0, baseY + rise + 0.03, 0));
  return { half, ang };
}
// ควันจากปล่องไฟ: ก้อนควันลอยขึ้นแล้วจางหาย
function smoke(x: number, y: number, z: number, group: THREE.Group) {
  const puffs: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8eef3, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 }));
    group.add(p);
    puffs.push(p);
  }
  return (t: number, reduced: boolean) => {
    puffs.forEach((p, k) => {
      const ph = ((reduced ? 0.3 : t * 0.35) + k / puffs.length) % 1;
      p.position.set(x + Math.sin(ph * 5 + k) * 0.04, y + ph * 0.5, z + ph * 0.05);
      p.scale.setScalar(0.6 + ph * 1.4);
      (p.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - ph);
    });
  };
}

// จั่วสามเหลี่ยมที่ผนังด้านข้างซ้าย/ขวา (สันหลังคาวิ่งตามแนวกว้าง)
function sideGables(W: number, D: number, rise: number, y: number, mat: THREE.Material, group: THREE.Group) {
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2, 0);
  tri.lineTo(D / 2, 0);
  tri.lineTo(0, rise);
  tri.closePath();
  const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const g = m(geo, mat, s * (W / 2 - 0.01), y, 0);
    g.rotation.y = s * Math.PI / 2;
    group.add(g);
  }
}

function cottage(wallHex: number, roofHex: number): Built {
  const g = new THREE.Group();
  const updates: ((t: number, r: boolean) => void)[] = [];
  const W = 0.86;
  const D = 0.62;
  const H = 0.5;
  g.add(m(new THREE.BoxGeometry(W + 0.08, 0.07, D + 0.08), std(0x9a9489, 0.9), 0, 0.035, 0));
  const wall = new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.75 });
  g.add(m(new THREE.BoxGeometry(W, H, D), wall, 0, 0.07 + H / 2, 0));
  // ไม้ระแนงแนวนอน
  for (let k = 1; k < 6; k++) g.add(m(new THREE.BoxGeometry(W + 0.004, 0.006, D + 0.004), std(new THREE.Color(wallHex).multiplyScalar(0.85).getHex(), 0.8), 0, 0.07 + (H * k) / 6, 0));
  const trim = std(0xfffaf0, 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(m(new THREE.BoxGeometry(0.04, H, 0.04), trim, (sx * W) / 2, 0.07 + H / 2, (sz * D) / 2));
  // จั่วด้านข้าง และหน้าต่างกลมบนจั่วทั้งสองข้าง
  const rise = 0.34;
  sideGables(W, D, rise, 0.07 + H, wall, g);
  for (const sx of [-1, 1]) {
    const rw = m(new THREE.CircleGeometry(0.05, 20), new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 1.1 }), sx * (W / 2 + 0.012), 0.07 + H + 0.12, 0);
    rw.rotation.y = sx * Math.PI / 2;
    g.add(rw);
    const rf = m(new THREE.TorusGeometry(0.05, 0.01, 6, 20), trim, sx * (W / 2 + 0.014), 0.07 + H + 0.12, 0);
    rf.rotation.y = sx * Math.PI / 2;
    g.add(rf);
  }
  // หน้าต่างหลังคา (dormer) เหนือประตู
  const dormer = new THREE.Group();
  dormer.add(m(new THREE.BoxGeometry(0.2, 0.14, 0.16), wall, 0, 0, 0));
  const dw = windowPane(0.1, 0.08);
  dw.position.set(0, 0, 0.081);
  dormer.add(dw);
  const dRoof = m(new THREE.ConeGeometry(0.16, 0.1, 4), new THREE.MeshPhysicalMaterial({ color: roofHex, roughness: 0.55 }), 0, 0.11, 0);
  dRoof.rotation.y = Math.PI / 4;
  dormer.add(dRoof);
  dormer.add(m(new THREE.ConeGeometry(0.12, 0.06, 4).rotateY(Math.PI / 4), snowMat(), 0, 0.15, 0));
  dormer.position.set(0, 0.07 + H + 0.1, D / 2 - 0.08);
  g.add(dormer);
  gableRoof(W, D, rise, roofHex, 0.07 + H, g);
  // ประตูไม้ พวงหรีด บันไดหิมะ
  g.add(m(new THREE.BoxGeometry(0.2, 0.32, 0.03), std(0x7a3b1d, 0.6), 0, 0.07 + 0.16, D / 2 + 0.01));
  g.add(m(new THREE.BoxGeometry(0.24, 0.34, 0.02), trim, 0, 0.07 + 0.17, D / 2 + 0.002));
  g.add(m(new THREE.SphereGeometry(0.012, 8, 6), std(0xe8b84a, 0.3, 0.9), 0.06, 0.07 + 0.15, D / 2 + 0.03));
  const wr = wreath(0.045);
  wr.position.set(0, 0.07 + 0.25, D / 2 + 0.035);
  g.add(wr);
  g.add(m(new THREE.BoxGeometry(0.3, 0.04, 0.1), snowMat(), 0, 0.02, D / 2 + 0.07));
  for (const sx of [-1, 1]) {
    const w = windowPane(0.15, 0.15);
    w.position.set(sx * 0.27, 0.07 + 0.27, D / 2 + 0.002);
    g.add(w);
    // หน้าต่างด้านข้าง
    const ws = windowPane(0.14, 0.14);
    ws.rotation.y = sx * Math.PI / 2;
    ws.position.set(sx * (W / 2 + 0.002), 0.07 + 0.27, 0);
    g.add(ws);
  }
  // ปล่องไฟ หิมะบนปล่อง และควัน
  const chim = std(0x8a4a32, 0.85);
  g.add(m(new THREE.BoxGeometry(0.12, 0.3, 0.12), chim, 0.24, 0.07 + H + 0.26, -0.1));
  g.add(m(new THREE.BoxGeometry(0.15, 0.04, 0.15), snowMat(), 0.24, 0.07 + H + 0.42, -0.1));
  updates.push(smoke(0.24, 0.07 + H + 0.5, -0.1, g));
  // ไฟประดับตามชายคาด้านหน้า
  const eaveY = 0.07 + H - 0.01;
  const ls = lightString(
    Array.from({ length: 9 }, (_, i) => new THREE.Vector3(-W / 2 - 0.06 + ((W + 0.12) * i) / 8, eaveY - 0.03 * Math.sin((i / 8) * Math.PI), D / 2 + 0.11)),
    BULBS,
  );
  g.add(ls.group);
  updates.push(ls.update);
  // โคมไฟข้างประตู
  g.add(m(new THREE.BoxGeometry(0.05, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 1.3 }), 0.17, 0.07 + 0.3, D / 2 + 0.04));
  return { group: g, update: (t, r) => updates.forEach((u) => u(t, r)) };
}

function cabin(wallHex: number, roofHex: number): Built {
  const g = new THREE.Group();
  const updates: ((t: number, r: boolean) => void)[] = [];
  const W = 0.9;
  const D = 0.64;
  const H = 0.46;
  const logHex = new THREE.Color(wallHex).lerp(new THREE.Color(0x7a4a24), 0.65).getHex();
  const log = new THREE.MeshStandardMaterial({ color: logHex, roughness: 0.85 });
  const endM = std(new THREE.Color(logHex).multiplyScalar(1.25).getHex(), 0.8);
  g.add(m(new THREE.BoxGeometry(W + 0.06, 0.06, D + 0.06), std(0x8a857c, 0.95), 0, 0.03, 0));
  const n = 7;
  for (let k = 0; k < n; k++) {
    const y = 0.09 + k * (H / n);
    const lx = m(new THREE.CylinderGeometry(0.034, 0.034, W + 0.1, 10).rotateZ(Math.PI / 2), log, 0, y, D / 2 - 0.02);
    const lx2 = m(new THREE.CylinderGeometry(0.034, 0.034, W + 0.1, 10).rotateZ(Math.PI / 2), log, 0, y, -D / 2 + 0.02);
    const lz = m(new THREE.CylinderGeometry(0.034, 0.034, D + 0.1, 10).rotateX(Math.PI / 2), log, W / 2 - 0.02, y + H / n / 2, 0);
    const lz2 = m(new THREE.CylinderGeometry(0.034, 0.034, D + 0.1, 10).rotateX(Math.PI / 2), log, -W / 2 + 0.02, y + H / n / 2, 0);
    g.add(lx, lx2, lz, lz2);
    for (const sx of [-1, 1]) g.add(m(new THREE.CircleGeometry(0.034, 10).rotateY(sx * Math.PI / 2), endM, sx * (W / 2 + 0.05 + 0.001), y, D / 2 - 0.02));
  }
  g.add(m(new THREE.BoxGeometry(W - 0.06, H, D - 0.06), log, 0, 0.09 + H / 2 - 0.03, 0));
  const rise = 0.36;
  sideGables(W, D, rise, 0.06 + H, log, g);
  gableRoof(W, D, rise, roofHex, 0.06 + H, g);
  g.add(m(new THREE.BoxGeometry(0.2, 0.3, 0.03), std(0x4a2a16, 0.7), -0.18, 0.06 + 0.15, D / 2 + 0.02));
  const wr = wreath(0.04);
  wr.position.set(-0.18, 0.06 + 0.24, D / 2 + 0.045);
  g.add(wr);
  const w = windowPane(0.18, 0.15, 0xe8d6b0);
  w.position.set(0.18, 0.06 + 0.26, D / 2 + 0.03);
  g.add(w);
  // ปล่องหินข้างบ้าน
  const stone = std(0x8f8a82, 0.95);
  for (let k = 0; k < 9; k++) g.add(m(new THREE.BoxGeometry(0.16 - (k % 2) * 0.02, 0.1, 0.14), stone, W / 2 + 0.07, 0.05 + k * 0.1, -0.12));
  g.add(m(new THREE.BoxGeometry(0.17, 0.04, 0.16), snowMat(), W / 2 + 0.07, 0.95, -0.12));
  updates.push(smoke(W / 2 + 0.07, 1.0, -0.12, g));
  // กองฟืนข้างประตู
  for (let k = 0; k < 6; k++) g.add(m(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8).rotateX(Math.PI / 2), log, -W / 2 - 0.02 + (k % 3) * 0.055, 0.04 + Math.floor(k / 3) * 0.05, D / 2 - 0.05));
  const ls = lightString(
    Array.from({ length: 9 }, (_, i) => new THREE.Vector3(-W / 2 - 0.06 + ((W + 0.12) * i) / 8, 0.06 + H - 0.02 - 0.035 * Math.sin((i / 8) * Math.PI), D / 2 + 0.12)),
    [0xffd38a, 0xfff1d0],
  );
  g.add(ls.group);
  updates.push(ls.update);
  return { group: g, update: (t, r) => updates.forEach((u) => u(t, r)) };
}

function gingerbread(wallHex: number, roofHex: number): Built {
  const g = new THREE.Group();
  const updates: ((t: number, r: boolean) => void)[] = [];
  const W = 0.8;
  const D = 0.6;
  const H = 0.48;
  const ginger = new THREE.MeshStandardMaterial({ color: 0xa8612e, roughness: 0.85 });
  const icing = new THREE.MeshPhysicalMaterial({ color: 0xfffdf8, roughness: 0.35, clearcoat: 0.6 });
  g.add(m(new THREE.BoxGeometry(W + 0.1, 0.06, D + 0.1), icing, 0, 0.03, 0));
  g.add(m(new THREE.BoxGeometry(W, H, D), ginger, 0, 0.06 + H / 2, 0));
  // ไอซิ่งขอบผนังเป็นลอนคลื่น
  const wavy = (y: number, z: number, len: number, rotY = 0) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) pts.push(new THREE.Vector3(-len / 2 + (len * k) / 16, y + (k % 2 ? -0.02 : 0), 0));
    const tube = m(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.01, 6), icing);
    const holder = new THREE.Group();
    holder.add(tube);
    holder.rotation.y = rotY;
    holder.position.z = z;
    return holder;
  };
  g.add(wavy(0.06 + H - 0.02, D / 2 + 0.008, W));
  g.add(wavy(0.1, D / 2 + 0.008, W));
  const rise = 0.36;
  sideGables(W, D, rise, 0.06 + H, ginger, g);
  gableRoof(W, D, rise, roofHex, 0.06 + H, g);
  // ลูกกวาดกัมดรอปบนสันหลังคา (สีตามผนังที่เลือก)
  const drops = [wallHex, 0xff4d5e, 0x86efac, 0xffd166];
  for (let k = 0; k < 7; k++) {
    const d = m(new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: drops[k % drops.length], roughness: 0.2, clearcoat: 1 }), -W / 2 + 0.04 + ((W - 0.08) * k) / 6, 0.06 + H + rise + 0.06, 0);
    g.add(d);
  }
  // ประตูช็อกโกแลต หน้าต่างเปปเปอร์มินต์ และไม้เท้าขนมคู่
  g.add(m(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), std(0x4a2414, 0.5), 0, 0.06 + 0.22, D / 2 + 0.012));
  g.add(m(new THREE.BoxGeometry(0.2, 0.22, 0.03), std(0x4a2414, 0.5), 0, 0.06 + 0.11, D / 2 + 0.012));
  for (const sx of [-1, 1]) {
    const pep = m(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 }), sx * 0.25, 0.06 + 0.28, D / 2 + 0.012);
    g.add(pep);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const wedge = m(new THREE.CylinderGeometry(0.065, 0.065, 0.022, 4, 1, false, a, Math.PI / 6).rotateX(Math.PI / 2), std(0xd21f3c, 0.3), sx * 0.25, 0.06 + 0.28, D / 2 + 0.013);
      g.add(wedge);
    }
    const cane = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.32, 0), new THREE.Vector3(0.04, 0.38, 0), new THREE.Vector3(0.09, 0.35, 0)]);
    const cm = m(new THREE.TubeGeometry(cane, 20, 0.018, 8), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1 }));
    cm.position.set(sx * 0.16, 0, D / 2 + 0.1);
    cm.rotation.y = sx > 0 ? Math.PI : 0;
    g.add(cm);
    for (let k = 0; k < 6; k++) g.add(m(new THREE.TorusGeometry(0.019, 0.006, 6, 12).rotateX(Math.PI / 2), std(0xd21f3c, 0.3), sx * 0.16, 0.03 + k * 0.05, D / 2 + 0.1));
  }
  const ls = lightString(
    Array.from({ length: 9 }, (_, i) => new THREE.Vector3(-W / 2 - 0.06 + ((W + 0.12) * i) / 8, 0.06 + H - 0.02 - 0.03 * Math.sin((i / 8) * Math.PI), D / 2 + 0.11)),
    BULBS,
  );
  g.add(ls.group);
  updates.push(ls.update);
  return { group: g, update: (t, r) => updates.forEach((u) => u(t, r)) };
}

function igloo(wallHex: number): Built {
  const g = new THREE.Group();
  const updates: ((t: number, r: boolean) => void)[] = [];
  // ก้อนน้ำแข็ง: ลายอิฐบนผิวโดม
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d");
  if (x) {
    x.fillStyle = "#f4fbff";
    x.fillRect(0, 0, 256, 128);
    x.strokeStyle = "rgba(120,170,200,0.55)";
    x.lineWidth = 2;
    for (let r = 0; r < 8; r++) {
      x.beginPath();
      x.moveTo(0, r * 16);
      x.lineTo(256, r * 16);
      x.stroke();
      for (let k = 0; k < 8; k++) {
        const bx = k * 32 + (r % 2) * 16;
        x.beginPath();
        x.moveTo(bx, r * 16);
        x.lineTo(bx, r * 16 + 16);
        x.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ice = new THREE.MeshPhysicalMaterial({ map: tex, color: new THREE.Color(0xffffff).lerp(new THREE.Color(wallHex), 0.18), roughness: 0.25, clearcoat: 0.8 });
  g.add(m(new THREE.SphereGeometry(0.46, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), ice, 0, 0, -0.05));
  const tunnel = m(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 24, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), ice, 0, 0, 0.36);
  (tunnel.material as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
  g.add(tunnel);
  g.add(m(new THREE.CircleGeometry(0.15, 20, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xff9a3c, emissiveIntensity: 1.4 }), 0, 0.005, 0.25));
  // แสงอุ่นลอดออกจากช่องหน้าต่างน้ำแข็ง
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 1 });
  for (const a of [-0.9, 0.9]) {
    const win = m(new THREE.CircleGeometry(0.045, 16), glow, Math.sin(a) * 0.42, 0.2, Math.cos(a) * 0.42 - 0.05);
    win.lookAt(Math.sin(a) * 2, 0.2, Math.cos(a) * 2 - 0.05);
    g.add(win);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const lump = m(new THREE.SphereGeometry(0.1, 12, 8), snowMat(), Math.cos(a) * 0.48, 0.02, Math.sin(a) * 0.45 - 0.05);
    lump.scale.set(1.4, 0.45, 1);
    g.add(lump);
  }
  const ls = lightString(
    Array.from({ length: 11 }, (_, i) => {
      const a = -Math.PI * 0.8 + (Math.PI * 1.6 * i) / 10;
      return new THREE.Vector3(Math.sin(a) * 0.43, 0.2 + 0.02 * Math.sin(i), Math.cos(a) * 0.43 - 0.05);
    }),
    BULBS,
  );
  g.add(ls.group);
  updates.push(ls.update);
  return { group: g, update: (t, r) => updates.forEach((u) => u(t, r)) };
}

export function buildHouse(style: string | undefined, wall: string | undefined, roof: string | undefined): Built | null {
  const wallHex = col(wall, "cream");
  const roofHex = col(roof, "red");
  if (style === "cottage") return cottage(wallHex, roofHex);
  if (style === "cabin") return cabin(wallHex, roofHex);
  if (style === "gingerbread") return gingerbread(wallHex, roofHex);
  if (style === "igloo") return igloo(wallHex);
  return null;
}

// รั้วรอบขอบฐาน เว้นทางเข้าด้านหน้า
export function buildFence(kind: string | undefined): Built | null {
  if (!kind || kind === "none") return null;
  const g = new THREE.Group();
  const updates: ((t: number, r: boolean) => void)[] = [];
  const R = BASE_R - 0.07;
  const gap = 0.42; // ครึ่งมุมของทางเข้าด้านหน้า (เรเดียน)
  const n = 26;
  const angles: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = Math.PI / 2 + gap + ((Math.PI * 2 - gap * 2) * k) / (n - 1);
    angles.push(a);
  }
  const at = (a: number) => new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
  if (kind === "candy") {
    const white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1 });
    const red = std(0xd21f3c, 0.3);
    angles.forEach((a, k) => {
      if (k % 2) return;
      const p = at(a);
      g.add(m(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 8), white, p.x, 0.09, p.z));
      for (let j = 0; j < 4; j++) g.add(m(new THREE.TorusGeometry(0.015, 0.005, 6, 10).rotateX(Math.PI / 2), red, p.x, 0.03 + j * 0.045, p.z));
      const hook = m(new THREE.TorusGeometry(0.03, 0.013, 6, 12, Math.PI), k % 4 ? red : white, p.x, 0.18, p.z);
      hook.rotation.y = -a;
      g.add(hook);
    });
  } else if (kind === "picket") {
    const white = std(0xfaf7f0, 0.5);
    angles.forEach((a) => {
      const p = at(a);
      const post = m(new THREE.BoxGeometry(0.035, 0.16, 0.015), white, p.x, 0.08, p.z);
      post.rotation.y = -a + Math.PI / 2;
      g.add(post);
      const tip = m(new THREE.ConeGeometry(0.025, 0.04, 4), white, p.x, 0.18, p.z);
      tip.rotation.y = -a + Math.PI / 4;
      g.add(tip);
    });
    for (const y of [0.05, 0.12]) {
      const pts = angles.map((a) => at(a).setY(y));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.008, 4), white));
    }
    const snowTop = angles.map((a) => at(a).setY(0.165));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(snowTop), 80, 0.012, 5), snowMat()));
  } else if (kind === "lights") {
    const black = std(0x1d2420, 0.4, 0.6);
    const posts = angles.filter((_, k) => k % 5 === 0);
    posts.forEach((a) => {
      const p = at(a);
      g.add(m(new THREE.CylinderGeometry(0.01, 0.014, 0.26, 8), black, p.x, 0.13, p.z));
      g.add(m(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 1.3 }), p.x, 0.27, p.z));
    });
    for (let k = 0; k < posts.length - 1; k++) {
      const a0 = posts[k];
      const a1 = posts[k + 1];
      const pts = Array.from({ length: 7 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / 6;
        return at(a).setY(0.24 - 0.06 * Math.sin((i / 6) * Math.PI));
      });
      const ls = lightString(pts, BULBS);
      g.add(ls.group);
      updates.push(ls.update);
    }
  } else if (kind === "hedge") {
    const leaf = std(0x1b5a35, 0.85);
    angles.forEach((a, k) => {
      const p = at(a);
      const b = m(new THREE.IcosahedronGeometry(0.075, 1), leaf, p.x, 0.06, p.z);
      b.scale.set(1.1, 0.8 + (k % 3) * 0.1, 1.1);
      g.add(b);
      const cap = m(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snowMat(), p.x, 0.1, p.z);
      cap.scale.set(1.1, 0.4, 1.1);
      g.add(cap);
      if (k % 3 === 0) g.add(m(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0xff4d5e, emissiveIntensity: 0.8 }), p.x, 0.11, p.z + 0.04));
    });
  }
  return { group: g, update: (t, r) => updates.forEach((u) => u(t, r)) };
}
