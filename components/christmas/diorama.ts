// ตุ๊กตาหิมะ Exclusive แบบฐานกลมก้อน ๆ: ฐานลายแถบขนมหวาน หิมะบนหน้า และของตกแต่งที่วางอย่างอิสระบนฐาน
// ตำแหน่ง (x, z) และการหมุน (r) ของแต่ละชิ้นมาจาก look.items โดยตรง ไม่มีตารางมาบังคับ
import * as THREE from "three";
import { BASE_HEX, BASE_R, GIFT_HEX, ITEM_R, TREE_HEX, type DioramaItem, type GiantLook } from "@/lib/christmas/giant";
import { buildBoard, makeCanvasTexture } from "./giantSign";
import { drawGiantBoard, type BoardStyle } from "./skyArt";
import { candyCane, giftBox, miniPine, shade, snowman, snowSurface, std, type Scenery } from "./zoneScenery";

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
  let obj: THREE.Object3D | null = null;
  if (item.kind === "snowman") obj = snowman();
  else if (item.kind === "tree") obj = miniPine(0.85, 0.85, TREE_HEX[item.color] ?? TREE_HEX.forest);
  else if (item.kind === "gift") obj = giftBox(0.36, GIFT_HEX[item.color] ?? GIFT_HEX.red, item.color === "gold" ? 0xdc2643 : 0xf5c542);
  else if (item.kind === "candy") obj = candyCane();
  if (obj) g.add(obj);

  const r = ITEM_R[item.kind] ?? 0.2;
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
  const pal = BASE_HEX[opts.look.base] ?? BASE_HEX.pink;
  const stripes = stripeTexture(pal.a, pal.b);
  stripes.wrapS = THREE.RepeatWrapping;

  // ฐานลายแถบ และหน้าหิมะที่นูนเบา ๆ
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(BASE_R, BASE_R * 1.03, BASE_H, 56),
    new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5 }),
  );
  base.position.y = BASE_H / 2;
  group.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(BASE_R * 0.97, BASE_R * 0.97, 0.05, 56), snowSurface());
  top.position.y = BASE_H + 0.02;
  group.add(top);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.6;
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), snowSurface());
    lump.scale.set(1.6, 0.45, 1.2);
    lump.position.set(Math.cos(a) * BASE_R * 0.7, BASE_H + 0.03, Math.sin(a) * BASE_R * 0.7);
    group.add(lump);
  }

  // ข้อมูลเก่าที่ไม่มีรายการของจะใช้รายการว่างแทน ไม่ให้หน้าเว็บพัง
  const items = Array.isArray(opts.look.items) ? opts.look.items : [];
  for (const item of items) group.add(buildItem(item));

  // ป้ายชื่อเล็กปักขอบหน้าฐาน
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.7, 10), std(0x7a4a24, 0.8));
  pole.position.set(0, BASE_H + 0.35, BASE_R - 0.06);
  group.add(pole);
  const tex = makeCanvasTexture(1024, Math.round((1024 * SIGN_H) / SIGN_W), (g, w, h) => {
    drawGiantBoard(g, 14, 14, w - 28, h - 28, { name: opts.name || "ชื่อของคุณ", message: opts.message || "ข้อความของคุณจะขึ้นตรงนี้", style: (opts.look.board as BoardStyle) ?? "spruce" });
  });
  const sign = buildBoard(tex, SIGN_W, SIGN_H, 0x7a4a24, 0.05);
  sign.position.set(0, BASE_H + 0.78, BASE_R - 0.06);
  group.add(sign);

  return { group: shade(group), update: () => {} };
}
