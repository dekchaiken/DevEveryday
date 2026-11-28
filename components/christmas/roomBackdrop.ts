// ฉากหลังสามมิติของแต่ละห้อง (อยู่ไกลเลยแนวเขารอบลานออกไป): เมืองหลวง ดอยในหมอก ทุ่งนา ทะเล เมืองเก่า
// พร้อมแลนด์มาร์กของจังหวัดยอดนิยม เช่น วัดอรุณ พระธาตุดอยสุเทพ ประภาคารแหลมพรหมเทพ พระธาตุแก่นนคร
// ความลื่น: แต่ละฉากรวมชิ้นที่ไม่ขยับเป็นก้อนเดียว (วาดไม่กี่ครั้งต่อเฟรม) และไม่ใช้หมอก/แสงเงา (วัสดุแบบ Basic)
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Landmark, SceneKind } from "@/lib/christmas/rooms";

type Built = { group: THREE.Group; update: (t: number, reduced: boolean) => void; dispose: () => void };

// สุ่มแบบกำหนดผลได้ ทุกเครื่องเห็นฉากเดียวกัน
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const polar = (a: number, r: number) => new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
// มุมด้านหลังต้นไม้ (กล้องเริ่มต้นมองไปทาง -z)
const BACK = -Math.PI / 2;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTex() {
  return canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.7)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}
const basic = (opts: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ fog: false, ...opts });
// ไล่สีตามความสูง (ล่างสว่างจากไฟเมือง/แสงขอบฟ้า บนมืดกลืนกับฟ้า)
function paintHeight(geo: THREE.BufferGeometry, bottom: number, top: number, y0: number, y1: number) {
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const a = new THREE.Color(bottom);
  const b = new THREE.Color(top);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const k = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0)));
    c.copy(a).lerp(b, k);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}
function merge(list: THREE.BufferGeometry[]) {
  const norm = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "uv" && k !== "color") n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  const hasColor = norm.some((g) => g.attributes.color);
  if (hasColor) for (const g of norm) if (!g.attributes.color) paintHeight(g, 0xffffff, 0xffffff, 0, 1);
  return mergeGeometries(norm, false)!;
}

