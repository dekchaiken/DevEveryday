// ตุ๊กตาหิมะ Exclusive แบบฐานกลมก้อน ๆ: ฐานลายแถบขนมหวาน หิมะบนหน้า และของตกแต่งที่วางบนตาราง 4×4
// ของแต่ละชิ้นอยู่กึ่งกลางช่องของตาราง ผู้ซื้อเลือกชนิด สี และช่องได้เอง ไม่มีโมเดลจากไฟล์ภายนอก
import * as THREE from "three";
import { BASE_HEX, DIORAMA_GRID, GIFT_HEX, TREE_HEX, type GiantLook } from "@/lib/christmas/giant";
import { buildBoard, makeCanvasTexture } from "./giantSign";
import { drawGiantBoard, type BoardStyle } from "./skyArt";
import { candyCane, giftBox, miniPine, shade, snowman, snowSurface, std, type Scenery } from "./zoneScenery";

export const BASE_R = 1.35; // รัศมีฐาน ใหญ่กว่าช่อง 2×2 เล็กน้อย
export const BASE_H = 0.3;
const SUB = 0.6; // ระยะของตารางย่อยบนฐาน
const SIGN_W = 0.8;
const SIGN_H = 0.46;

// ตำแหน่งกลางของช่อง i (0..15) บนฐาน
export function subCellPos(i: number): { x: number; z: number } {
  const cx = i % DIORAMA_GRID;
  const cz = Math.floor(i / DIORAMA_GRID);
  const off = (DIORAMA_GRID - 1) / 2;
  return { x: (cx - off) * SUB, z: (cz - off) * SUB };
}

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

  // ของตกแต่งตามช่องที่ผู้ซื้อวาง
  const y = BASE_H + 0.04;
  // ข้อมูลเก่าที่ไม่มีรายการของจะใช้รายการว่างแทน ไม่ให้หน้าเว็บพัง
  const items = Array.isArray(opts.look.items) ? opts.look.items : [];
  for (const item of items) {
    const p = subCellPos(item.i);
    const turn = ((item.i * 37) % 12) * 0.25;
    let obj: THREE.Object3D | null = null;
    if (item.kind === "snowman") obj = snowman();
    else if (item.kind === "tree") obj = miniPine(0.85, 0.85, TREE_HEX[item.color] ?? TREE_HEX.forest);
    else if (item.kind === "gift") {
      const body = GIFT_HEX[item.color] ?? GIFT_HEX.red;
      obj = giftBox(0.36, body, item.color === "gold" ? 0xdc2643 : 0xf5c542);
    } else if (item.kind === "candy") obj = candyCane();
    if (!obj) continue;
    obj.position.set(p.x, y, p.z);
    obj.rotation.y = turn;
    group.add(obj);
  }

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
