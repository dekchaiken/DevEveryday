// โมเดลตุ๊กตาหิมะ 3 มิติชุดเดียว ใช้ทั้งในฉาก หน้าตกแต่ง และรูปตัวอย่างของแต่ละตัวเลือก
// จุดกำเนิดอยู่ที่พื้นใต้ฐาน หันหน้าไปทาง +z สูงราว 1.8–2.1 หน่วย (ฉากย่อด้วย DECOR_SCALE)
import * as THREE from "three";
import { withDefaults, type SnowParts } from "@/lib/christmas/snowman";

// ---------- สีและเท็กซ์เจอร์ ----------
const BODY_HEX: Record<string, number> = { white: 0xffffff, pearl: 0xfff6e6, ice: 0xe2f6ff, mint: 0xdcf7ea, sky: 0xdcecff, blush: 0xffe6f0 };
const COLOR_HEX: Record<string, number> = {
  red: 0xc81e3a,
  green: 0x1f7a4d,
  navy: 0x1e3a6e,
  gold: 0xe0b44c,
  white: 0xf6f3ee,
  pink: 0xf178a8,
  purple: 0x7c4ddb,
  black: 0x24242c,
  blue: 0x2f6fd6,
};
const HAT_AUTO: Record<string, string> = { top: "black", santa: "red", beanie: "red", pom: "navy", elf: "green", crown: "gold", beret: "red", earmuff: "pink", bow: "red" };

const texCache = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  texCache.set(key, t);
  return t;
}
const hexCss = (h: number) => `#${h.toString(16).padStart(6, "0")}`;
// หิมะ: จุดนูนละเอียดใช้เป็น bump ให้ผิวดูเป็นเกล็ดหิมะจริง
function snowBump() {
  const t = canvasTex(
    "snow-bump",
    128,
    128,
    (g) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) {
        const v = 100 + Math.floor(Math.random() * 110);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.beginPath();
        g.arc(Math.random() * 128, Math.random() * 128, 0.6 + Math.random() * 1.6, 0, Math.PI * 2);
        g.fill();
      }
    },
    [3, 2],
  );
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
// ลายผ้าถัก: เส้นถักแนวตั้ง + ลายตามแบบ (แถบ สก็อต แคนดี้ นอร์ดิก)
function knitTex(pattern: string) {
  return canvasTex(
    `knit-${pattern}`,
    128,
    128,
    (g) => {
      const base = COLOR_HEX[pattern] ?? (pattern === "plaid" ? 0xb3172f : pattern === "candy" ? 0xffffff : pattern === "fairisle" ? 0xb3172f : 0xc81e3a);
      g.fillStyle = hexCss(base);
      g.fillRect(0, 0, 128, 128);
      if (pattern === "plaid") {
        g.fillStyle = "rgba(20,60,40,0.55)";
        g.fillRect(0, 40, 128, 26);
        g.fillRect(40, 0, 26, 128);
        g.fillStyle = "rgba(255,215,106,0.7)";
        g.fillRect(0, 100, 128, 5);
        g.fillRect(100, 0, 5, 128);
      } else if (pattern === "candy") {
        g.fillStyle = "#d21f3c";
        for (let i = -128; i < 256; i += 32) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i + 16, 0);
          g.lineTo(i + 16 + 128, 128);
          g.lineTo(i + 128, 128);
          g.closePath();
          g.fill();
        }
      } else if (pattern === "fairisle") {
        g.fillStyle = "#f6f1e7";
        g.fillRect(0, 18, 128, 6);
        g.fillRect(0, 104, 128, 6);
        for (let x = 0; x < 128; x += 16) {
          // เกล็ดหิมะเล็กแบบลายถักนอร์ดิก
          g.fillRect(x + 6, 50, 4, 28);
          g.fillRect(x + 1, 62, 14, 4);
          g.fillRect(x + 3, 54, 3, 3);
          g.fillRect(x + 10, 54, 3, 3);
          g.fillRect(x + 3, 71, 3, 3);
          g.fillRect(x + 10, 71, 3, 3);
        }
        g.fillStyle = "#1f7a4d";
        for (let x = 0; x < 128; x += 8) g.fillRect(x, 32, 4, 4), g.fillRect(x + 4, 92, 4, 4);
      } else {
        // แถบสีอ่อนสลับ ให้ผ้าสีพื้นดูมีลาย
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(0, 54, 128, 10);
        g.fillRect(0, 70, 128, 4);
      }
      // ลายถักไหมพรม: ตัว V เล็กเรียงเป็นแถว
      g.strokeStyle = "rgba(0,0,0,0.18)";
      g.lineWidth = 1.2;
      for (let y = 0; y < 128; y += 8) {
        for (let x = 0; x < 128; x += 8) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + 4, y + 6);
          g.lineTo(x + 8, y);
          g.stroke();
        }
      }
    },
    [3, 1],
  );
}
function blushTex(hex: number) {
  return canvasTex(`blush-${hex}`, 64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const c = new THREE.Color(hex);
    grd.addColorStop(0, `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.85)`);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}
function peppermintTex() {
  return canvasTex("peppermint", 64, 64, (g) => {
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(32, 32, 32, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#d21f3c";
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(32, 32);
      g.arc(32, 32, 31, a, a + Math.PI / 6);
      g.closePath();
      g.fill();
    }
  });
}

const std = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
};
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