// แถบเรืองแสงที่ขอบฟ้า (ไฟเมือง แสงจันทร์ แสงจากหมอก)
function horizonGlow(radius: number, height: number, color: string, alpha = 0.55) {
  const tex = canvasTex(4, 128, (g) => {
    const grd = g.createLinearGradient(0, 128, 0, 0);
    grd.addColorStop(0, color.replace("A", String(alpha)));
    grd.addColorStop(1, color.replace("A", "0"));
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 128);
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true), basic({ map: tex, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
  m.position.y = height / 2 - 3;
  return m;
}

// จุดแสงลอย (โคมลอย หิ่งห้อย เรือไฟ กระทง) ขยับตามเวลา
function lights(n: number, color: number, size: number, place: (i: number, r: () => number) => THREE.Vector3, move?: (p: THREE.Vector3, base: THREE.Vector3, t: number, i: number) => void) {
  const r = rng(n * 31 + color);
  const base: THREE.Vector3[] = [];
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = place(i, r);
    base.push(v);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const tmp = new THREE.Vector3();
  return {
    pts,
    update: (t: number, reduced: boolean) => {
      if (!move || reduced) return;
      for (let i = 0; i < n; i++) {
        move(tmp, base[i], t, i);
        pos[i * 3] = tmp.x;
        pos[i * 3 + 1] = tmp.y;
        pos[i * 3 + 2] = tmp.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- ตึกเมือง: กล่องหน้าต่างไฟ รวมเป็นก้อนเดียว ----------
function windowTexture(seed: number) {
  const r = rng(seed);
  const tex = canvasTex(64, 128, (g) => {
    g.fillStyle = "#0b1424";
    g.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 124; y += 8) {
      for (let x = 4; x < 60; x += 8) {
        const v = r();
        if (v > 0.45) continue;
        g.fillStyle = v < 0.08 ? "#bfe3ff" : v < 0.3 ? "#ffd27a" : "#ffb35c";
        g.globalAlpha = 0.55 + r() * 0.45;
        g.fillRect(x, y, 4, 4);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function buildings(opts: { seed: number; count: number; from: number; to: number; rMin: number; rMax: number; hMin: number; hMax: number; tallAt?: number }) {
  const r = rng(opts.seed);
  const list: THREE.BufferGeometry[] = [];
  const tops: THREE.Vector3[] = [];
  for (let i = 0; i < opts.count; i++) {
    const a = opts.from + (opts.to - opts.from) * r();
    const rad = opts.rMin + (opts.rMax - opts.rMin) * r();
    const near = opts.tallAt === undefined ? 0.5 : Math.max(0, 1 - Math.abs(a - opts.tallAt) / 0.7);
    const h = opts.hMin + (opts.hMax - opts.hMin) * Math.pow(r(), 1.6) * (0.5 + near);
    const w = 3 + r() * 6;
    const d = 3 + r() * 5;
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 4), uv.getY(k) * (h / 6));
    g.translate(0, h / 2 - 3, 0);
    g.rotateY(-a + Math.PI / 2);
    const p = polar(a, rad);
    g.translate(p.x, 0, p.z);
    list.push(g);
    if (h > opts.hMax * 0.55) tops.push(new THREE.Vector3(p.x, h - 2.6, p.z));
  }
  return { geo: merge(list), tops };
}

// ---------- ทรงหมุน (ปรางค์ เจดีย์ พระธาตุ) จากเส้นโครง ----------
function lathe(profile: [number, number][], scale: number, segs = 12, tall = 1) {
  return new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x * scale), y * scale * tall)),
    segs,
  );
}
// ปรางค์ทรงข้าวโพด (วัดอรุณ/อยุธยา)
const PRANG: [number, number][] = [
  [1.0, 0], [1.0, 0.12], [0.82, 0.14], [0.82, 0.26], [0.66, 0.28], [0.62, 0.42], [0.5, 0.44], [0.46, 0.6], [0.36, 0.62], [0.34, 0.76], [0.24, 0.78], [0.18, 0.9], [0.08, 0.95], [0.03, 1.08], [0, 1.12],
];
// เจดีย์ทรงระฆัง (ล้านนา / สุโขทัย)
const CHEDI: [number, number][] = [
  [1.0, 0], [1.0, 0.08], [0.86, 0.1], [0.86, 0.18], [0.72, 0.2], [0.72, 0.28], [0.64, 0.3], [0.7, 0.4], [0.68, 0.5], [0.56, 0.6], [0.36, 0.66], [0.2, 0.68], [0.18, 0.76], [0.1, 0.8], [0.08, 0.95], [0.03, 1.05], [0, 1.1],
];

// ---------- แนวเขาไกล: วงรอบที่ยอดเป็นคลื่น ----------
function ridge(radius: number, maxH: number, seed: number, bottom: number, top: number, roughness = 1) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 160, 1, true);
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const s = seed * 0.37;
  const heightAt = (th: number) =>
    maxH * (0.35 + 0.35 * (Math.sin(th * 3 + s) * 0.5 + 0.5) + 0.22 * (Math.sin(th * 7.3 + s * 2) * 0.5 + 0.5) * roughness + 0.08 * (Math.sin(th * 19 + s * 3) * 0.5 + 0.5) * roughness);
  for (let i = 0; i < p.count; i++) {
    const th = Math.atan2(p.getZ(i), p.getX(i));
    p.setY(i, p.getY(i) > 0 ? heightAt(th) - 3 : -6);
  }
  paintHeight(geo, bottom, top, -6, maxH);
  return { geo, heightAt };
}

// ---------- ฉากแต่ละแบบ ----------
export function buildBackdrop(kind: SceneKind, landmarks: Landmark[], small: boolean): Built {
  const group = new THREE.Group();
  group.name = "room-backdrop";
  const updates: ((t: number, r: boolean) => void)[] = [];
  const has = (l: Landmark) => landmarks.includes(l);
  const vc = (opts: THREE.MeshBasicMaterialParameters = {}) => basic({ vertexColors: true, side: THREE.DoubleSide, ...opts });
  const glow = glowTex();
  const sprite = (color: number, size: number, pos: THREE.Vector3, opacity = 0.8) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.scale.setScalar(size);
    s.position.copy(pos);
    group.add(s);
    return s;
  };
  // ผืนน้ำ/ทุ่งด้านหลังแนวเขา (ปิดขอบลานไม่ให้เห็นช่องว่าง)
  const floor = (color: number, far: number, y = -0.6, texture?: THREE.Texture) => {
    const geo = new THREE.RingGeometry(57, far, 96, 8);
    geo.rotateX(-Math.PI / 2);
    paintHeight(geo, color, color, 0, 1);
    const col = geo.getAttribute("color") as THREE.BufferAttribute;
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    const fade = new THREE.Color(0x0a1a22);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getZ(i));
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(fade, Math.min(1, (d - 57) / (far - 57)) * 0.7);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    const m = new THREE.Mesh(geo, vc({ map: texture }));
    m.position.y = y;
    group.add(m);
    return m;
  };

  if (kind === "city") {
    // ตึกทั่วขอบฟ้า สูงที่สุดด้านหลังต้นไม้ (ย่านใจกลางเมือง)
    const b = buildings({ seed: 11, count: small ? 130 : 200, from: -Math.PI, to: Math.PI, rMin: 118, rMax: 150, hMin: 4, hMax: 24, tallAt: BACK });
    const tex = windowTexture(5);
    group.add(new THREE.Mesh(b.geo, basic({ map: tex, color: 0xd9e2ff })));
    // ตึกระฟ้าสูงพิเศษ ยอดแหลม ไฟสีแดงกะพริบบนยอดตึกสูง
    if (has("tower")) {
      const p = polar(BACK + 0.22, 122);
      const tw = new THREE.BoxGeometry(4.5, 38, 4.5);
      const uv = tw.getAttribute("uv") as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 1.1, uv.getY(k) * 6);
      tw.translate(p.x, 16, p.z);
      group.add(new THREE.Mesh(tw, basic({ map: tex, color: 0xffffff })));
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 8, 6), basic({ color: 0x1a2438 }));
      spire.position.set(p.x, 39, p.z);
      group.add(spire);
      b.tops.push(new THREE.Vector3(p.x, 43, p.z));
    }
    const red = lights(b.tops.length, 0xff3b3b, small ? 2.2 : 1.8, (i) => b.tops[i].clone().setY(b.tops[i].y + 0.5));
    group.add(red.pts);
    updates.push((t) => ((red.pts.material as THREE.PointsMaterial).opacity = 0.35 + 0.65 * (Math.sin(t * 2.4) > 0.2 ? 1 : 0)));
    // วัดอรุณ: ปรางค์ประธานกับปรางค์บริวารสี่องค์ ต้องแสงไฟสีทอง ริมแม่น้ำด้านหน้าตึก
    if (has("prang")) {
      const c = polar(BACK - 0.45, 96);
      const parts: THREE.BufferGeometry[] = [];
      const main = lathe(PRANG, 4.2, 12, 4.6);
      main.translate(c.x, -2, c.z);
      parts.push(main);
      for (const [dx, dz] of [[-8, 0], [8, 0], [-4, 6], [4, -6]]) {
        const s = lathe(PRANG, 1.9, 10, 4.2);
        s.translate(c.x + dx, -2, c.z + dz);
        parts.push(s);
      }
      const geo = merge(parts);
      paintHeight(geo, 0xffe2b0, 0xb08a5a, -2, 22);
      group.add(new THREE.Mesh(geo, vc()));
      sprite(0xffc46b, 30, new THREE.Vector3(c.x, 6, c.z), 0.3);
    }
    // แม่น้ำเจ้าพระยา: แถบน้ำสะท้อนไฟ
    if (has("river")) {
      const tex2 = canvasTex(256, 32, (g) => {
        g.fillStyle = "#08131f";
        g.fillRect(0, 0, 256, 32);
        const r = rng(3);
        for (let i = 0; i < 90; i++) {
          g.fillStyle = r() > 0.5 ? "rgba(255,200,120,0.7)" : "rgba(160,200,255,0.5)";
          g.fillRect(r() * 256, r() * 32, 1 + r() * 6, 1);
        }
      });
      tex2.wrapS = tex2.wrapT = THREE.RepeatWrapping;
      tex2.repeat.set(30, 2);
      const river = floor(0x6f87a8, 92, -0.4, tex2);
      updates.push((t, rd) => {
        if (!rd) tex2.offset.x = (t * 0.004) % 1;
      });
      void river;
    } else floor(0x1a2232, 130);
    group.add(horizonGlow(150, 22, "rgba(255,170,90,A)", 0.45));
  } else if (kind === "hills") {
    // ดอยสามชั้น ใกล้เข้มไกลจาง และทะเลหมอกระหว่างชั้น
    const layers = [
      { r: 92, h: 16, b: 0x0b1c1c, t: 0x1e3b3a },
      { r: 112, h: 24, b: 0x13262f, t: 0x30505a },
      { r: 135, h: 34, b: 0x1c3140, t: 0x4b6878 },
    ];
    const ridges = layers.map((L, i) => {
      const rg = ridge(L.r, L.h, 3 + i * 7, L.b, L.t);
      group.add(new THREE.Mesh(rg.geo, vc()));
      return rg;
    });
    const mistTex = canvasTex(512, 64, (g) => {
      const r = rng(9);
      for (let i = 0; i < 70; i++) {
        const x = r() * 512;
        const y = 20 + r() * 30;
        const rad = 20 + r() * 50;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, "rgba(220,235,245,0.35)");
        grd.addColorStop(1, "rgba(220,235,245,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, 512, 64);
      }
    });
    mistTex.wrapS = THREE.RepeatWrapping;
    mistTex.repeat.set(5, 1);
    for (const [rad, y, hgt, sp] of [
      [100, 4, 14, 0.0016],
      [124, 9, 18, -0.0011],
    ]) {
      const tx = mistTex.clone();
      tx.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, hgt, 64, 1, true), basic({ map: tx, transparent: true, depthWrite: false, side: THREE.BackSide }));
      m.position.y = y;
      group.add(m);
      updates.push((t, rd) => {
        if (!rd) tx.offset.x = (t * sp) % 1;
      });
    }
    // พระธาตุดอยสุเทพ: เจดีย์ทองบนยอดดอย ต้องไฟสว่างมองเห็นจากเมือง
    if (has("chedi")) {
      const a = BACK - 0.2;
      const L = layers[0];
      const top = ridges[0].heightAt(a) - 3;
      const c = polar(a, L.r - 1);
      const geo = lathe(CHEDI, 3, 12, 2.4);
      geo.translate(c.x, top - 0.5, c.z);
      paintHeight(geo, 0xffe2a0, 0xffc04d, top, top + 5);
      group.add(new THREE.Mesh(geo, vc()));
      sprite(0xffc46b, 18, new THREE.Vector3(c.x, top + 2.5, c.z), 0.55);
    }
    // วัดร่องขุ่น: วิหารสีขาวหลังคาซ้อนชั้น ยอดแหลม เรืองแสงขาวอมฟ้า
    if (has("whitetemple")) {
      const c = polar(BACK + 0.3, 86);
      const parts: THREE.BufferGeometry[] = [];
      const box = (w: number, h: number, d: number, y: number) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(c.x, y + h / 2, c.z);
        parts.push(g);
      };
      box(12, 3, 6, -2);
      for (let k = 0; k < 4; k++) {
        const roof = new THREE.ConeGeometry(7 - k * 1.4, 2.4, 4, 1, true);
        roof.rotateY(Math.PI / 4);
        roof.scale(1.5, 1, 0.8);
        roof.translate(c.x, 2 + k * 1.9, c.z);
        parts.push(roof);
      }
      const spire = new THREE.ConeGeometry(0.5, 7, 6);
      spire.translate(c.x, 11, c.z);
      parts.push(spire);
      for (const s of [-1, 1]) {
        const fin = new THREE.ConeGeometry(0.3, 4, 5);
        fin.translate(c.x + s * 7, 2.5, c.z);
        parts.push(fin);
      }
      const geo = merge(parts);
      paintHeight(geo, 0xffffff, 0xd6e8ff, -2, 14);
      group.add(new THREE.Mesh(geo, vc()));
      sprite(0xbfe0ff, 30, new THREE.Vector3(c.x, 4, c.z), 0.4);
    }
    group.add(horizonGlow(130, 30, "rgba(150,200,230,A)", 0.22));
    floor(0x10201f, 140);
  } else if (kind === "rice") {
    // ทุ่งนาแถวยาวไปจนขอบฟ้า ต้นตาลเรียงคันนา แนวป่าไกล
    const field = canvasTex(64, 64, (g) => {
      g.fillStyle = "#1c2a1a";
      g.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 8) {
        g.fillStyle = y % 16 ? "#2a3a22" : "#3a3a20";
        g.fillRect(0, y, 64, 5);
      }
    });
    field.wrapS = field.wrapT = THREE.RepeatWrapping;
    field.repeat.set(40, 6);
    floor(0xb9c49a, 160, -0.5, field);
    const tree = ridge(150, 6, 21, 0x0a140f, 0x18261c, 0.6);
    group.add(new THREE.Mesh(tree.geo, vc()));
    const r = rng(41);
    const palms: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (small ? 40 : 70); i++) {
      const a = r() * Math.PI * 2;
      const c = polar(a, 75 + r() * 60);
      const h = 7 + r() * 5;
      const trunk = new THREE.CylinderGeometry(0.15, 0.25, h, 5);
      trunk.translate(c.x, h / 2 - 1, c.z);
      palms.push(trunk);
      for (let k = 0; k < 9; k++) {
        const leaf = new THREE.ConeGeometry(0.35, 2.6, 3);
        leaf.translate(0, 1.3, 0);
        leaf.rotateZ(1.1 + (k % 3) * 0.25);
        leaf.rotateY((k / 9) * Math.PI * 2);
        leaf.translate(c.x, h - 1, c.z);
        palms.push(leaf);
      }
    }
    const pg = merge(palms);
    paintHeight(pg, 0x0b130e, 0x16241a, -1, 13);
    group.add(new THREE.Mesh(pg, vc()));
    // พระธาตุแก่นนครเก้าชั้น สีขาวทองต้องไฟ ริมบึง
    if (has("pagoda")) {
      const c = polar(BACK - 0.3, 92);
      const parts: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 9; k++) {
        const w = 9 - k * 0.85;
        const tier = new THREE.BoxGeometry(w, 1.5, w);
        tier.translate(c.x, -1 + k * 1.55 + 0.75, c.z);
        parts.push(tier);
        const roof = new THREE.CylinderGeometry(w * 0.4, w * 0.62, 0.45, 4);
        roof.rotateY(Math.PI / 4);
        roof.translate(c.x, -1 + k * 1.55 + 1.6, c.z);
        parts.push(roof);
      }
      const top = lathe(CHEDI, 1.4, 10, 2);
      top.translate(c.x, 13, c.z);
      parts.push(top);
      const geo = merge(parts);
      paintHeight(geo, 0xfff1d6, 0xffc65c, -1, 16);
      group.add(new THREE.Mesh(geo, vc()));
      sprite(0xffd38a, 34, new THREE.Vector3(c.x, 6, c.z), 0.4);
    }
    // บึงน้ำสะท้อนแสงดาว
    if (has("lake")) {
      const c = polar(BACK - 0.05, 78);
      const lake = new THREE.Mesh(new THREE.CircleGeometry(16, 48), basic({ color: 0x1c3550, transparent: true, opacity: 0.9 }));
      lake.rotation.x = -Math.PI / 2;
      lake.scale.set(1.6, 1, 1);
      lake.position.set(c.x, -0.45, c.z);
      group.add(lake);
      const sp = lights(40, 0xcfe6ff, 0.9, (_, rr) => new THREE.Vector3(c.x + (rr() - 0.5) * 44, -0.3, c.z + (rr() - 0.5) * 26), (o, b, t, i) => o.set(b.x, b.y + Math.sin(t * 3 + i) * 0.05, b.z));
      group.add(sp.pts);
      updates.push((t) => ((sp.pts.material as THREE.PointsMaterial).opacity = 0.5 + 0.3 * Math.sin(t * 2)));
    }
    if (has("river")) {
      const rv = new THREE.Mesh(new THREE.RingGeometry(98, 104, 96, 1, BACK - 1.2, 2.4), basic({ color: 0x23405e, side: THREE.DoubleSide }));
      rv.rotation.x = -Math.PI / 2;
      rv.position.y = -0.4;
      group.add(rv);
    }
    // หิ่งห้อยเหนือทุ่ง
    const ff = lights(small ? 60 : 110, 0xd9ff7a, 0.6, (_, rr) => polar(rr() * Math.PI * 2, 60 + rr() * 50).setY(0.5 + rr() * 3), (o, b, t, i) => o.set(b.x + Math.sin(t * 0.5 + i) * 1.2, b.y + Math.sin(t * 0.8 + i * 1.7) * 0.6, b.z + Math.cos(t * 0.4 + i) * 1.2));
    group.add(ff.pts);
    updates.push(ff.update);
    group.add(horizonGlow(150, 22, "rgba(255,190,110,A)", 0.22));
  } else if (kind === "sea") {
    // ทะเลกว้างถึงขอบฟ้า ระลอกคลื่นสะท้อนแสง
    const waves = canvasTex(256, 64, (g) => {
      g.fillStyle = "#0a2236";
      g.fillRect(0, 0, 256, 64);
      const r = rng(13);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(150,210,255,${0.15 + r() * 0.35})`;
        g.fillRect(r() * 256, r() * 64, 2 + r() * 10, 1);
      }
    });
    waves.wrapS = waves.wrapT = THREE.RepeatWrapping;
    waves.repeat.set(24, 10);
    floor(0x8fb3c9, 220, -0.7, waves);
    updates.push((t, rd) => {
      if (!rd) {
        waves.offset.x = (t * 0.003) % 1;
        waves.offset.y = (t * 0.006) % 1;
      }
    });
    // ประกายบนผิวน้ำ
    const sparkle = lights(small ? 70 : 140, 0xdff4ff, 0.7, (_, rr) => polar(BACK + (rr() - 0.5) * 2.4, 62 + rr() * 120).setY(-0.5), (o, b, t, i) => o.copy(b).setY(-0.5 + 0.06 * Math.sin(t * 2 + i)));
    group.add(sparkle.pts);
    updates.push((t) => ((sparkle.pts.material as THREE.PointsMaterial).opacity = 0.45 + 0.35 * Math.sin(t * 3.1)));
    const islandColor = (g: THREE.BufferGeometry, top: number) => paintHeight(g, 0x0a1a1c, 0x1a3330, -1, top);
    // เกาะกลางทะเล
    if (has("islands") || has("lighthouse")) {
      const r = rng(17);
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) {
        const a = BACK + (r() - 0.5) * 2.6;
        const c = polar(a, 105 + r() * 40);
        const s = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        s.scale(10 + r() * 14, 5 + r() * 8, 7 + r() * 8);
        s.translate(c.x, -1, c.z);
        parts.push(s);
      }
      const geo = merge(parts);
      islandColor(geo, 12);
      group.add(new THREE.Mesh(geo, vc()));
    }
    // ภูเขาหินปูนตั้งตรงกลางทะเล (กระบี่ พังงา)
    if (has("karst")) {
      const r = rng(23);
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < (small ? 10 : 16); i++) {
        const a = BACK + (r() - 0.5) * 3;
        const c = polar(a, 85 + r() * 55);
        const h = 12 + r() * 22;
        const g = new THREE.CylinderGeometry(2 + r() * 3, 4 + r() * 4, h, 9, 6);
        const p = g.getAttribute("position") as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) {
          const n = 1 + 0.25 * Math.sin(p.getY(k) * 0.7 + i) + 0.15 * Math.sin(Math.atan2(p.getZ(k), p.getX(k)) * 3 + i);
          p.setX(k, p.getX(k) * n);
          p.setZ(k, p.getZ(k) * n);
        }
        g.translate(c.x, h / 2 - 1.5, c.z);
        parts.push(g);
      }
      const geo = merge(parts);
      paintHeight(geo, 0x12302e, 0x4f7f62, -1, 30);
      group.add(new THREE.Mesh(geo, vc()));
    }
    // ประภาคารแหลมพรหมเทพ: แหลมหิน หอขาวลายแดง ลำแสงหมุน
    if (has("lighthouse")) {
      const c = polar(BACK + 0.38, 88);
      const cape = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      cape.scale(18, 9, 12);
      cape.translate(c.x, -1, c.z);
      islandColor(cape, 8);
      group.add(new THREE.Mesh(cape, vc()));
      const parts: THREE.BufferGeometry[] = [];
      const tower = new THREE.CylinderGeometry(0.9, 1.4, 9, 12);
      tower.translate(c.x, 12, c.z);
      parts.push(tower);
      const geo = merge(parts);
      paintHeight(geo, 0xf4f1ea, 0xffffff, 7, 17);
      group.add(new THREE.Mesh(geo, vc()));
      for (const y of [10, 13]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.18, 0.9, 12), basic({ color: 0xb3203a }));
        band.position.set(c.x, y, c.z);
        group.add(band);
      }
      const lamp = new THREE.Vector3(c.x, 17.2, c.z);
      sprite(0xfff1c2, 9, lamp, 0.95);
      const beamGeo = new THREE.ConeGeometry(4, 60, 16, 1, true);
      beamGeo.translate(0, -30, 0);
      beamGeo.rotateZ(Math.PI / 2);
      const beamTex = canvasTex(64, 4, (g) => {
        const grd = g.createLinearGradient(0, 0, 64, 0);
        grd.addColorStop(0, "rgba(255,245,210,0)");
        grd.addColorStop(1, "rgba(255,245,210,0.55)");
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 4);
      });
      const beam = new THREE.Mesh(beamGeo, basic({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.position.copy(lamp);
      group.add(beam);
      updates.push((t, rd) => {
        beam.rotation.y = rd ? 1 : t * 0.6;
      });
    }
    // ไฟเมืองริมหาด (พัทยา หาดใหญ่)
    if (has("shorecity")) {
      const b = buildings({ seed: 31, count: small ? 50 : 80, from: BACK - 1.1, to: BACK + 0.1, rMin: 120, rMax: 140, hMin: 4, hMax: 20, tallAt: BACK - 0.5 });
      group.add(new THREE.Mesh(b.geo, basic({ map: windowTexture(8), color: 0xffffff })));
      group.add(horizonGlow(132, 20, "rgba(255,170,100,A)", 0.4));
    }
    // เรือไฟกลางทะเล โยกตามคลื่น
    const boats = lights(small ? 14 : 22, 0xfff0b0, 1.6, (_, rr) => polar(BACK + (rr() - 0.5) * 3, 80 + rr() * 80).setY(0), (o, b, t, i) => o.set(b.x, b.y + Math.sin(t * 1.3 + i) * 0.2, b.z));
    group.add(boats.pts);
    updates.push(boats.update);
    group.add(horizonGlow(200, 24, "rgba(120,190,230,A)", 0.25));
  } else {
    // เมืองเก่า: ปรางค์และเจดีย์ระฆังอิฐแดง ต้องไฟสีส้มจากด้านล่าง ต้นไม้ใหญ่เงาดำ
    const r = rng(51);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (small ? 12 : 18); i++) {
      const a = BACK + (r() - 0.5) * 3.4;
      const c = polar(a, 82 + r() * 45);
      const sc = 2.5 + r() * 2.5;
      const g = lathe(i % 3 === 0 ? CHEDI : PRANG, sc, 10, i % 3 === 0 ? 2.2 : 3.4);
      g.translate(c.x, -1.5, c.z);
      parts.push(g);
      if (i % 2) {
        const base = new THREE.BoxGeometry(10 + r() * 8, 2, 8 + r() * 6);
        base.rotateY(-a);
        base.translate(c.x, -1, c.z);
        parts.push(base);
      }
    }
    const geo = merge(parts);
    paintHeight(geo, 0xffa560, 0x4a2418, -1.5, 16);
    group.add(new THREE.Mesh(geo, vc()));
    // ต้นไม้ใหญ่ (ต้นจามจุรี) เงาเข้ม
    const trees: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (small ? 14 : 24); i++) {
      const c = polar(r() * Math.PI * 2, 78 + r() * 60);
      const s = new THREE.IcosahedronGeometry(3 + r() * 4, 1);
      s.scale(1.4, 0.8, 1.4);
      s.translate(c.x, 4 + r() * 3, c.z);
      trees.push(s);
      const tk = new THREE.CylinderGeometry(0.4, 0.6, 5, 5);
      tk.translate(c.x, 1, c.z);
      trees.push(tk);
    }
    const tg = merge(trees);
    paintHeight(tg, 0x070d0b, 0x101c17, -1, 10);
    group.add(new THREE.Mesh(tg, vc()));
    // สายน้ำหน้าเมืองเก่า กระทงลอยไฟริบหรี่
    const river = new THREE.Mesh(new THREE.RingGeometry(62, 76, 128, 1), basic({ color: 0x1b2c3c, side: THREE.DoubleSide }));
    river.rotation.x = -Math.PI / 2;
    river.position.y = -0.4;
    group.add(river);
    if (has("krathong")) {
      const kr = lights(small ? 40 : 70, 0xffc46b, 1.1, (_, rr) => polar(rr() * Math.PI * 2, 64 + rr() * 10).setY(-0.1), (o, b, t, i) => {
        const a = Math.atan2(b.z, b.x) + t * 0.004;
        const rr = Math.hypot(b.x, b.z);
        o.set(Math.cos(a) * rr, b.y + Math.sin(t * 2 + i) * 0.05, Math.sin(a) * rr);
      });
      group.add(kr.pts);
      updates.push(kr.update);
    }
    floor(0x14110e, 140);
    group.add(horizonGlow(130, 24, "rgba(255,150,80,A)", 0.4));
  }

  // โคมลอยขึ้นฟ้าช้า ๆ (เชียงใหม่ เชียงราย ฯลฯ)
  if (has("lanterns")) {
    const n = small ? 40 : 70;
    const lan = lights(n, 0xffa94d, 3.4, (_, rr) => polar(BACK + (rr() - 0.5) * 3.2, 45 + rr() * 55).setY(4 + rr() * 34), (o, b, t, i) => {
      const y = 4 + ((b.y - 4 + t * (0.45 + (i % 5) * 0.1)) % 38);
      o.set(b.x + Math.sin(t * 0.3 + i) * 1.5, y, b.z + Math.cos(t * 0.25 + i) * 1.5);
    });
    group.add(lan.pts);
    updates.push(lan.update);
  }

  return {
    group,
    update: (t, r) => updates.forEach((u) => u(t, r)),
    dispose: () =>
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | undefined;
        if (mat) {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        }
      }),
  };
}

// ความสูงของแนวเขารอบลาน: ฉากทะเลและทุ่งนาต้องเตี้ยลงให้มองเห็นไกล
export const HILL_SCALE: Record<SceneKind, number> = { city: 0.45, hills: 1, rice: 0.3, sea: 0.12, ancient: 0.35 };
