// ตุ๊กตาหิมะ Exclusive แบบฐานกลมก้อน ๆ: ฐานลายแถบขนมหวาน หิมะบนหน้า และของตกแต่งที่วางอย่างอิสระบนฐาน
// ตำแหน่ง (x, z) และการหมุน (r) ของแต่ละชิ้นมาจาก look.items โดยตรง ไม่มีตารางมาบังคับ
import * as THREE from "three";
import { BASE_HEX, BASE_R, radiusOf, type DioramaItem, type GiantLook } from "@/lib/christmas/giant";
import { buildBoard, makeCanvasTexture } from "./giantSign";
import { drawGiantBoard, type BoardStyle } from "./skyArt";
import { buildItemModel } from "./decorItems";
import { shade, snowSurface, std, type Scenery } from "./zoneScenery";
import { buildFence, buildHouse } from "./exclusiveHouse";
import { HOUSE_SPOT } from "@/lib/christmas/giant";

export const BASE_H = 0.3;
// ระดับผิวหิมะบนฐานที่ของทุกชิ้นตั้งอยู่
export const ITEM_Y = BASE_H + 0.04;
const SIGN_W = 0.8;
const SIGN_H = 0.46;

// ลายแถบรอบฐานทรงกระบอก สองสีสลับกันเป็นแนวตั้ง
function stripeTexture(a: number, b: number): THREE.CanvasTexture {
  return makeCanvasTexture(512, 64, (g, w, h) => {
    const bands = 12;
    for (let k = 0; k < bands; k++) {
      g.fillStyle = `#${(k % 2 ? b : a).toString(16).padStart(6, "0")}`;
      g.fillRect((k * w) / bands, 0, w / bands + 1, h);
    }
  });
}

// ของตกแต่งหนึ่งชิ้น ตั้งตำแหน่งและการหมุนตามข้อมูลของชิ้นนั้น
// กลุ่มนี้มี userData.itemId ไว้ให้การเลือกและการลากบนหน้าจอหาเจอ และมีวงแหวนไฮไลต์ที่ซ่อนไว้จนกว่าจะเลือก
export function buildItem(item: DioramaItem): THREE.Group {
  const g = new THREE.Group();
  g.userData.itemId = item.id;
  g.add(buildItemModel(item.kind, item.parts));

  const r = radiusOf(item.kind);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.2, r * 1.42, 40),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  ring.renderOrder = 2;
  ring.userData.ring = true;
  ring.visible = false;
  g.add(ring);

  g.position.set(item.x, ITEM_Y, item.z);
  g.rotation.y = item.r;
  return g;
}

// เปิดวงแหวนไฮไลต์เฉพาะชิ้นที่เลือก (ไม่ต้องสร้างฉากใหม่ตอนเปลี่ยนการเลือก)
export function setSelectedRing(root: THREE.Object3D, selectedId: string | null) {
  root.traverse((o) => {
    if (typeof o.userData.itemId !== "string") return;
    for (const c of o.children) {
      if (c.userData.ring) c.visible = o.userData.itemId === selectedId;
    }
  });
}