// ถ่านก้อนเล็ก รูปร่างไม่เรียบ (ใช้เป็นตา ปาก กระดุม)
function coal(r: number) {
  const geo = new THREE.DodecahedronGeometry(r, 0);
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.85 + ((i * 37) % 10) / 33), p.getY(i) * (0.85 + ((i * 53) % 10) / 33), p.getZ(i) * 0.75);
  geo.computeVertexNormals();
  return mesh(geo, std(0x16161b, 0.85));
}
function starShape(outer: number, inner: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
function heartShape(k: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.035 * k);
  s.bezierCurveTo(-0.01 * k, -0.012 * k, -0.035 * k, 0, -0.035 * k, 0.02 * k);
  s.bezierCurveTo(-0.035 * k, 0.045 * k, -0.012 * k, 0.05 * k, 0, 0.03 * k);
  s.bezierCurveTo(0.012 * k, 0.05 * k, 0.035 * k, 0.045 * k, 0.035 * k, 0.02 * k);
  s.bezierCurveTo(0.035 * k, 0, 0.01 * k, -0.012 * k, 0, -0.035 * k);
  return s;
}
function bellGeo(s: number) {
  return new THREE.LatheGeometry(
    [new THREE.Vector2(0, 0.06 * s), new THREE.Vector2(0.02 * s, 0.058 * s), new THREE.Vector2(0.035 * s, 0.04 * s), new THREE.Vector2(0.05 * s, 0.005 * s), new THREE.Vector2(0.058 * s, -0.01 * s), new THREE.Vector2(0, -0.01 * s)],
    16,
  );
}
function bow(color: number, s: number) {
  const g = new THREE.Group();
  const m = std(color, 0.45);
  for (const side of [-1, 1]) {
    // ห่วงโบว์ทรงหยดน้ำ (ทรงกลมบีบแบน แคบเข้าหาปม)
    const loopGeo = new THREE.SphereGeometry(0.045 * s, 16, 12);
    const lp = loopGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i);
      const k = 0.55 + 0.45 * ((x / (0.045 * s) + 1) / 2);
      lp.setY(i, lp.getY(i) * k);
      lp.setZ(i, lp.getZ(i) * k * 0.55);
    }
    loopGeo.computeVertexNormals();
    loopGeo.translate(0.04 * s, 0, 0);
    const loop = mesh(loopGeo, m);
    loop.scale.x = side;
    loop.rotation.z = side * 0.25;
    g.add(at(loop, side * 0.012 * s, 0, 0));
    const tail = mesh(new THREE.BoxGeometry(0.025 * s, 0.07 * s, 0.01 * s), m);
    tail.rotation.z = side * 0.4;
    g.add(at(tail, side * 0.025 * s, -0.05 * s, 0));
  }
  g.add(mesh(new THREE.SphereGeometry(0.02 * s, 10, 8), m));
  return g;
}

// ---------- ทรงตัว ----------
type Ball = { r: number; y: number };
const SHAPES: Record<string, Ball[]> = {
  classic: [
    { r: 0.38, y: 0.36 },
    { r: 0.29, y: 0.92 },
    { r: 0.215, y: 1.36 },
  ],
  chubby: [
    { r: 0.45, y: 0.43 },
    { r: 0.29, y: 1.1 },
  ],
  tall: [
    { r: 0.31, y: 0.3 },
    { r: 0.25, y: 0.8 },
    { r: 0.2, y: 1.2 },
  ],
};

export type SnowmanAnchors = { headY: number; headR: number; top: number };

export function buildSnowman(input: Partial<Record<string, unknown>>, opts: { contact?: boolean } = {}): THREE.Group & { userData: { anchors: SnowmanAnchors } } {
  const p: SnowParts = withDefaults(input);
  // ข้อมูลรุ่นแรก "แขนถือของขวัญ" = แขนกิ่งไม้ + ถือกล่องของขวัญ
  if (p.arms === "gift") {
    p.arms = "sticks";
    if (p.hold === "none") p.hold = "gift";
  }
  const root = new THREE.Group() as THREE.Group & { userData: { anchors: SnowmanAnchors } };
  const fig = new THREE.Group();
  root.add(fig);
  const lift = p.legs === "gift" ? 0.3 : p.legs === "sled" ? 0.2 : p.legs === "skates" ? 0.12 : p.legs === "boots" ? 0.05 : 0;
  fig.position.y = lift;

  const balls = SHAPES[p.shape] ?? SHAPES.classic;
  const head = balls[balls.length - 1];
  const chest = balls[balls.length - 2];
  const stretch = p.shape === "tall" ? 1.08 : 0.95;
  const snow = new THREE.MeshPhysicalMaterial({
    color: BODY_HEX[p.body] ?? 0xffffff,
    roughness: 0.62,
    bumpMap: snowBump(),
    bumpScale: 0.6,
    sheen: 0.6,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0xdcecff),
  });
  balls.forEach((b, i) => {
    const s = mesh(new THREE.SphereGeometry(b.r, 40, 28), snow);
    s.scale.set(1, i === balls.length - 1 ? 1 : stretch, 1);
    fig.add(at(s, 0, b.y, 0));
  });
  // ผิวหน้าที่มีชิ้นส่วนแปะ: จุดบนผิวทรงกลมของหัว (มุมซ้าย/ขวา th และมุมบน/ล่าง ph)
  const onHead = (th: number, ph: number, out = 0) =>
    new THREE.Vector3(Math.sin(th) * Math.cos(ph) * (head.r + out), head.y + Math.sin(ph) * (head.r + out), Math.cos(th) * Math.cos(ph) * (head.r + out));
  const faceTo = (o: THREE.Object3D, pos: THREE.Vector3) => {
    o.position.copy(pos);
    o.lookAt(pos.clone().sub(new THREE.Vector3(0, head.y, 0)).multiplyScalar(2).add(new THREE.Vector3(0, head.y, 0)));
    return o;
  };
  const onChest = (th: number, y: number, out = 0) => {
    const dy = y - chest.y;
    const rr = Math.sqrt(Math.max(chest.r * chest.r - (dy / stretch) * (dy / stretch), 0.0001)) + out;
    return new THREE.Vector3(Math.sin(th) * rr, y, Math.cos(th) * rr);
  };
  const black = std(0x16161b, 0.5);

  // ---------- ดวงตา ----------
  const eyePh = 0.2;
  const eyeTh = 0.33;
  const arcEye = (side: number, up: boolean) => {
    const a = mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 16, Math.PI), black);
    if (!up) a.rotation.z = Math.PI;
    const g = new THREE.Group();
    g.add(a);
    return faceTo(g, onHead(side * eyeTh, eyePh, 0.002));
  };
  for (const side of [-1, 1]) {
    if (p.eyes === "happy" || (p.eyes === "wink" && side > 0)) fig.add(arcEye(side, true));
    else if (p.eyes === "sleepy") fig.add(arcEye(side, false));
    else if (p.eyes === "sparkle") {
      const g = new THREE.Group();
      const ball = mesh(new THREE.SphereGeometry(0.036, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0x0d0d14, roughness: 0.15, clearcoat: 1 }));
      ball.scale.z = 0.55;
      g.add(ball);
      g.add(at(mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })), 0.012, 0.013, 0.02));
      g.add(at(mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })), -0.01, -0.01, 0.02));
      fig.add(faceTo(g, onHead(side * eyeTh, eyePh, 0.004)));
    } else fig.add(faceTo(coal(0.03), onHead(side * eyeTh, eyePh, 0.006)));
  }

  // ---------- ปาก ----------
  const mouthPh = -0.32;
  if (p.mouth === "coal") {
    for (let k = 0; k < 5; k++) {
      const t = (k - 2) / 2;
      fig.add(faceTo(coal(0.016), onHead(t * 0.34, mouthPh + 0.07 * t * t - 0.02, 0.004)));
    }
  } else if (p.mouth === "smile" || p.mouth === "tongue") {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = (k - 6) / 6;
      pts.push(onHead(t * 0.36, mouthPh + 0.09 * t * t - 0.03, 0.006));
    }
    fig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 6, false), black));
    if (p.mouth === "tongue") {
      const tg = mesh(new THREE.SphereGeometry(0.03, 12, 8), std(0xf27a8f, 0.5));
      tg.scale.set(1, 0.7, 0.45);
      fig.add(faceTo(tg, onHead(0.08, mouthPh - 0.09, 0.004)));
    }
  } else if (p.mouth === "open") {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.055, Math.PI, Math.PI * 2, false);
    s.lineTo(-0.055, 0);
    const m = mesh(new THREE.ShapeGeometry(s, 16), new THREE.MeshStandardMaterial({ color: 0x4a1218, roughness: 0.7, side: THREE.DoubleSide }));
    const g = new THREE.Group();
    g.add(m);
    const tongue = mesh(new THREE.CircleGeometry(0.025, 16, Math.PI, Math.PI), std(0xf27a8f, 0.6));
    g.add(at(tongue, 0, -0.03, 0.001));
    fig.add(faceTo(g, onHead(0, mouthPh + 0.01, 0.005)));
  } else if (p.mouth === "o") {
    fig.add(faceTo(mesh(new THREE.TorusGeometry(0.022, 0.009, 8, 18), std(0x2a1216, 0.6)), onHead(0, mouthPh, 0.004)));
  }

  // ---------- จมูก ----------
  const nosePos = onHead(0, 0, 0);
  if (p.nose === "carrot") {
    const geo = new THREE.ConeGeometry(0.042, 0.22, 12, 6);
    const ps = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < ps.count; i++) {
      const y = ps.getY(i);
      const t = (0.11 - y) / 0.22; // 0 ปลาย → 1 โคน
      const ridge = 1 + 0.08 * Math.sin(y * 120);
      ps.setX(i, ps.getX(i) * ridge);
      ps.setZ(i, ps.getZ(i) * ridge + (1 - t) * (1 - t) * 0.025); // ปลายงอลงนิด ๆ
    }
    geo.computeVertexNormals();
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0.1);
    const c = mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf07a1a, roughness: 0.55 }));
    c.rotation.x = 0.12;
    fig.add(at(c, 0, nosePos.y - 0.01, head.r - 0.02));
  } else if (p.nose === "button" || p.nose === "berry") {
    const b = mesh(new THREE.SphereGeometry(p.nose === "berry" ? 0.035 : 0.04, 16, 12), new THREE.MeshPhysicalMaterial({ color: p.nose === "berry" ? 0xb3122e : 0xd62a3a, roughness: 0.25, clearcoat: 0.8 }));
    if (p.nose === "button") b.scale.z = 0.6;
    fig.add(at(b, 0, nosePos.y, head.r + 0.01));
    if (p.nose === "berry") {
      const leaf = mesh(new THREE.ConeGeometry(0.012, 0.04, 6), std(0x1f7a4d, 0.6));
      leaf.rotation.z = -0.9;
      fig.add(at(leaf, 0.025, nosePos.y + 0.03, head.r + 0.015));
    }
  } else if (p.nose === "star") {
    const geo = new THREE.ExtrudeGeometry(starShape(0.05, 0.022), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
    fig.add(at(mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffcf4a, metalness: 0.6, roughness: 0.25, emissive: 0x7a5200, emissiveIntensity: 0.3 })), 0, nosePos.y, head.r - 0.005));
  } else if (p.nose === "heart") {
    const geo = new THREE.ExtrudeGeometry(heartShape(1.3), { depth: 0.018, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 12 });
    fig.add(at(mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xe11d48, roughness: 0.3, clearcoat: 0.8 })), 0, nosePos.y - 0.005, head.r - 0.005));
  } else if (p.nose === "bell") {
    const b = mesh(bellGeo(0.75), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }));
    b.rotation.x = Math.PI / 2;
    fig.add(at(b, 0, nosePos.y, head.r + 0.01));
  }

  // ---------- แก้มแดง ----------
  if (p.cheeks !== "none") {
    const m = new THREE.MeshBasicMaterial({ map: blushTex(p.cheeks === "peach" ? 0xffa079 : 0xff7aa2), transparent: true, depthWrite: false });
    for (const side of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), m);
      fig.add(faceTo(d, onHead(side * 0.52, -0.08, 0.003)));
    }
  }

  // ---------- หมวก ----------
  const hatHex = COLOR_HEX[p.hatColor === "auto" ? (HAT_AUTO[p.hat] ?? "red") : p.hatColor] ?? 0xc81e3a;
  const topY = head.y + head.r * 0.78;
  const fur = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.8 });
  const bentCone = (r: number, h: number, bend: number, mat: THREE.Material) => {
    const geo = new THREE.ConeGeometry(r, h, 28, 10, true);
    const ps = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < ps.count; i++) {
      const t = (ps.getY(i) + h / 2) / h; // 0 ฐาน → 1 ปลาย
      ps.setX(i, ps.getX(i) + bend * t * t);
      ps.setY(i, ps.getY(i) - Math.abs(bend) * t * t * 0.5);
    }
    geo.computeVertexNormals();
    geo.translate(0, h / 2, 0);
    return mesh(geo, mat);
  };
  if (p.hat === "top") {
    const m = std(hatHex, 0.4);
    fig.add(at(mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 32), m), 0, topY + 0.17, 0));
    fig.add(at(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 32), m), 0, topY + 0.32, 0));
    fig.add(at(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.025, 40), m), 0, topY + 0.02, 0));
    fig.add(at(mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.055, 32), std(hatHex === COLOR_HEX.red ? 0x1f7a4d : 0xc81e3a, 0.5)), 0, topY + 0.07, 0));
    const holly = new THREE.Group();
    for (const s of [-1, 1]) {
      const leaf = mesh(new THREE.SphereGeometry(0.03, 10, 6), std(0x1f7a4d, 0.5));
      leaf.scale.set(1.6, 0.5, 0.4);
      leaf.rotation.z = s * 0.5;
      holly.add(at(leaf, s * 0.03, 0, 0));
    }
    holly.add(at(mesh(new THREE.SphereGeometry(0.015, 8, 6), std(0xc81e3a, 0.3)), 0, 0.005, 0.01));
    fig.add(at(holly, 0.1, topY + 0.08, 0.11));
  } else if (p.hat === "santa" || p.hat === "elf") {
    const m = new THREE.MeshPhysicalMaterial({ color: hatHex, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) });
    const cone = bentCone(0.2, p.hat === "elf" ? 0.5 : 0.42, p.hat === "elf" ? 0.12 : 0.2, m);
    fig.add(at(cone, 0, topY - 0.02, 0));
    const trim = mesh(new THREE.TorusGeometry(0.2, p.hat === "elf" ? 0.03 : 0.05, 12, 32), p.hat === "elf" ? std(0xc81e3a, 0.6) : fur);
    trim.rotation.x = Math.PI / 2;
    fig.add(at(trim, 0, topY, 0));
    const tipX = p.hat === "elf" ? 0.12 : 0.2;
    const tipY = topY - 0.02 + (p.hat === "elf" ? 0.5 - 0.06 : 0.42 - 0.1);
    if (p.hat === "santa") fig.add(at(mesh(new THREE.SphereGeometry(0.06, 16, 12), fur), tipX, tipY, 0));
    else fig.add(at(mesh(bellGeo(0.7), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide })), tipX, tipY - 0.02, 0));
  } else if (p.hat === "beanie" || p.hat === "pom") {
    // ผ้าถักลายเดียวกับผ้าพันคอ ตามสีหมวกที่เลือก
    const m = new THREE.MeshStandardMaterial({ map: knitTex(p.hatColor === "auto" ? HAT_AUTO[p.hat] : p.hatColor), roughness: 0.95 });
    // หมวกคลุมแค่ครึ่งบนของหัว ขอบพับอยู่เหนือดวงตา
    const cap = mesh(new THREE.SphereGeometry(head.r * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), m);
    fig.add(at(cap, 0, head.y + 0.005, 0));
    const cuffR = head.r * 1.0;
    const cuff = mesh(new THREE.TorusGeometry(cuffR, 0.032, 10, 36), new THREE.MeshStandardMaterial({ map: p.hat === "pom" ? knitTex("white") : knitTex(p.hatColor === "auto" ? HAT_AUTO[p.hat] : p.hatColor), roughness: 0.95 }));
    cuff.rotation.x = Math.PI / 2;
    cuff.scale.set(1, 1, 1.4);
    fig.add(at(cuff, 0, head.y + head.r * 0.46, 0));
    if (p.hat === "pom") {
      const pom = mesh(new THREE.IcosahedronGeometry(0.075, 2), fur);
      fig.add(at(pom, 0, head.y + head.r * 1.12, 0));
    }
  } else if (p.hat === "crown") {
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.22 });
    const ring = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 32, 1, true), gold);
    (ring.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    fig.add(at(ring, 0, topY + 0.04, 0));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.03, 0.09, 4), gold);
      fig.add(at(spike, Math.sin(a) * 0.145, topY + 0.12, Math.cos(a) * 0.145));
      fig.add(at(mesh(new THREE.SphereGeometry(0.014, 8, 6), gold), Math.sin(a) * 0.145, topY + 0.17, Math.cos(a) * 0.145));
    }
    const gems = [0xc81e3a, 0x2f6fd6, 0x1f9a5a];
    for (let k = 0; k < 3; k++) {
      const a = (k - 1) * 0.6;
      fig.add(at(mesh(new THREE.OctahedronGeometry(0.022), new THREE.MeshPhysicalMaterial({ color: gems[k], roughness: 0.05, clearcoat: 1 })), Math.sin(a) * 0.152, topY + 0.04, Math.cos(a) * 0.152));
    }
  } else if (p.hat === "antlers") {
    const bark = std(0x8a5a32, 0.7);
    fig.add(at(mesh(new THREE.TorusGeometry(head.r * 1.02, 0.014, 6, 24, Math.PI), std(0x6b3a22, 0.5)), 0, head.y + 0.02, 0));
    for (const s of [-1, 1]) {
      const pts = [new THREE.Vector3(s * 0.12, topY - 0.02, 0), new THREE.Vector3(s * 0.16, topY + 0.12, 0), new THREE.Vector3(s * 0.2, topY + 0.24, -0.02)];
      fig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 6), bark));
      for (const [t, len] of [
        [0.45, 0.08],
        [0.75, 0.06],
      ]) {
        const base = new THREE.CatmullRomCurve3(pts).getPoint(t);
        fig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, base.clone().add(new THREE.Vector3(s * -0.03, len, 0.02))]), 4, 0.012, 6), bark));
      }
      const ear = mesh(new THREE.SphereGeometry(0.045, 12, 8), std(0x8a5a32, 0.8));
      ear.scale.set(1, 0.5, 0.35);
      ear.rotation.z = s * 0.7;
      fig.add(at(ear, s * 0.2, head.y + 0.08, 0));
    }
  } else if (p.hat === "holly") {
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.03, 0.03, 0, 0.09);
    leafShape.quadraticCurveTo(-0.03, 0.03, 0, 0);
    const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.006, bevelEnabled: false });
    const leafMat = new THREE.MeshPhysicalMaterial({ color: 0x1b6b3f, roughness: 0.35, clearcoat: 0.6 });
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const l = mesh(leafGeo, leafMat);
      l.rotation.z = (k - 2) * 0.55;
      g.add(l);
    }
    for (let k = 0; k < 3; k++) g.add(at(mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.2, clearcoat: 1 })), (k - 1) * 0.025, 0.01, 0.015));
    g.rotation.z = -0.4;
    fig.add(faceTo(g, onHead(0.5, 0.75, 0)));
  } else if (p.hat === "beret") {
    const b = mesh(new THREE.SphereGeometry(0.21, 28, 14), new THREE.MeshStandardMaterial({ color: hatHex, roughness: 0.9 }));
    b.scale.set(1.05, 0.32, 1.05);
    b.rotation.z = 0.15;
    fig.add(at(b, 0.03, topY + 0.05, 0));
    fig.add(at(mesh(new THREE.SphereGeometry(0.02, 8, 6), std(hatHex, 0.8)), 0.06, topY + 0.115, 0));
  } else if (p.hat === "earmuff") {
    fig.add(at(mesh(new THREE.TorusGeometry(head.r * 1.05, 0.016, 8, 24, Math.PI), std(0x2a2a33, 0.4, 0.3)), 0, head.y + 0.01, 0));
    const cup = new THREE.MeshPhysicalMaterial({ color: hatHex, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xffffff) });
    for (const s of [-1, 1]) fig.add(at(mesh(new THREE.IcosahedronGeometry(0.07, 2), cup), s * head.r * 1.02, head.y + 0.01, 0));
  } else if (p.hat === "bow") {
    const b = bow(hatHex, 2.2);
    b.rotation.x = -0.4;
    fig.add(at(b, 0.04, topY + 0.04, 0.03));
  }

  // ---------- ผ้าพันคอ ----------
  const neckY = head.y - head.r * 0.86;
  const neckR = head.r * 0.88;
  const scarfMat = new THREE.MeshStandardMaterial({ map: knitTex(p.scarf), roughness: 0.95 });
  if (p.scarfStyle === "wrap" || p.scarfStyle === "long" || p.scarfStyle === "knot") {
    const wrap = mesh(new THREE.TorusGeometry(neckR, 0.058, 14, 40), scarfMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.scale.set(1, 1, 1.25);
    fig.add(at(wrap, 0, neckY, 0));
    const tailMat = new THREE.MeshStandardMaterial({ map: knitTex(p.scarf), roughness: 0.95, side: THREE.DoubleSide });
    // ชายผ้า: แผ่นผ้าที่ไล่ตามผิวลำตัวลงมา (คำนวณจุดบนผิวทุกแถว ไม่จมเข้าไปในหิมะ)
    const tail = (x: number, len: number, swing: number, side: number) => {
      const rows = 12;
      const geo = new THREE.PlaneGeometry(0.1, len, 1, rows);
      const ps = geo.getAttribute("position") as THREE.BufferAttribute;
      const surfZ = (px: number, py: number) => {
        let best = 0;
        for (const b of balls) {
          const dy = (py - b.y) / (b === head ? 1 : stretch);
          const r2 = b.r * b.r - dy * dy - px * px;
          if (r2 > 0) best = Math.max(best, Math.sqrt(r2));
        }
        return best;
      };
      for (let i = 0; i < ps.count; i++) {
        const t = (len / 2 - ps.getY(i)) / len; // 0 บน → 1 ปลาย
        const px = x + ps.getX(i) + Math.sin(t * 2.2) * swing;
        const py = neckY - 0.03 - t * len;
        const pz = Math.max(surfZ(px, py), neckR * 0.9) + 0.03 + t * 0.02;
        ps.setXYZ(i, px, py, pz * side);
      }
      geo.computeVertexNormals();
      fig.add(mesh(geo, tailMat));
      // พู่ปลายผ้า
      const endX = x + Math.sin(2.2) * swing;
      const endY = neckY - 0.03 - len;
      const endZ = (Math.max(surfZ(endX, endY), neckR * 0.9) + 0.05) * side;
      for (let k = 0; k < 5; k++) fig.add(at(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 4), scarfMat), endX + (k - 2) * 0.02, endY - 0.018, endZ));
    };
    if (p.scarfStyle === "wrap") tail(0.09, 0.26, -0.03, 1);
    if (p.scarfStyle === "long") {
      tail(0.09, 0.44, -0.04, 1);
      tail(-0.07, 0.34, 0.04, 1);
    }
    if (p.scarfStyle === "knot") {
      fig.add(at(mesh(new THREE.SphereGeometry(0.06, 14, 10), scarfMat), neckR * 0.72, neckY - 0.02, neckR * 0.85));
      tail(neckR * 0.7, 0.24, -0.05, 1);
      tail(neckR * 0.9, 0.18, 0.03, 1);
    }
  } else if (p.scarfStyle === "bowtie") {
    const b = bow(COLOR_HEX[p.scarf] ?? 0xc81e3a, 1.4);
    fig.add(at(b, 0, neckY, neckR + 0.04));
  } else if (p.scarfStyle === "cape") {
    const capeMat = new THREE.MeshStandardMaterial({ map: knitTex(p.scarf), roughness: 0.9, side: THREE.DoubleSide });
    const cape = mesh(new THREE.CylinderGeometry(neckR * 1.05, chest.r * 1.18, chest.r * 0.9, 40, 1, true, Math.PI * 0.2, Math.PI * 1.6), capeMat);
    cape.rotation.y = Math.PI;
    fig.add(at(cape, 0, neckY - chest.r * 0.38, 0));
    const trim = mesh(new THREE.TorusGeometry(neckR * 1.05, 0.035, 10, 32), fur);
    trim.rotation.x = Math.PI / 2;
    fig.add(at(trim, 0, neckY + 0.02, 0));
    fig.add(at(mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.25 })), 0, neckY, neckR * 1.08));
  }

  // ---------- กระดุม ----------
  if (p.buttons !== "none") {
    const ys = [0.35, 0, -0.35].map((t) => chest.y + t * chest.r * stretch);
    const ornCols = [0xc81e3a, 0xe0b44c, 0x2f6fd6];
    ys.forEach((y, k) => {
      const pos = onChest(0, y, 0.004);
      let b: THREE.Object3D;
      if (p.buttons === "coal") b = coal(0.03);
      else if (p.buttons === "gold") {
        b = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.014, 20), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.25 }));
        b.rotation.x = Math.PI / 2;
      } else if (p.buttons === "candy") {
        b = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.016, 24), [new THREE.MeshStandardMaterial({ color: 0xffffff }), new THREE.MeshPhysicalMaterial({ map: peppermintTex(), roughness: 0.2, clearcoat: 1 }), new THREE.MeshStandardMaterial({ color: 0xffffff })] as unknown as THREE.Material);
        b.rotation.x = Math.PI / 2;
      } else {
        const g = new THREE.Group();
        g.add(mesh(new THREE.SphereGeometry(0.034, 16, 12), new THREE.MeshPhysicalMaterial({ color: ornCols[k], roughness: 0.12, metalness: 0.4, clearcoat: 1 })));
        g.add(at(mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.014, 10), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.3 })), 0, 0.037, 0));
        b = g;
      }
      b.position.copy(pos);
      fig.add(b);
    });
  }

  // ---------- แขน และของในมือ ----------
  const armY = chest.y + chest.r * 0.25;
  const armX = chest.r * 0.9;
  const bark = std(0x5a3a22, 0.85);
  let hand: THREE.Vector3 | null = null;
  const stickArm = (side: number, raise: number) => {
    const start = new THREE.Vector3(side * armX, armY, 0);
    const mid = new THREE.Vector3(side * (armX + 0.14), armY + 0.1 + raise * 0.35, 0.04);
    const end = new THREE.Vector3(side * (armX + 0.27), armY + 0.17 + raise * 0.75, 0.07 + raise * 0.05);
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    fig.add(mesh(new THREE.TubeGeometry(curve, 12, 0.018, 6, false), bark));
    // กิ่งแยกเป็นนิ้ว
    const fork = curve.getPoint(0.75);
    fig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([fork, fork.clone().add(new THREE.Vector3(side * 0.05, 0.08, 0.02))]), 4, 0.011, 5), bark));
    fig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([end, end.clone().add(new THREE.Vector3(side * 0.04, 0.05, 0.02))]), 4, 0.008, 5), bark));
    fig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([end, end.clone().add(new THREE.Vector3(side * 0.06, -0.01, 0.01))]), 4, 0.008, 5), bark));
    return end;
  };
  if (p.arms === "sticks" || p.arms === "mittens" || p.arms === "wave") {
    const left = stickArm(-1, 0);
    const right = stickArm(1, p.arms === "wave" ? 0.55 : 0);
    hand = right;
    if (p.arms === "mittens") {
      const mit = new THREE.MeshStandardMaterial({ map: knitTex(p.scarf), roughness: 0.95 });
      for (const [h, s] of [
        [left, -1],
        [right, 1],
      ] as const) {
        const g = new THREE.Group();
        const palm = mesh(new THREE.SphereGeometry(0.05, 14, 10), mit);
        palm.scale.set(1, 1.2, 0.8);
        g.add(palm);
        const thumb = mesh(new THREE.SphereGeometry(0.022, 10, 8), mit);
        g.add(at(thumb, -s * 0.03, 0.02, 0.03));
        const cuff = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14), fur);
        g.add(at(cuff, 0, -0.055, 0));
        g.position.copy(h);
        g.rotation.z = -s * 0.6;
        fig.add(g);
      }
    }
  } else if (p.arms === "wings") {
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.15, 0.25, 0.4, 0.3, 0.45, 0.12);
    wingShape.bezierCurveTo(0.38, 0.12, 0.36, 0.06, 0.4, 0.02);
    wingShape.bezierCurveTo(0.3, 0.04, 0.3, -0.04, 0.33, -0.08);
    wingShape.bezierCurveTo(0.2, -0.04, 0.12, -0.1, 0, 0);
    const geo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    const wm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xffe9a8), emissive: 0x3a3020, emissiveIntensity: 0.2 });
    for (const s of [-1, 1]) {
      const w = mesh(geo, wm);
      w.scale.set(s, 1, 1);
      w.rotation.y = s * -0.5;
      fig.add(at(w, s * chest.r * 0.4, armY, -chest.r * 0.75));
    }
  }
  // ของในมือ: ถือที่มือขวา ถ้าไม่มีแขนจะวางแนบหน้าอก
  if (p.hold !== "none") {
    const item = new THREE.Group();
    const goldM = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.25 });
    if (p.hold === "candy") {
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.22, 0), new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0.03, 0.2, 0), new THREE.Vector3(0.09, 0.22, 0), new THREE.Vector3(0.12, 0.17, 0)]);
      item.add(mesh(new THREE.TubeGeometry(path, 40, 0.018, 10, false), new THREE.MeshPhysicalMaterial({ map: knitTex("candy"), roughness: 0.25, clearcoat: 1 })));
    } else if (p.hold === "lantern") {
      item.add(at(mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), std(0x2a2a33, 0.4, 0.5)), 0, 0.03, 0));
      item.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 8), std(0x2a2a33, 0.4, 0.5)), 0, 0.0, 0));
      item.add(at(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 1.4 })), 0, -0.06, 0));
      item.add(at(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.02, 8), std(0x2a2a33, 0.4, 0.5)), 0, -0.12, 0));
    } else if (p.hold === "gift") {
      item.add(at(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), new THREE.MeshPhysicalMaterial({ color: 0xc81e3a, roughness: 0.4, clearcoat: 0.5 })), 0, -0.04, 0));
      item.add(at(mesh(new THREE.BoxGeometry(0.165, 0.145, 0.03), goldM), 0, -0.04, 0));
      item.add(at(mesh(new THREE.BoxGeometry(0.03, 0.145, 0.165), goldM), 0, -0.04, 0));
      item.add(at(bow(0xe8b84a, 0.8), 0, 0.04, 0));
    } else if (p.hold === "wand") {
      item.add(at(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), std(0xf6f3ee, 0.4)), 0, -0.02, 0));
      item.add(at(mesh(new THREE.ExtrudeGeometry(starShape(0.06, 0.026), { depth: 0.015, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb000, emissiveIntensity: 0.9 })), 0, 0.15, -0.007));
    } else if (p.hold === "pine") {
      item.add(at(mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.05, 10), std(0x8a3b22, 0.7)), 0, -0.1, 0));
      for (let k = 0; k < 3; k++) item.add(at(mesh(new THREE.ConeGeometry(0.08 - k * 0.018, 0.1, 12), std(0x1b6b3f, 0.8)), 0, -0.04 + k * 0.06, 0));
      item.add(at(mesh(new THREE.OctahedronGeometry(0.018), goldM), 0, 0.16, 0));
    } else if (p.hold === "mug") {
      const cup = mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xc81e3a, roughness: 0.4, side: THREE.DoubleSide }));
      item.add(at(cup, 0, -0.04, 0));
      item.add(at(mesh(new THREE.CircleGeometry(0.042, 16).rotateX(-Math.PI / 2), std(0x5a2e1a, 0.4)), 0, -0.005, 0));
      item.add(at(mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 12), std(0xc81e3a, 0.4)), 0.05, -0.04, 0));
      for (const [x, z] of [
        [0.01, 0.01],
        [-0.015, -0.01],
      ])
        item.add(at(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), std(0xffffff, 0.8)), x, 0.005, z));
    }
    if (hand) item.position.copy(hand).add(new THREE.Vector3(0.03, 0.02, 0.04));
    else item.position.copy(onChest(0.6, chest.y - chest.r * 0.15, 0.06));
    fig.add(item);
  }

  // ---------- ของประดับ ----------
  const brooch = onChest(-0.55, chest.y + chest.r * 0.38, 0.01);
  if (p.acc === "glasses") {
    const wire = std(0x8a6a2a, 0.3, 0.8);
    for (const s of [-1, 1]) fig.add(faceTo(mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 24), wire), onHead(s * eyeTh, eyePh, 0.025)));
    const a = onHead(-0.12, eyePh + 0.02, 0.03);
    const b = onHead(0.12, eyePh + 0.02, 0.03);
    fig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, onHead(0, eyePh + 0.05, 0.035), b]), 6, 0.005, 5), wire));
  } else if (p.acc === "bow") {
    fig.add(at(bow(0xc81e3a, 1.3), 0, neckY - 0.08, neckR + 0.08));
  } else if (p.acc === "bell") {
    const bl = mesh(bellGeo(0.8), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
    fig.add(at(bl, 0, neckY - 0.09, neckR + 0.07));
  } else if (p.acc === "snowflake") {
    const ice = new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, roughness: 0.1, clearcoat: 1, emissive: 0x0c4a6e, emissiveIntensity: 0.3 });
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const bar = mesh(new THREE.BoxGeometry(0.11, 0.012, 0.012), ice);
      bar.rotation.z = (k * Math.PI) / 3;
      g.add(bar);
    }
    fig.add(faceTo(g, brooch));
  } else if (p.acc === "holly") {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const leaf = mesh(new THREE.SphereGeometry(0.03, 10, 6), new THREE.MeshPhysicalMaterial({ color: 0x1b6b3f, roughness: 0.3, clearcoat: 0.6 }));
      leaf.scale.set(1.7, 0.6, 0.35);
      leaf.rotation.z = s * 0.5;
      g.add(at(leaf, s * 0.035, 0, 0));
    }
    for (let k = 0; k < 3; k++) g.add(at(mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.2, clearcoat: 1 })), (k - 1) * 0.016, 0.012, 0.012));
    fig.add(faceTo(g, brooch));
  } else if (p.acc === "medal") {
    const g = new THREE.Group();
    g.add(at(mesh(new THREE.BoxGeometry(0.04, 0.06, 0.008), std(0x2f6fd6, 0.6)), 0, 0.04, 0));
    g.add(mesh(new THREE.ExtrudeGeometry(starShape(0.04, 0.018), { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.2 })));
    fig.add(faceTo(g, brooch));
  }

  // ---------- ฐาน ----------
  if (p.legs === "snow") {
    const drift = mesh(new THREE.SphereGeometry(0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), snow);
    drift.scale.set(1.15, 0.22, 1);
    root.add(drift);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const lump = mesh(new THREE.SphereGeometry(0.1, 12, 8), snow);
      lump.scale.set(1.3, 0.55, 1);
      root.add(at(lump, Math.cos(a) * 0.48, 0.02, Math.sin(a) * 0.42));
    }
  } else if (p.legs === "boots") {
    for (const s of [-1, 1]) {
      const boot = new THREE.Group();
      const m = new THREE.MeshPhysicalMaterial({ color: 0x5a3220, roughness: 0.4, clearcoat: 0.5 });
      const shaft = mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.12, 16), m);
      boot.add(at(shaft, 0, 0.08, 0));
      const toe = mesh(new THREE.SphereGeometry(0.085, 16, 10), m);
      toe.scale.set(0.95, 0.55, 1.4);
      boot.add(at(toe, 0, 0.04, 0.06));
      boot.add(at(mesh(new THREE.TorusGeometry(0.078, 0.022, 8, 18).rotateX(Math.PI / 2), fur), 0, 0.14, 0));
      root.add(at(boot, s * 0.14, 0, 0.18));
    }
  } else if (p.legs === "gift") {
    const box = new THREE.Group();
    box.add(at(mesh(new THREE.BoxGeometry(0.72, 0.3, 0.72), new THREE.MeshPhysicalMaterial({ color: 0x1f7a4d, roughness: 0.4, clearcoat: 0.5 })), 0, 0.15, 0));
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.8, roughness: 0.3 });
    box.add(at(mesh(new THREE.BoxGeometry(0.74, 0.305, 0.1), gold), 0, 0.15, 0));
    box.add(at(mesh(new THREE.BoxGeometry(0.1, 0.305, 0.74), gold), 0, 0.15, 0));
    const bw = bow(0xe8b84a, 1.6);
    box.add(at(bw, 0.24, 0.31, 0.3));
    root.add(box);
  } else if (p.legs === "sled") {
    const wood = new THREE.MeshStandardMaterial({ color: 0xa8643a, roughness: 0.6 });
    const red = new THREE.MeshPhysicalMaterial({ color: 0xc81e3a, roughness: 0.35, clearcoat: 0.6 });
    for (let k = -2; k <= 2; k++) root.add(at(mesh(new THREE.BoxGeometry(0.62, 0.025, 0.11), wood), 0, 0.17, k * 0.13));
    for (const s of [-1, 1]) {
      const pts = [new THREE.Vector3(s * 0.25, 0.02, -0.4), new THREE.Vector3(s * 0.25, 0.02, 0.32), new THREE.Vector3(s * 0.25, 0.12, 0.46), new THREE.Vector3(s * 0.25, 0.2, 0.4)];
      root.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 8), red));
      for (const z of [-0.25, 0.2]) root.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6), red), s * 0.25, 0.09, z));
    }
  } else if (p.legs === "skates") {
    for (const s of [-1, 1]) {
      const boot = new THREE.Group();
      const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.6 });
      boot.add(at(mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.11, 14), m), 0, 0.1, 0));
      const toe = mesh(new THREE.SphereGeometry(0.075, 14, 10), m);
      toe.scale.set(0.9, 0.5, 1.4);
      boot.add(at(toe, 0, 0.065, 0.05));
      boot.add(at(mesh(new THREE.BoxGeometry(0.012, 0.035, 0.26), std(0xc9d3dc, 0.15, 1)), 0, 0.015, 0.03));
      root.add(at(boot, s * 0.13, 0, 0.16));
    }
  }

  if (opts.contact !== false) {
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshBasicMaterial({ color: 0x0b2a1f, transparent: true, opacity: 0.18, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.006;
    root.add(contact);
  }
  const top = lift + head.y + head.r + (p.hat === "none" ? 0 : p.hat === "elf" ? 0.5 : p.hat === "top" ? 0.36 : 0.3);
  root.userData.anchors = { headY: lift + head.y, headR: head.r, top };
  return root;
}

// ปล่อยหน่วยความจำของโมเดล (เท็กซ์เจอร์ที่ใช้ร่วมกันไม่ถูกลบ)
export function disposeSnowman(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose?.();
  });
}