export function buildDiorama(opts: { look: GiantLook; name: string; message: string }): Scenery {
  const group = new THREE.Group();
  const updates: ((t: number, r: boolean) => void)[] = [];
  const pal = BASE_HEX[opts.look.base] ?? BASE_HEX.pink;
  const stripes = stripeTexture(pal.a, pal.b);
  stripes.wrapS = THREE.RepeatWrapping;
  stripes.repeat.set(2, 1);

  // ฐานสองชั้น: ขอบหินด้านล่าง แถบลายขนมรอบฐาน ขอบทอง และหน้าหิมะนูนเป็นเนิน
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(BASE_R * 1.04, BASE_R * 1.07, 0.09, 64), std(0x8f8a82, 0.9));
  stone.position.y = 0.045;
  group.add(stone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(BASE_R, BASE_R * 1.01, BASE_H - 0.09, 64, 1, true), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.45 }));
  band.position.y = 0.09 + (BASE_H - 0.09) / 2;
  group.add(band);
  for (const y of [0.095, BASE_H]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(BASE_R * 1.005, 0.018, 8, 80), std(0xe0b44c, 0.3, 0.85));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }
  const topGeo = new THREE.CylinderGeometry(BASE_R * 0.99, BASE_R * 0.99, 0.06, 64, 6);
  const tp = topGeo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    if (tp.getY(i) <= 0) continue;
    const x = tp.getX(i);
    const z = tp.getZ(i);
    const d = Math.hypot(x, z) / BASE_R;
    tp.setY(i, tp.getY(i) + 0.03 * (1 - d * d) + 0.008 * Math.sin(x * 9) * Math.cos(z * 7));
  }
  topGeo.computeVertexNormals();
  const top = new THREE.Mesh(topGeo, snowSurface());
  top.position.y = BASE_H + 0.0;
  group.add(top);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.6;
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), snowSurface());
    lump.scale.set(1.6, 0.42, 1.2);
    lump.position.set(Math.cos(a) * BASE_R * 0.86, BASE_H + 0.03, Math.sin(a) * BASE_R * 0.86);
    group.add(lump);
  }

  // บ้านกลางฐาน ทางเดินหินจากหน้าฐานถึงประตู และรั้ว
  const house = buildHouse(opts.look.house, opts.look.wall, opts.look.roof);
  if (house) {
    house.group.position.set(HOUSE_SPOT.x, ITEM_Y - 0.01, HOUSE_SPOT.z);
    house.group.scale.setScalar(1.25);
    group.add(house.group);
    updates.push(house.update);
    const pathM = std(0xb9b1a3, 0.9);
    for (let k = 0; k < 5; k++) {
      const z = HOUSE_SPOT.z + 0.42 + k * 0.17;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.02, 10), pathM);
      st.scale.set(1.2, 1, 0.8);
      st.position.set(Math.sin(k * 1.7) * 0.03, ITEM_Y + 0.005, z);
      group.add(st);
    }
  }
  const fence = buildFence(opts.look.fence);
  if (fence) {
    fence.group.position.y = ITEM_Y - 0.01;
    group.add(fence.group);
    updates.push(fence.update);
  }

  // ข้อมูลเก่าที่ไม่มีรายการของจะใช้รายการว่างแทน ไม่ให้หน้าเว็บพัง
  const items = Array.isArray(opts.look.items) ? opts.look.items : [];
  for (const item of items) group.add(buildItem(item));

  // ป้ายชื่อ: มีบ้านจะปักไว้มุมหลังขวาข้างบ้าน (ไม่บังตัวบ้าน) ไม่มีบ้านปักหน้าฐานตามเดิม
  const signX = house ? 0.9 : 0;
  const signZ = house ? -0.55 : BASE_R - 0.1;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.7, 10), std(0x7a4a24, 0.8));
  pole.position.set(signX, BASE_H + 0.35, signZ);
  group.add(pole);
  const tex = makeCanvasTexture(1024, Math.round((1024 * SIGN_H) / SIGN_W), (g, w, h) => {
    drawGiantBoard(g, 14, 14, w - 28, h - 28, { name: opts.name || "ชื่อของคุณ", message: opts.message || "ข้อความของคุณจะขึ้นตรงนี้", style: (opts.look.board as BoardStyle) ?? "spruce" });
  });
  const sign = buildBoard(tex, SIGN_W, SIGN_H, 0x7a4a24, 0.05);
  sign.position.set(signX, BASE_H + 0.78, signZ);
  if (house) {
    sign.scale.setScalar(0.8);
    sign.rotation.y = -0.45;
  }
  group.add(sign);

  return { group: shade(group), update: (t, r) => updates.forEach((u) => u(t, r)) };
}
