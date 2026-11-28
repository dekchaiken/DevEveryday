"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TREE_CAPACITY, type Ornament } from "@/lib/christmas/types";
import { SLOT_COUNT, type Decor } from "@/lib/christmas/decor";
// ตำแหน่งวาดบนฉากใช้ชุด DISPLAY (ช่องที่ถูกปิดหลังผังเปลี่ยนย้ายไปแสดงที่ช่องเปิดใกล้สุด)
import { distToPath, GIANT_DISPLAY as GIANT_POSITIONS, GIANT_MODEL_SCALE, inZone, SLOT_DISPLAY_POSITIONS as SLOT_POSITIONS, SLOT_POSITIONS as SLOT_REAL, GIANT_POSITIONS as GIANT_REAL, slotAtWorld, ZONE, ZONE_CAPACITY, ZONE_GATE, ZONE_GATE_ANGLE, ZONE_STOPS, ZONE_WALKWAYS } from "@/lib/christmas/slots";
import { CELL, LAND_R } from "@/lib/christmas/grid";
import type { CardRecord } from "@/lib/christmas/cardSpec";
import { ORNAMENT_HEX, ornamentPosition, pointToHeightAngle, surfaceNormal, TREE_TOP_Y } from "./geometry";
import { buildTreeModel, type TreeVariant } from "./treeModel";
import { createOrnamentLayer } from "./ornamentLayer";
import { createTreeAura } from "./treeAura";
import { buildPlaza } from "./plazaScenery";
import { drawGiantBoard, drawSkyPanel, drawSled, type BoardStyle, type SkyTheme } from "./skyArt";
import { DEFAULT_GIANT_LOOK, parseGiantLook, type GiantLook } from "@/lib/christmas/giant";
import { buildWishVillage } from "./wishVillage";
import { buildSnowman } from "./snowmanModel";
import { buildSurroundings } from "./treeSurroundings";
import { buildDiorama } from "./diorama";
import { buildSleighFlight, flightProgressAt } from "./sleighFlight";
import { serverNowMs, startServerClock } from "./serverClock";
import type { Social } from "@/lib/christmas/social";

// ตุ๊กตายักษ์ที่ตั้งป้ายไว้: ชื่อ ข้อความ ตำแหน่ง และลุค (ถ้าไม่มีจะใช้ลุคเริ่มต้น)
type GiantSpec = { name: string; message: string; spot: number; look?: GiantLook; social?: Social };

export type Preview = { height: number; angle: number; color: string; shape: string } | null;

export type LocateTarget = { kind: "decor"; slot: number } | { kind: "giant"; spot: number };

export type TreeSceneHandle = {
  launchFirework: (color: string) => void;
  celebrate: () => void; // ฉลองต้นครบ 999 คำอวยพร (ออร่า พลุ ประกายทอง)
  locate: (target: LocateTarget) => void;
  highlightDecor: (slot: number) => void;
  focusOrnament: (id: string | null) => void;
  focusDecor: (d: Decor | null) => void;
  focusGiant: (spot: number | null) => void; // กล้องบินไปหาบ้านหิมะ Exclusive และกลับมุมเดิมเมื่อส่ง null
  project: (x: number, y: number, z: number) => { x: number; y: number; visible: boolean }; // พิกัดจอของจุดในโลก (ใช้วางคำอธิบายข้างโมเดล)
  zoneSlots: (only?: Set<string>) => { id: string; x: number; y: number; visible: boolean; angle: number }[]; // จุดของการ์ดในโซนบนจอ (ใช้วางป้ายชี้) ระบุชุด id เพื่อคำนวณเฉพาะใบที่ต้องการ
  focusZoneCard: (id: string) => void; // กล้องบินไปหาการ์ดใบนั้น
  flyToZone: () => void; // เดินผ่านอุโมงค์ไฟเข้าหมู่บ้านคำอวยพร แล้วหยุดหน้ากำแพงแรกที่มีการ์ด
  zoneStep: (delta: number) => void; // เลื่อนไปกำแพงถัดไป/ก่อนหน้า (เฉพาะกำแพงที่มีการ์ด)
  returnView: () => void; // กลับไปมุมกล้องเดิมก่อนไปดูตุ๊กตาหรือโซน
  zoomBy: (factor: number) => void;
  resetView: () => void;
};

type Props = {
  ornaments: Ornament[];
  preview: Preview;
  reducedMotion: boolean;
  onPick: (height: number, angle: number) => void;
  onOrnamentClick: (o: Ornament) => void;
  onError: () => void;
  onReady: (handle: TreeSceneHandle) => void; // ส่งตัวควบคุมฉากให้พาเรนต์ เช่น สั่งจุดพลุ
  ground: string; // สีพื้นหิมะตามห้อง
  giants: GiantSpec[]; // ตุ๊กตายักษ์ทุกตัวในห้องพร้อมป้ายและตำแหน่ง
  decor: Decor[]; // ตุ๊กตาหิมะที่ผู้ใช้ตกแต่งรอบต้น
  onDecorClick: (d: Decor) => void;
  onGiantClick?: (g: GiantSpec) => void; // แตะบ้านหิมะ Exclusive เพื่อดูป้ายและลิงก์
  markerSlot: number | null; // ช่องที่กำลังเลือกบนพื้น
  onGroundPick: (slot: number | null) => void; // โหมดเลือกบนฉาก: ช่องตรงจุดที่แตะ (null = ตรงนั้นวางไม่ได้)
  zoneCards?: CardRecord[]; // การ์ดที่แขวนบนรั้วโซนคำอวยพร
  onZoneCardClick?: (id: string) => void;
  onAwayChange?: (away: boolean) => void; // บอกพาเรนต์ว่ากล้องอยู่นอกมุมเดิมหรือไม่
  onZoneStop?: (index: number, total: number) => void; // กำแพงที่กำลังชมในหมู่บ้าน
  pickMode?: false | "doll" | "giant"; // โหมดเลือกช่องบนฉาก: ตุ๊กตา (1×1) หรือบ้าน Exclusive (2×2) แตะพื้นได้เฉพาะตอนนี้
  giantPickState?: { taken: number[]; held: number[]; spot: number | null } | null; // จุดบ้านที่ซื้อ/จองแล้ว และจุดที่เลือก
  onGiantPick?: (spot: number | null) => void;
  snowing: boolean; // เปิด/ปิดหิมะตก
  crowd: { count: number; seed: string }; // จำนวนคนออนไลน์ในโซนนี้ และรหัสโซนสำหรับจัดตำแหน่ง
};

// รวมเมชที่ไม่เคลื่อนไหวภายในกลุ่มเป็นไม่กี่ชิ้นต่อวัสดุ
// ทุกเมชเป็นคำสั่งวาดแยกกันบน GPU ของที่นิ่งหลายร้อยชิ้นจึงกินเฟรมไปมาก การรวมแล้วจำนวนคำสั่งวาดลดลงมาก
// ข้ามเมชที่มี userData (ใช้เลือกบนหน้าจอ) และชิ้นที่อยู่ใน keep (ของที่ยังขยับอยู่)
function mergeStaticMeshes(root: THREE.Group, keep: Set<THREE.Object3D>) {
  root.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const isKept = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (keep.has(p) || p.userData.animated) return true;
    return false;
  };
  // วัสดุมาตรฐานที่ไม่มีลาย/แสงในตัว รวมได้โดยเอาสีไปไว้ที่จุดยอด (vertex color) แล้วใช้วัสดุเดียวกันทั้งกลุ่ม
  // ส่วนวัสดุอื่นรวมได้เฉพาะเมื่อใช้วัสดุตัวเดียวกันจริง ๆ
  type Bucket = { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean; meshes: THREE.Mesh[] };
  const buckets = new Map<string, Bucket>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || isKept(m) || Object.keys(m.userData).length > 0) return;
    const src = m.material as THREE.MeshStandardMaterial;
    const plain = src.type === "MeshStandardMaterial" && !src.map && !src.emissiveMap && !src.transparent && !src.vertexColors && src.opacity === 1 && src.emissive.getHex() === 0;
    const geo = m.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld));
    let key: string;
    if (plain) {
      const c = src.color;
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      key = `std|${src.roughness}|${src.metalness}|${src.side}|${src.flatShading}`;
    } else {
      key = `${src.uuid}`;
    }
    key += `|${Object.keys(geo.attributes).sort().join(",")}|${geo.index ? "i" : "n"}`;
    let b = buckets.get(key);
    if (!b) {
      const mat = plain
        ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: src.roughness, metalness: src.metalness, side: src.side, flatShading: src.flatShading })
        : src;
      b = { mat, geos: [], shadow: false, meshes: [] };
      buckets.set(key, b);
    }
    b.geos.push(geo);
    b.shadow = b.shadow || m.castShadow;
    b.meshes.push(m);
  });
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue;
    let merged: THREE.BufferGeometry | null = null;
    try {
      merged = mergeGeometries(b.geos, false);
    } catch {
      merged = null;
    }
    if (!merged) continue;
    for (const m of b.meshes) m.parent?.remove(m);
    const out = new THREE.Mesh(merged, b.mat);
    out.castShadow = b.shadow;
    out.receiveShadow = true;
    root.add(out);
  }
}

// ธีมของต้นคริสต์มาสในฉากหลัก (เทียบทั้ง 3 แบบได้ที่ /Christmas/tree-lab)
const TREE_VARIANT: TreeVariant = "classic";

// ฉากต้นคริสต์มาสด้วย Three.js: ใบไม้แบบจุดระยิบ ไฟประดับ ลูกบอลโลหะ หิมะ และพลุ
export default function TreeScene({ ornaments, preview, reducedMotion, onPick, onOrnamentClick, onError, onReady, ground: groundColor, giants, decor, onDecorClick, onGiantClick, markerSlot, onGroundPick, snowing, crowd, zoneCards = [], onZoneCardClick, onAwayChange, onZoneStop, pickMode = false, giantPickState = null, onGiantPick }: Props) {
  const snowingRef = useRef(snowing);
  snowingRef.current = snowing;
  const mountRef = useRef<HTMLDivElement>(null);
  // ตัวช่วยที่ฉากใช้ร่วมกับ React โดยไม่ต้อง re-render
  const api = useRef<{
    addOrnament: (o: Ornament) => void;
    setOrnaments: (list: Ornament[]) => void;
    setPreview: (p: Preview) => void;
    firework: (color: string) => void;
    setReduced: (v: boolean) => void;
    setCrowd: (count: number, seed: string) => void;
    highlightDecor: (slot: number) => void;
    setGiants: (list: GiantSpec[]) => void;
    setZoneCards: (list: CardRecord[]) => void;
    setDecor: (list: Decor[]) => void;
    setMarker: (slot: number | null) => void;
    setPickMode: (mode: false | "doll" | "giant", taken: number[], giant?: { taken: number[]; held: number[]; spot: number | null } | null) => void;
  } | null>(null);
  const callbacks = useRef({ onPick, onOrnamentClick, onDecorClick, onGiantClick, onGroundPick, onZoneCardClick, onAwayChange, onZoneStop, onGiantPick });
  callbacks.current = { onPick, onOrnamentClick, onDecorClick, onGiantClick, onGroundPick, onZoneCardClick, onAwayChange, onZoneStop, onGiantPick };
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  // สร้างฉากครั้งเดียวเมื่อ mount
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      // ขอบเรียบ (MSAA) กินแรงมากบนจอเล็ก จึงปิดเฉพาะมือถือ
      renderer = new THREE.WebGLRenderer({ antialias: window.innerWidth >= 768, alpha: true, powerPreference: "high-performance" });
    } catch {
      onError();
      return;
    }
    const isSmall = window.matchMedia("(max-width: 767px)").matches;
    // จำนวนพิกเซลที่วาดคือตัวกินเครื่องหลัก จึงจำกัดความละเอียดให้ต่ำลงกว่าเดิม
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.25 : 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    // เงาวาดใหม่เฉพาะตอนของในฉากเปลี่ยน (เดิมวาดทุก 0.25 วินาที ทำให้ภาพกระตุกเป็นจังหวะ)
    let shadowFrames = 2;
    const markShadows = () => {
      shadowFrames = 2;
    };
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    // หมอกบาง ๆ ทำให้พื้นหิมะไกลค่อย ๆ กลมกลืนกับท้องฟ้าค่ำ
    scene.fog = new THREE.Fog(0x0c251d, 14, 56);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
    camera.position.set(0, 3.9, 13.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5.5;
    // ซูมออกได้ไกลพอให้เห็นทั้งวงตุ๊กตาหิมะและตุ๊กตายักษ์ทั้ง 12 จุด
    controls.maxDistance = 60;
    // ก้มกล้องได้ไม่เกินแนวเกือบขนานพื้น (ไม่ให้มุดลงใต้พื้นแล้วเห็นทะลุ)
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.enablePan = false;
    controls.autoRotate = false; // ไม่หมุนเอง ผู้ใช้หมุนดูได้เอง

    // ---------- แสง ----------
    scene.add(new THREE.AmbientLight(0x9fb8d6, 0.35));
    const key = new THREE.DirectionalLight(0xffe2b0, 1.4);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 24;
    key.shadow.camera.bottom = -24;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key);
    key.target.position.set(0, 1, 0);
    scene.add(key.target);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.8);
    rim.position.set(-7, 4, -5);
    scene.add(rim);

    // ---------- พื้นหิมะ ----------
    // พื้นหิมะ: ผิวเป็นลอนกองหิมะเบา ๆ รอบนอก โคนต้นเรียบ และมีเม็ดหิมะจากเท็กซ์เจอร์
    // พื้นหิมะครอบคลุมลานทั้งหมด (ขนาดตามรัศมีลาน) ส่วนขอบจะถูกหมอกบัง
    const groundSize = LAND_R * 2 + 8;
    // ลานเป็นวงกลมแบ่งเป็นวงย่อยหลายชั้น (ยังมีลอนหิมะได้) ไม่มีมุมสี่เหลี่ยมลอยให้เห็นทะลุ
    const groundRadius = groundSize / 2 + 4;
    const groundGeo = new THREE.RingGeometry(0, groundRadius, 180, 90);
    groundGeo.rotateX(-Math.PI / 2);
    const gp = groundGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i);
      const z = gp.getZ(i);
      const d = Math.hypot(x, z);
      const drift = (Math.sin(x * 0.55 + Math.cos(z * 0.7)) * Math.cos(z * 0.45 - x * 0.3) * 0.6 + Math.sin(x * 1.7 + z * 1.3) * 0.25) * 0.11;
      const edge = Math.min(Math.max((d - 10) / 10, 0), 1); // ลานด้านในเรียบ ให้ของประดับวางได้พอดี
      // ในโซนคำอวยพรและทางเดินไปโซนเรียบ รั้วและซุ้มจึงตั้งได้ตรงพื้นพอดี
      const flat = inZone(x, z, 2.5) || distToPath(x, z) < 2.4 ? 0 : 1;
      gp.setY(i, drift * edge * edge * flat);
    }
    groundGeo.computeVertexNormals();
    const snowTex = makeSnowTexture();
    // ลานหิมะกว้างกว่าเดิม ขอบด้านไกลถูกเนินเขาบังไว้
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: groundColor, map: snowTex, bumpMap: snowTex, bumpScale: 0.03, roughness: 0.82, metalness: 0 }),
    );
    ground.receiveShadow = true;
    ground.position.y = -0.02;
    scene.add(ground);
    // ขอบดินหนาใต้ลานและพื้นด้านล่าง: มองจากมุมต่ำแค่ไหนก็ไม่เห็นเป็นช่องโหว่
    const soil = new THREE.MeshStandardMaterial({ color: 0x23423a, roughness: 1, side: THREE.DoubleSide });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(groundRadius, groundRadius * 0.92, 4.2, 180, 1, true), soil);
    skirt.position.y = -2.12;
    scene.add(skirt);
    const underside = new THREE.Mesh(new THREE.CircleGeometry(groundRadius * 0.92, 180), new THREE.MeshBasicMaterial({ color: 0x0c251d, side: THREE.DoubleSide }));
    underside.rotation.x = Math.PI / 2;
    underside.position.y = -4.22;
    scene.add(underside);

    // ---------- ต้นคริสต์มาส: พุ่มสนจากกิ่งจริง ไฟ สายลูกปัด ดาว ผ้าคลุมโคน และกล่องของขวัญ (treeModel.ts) ----------
    const glowTex = makeGlowTexture();
    const tree = buildTreeModel({ variant: TREE_VARIANT, small: isSmall, glowTex, starLight: false });
    scene.add(tree.group);
    const hitCone = tree.hitMesh;
    // ลานหินลายทองรอบต้น รั้วไม้เท้าลูกกวาดกับโคมไฟ และอุโมงค์ซุ้มไฟตามทางไปโซนคำอวยพร
    const plaza = buildPlaza({ gate: ZONE_GATE, glowTex, small: isSmall });
    scene.add(plaza.group);

    // ---------- ลูกบอลคำอวยพร: ห้อยจากกิ่งจริง รองรับได้ถึง 999 ลูก (ornamentLayer.ts) ----------
    const ornLayer = createOrnamentLayer({
      capacity: TREE_CAPACITY,
      // ลูกบอลหล่นลงถึงจุดแขวน: มีประกายสีเดียวกับลูกบอลแตกออกเบา ๆ
      onLanded: (pos, color) => (markShadows(), burst(pos.clone().add(new THREE.Vector3(0, 0.08, 0)), color, isSmall ? 14 : 24, 0.25)),
    });
    scene.add(ornLayer.group);
    let loadedOnce = false;

    // ---------- ออร่าความคืบหน้า: ไต่จากโคนถึงยอดตามจำนวนคำอวยพร (treeAura.ts) ----------
    const aura = createTreeAura({ small: isSmall, pixelRatio: renderer.getPixelRatio() });
    scene.add(aura.group);

    // ต้น ลูกบอล และออร่าใช้ instancing ที่เดิมปิดการตัดวัตถุนอกจอ (วาดทุกเฟรมแม้กล้องหันไปทางอื่น)
    // ให้ทุกชิ้นใช้ทรงกลมครอบต้นเดียวกัน เมื่อกล้องอยู่ในหมู่บ้านหรือหันออกจากต้น การ์ดจอจะข้ามไปเลย
    const treeSphere = new THREE.Sphere(new THREE.Vector3(0, 3.2, 0), 5);
    for (const root of [tree.group, ornLayer.group, aura.group]) {
      root.traverse((o) => {
        if (o.frustumCulled) return;
        const inst = o as THREE.InstancedMesh;
        const geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        if (inst.isInstancedMesh) inst.boundingSphere = treeSphere.clone();
        else if (geo) geo.boundingSphere = treeSphere.clone();
        else return;
        o.frustumCulled = true;
      });
    }

    // ---------- ตัวอย่างลูกบอลก่อนยืนยัน ----------
    const previewMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    previewMesh.visible = false;
    scene.add(previewMesh);

    // ---------- ฉากรอบลาน: เสาไฟโบราณกับสายไฟห้อย ม้านั่ง ลูกบอลยักษ์ ป่าสนหิมะเกาะ (treeSurroundings.ts) ----------
    const surroundings = buildSurroundings({
      glowTex,
      small: isSmall,
      gate: ZONE_GATE,
      blocked: (x, z, pad) => distToPath(x, z) < 1.7 + pad || inZone(x, z, pad),
    });
    scene.add(surroundings.group);

    // ---------- ฝูงชนเงาในโซนนี้: จำนวนตามคนออนไลน์ ตำแหน่งต่างกันในแต่ละโซน ----------
    const crowdGroup = new THREE.Group();
    scene.add(crowdGroup);
    const silTex = new Map<string, THREE.CanvasTexture>();
    for (const v of ["adult", "hat", "bag", "child"]) silTex.set(v, makeSilhouetteTexture(v));
    const crowdMats: THREE.Material[] = [];
    function setCrowd(count: number, seed: string) {
      crowdGroup.clear();
      for (const m of crowdMats) m.dispose();
      crowdMats.length = 0;
      const rnd = seededRandom(seed);
      const total = Math.min(Math.max(Math.round(count), 0), 60);
      const variants = ["adult", "hat", "adult", "bag", "adult", "hat", "bag", "adult"];
      for (let i = 0; i < total; i++) {
        let angle = rnd() * Math.PI * 2;
        const dist = 15 + rnd() * 5;
        // ไม่ให้เงาคนยืนบนทางเดินหรือในโซนคำอวยพร
        for (let tries = 0; tries < 6 && (distToPath(Math.cos(angle) * dist, Math.sin(angle) * dist) < 2 || inZone(Math.cos(angle) * dist, Math.sin(angle) * dist, 1)); tries++) angle += 0.5;
        const variant = rnd() < 0.15 ? "child" : variants[Math.floor(rnd() * variants.length)];
        const h = variant === "child" ? 1.25 : 1.75 + (rnd() - 0.5) * 0.12;
        const aspect = variant === "child" ? 0.5 : 0.48;
        const mat = new THREE.SpriteMaterial({ map: silTex.get(variant), color: 0x1f4a3b, transparent: true, opacity: 0.92, depthWrite: false, fog: true });
        crowdMats.push(mat);
        const sp = new THREE.Sprite(mat);
        sp.scale.set(h * aspect, h, 1);
        sp.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
        crowdGroup.add(sp);
      }
    }
    setCrowd(crowd.count, crowd.seed);

    // ---------- เนินเขาเป็นวงรอบฉากในโลก 3 มิติ จึงหมุนไปพร้อมกับพื้นหิมะและต้นไม้ ----------
    scene.add(buildHills());

    // ---------- หิมะตก ----------
    const SNOW = isSmall ? 320 : 800;
    const snowPos = new Float32Array(SNOW * 3);
    const snowSpeed = new Float32Array(SNOW);
    for (let i = 0; i < SNOW; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 16;
      snowPos[i * 3 + 1] = Math.random() * 10;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      snowSpeed[i] = 0.25 + Math.random() * 0.45;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
    const snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.85, depthWrite: false, map: glowTex, blending: THREE.AdditiveBlending }),
    );
    scene.add(snow);

    // ---------- พลุ ----------
    type Burst = { points: THREE.Points; vel: Float32Array; start: number; life: number; origin: THREE.Vector3 };
    const bursts: Burst[] = [];
    function burst(origin: THREE.Vector3, hex: number, n: number, speedScale: number) {
      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const sp = (1.1 + Math.random() * 1.3) * speedScale;
        vel[i * 3] = s * Math.cos(th) * sp;
        vel[i * 3 + 1] = u * sp;
        vel[i * 3 + 2] = s * Math.sin(th) * sp;
        pos[i * 3] = origin.x;
        pos[i * 3 + 1] = origin.y;
        pos[i * 3 + 2] = origin.z;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.Points(
        g,
        new THREE.PointsMaterial({ color: hex, size: isSmall ? 0.22 : 0.26, map: glowTex, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      scene.add(m);
      bursts.push({ points: m, vel, start: performance.now(), life: 2400, origin });
      if (bursts.length > 14) {
        const old = bursts.shift();
        if (old) {
          scene.remove(old.points);
          old.points.geometry.dispose();
        }
      }
    }

    // ฉลองต้นครบ 999 คำอวยพร: ออร่าพุ่งออกรอบต้น พลุหลายสีต่อเนื่อง และประกายทองโปรยจากยอด
    let celebrateTimers: number[] = [];
    function celebrateTree() {
      celebrateTimers.forEach((id) => clearTimeout(id));
      celebrateTimers = [];
      aura.celebrate();
      const colors = ["gold", "red", "white", "pink", "blue", "green"];
      const shots = reduced ? 4 : 24;
      for (let i = 0; i < shots; i++) celebrateTimers.push(window.setTimeout(() => firework(colors[i % colors.length]), 200 + i * 420));
      // ประกายทองโปรยลงรอบต้นจากยอดเป็นจังหวะ
      for (let i = 0; i < (reduced ? 2 : 10); i++) {
        celebrateTimers.push(window.setTimeout(() => burst(new THREE.Vector3(0, TREE_TOP_Y + 0.3, 0), 0xffd76a, isSmall ? 70 : 130, 0.7), 400 + i * 950));
      }
    }
    function firework(colorName: string) {
      const hex = ORNAMENT_HEX[colorName] ?? 0xffd76a;
      const n = isSmall ? 90 : 160;
      // จุดระเบิดต้องอยู่ในกรอบกล้อง: เหนือยอดต้นเล็กน้อยและกระจายซ้ายขวา
      const origin = new THREE.Vector3((Math.random() - 0.5) * 6, TREE_TOP_Y + 0.2 + Math.random() * 0.9, -2.5 + Math.random() * 3.5);
      burst(origin, hex, n, 1);
    }

    // ---------- ข้อความบนท้องฟ้า: ธีมต่าง ๆ เห็นพร้อมกันทุกจอ ----------
    type Sky = { group: THREE.Group; panel: THREE.Sprite; start: number; dur: number; nextSpark: number; hex: number; theme: string; sled?: THREE.Sprite; sparkle?: THREE.Points };
    let sky: Sky | null = null;
    let storm = 0; // ความแรงของหิมะโปรยในธีมหิมะ ค่อย ๆ ลดลง
    function disposeSky() {
      if (!sky) return;
      scene.remove(sky.group);
      sky.group.traverse((o) => {
        const obj = o as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material & { map?: THREE.Texture | null } };
        obj.geometry?.dispose();
        obj.material?.map?.dispose();
        obj.material?.dispose();
      });
      sky = null;
    }
    // กรอบประกายรอบข้อความ ใช้จุดเรืองแสงเรียงตามขอบกรอบ
    function makeSparkleRing(hex: number): THREE.Points {
      const N = 70;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const t4 = ((i / N) * 4) % 4;
        const side = Math.floor(t4);
        const f = t4 - side;
        let x = 0;
        let y = 0;
        if (side === 0) {
          x = -3.5 + 7 * f;
          y = 6.05;
        } else if (side === 1) {
          x = 3.5;
          y = 6.05 - 1.7 * f;
        } else if (side === 2) {
          x = 3.5 - 7 * f;
          y = 4.35;
        } else {
          x = -3.5;
          y = 4.35 + 1.7 * f;
        }
        pos[i * 3] = x + (Math.random() - 0.5) * 0.12;
        pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.12;
        pos[i * 3 + 2] = -1.6;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(
        g,
        new THREE.PointsMaterial({ color: hex, size: 0.3, map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
    }
    const zoneAwayRef = { v: false };
    const walkRef = { v: false };
    // ---------- ปรับขนาดและเรนเดอร์ ----------
    function resize() {
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      // จอแคบให้ถอยกล้องออกเพื่อให้ต้นไม้ไม่ถูกตัด (ระหว่างเดินหรืออยู่ในหมู่บ้าน มุมกล้องคุมโดยเส้นทาง)
      if (!zoneAwayRef.v && !walkRef.v) camera.fov = camera.aspect < 0.8 ? 50 : 38;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ความละเอียดปรับเองตามความเร็วเครื่อง: วาดไม่ทัน 60 fps ต่อเนื่อง 1.5 วินาที ลดลงทีละขั้น
    // และเครื่องเหลือแรงต่อเนื่อง 5 วินาที เพิ่มกลับ (ไม่เกินค่าตั้งต้น)
    const PR_MAX = renderer.getPixelRatio();
    const PR_MIN = isSmall ? 0.75 : 0.9;
    let frameAvg = 16.7;
    let slowFor = 0;
    let fastFor = 0;
    function governPixelRatio(dtMs: number) {
      if (dtMs > 200) return; // แท็บเพิ่งกลับมาจากเบื้องหลัง ไม่นับ
      frameAvg += (dtMs - frameAvg) * 0.05;
      const pr = renderer.getPixelRatio();
      if (frameAvg > 19) {
        slowFor += dtMs;
        fastFor = 0;
        if (slowFor > 1500 && pr > PR_MIN) {
          renderer.setPixelRatio(Math.max(PR_MIN, pr - 0.15));
          resize();
          slowFor = 0;
          frameAvg = 16.7;
        }
      } else if (frameAvg < 15 && pr < PR_MAX) {
        fastFor += dtMs;
        slowFor = 0;
        if (fastFor > 5000) {
          renderer.setPixelRatio(Math.min(PR_MAX, pr + 0.1));
          resize();
          fastFor = 0;
        }
      } else {
        slowFor = 0;
        fastFor = 0;
      }
    }

    // คลิกหรือแตะ: ถ้าโดนลูกบอลให้แสดงคำอวยพร ถ้าโดนผิวต้นให้เลือกตำแหน่งแขวน
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      // โหมดเลือกช่องบนฉาก: ใช้ช่องที่อยู่ใต้จุดแตะพอดี และไม่เปิดสิ่งอื่น
      if (pickOn) {
        const gh = raycaster.intersectObject(ground, false)[0];
        if (gh) {
          if (pickKind === "giant") callbacks.current.onGiantPick?.(giantAtWorld(gh.point.x, gh.point.z));
          else callbacks.current.onGroundPick(slotAtWorld(gh.point.x, gh.point.z));
        }
        return;
      }
      const picked = ornLayer.pick(raycaster);
      if (picked) {
        callbacks.current.onOrnamentClick(picked);
        return;
      }
      const decorHit = raycaster.intersectObjects(decorGroup.children, true)[0];
      if (decorHit) {
        let obj: THREE.Object3D | null = decorHit.object;
        while (obj && !obj.userData.decorId) obj = obj.parent;
        const d = obj ? decorById.get(obj.userData.decorId as string) : undefined;
        if (d) {
          callbacks.current.onDecorClick(d);
          return;
        }
      }
      // บ้านหิมะ Exclusive: กล้องบินไปหา แล้วเปิดป้ายและลิงก์ของเจ้าของ
      const giantHit = raycaster.intersectObjects([...giantGroups.values()].map((v) => v.grp), true)[0];
      if (giantHit) {
        let obj: THREE.Object3D | null = giantHit.object;
        while (obj && obj.userData.giantSpot === undefined) obj = obj.parent;
        const spec = obj ? giantSpecs.get(obj.userData.giantSpot as number) : undefined;
        if (spec) {
          focusGiant(spec.spot);
          callbacks.current.onGiantClick?.(spec);
          return;
        }
      }
      if (instBodies) {
        const ih = raycaster.intersectObject(instBodies, false)[0];
        if (ih && ih.instanceId !== undefined && instDecor[ih.instanceId]) {
          callbacks.current.onDecorClick(instDecor[ih.instanceId]);
          return;
        }
      }
      const zoneCardId = village.pickCard(raycaster);
      if (zoneCardId) {
        callbacks.current.onZoneCardClick?.(zoneCardId);
        return;
      }
      const hit = raycaster.intersectObject(hitCone, false)[0];
      if (hit) {
        const local = hit.point.clone(); // ต้นอยู่ที่จุดกำเนิดของฉาก
        const pick = pointToHeightAngle(local.x, local.y, local.z);
        callbacks.current.onPick(pick.height, pick.angle);
        return;
      }
      // แตะพื้นปกติไม่ทำอะไร (เลือกช่องได้เฉพาะในโหมด "บนฉาก" จากหน้าตกแต่งตุ๊กตา)
    };
    // เมื่อเลื่อนเมาส์ไปโดนลูกบอลให้เปลี่ยนเคอร์เซอร์เป็นมือชี้
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (pickOn) {
        // กรอบช่องใต้เมาส์: เขียว = ว่าง, แดง = วางไม่ได้
        const gh = raycaster.intersectObject(ground, false)[0];
        if (gh && pickKind === "giant") {
          const spot = giantAtWorld(gh.point.x, gh.point.z);
          if (spot !== null) {
            const gp = GIANT_REAL[spot];
            hoverCell.position.set(gp.x, 0.06, gp.z);
            hoverCell.scale.setScalar(2);
            hoverCell.visible = true;
            (hoverCell.material as THREE.MeshBasicMaterial).color.setHex(giantBusy.has(spot) ? 0xef4444 : 0x4ade80);
          } else hoverCell.visible = false;
        } else if (gh) {
          const slot = slotAtWorld(gh.point.x, gh.point.z);
          const cx = Math.floor(gh.point.x / CELL);
          const cz = Math.floor(gh.point.z / CELL);
          hoverCell.position.set((cx + 0.5) * CELL, 0.06, (cz + 0.5) * CELL);
          hoverCell.scale.setScalar(1);
          hoverCell.visible = true;
          (hoverCell.material as THREE.MeshBasicMaterial).color.setHex(slot !== null && !pickTaken.has(slot) ? 0x4ade80 : 0xef4444);
        } else hoverCell.visible = false;
        renderer.domElement.style.cursor = "crosshair";
        return;
      }
      renderer.domElement.style.cursor = ornLayer.pick(raycaster) ? "pointer" : "";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    // ตอนพัฒนา: วัดเวลาวาดจริงด้วยการวาดซ้ำแล้วรอ GPU ทำเสร็จ (ใช้ได้แม้แท็บอยู่เบื้องหลัง)
    if (process.env.NODE_ENV !== "production") {
      // รายการสามเหลี่ยมมากสุด 15 อันดับ (นับรวมจำนวน instance)
      (window as unknown as { __xmasTris?: unknown }).__xmasTris = () => {
        const rows: { name: string; tris: number; inst: number }[] = [];
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.visible) return;
          const g = m.geometry;
          const per = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
          const inst = (m as unknown as THREE.InstancedMesh).isInstancedMesh ? (m as unknown as THREE.InstancedMesh).count : 1;
          let path = "";
          for (let p: THREE.Object3D | null = o; p && p !== scene; p = p.parent) path = (p.name || p.type) + "/" + path;
          rows.push({ name: path.slice(-80) + ` [${g.type}]`, tris: Math.round(per * inst), inst });
        });
        return rows.sort((a, b) => b.tris - a.tris).slice(0, 15);
      };
      // ตำแหน่งบนจอของตุ๊กตาหิมะแต่ละตัว (ไว้ทดสอบการกดและป้ายชื่อ)
      (window as unknown as { __xmasDecorScreen?: unknown }).__xmasDecorScreen = () => {
        const r = renderer.domElement.getBoundingClientRect();
        return decorGroup.children.map((c) => {
          const v = new THREE.Vector3();
          c.getWorldPosition(v);
          v.y += 0.4;
          v.project(camera);
          return { id: c.userData.decorId, x: Math.round(r.left + ((v.x + 1) / 2) * r.width), y: Math.round(r.top + ((1 - v.y) / 2) * r.height), front: v.z < 1 };
        });
      };
      (window as unknown as { __xmasBench?: unknown }).__xmasBench = (n = 30, shadows = false) => {
        const gl = renderer.getContext();
        renderer.render(scene, camera);
        gl.finish();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          if (shadows) renderer.shadowMap.needsUpdate = true;
          renderer.render(scene, camera);
        }
        gl.finish();
        const ms = (performance.now() - t0) / n;
        void ms;
        return { msPerFrame: Math.round(ms * 100) / 100, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, px: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height] };
      };
    }
    // ---------- วนลูปภาพ ----------
    let reduced = reducedMotion;
    let raf = 0;
    const startedAt = performance.now();
    let lastFrameAt = startedAt;
    let lastGovAt = startedAt;
    function frame() {
      // ระหว่างหน้าเปิด (ลูกแก้วหิมะ) ฉากหลักหยุดวาด เครื่องจึงทำงานภาพเดียว
      if (document.documentElement.dataset.intro === "on") {
        raf = requestAnimationFrame(frame);
        return;
      }
      const t = (performance.now() - startedAt) / 1000;
      if (focusDecorGroup) {
        // โยกตัวเบา ๆ และกระโดดนิดหนึ่ง เหมือนกำลังทักทาย
        focusDecorGroup.rotation.z = Math.sin(t * 2.4) * 0.09;
        focusDecorGroup.position.y = Math.abs(Math.sin(t * 2.6)) * 0.1;
      }
      const now = performance.now();
      governPixelRatio(now - lastGovAt);
      lastGovAt = now;
      if (beacon) {
        const age = (now - beacon.start) / 1000;
        const b = beacon;
        if (age > 7) clearBeacon();
        else {
          const fade = age > 6 ? 7 - age : 1;
          b.ring.scale.setScalar(1 + (reduced ? 0 : 0.22 * Math.sin(t * 5)));
          (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade;
          b.arrow.position.y = b.top + (reduced ? 0 : Math.abs(Math.sin(t * 3)) * 0.35);
          (b.arrow.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade;
        }
      }

      // ฉากที่มีการเคลื่อนไหว: ไฟ ควัน ต้นสนเรืองแสง และบ้านของ Exclusive
      sceneryUpdaters.forEach((u) => u(t, reduced));
      giantGroups.forEach(({ grp }) => (grp.userData.update as ((t: number, r: boolean) => void) | undefined)?.(t, reduced));
      // ซานตาบินตามนาฬิกาเซิร์ฟเวอร์ ทุกคนในห้องจึงเห็นการบินเดียวกันในเวลาเดียวกัน
      const flightDt = Math.min(0.05, (now - lastFlightFrame) / 1000);
      lastFlightFrame = now;
      const flightProgress = reduced ? null : flightProgressAt(serverNowMs());
      flight.update(flightProgress, serverNowMs() / 1000, flightDt);
      if (!reduced && now - lastZoneBurst > 2600) {
        lastZoneBurst = now;
        zoneFirework();
      }

      village.update(t, reduced, camera.position);
      surroundings.update(t, reduced);
      stepWalk(now);
      if (camAnim) {
        const k = Math.min((now - camAnim.start) / camAnim.dur, 1);
        const e = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
        controls.target.lerpVectors(camAnim.fromTgt, camAnim.toTgt, e);
        if (k >= 1) camAnim = null;
      }
      controls.autoRotate = false;
      controls.update();
      // กันกล้องและจุดมองไม่ให้ต่ำกว่าพื้นหิมะ (เช่นตอนซูมเข้าใกล้หรือหมุนมุมต่ำ)
      if (camera.position.y < 0.45) camera.position.y = 0.45;
      if (controls.target.y < 0) controls.target.y = 0;

      const frameDt = Math.min(0.05, (now - lastFrameAt) / 1000);
      lastFrameAt = now;
      tree.update(t, reduced);
      plaza.update(t, reduced);
      ornLayer.update(now, t, reduced);
      aura.update(frameDt, t, reduced);

      if (marker.visible) {
        const k = (1 + 0.12 * Math.sin(t * 4)) * ((marker.userData.base as number | undefined) ?? 1);
        marker.scale.set(k, k, 1);
      }

      if (sky) {
        const age = (now - sky.start) / 1000;
        const dur = sky.dur / 1000;
        const fadeIn = Math.min(age / 0.6, 1);
        const fadeOut = Math.min(Math.max((dur - age) / 1, 0), 1);
        const alpha = fadeIn * fadeOut;
        (sky.panel.material as THREE.SpriteMaterial).opacity = alpha;
        const pop = 0.88 + 0.12 * easeOutBounce(Math.min(age / 0.7, 1));
        sky.panel.scale.set((isSmall ? 5.8 : 6.4) * pop, (isSmall ? 1.45 : 1.6) * pop, 1);
        sky.panel.position.y = TREE_TOP_Y + 1.6 + Math.sin(t * 1.2) * 0.06;
        if (sky.sled) {
          (sky.sled.material as THREE.SpriteMaterial).opacity = alpha;
          const k = Math.min(age / dur, 1);
          sky.sled.position.set(-16 + 32 * k, TREE_TOP_Y + 0.7 + Math.sin(age * 3.2) * 0.14, -2.4);
        }
        if (sky.sparkle) {
          (sky.sparkle.material as THREE.PointsMaterial).opacity = alpha * (0.45 + 0.4 * Math.sin(t * 6));
        }
        if (now >= sky.nextSpark && age < dur - 0.5) {
          sky.nextSpark = now + 700;
          const x = (Math.random() - 0.5) * 9;
          burst(new THREE.Vector3(x, 6.2 + Math.random() * 0.4, -1.6), sky.hex, isSmall ? 14 : 24, 0.25);
        }
        if (age >= dur) disposeSky();
      }
      if (highlight) {
        const age = (now - highlight.start) / 1000;
        const hl = highlight as { ring: THREE.Mesh; start: number };
        const mat = hl.ring.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.9 * (1 - age / 5)) * (0.7 + 0.3 * Math.sin(age * 8));
        hl.ring.scale.setScalar(1 + Math.min(age, 1) * 0.6);
        if (age >= 5) {
          scene.remove(hl.ring);
          hl.ring.geometry.dispose();
          mat.dispose();
          highlight = null;
        }
      }
      storm = Math.max(0, storm - 0.003);

      if (previewMesh.visible) {
        (previewMesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.2 * Math.sin(t * 4);
      }

      snow.visible = snowingRef.current;
      const pos = snowGeo.getAttribute("position") as THREE.BufferAttribute;
      if (!reduced && snowingRef.current) {
        for (let i = 0; i < SNOW; i++) {
          let y = pos.getY(i) - snowSpeed[i] * 0.012 * (1 + storm * 5);
          let x = pos.getX(i) + Math.sin(t * 0.7 + i) * 0.0015;
          if (y < -0.1) {
            y = 10;
            x = (Math.random() - 0.5) * 16;
          }
          pos.setX(i, x);
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        const age = now - b.start;
        const k = age / b.life;
        if (k >= 1) {
          scene.remove(b.points);
          b.points.geometry.dispose();
          bursts.splice(i, 1);
          continue;
        }
        const p = b.points.geometry.getAttribute("position") as THREE.BufferAttribute;
        const dt = 1 / 60;
        for (let j = 0; j < p.count; j++) {
          b.vel[j * 3 + 1] -= 0.9 * dt;
          b.vel[j * 3] *= 0.978;
          b.vel[j * 3 + 1] *= 0.978;
          b.vel[j * 3 + 2] *= 0.978;
          p.setXYZ(j, p.getX(j) + b.vel[j * 3] * dt, p.getY(j) + b.vel[j * 3 + 1] * dt, p.getZ(j) + b.vel[j * 3 + 2] * dt);
        }
        p.needsUpdate = true;
        (b.points.material as THREE.PointsMaterial).opacity = 1 - k * k;
      }

      // เงาไม่ต้องวาดใหม่ทุกเฟรม (ของส่วนใหญ่อยู่นิ่ง) จึงอัปเดตทุก 0.25 วินาที เงาของชิ้นใหม่จะขึ้นช้าไม่กี่ร้อยมิลลิวินาที
      if (shadowFrames > 0) {
        renderer.shadowMap.needsUpdate = true;
        shadowFrames--;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    // ---------- ตุ๊กตาหิมะยักษ์ของห้อง พร้อมป้ายห้อย ----------
    // ตุ๊กตาหิมะ Exclusive: ฐานกลมลายขนม ของตกแต่งตามที่ผู้ซื้อวางบนตาราง 4×4 ตั้งอยู่กึ่งกลางจุด 2×2
    function buildGiant(g: GiantSpec) {
      // ข้อมูลที่บันทึกไว้ก่อนหน้านี้ถูกตรวจและเติมค่าเริ่มต้นก่อนใช้
      const look = parseGiantLook(g.look) ?? DEFAULT_GIANT_LOOK;
      const def = GIANT_POSITIONS[g.spot] ?? GIANT_POSITIONS[0];
      const d = buildDiorama({ look, name: g.name, message: g.message });
      const grp = d.group;
      grp.userData.update = d.update;
      grp.position.set(def.x, 0, def.z);
      grp.scale.setScalar(GIANT_MODEL_SCALE);
      grp.userData.giantSpot = g.spot;
      return grp;
    }
    const giantGroups = new Map<number, { key: string; grp: THREE.Group }>();
    const giantSpecs = new Map<number, GiantSpec>();
    // กล้องบินไปหาบ้านที่แตะ (ค่าเป็นจุดเริ่มและจุดหมายของการเคลื่อนกล้อง)
    // บ้านหิมะ Exclusive: บินเข้าหาเหมือนตุ๊กตาที่ผู้ใช้ตกแต่ง และจำมุมเดิมไว้ให้กลับมาได้
    function focusGiant(spot: number | null) {
      if (spot === null) {
        callbacks.current.onAwayChange?.(false);
        if (savedView) {
          animateCam(savedView.pos, savedView.tgt, 1000);
          controls.minDistance = savedView.min;
          savedView = null;
        }
        return;
      }
      const def = GIANT_POSITIONS[spot] ?? GIANT_POSITIONS[0];
      rememberView();
      callbacks.current.onAwayChange?.(true);
      const tgt = new THREE.Vector3(def.x, 0.9, def.z);
      const dir = new THREE.Vector3(camera.position.x - def.x, 0, camera.position.z - def.z);
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
      dir.normalize().multiplyScalar(4.8);
      controls.minDistance = 3;
      animateCam(new THREE.Vector3(def.x + dir.x, 2.4, def.z + dir.z), tgt, reduced ? 1 : 900);
    }
    function disposeGroup(grp: THREE.Group) {
      scene.remove(grp);
      grp.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        const release = (x: THREE.Material) => {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        };
        if (Array.isArray(mat)) mat.forEach(release);
        else if (mat) release(mat);
      });
    }
    // ตุ๊กตายักษ์ทุกตัวของห้อง: สร้างเฉพาะตัวที่เพิ่งมา และเอาตัวที่หายไปออก
    function api_setGiants(list: GiantSpec[]) {
      markShadows();
      const keep = new Set<number>();
      for (const g of list) {
        const key = JSON.stringify(g);
        keep.add(g.spot);
        giantSpecs.set(g.spot, g);
        const cur = giantGroups.get(g.spot);
        if (cur && cur.key === key) continue;
        if (cur) disposeGroup(cur.grp);
        const grp = buildGiant(g);
        scene.add(grp);
        giantGroups.set(g.spot, { key, grp });
      }
      for (const [spot, cur] of [...giantGroups]) {
        if (!keep.has(spot)) {
          disposeGroup(cur.grp);
          giantGroups.delete(spot);
          giantSpecs.delete(spot);
        }
      }
    }

    // ---------- ตุ๊กตาหิมะที่ผู้ใช้ตกแต่ง วางรอบต้น ----------
    const decorGroup = new THREE.Group();
    scene.add(decorGroup);
    const decorById = new Map<string, Decor>();
    const SLOT_R = 2.7;
    const slotAngle = (i: number) => (i / SLOT_COUNT) * Math.PI * 2 + 0.4;
    const BODY_HEX: Record<string, number> = { white: 0xffffff, mint: 0xd1fae5, sky: 0xdbeafe, blush: 0xfce7f3, pearl: 0xfff6e6, ice: 0xd6f3ff };
    const SCARF_HEX: Record<string, number> = { red: 0xdc2643, green: 0x16a34a, gold: 0xf5c542, blue: 0x3b82f6, white: 0xf8fafc, plaid: 0xb91c3c, purple: 0xa855f7 };
    const HAT_HEX = 0x1f2937;

    // ---------- หมู่บ้านคำอวยพร: กำแพงการ์ดสองวงรอบต้นสนกลางลาน บ้านหิมะ เสาไฟ (สร้างใน wishVillage.ts) ----------
    const village = buildWishVillage({ glowTex, small: isSmall });
    scene.add(village.group);
    mergeStaticMeshes(village.staticRoot, new Set<THREE.Object3D>());
    const zx = ZONE.x;
    const zz = ZONE.z;
    function api_setZoneCards(list: CardRecord[]) {
      village.setCards(list.slice(0, ZONE_CAPACITY).map((c) => ({ id: c.id, envelope: c.envelope, name: c.name })));
    }
    const sceneryUpdaters: ((t: number, reduced: boolean) => void)[] = [];
    // พลุในโซนเป็นจังหวะเบา ๆ เหนือลาน (ปิดเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว)
    let lastZoneBurst = 0;
    // ซานตากับกวางเรนเดียร์บินข้ามท้องฟ้าเป็นช่วง ๆ (ไม่แสดงเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว)
    const flight = buildSleighFlight();
    scene.add(flight.group);
    let lastFlightFrame = performance.now();
    startServerClock();
    const ZONE_FIREWORK_HEX = [0xffd76a, 0xff6b8a, 0x7dd3fc, 0x86efac];
    function zoneFirework() {
      const origin = new THREE.Vector3(zx + (Math.random() - 0.5) * 9, 4.0 + Math.random() * 0.8, zz + (Math.random() - 0.5) * 8);
      burst(origin, ZONE_FIREWORK_HEX[Math.floor(Math.random() * ZONE_FIREWORK_HEX.length)], isSmall ? 70 : 110, 0.7);
    }
    api_setZoneCards(zoneCards);
    // ตั้งตุ๊กตายักษ์หลังค่าสีทั้งหมดพร้อมแล้ว (กันการเข้าถึงก่อนประกาศ)
    api_setGiants(giants);

    // ตุ๊กตาหิมะแบบละเอียด: โมเดลชุดเดียวกับหน้าตกแต่ง (snowmanModel.ts)
    function buildDecorSnowman(d: Decor) {
      const grp = buildSnowman(d);
      // ติดรหัสตุ๊กตาไว้ทุกชิ้น เพื่อให้กดโดนส่วนไหนก็เปิดการ์ดของตัวนี้ได้
      grp.userData.decorId = d.id;
      grp.traverse((o) => (o.userData.decorId = d.id));
      return grp;
    }

    // ตำแหน่งที่กำลังเลือกบนพื้น: วงแหวนเรืองแสงที่เต้นเบา ๆ
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.36, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    marker.renderOrder = 6; // อยู่เหนือตารางช่องในโหมดเลือกบนฉาก
    scene.add(marker);

    // ---------- โหมดเลือกช่องบนฉาก: ตารางช่องบนพื้น (เขียว = ว่าง, แดง = มีคนวางแล้ว) ----------
    let pickOn = false;
    let pickTaken = new Set<number>();
    const openSlots: number[] = [];
    SLOT_REAL.forEach((_, i) => {
      if (slotAtWorld(SLOT_REAL[i].x, SLOT_REAL[i].z) === i) openSlots.push(i);
    });
    const tileGeo = new THREE.PlaneGeometry(CELL * 0.84, CELL * 0.84);
    tileGeo.rotateX(-Math.PI / 2);
    const pickGrid = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }), openSlots.length);
    openSlots.forEach((slot, k) => pickGrid.setMatrixAt(k, new THREE.Matrix4().makeTranslation(SLOT_REAL[slot].x, 0.045, SLOT_REAL[slot].z)));
    pickGrid.visible = false;
    pickGrid.renderOrder = 3;
    scene.add(pickGrid);
    const hoverCell = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.42, CELL * 0.52, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
    hoverCell.rotation.x = -Math.PI / 2;
    hoverCell.visible = false;
    hoverCell.renderOrder = 4;
    scene.add(hoverCell);
    const FREE = new THREE.Color(0x4ade80);
    const TAKEN = new THREE.Color(0xef4444);
    // จุดบ้าน Exclusive (2×2) ที่เปิดอยู่: กรอบใหญ่บนพื้น เขียว = ว่าง, ส้ม = มีคนจอง, แดง = ซื้อแล้ว, ทอง = ที่เลือก
    let pickKind: false | "doll" | "giant" = false;
    let giantBusy = new Set<number>();
    const openGiants: number[] = [];
    GIANT_REAL.forEach((g, i) => {
      if (!g.blocked) openGiants.push(i);
    });
    const giantTileGeo = new THREE.PlaneGeometry(CELL * 1.84, CELL * 1.84);
    giantTileGeo.rotateX(-Math.PI / 2);
    const giantGrid = new THREE.InstancedMesh(giantTileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }), openGiants.length);
    openGiants.forEach((spot, k) => giantGrid.setMatrixAt(k, new THREE.Matrix4().makeTranslation(GIANT_REAL[spot].x, 0.05, GIANT_REAL[spot].z)));
    giantGrid.visible = false;
    giantGrid.renderOrder = 3;
    scene.add(giantGrid);
    const giantByCell = new Map<string, number>();
    openGiants.forEach((spot) => {
      const c = GIANT_REAL[spot].cell;
      for (const dx of [0, 1]) for (const dz of [0, 1]) giantByCell.set(`${c.x + dx},${c.z + dz}`, spot);
    });
    function giantAtWorld(x: number, z: number): number | null {
      return giantByCell.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? null;
    }
    const HELD = new THREE.Color(0xf59e0b);
    const PICKED = new THREE.Color(0xfacc15);
    function setPickMode(mode: false | "doll" | "giant", taken: number[], giant?: { taken: number[]; held: number[]; spot: number | null } | null) {
      pickTaken = new Set(taken);
      openSlots.forEach((slot, k) => pickGrid.setColorAt(k, pickTaken.has(slot) ? TAKEN : FREE));
      if (pickGrid.instanceColor) pickGrid.instanceColor.needsUpdate = true;
      if (giant) {
        const taken2 = new Set(giant.taken);
        const held2 = new Set(giant.held);
        giantBusy = new Set([...giant.taken, ...giant.held]);
        openGiants.forEach((spot, k) => giantGrid.setColorAt(k, spot === giant.spot ? PICKED : taken2.has(spot) ? TAKEN : held2.has(spot) ? HELD : FREE));
        if (giantGrid.instanceColor) giantGrid.instanceColor.needsUpdate = true;
        if (giant.spot !== null) {
          marker.position.set(GIANT_REAL[giant.spot].x, 0.08, GIANT_REAL[giant.spot].z);
          marker.userData.base = 2.2;
          marker.visible = true;
        }
      }
      if (mode === pickKind) return;
      const wasOn = pickOn;
      pickKind = mode;
      pickOn = mode !== false;
      pickGrid.visible = mode === "doll";
      giantGrid.visible = mode === "giant";
      hoverCell.visible = false;
      if (pickOn && !wasOn) {
        // มองจากด้านบนเฉียง เห็นช่องรอบต้นชัดและแตะได้แม่น (จุดบ้านอยู่ไกลกว่า จึงถอยกล้องมากกว่า)
        rememberView();
        controls.minDistance = 3;
        // มองจากที่สูงต้องไม่ให้หมอกกลบพื้น
        const fog = scene.fog as THREE.Fog | null;
        if (fog) fog.far = 160;
        const far = mode === "giant" ? 1.5 : 1;
        animateCam(new THREE.Vector3(0, (isSmall ? 24 : 19) * far, (isSmall ? 17 : 15) * far), new THREE.Vector3(0, 0, 1.5), 1100);
      } else if (!pickOn) {
        renderer.domElement.style.cursor = "";
        const fog = scene.fog as THREE.Fog | null;
        if (fog && !zoneAway) fog.far = 56;
        if (wasOn && marker.userData.base === 2.2) {
          marker.visible = false;
          marker.userData.base = 1;
        }
        if (savedView && !zoneAway) {
          animateCam(savedView.pos, savedView.tgt, 900);
          controls.minDistance = savedView.min;
          savedView = null;
        }
      }
    }

    // ตุ๊กตาหิมะทุกชิ้นวาดด้วย InstancedMesh เพื่อให้รองรับหลายพันชิ้นได้โดยไม่ทำให้เครื่องหนัก
    // ชิ้นที่ใหม่สุด 40 ชิ้นจะวาดเป็นโมเดลละเอียดแทน
    const DETAIL_N = 40;
    const DECOR_SCALE = 0.46;
    let instMeshes: THREE.InstancedMesh[] = [];
    let instBodies: THREE.InstancedMesh | null = null;
    let instDecor: Decor[] = [];
    const HAT_COLOR: Record<string, number> = { top: 0x1f2937, beanie: 0x3b82f6, santa: 0xdc2643, crown: 0xf5c542, pom: 0xf8fafc, holly: 0x16a34a, beret: 0xdc2643, earmuff: 0x1f2937 };

    // มุมมองบุคคลที่หนึ่ง: เลื่อนกล้องไปใกล้ลูกบอลที่เลือก และกลับมาที่เดิมเมื่อปิด
    type CamAnim = { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3; start: number; dur: number };
    let camAnim: CamAnim | null = null;
    let savedView: { pos: THREE.Vector3; tgt: THREE.Vector3; min: number } | null = null;
    // ---------- เดินกล้องตามจุดสำคัญ (ตำแหน่ง + จุดที่มอง) ----------
    // ทิศที่มองถูกแปลงเป็นมุมส่าย/มุมก้มแล้วต่อกันอย่างต่อเนื่อง กล้องจึงหันอย่างนุ่มนวลไม่สะบัดหรือหันกลับหลังเอง
    type Key = { p: THREE.Vector3; look: THREE.Vector3; fov?: number; turn?: 1 | -1 }; // turn: บังคับทิศหันเมื่อหันเกือบกลับหลัง
    type PathAnim = { pc: THREE.CatmullRomCurve3; vc: THREE.CatmullRomCurve3; times: number[]; start: number; dur: number; end: Key; endMin: number; done?: () => void };
    let walkAnim: PathAnim | null = null;
    function animateCam(toPos: THREE.Vector3, toTgt: THREE.Vector3, dur = 900) {
      walkAnim = null;
      walkRef.v = false;
      camAnim = { fromPos: camera.position.clone(), toPos, fromTgt: controls.target.clone(), toTgt, start: performance.now(), dur };
    }
    // มุมกล้องในหมู่บ้าน: จอแนวตั้งกว้างกว่า เห็นกำแพงได้มากขึ้น
    let ZONE_FOV = 50;
    // จอเตี้ยแนวตั้ง (เช่น 360×640) ใช้มุมกว้างขึ้นอีก ให้กำแพงพอดีแถบว่างระหว่างหัวจอกับปุ่มล่าง
    const zoneFov = () => (renderer.domElement.clientHeight < 520 && camera.aspect > 1 ? 76 : camera.aspect < 0.7 ? (renderer.domElement.clientHeight < 700 ? 80 : 74) : camera.aspect < 1 ? 62 : 50);
    // มุมกล้องปกติ (จอแคบกว้างกว่า) ใช้ปลายทางของการเดินกลับ
    const baseFov = () => (camera.aspect < 0.8 ? 50 : 38);
    function playPath(keys: Key[], opts: { speed?: number; turn?: number; maxDur?: number; endMin?: number; done?: () => void } = {}) {
      camAnim = null;
      controls.minDistance = 0.2;
      const speed = opts.speed ?? 4.2;
      // มุมส่ายต่อกันแบบไม่กระโดดข้าม ±180°
      let prevYaw = 0;
      const views = keys.map((k, i) => {
        const d = k.look.clone().sub(k.p);
        let yaw = Math.atan2(d.x, d.z);
        if (i > 0) {
          while (yaw - prevYaw > Math.PI) yaw -= Math.PI * 2;
          while (yaw - prevYaw < -Math.PI) yaw += Math.PI * 2;
          if (k.turn && Math.sign(yaw - prevYaw) !== k.turn && Math.abs(yaw - prevYaw) > 0.3) yaw += k.turn * Math.PI * 2;
        }
        prevYaw = yaw;
        const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
        return new THREE.Vector3(yaw, pitch, k.fov ?? camera.fov);
      });
      const segs: number[] = [];
      for (let i = 1; i < keys.length; i++) {
        const move = keys[i].p.distanceTo(keys[i - 1].p) / speed;
        const turn = Math.abs(views[i].x - views[i - 1].x) / (opts.turn ?? 1.5); // จำกัดความเร็วการหัน ไม่ให้ภาพสะบัด
        segs.push(Math.max(move, turn, 0.25));
      }
      // ทางยาวแค่ไหนก็จบในเวลาที่กำหนด (ความเร็วเพิ่มขึ้นเท่ากันทุกช่วง จึงยังลื่นเหมือนเดิม)
      const total = Math.min(segs.reduce((a, b) => a + b, 0), opts.maxDur ?? Infinity);
      const rawTotal = segs.reduce((a, b) => a + b, 0);
      const times = [0];
      segs.forEach((sg) => times.push(times[times.length - 1] + sg / rawTotal));
      walkRef.v = true;
      walkAnim = {
        pc: new THREE.CatmullRomCurve3(keys.map((k) => k.p.clone()), false, "centripetal"),
        vc: new THREE.CatmullRomCurve3(views, false, "catmullrom", 0.5),
        times,
        start: performance.now(),
        dur: total * 1000,
        end: keys[keys.length - 1],
        endMin: opts.endMin ?? 0.5,
        done: opts.done,
      };
    }
    const tmpDir = new THREE.Vector3();
    function stepWalk(now: number) {
      if (!walkAnim) return;
      const w = walkAnim;
      const k = Math.min((now - w.start) / Math.max(w.dur, 1), 1);
      // ออกตัวและหยุดแบบนุ่ม ช่วงกลางความเร็วคงที่
      const e = k < 0.12 ? (k * k) / 0.24 : k > 0.88 ? 1 - ((1 - k) * (1 - k)) / 0.24 : 0.06 + (k - 0.12) * (0.88 / 0.76);
      const n = w.times.length - 1;
      let j = 0;
      while (j < n - 1 && e > w.times[j + 1]) j++;
      const f = Math.min(Math.max((e - w.times[j]) / Math.max(w.times[j + 1] - w.times[j], 1e-6), 0), 1);
      const u = (j + f) / n;
      const pos = w.pc.getPoint(u);
      const v = w.vc.getPoint(u);
      camera.position.copy(pos);
      tmpDir.set(Math.sin(v.x) * Math.cos(v.y), Math.sin(v.y), Math.cos(v.x) * Math.cos(v.y));
      controls.target.copy(pos).addScaledVector(tmpDir, 3);
      if (Math.abs(camera.fov - v.z) > 0.01) {
        camera.fov = v.z;
        camera.updateProjectionMatrix();
      }
      if (k >= 1) {
        camera.position.copy(w.end.p);
        controls.target.copy(w.end.look);
        controls.minDistance = w.endMin;
        walkAnim = null;
        walkRef.v = false;
        w.done?.();
      }
    }
    const HOME_POS = new THREE.Vector3(0, 3.9, 13.6);
    const HOME_TGT = new THREE.Vector3(0, 2.85, 0);
    // ซูมเข้า/ออกทีละขั้นแบบนุ่ม (ปุ่มบนจอ) ระยะถูกจำกัดตามค่าที่ตั้งไว้
    function zoomBy(factor: number) {
      const dir = camera.position.clone().sub(controls.target);
      const len = Math.min(Math.max(dir.length() * factor, controls.minDistance), controls.maxDistance);
      const toPos = controls.target.clone().add(dir.normalize().multiplyScalar(len));
      animateCam(toPos, controls.target.clone());
      savedView = null;
    }
    // ดูตัวอย่างป้ายประจำห้องที่ตำแหน่งที่เลือก (แสดงเฉพาะในเครื่องนี้ 9 วินาที ไม่บันทึก)
    function resetView() {
      animateCam(HOME_POS.clone(), HOME_TGT.clone());
      controls.minDistance = 5.5;
      savedView = null;
    }

    // ---------- มุมมองโซนคำอวยพร: ซูมออกเป็นแผนที่ แล้วเลื่อนไปที่โซน และกลับมุมเดิมได้
    const FOG_FAR = 56;
    let zoneAway = false;
      zoneAwayRef.v = false;
    function rememberView() {
      if (!savedView) savedView = { pos: camera.position.clone(), tgt: controls.target.clone(), min: controls.minDistance };
    }
    // ---------- เส้นทางในหมู่บ้าน: ทางเดินวงแหวนสองวง ช่องตรงแนวประตูเชื่อมทุกวง ----------
    const ZC = new THREE.Vector3(ZONE.x, 0, ZONE.z);
    const GA = ZONE_GATE_ANGLE;
    const EYE = 1.7;
    const polar = (a: number, r: number, y = EYE) => new THREE.Vector3(ZONE.x + Math.cos(a) * r, y, ZONE.z + Math.sin(a) * r);
    const angleOf = (p: THREE.Vector3) => Math.atan2(p.z - ZONE.z, p.x - ZONE.x);
    const radiusOf = (p: THREE.Vector3) => Math.hypot(p.x - ZONE.x, p.z - ZONE.z);
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    // ---------- จัดกรอบจุดชมให้เห็นซองครบทุกใบ ไม่โดนแถบปุ่มบนจอบัง ----------
    // ซองในหน้ากำแพงหนึ่งหน้า: 5 คอลัมน์ (ห่าง 0.7) × 5 แถว กินความสูง 0.2–2.67 หน่วย
    // แถบว่างบนจอ (สัดส่วนจากบน) ที่ซองต้องอยู่ภายใน: มือถือมีหัวข้อ/ตัวอักษรวิ่งด้านบน และแถบโซน แถบเลื่อนกำแพง เมนูด้านล่าง
    const WALL_MID_Y = 1.44;
    const WALL_HALF_H = 1.32;
    const STOP_MAX_DIST = 3.6; // เกินนี้จะชนกำแพงฝั่งตรงข้ามของทางเดิน
    const band = () => {
      const h = Math.max(renderer.domElement.clientHeight, 1);
      // ขอบบน: ใต้หัวข้อและตัวอักษรวิ่ง (วัดจากหน้าจอจริง เพราะหัวข้อสูงไม่เท่ากันแต่ละจอ)
      const rectTop = renderer.domElement.getBoundingClientRect().top;
      const ticker = document.querySelector(".xmas-ticker")?.getBoundingClientRect();
      const top = Math.max(ticker && ticker.height > 0 ? ticker.bottom - rectTop : 0, 76) + 10;
      if (h < 520 && window.innerWidth > h) return [84 / h, 1 - 122 / h]; // มือถือแนวนอน: ตัวอักษรวิ่งซ่อนในโซน ปุ่มเรียงแถวเดียวด้านล่าง
      return window.innerWidth < 760 ? [top / h, 1 - 228 / h] : [top / h, 1 - 214 / h];
    };
    // แบ่งหน้ากำแพงเป็นกี่ส่วน (1 = ทั้งหน้า, 2 = ซ้าย/ขวาส่วนละ 3 คอลัมน์, 3 = ส่วนละ 2 คอลัมน์)
    const PART_HALF_W: Record<number, number> = { 1: 1.74, 2: 1.04, 3: 0.68 };
    const FACE_HALF_W = 1.74; // ครึ่งความกว้างแถวซอง (คอลัมน์นอกสุด ±1.4 + ครึ่งซอง + ขอบ)
    function framing() {
      const tv = Math.tan(THREE.MathUtils.degToRad(zoneFov()) / 2);
      const [top, bot] = band();
      const bandH = Math.max(bot - top, 0.3);
      const dH = WALL_HALF_H / (bandH * tv);
      // แบ่งน้อยส่วนที่สุดที่ความกว้างยังพอดีจอ (ความสูงใช้ระยะเดียวกันทุกแบบ จึงไม่ใช่เหตุให้แบ่งเพิ่ม)
      for (const n of [1, 2, 3]) {
        const dW = PART_HALF_W[n] / (tv * camera.aspect * 0.96);
        if (dW <= STOP_MAX_DIST || n === 3) {
          const d = Math.min(Math.max(dH, dW, 2.4), STOP_MAX_DIST);
          // ส่วนซ้าย/ขวาชิดขอบกำแพงพอดี (เห็นกว้างกว่าที่ต้องการเมื่อระยะถูกกำหนดด้วยความสูง)
          const vis = d * tv * camera.aspect * 0.96;
          const edge = Math.max(FACE_HALF_W - vis, 0);
          const centers = n === 1 ? [0] : n === 2 ? [-edge, edge] : [-edge, 0, edge];
          return { n, d, tv, ndcY: 1 - (top + bot), centers };
        }
      }
      return { n: 1, d: STOP_MAX_DIST, tv, ndcY: 0, centers: [0] };
    }
    const partOf = (t: number) => {
      const centers = framing().centers;
      let best = 0;
      centers.forEach((c, i) => {
        if (Math.abs(t - c) < Math.abs(t - centers[best])) best = i;
      });
      return best;
    };
    function stopKey(stop: number, part = 0): Key {
      ZONE_FOV = zoneFov();
      const st = ZONE_STOPS[stop];
      const f = framing();
      const shift = f.centers[Math.min(part, f.n - 1)];
      // มองระดับสายตาแนวนอน และเลื่อนจุดมองลงให้กลางกำแพงไปอยู่กลางแถบว่างบนจอ
      const lookY = WALL_MID_Y - f.ndcY * f.d * f.tv;
      const c = new THREE.Vector3(st.center.x + st.tangent.x * shift, lookY, st.center.z + st.tangent.z * shift);
      const p = new THREE.Vector3(c.x + st.normal.x * f.d, lookY, c.z + st.normal.z * f.d);
      return { p, look: c, fov: ZONE_FOV };
    }
    // จุดชมที่มีการ์ดอยู่ (เรียงตามลำดับเดิน) แต่ละรายการคือ [จุดชม, ครึ่งซ้าย/ขวา]
    function browseList(): [number, number][] {
      const used = new Map<number, Set<number>>();
      for (const en of village.cardEntries()) {
        const st = ZONE_STOPS[en.stop];
        const t = (en.pos.x - st.center.x) * st.tangent.x + (en.pos.z - st.center.z) * st.tangent.z;
        if (!used.has(en.stop)) used.set(en.stop, new Set());
        used.get(en.stop)!.add(partOf(t));
      }
      const out: [number, number][] = [];
      ZONE_STOPS.forEach((_, i) => {
        const parts = used.get(i);
        if (!parts) return;
        [...parts].sort().forEach((pt) => out.push([i, pt]));
      });
      if (!out.length) out.push([0, 0]);
      return out;
    }
    let browseIdx = 0;
    function reportStop() {
      const list = browseList();
      callbacks.current.onZoneStop?.(Math.min(browseIdx, list.length - 1), list.length);
    }
    // จุดเดินตามทางวงแหวน (ไม่ทะลุกำแพง): จาก p ไปยังมุม a1 บนทางเดินรัศมี r
    function arcKeys(fromA: number, toA: number, r: number, lookAhead = true): Key[] {
      const d = wrap(toA - fromA);
      const n = Math.max(1, Math.ceil(Math.abs(d) / 0.45));
      const out: Key[] = [];
      for (let i = 1; i <= n; i++) {
        const a = fromA + (d * i) / n;
        const p = polar(a, r);
        // มองไปข้างหน้าตามทางเดิน
        const look = lookAhead ? polar(a + Math.sign(d || 1) * 0.5, r, EYE - 0.15) : ZC.clone().setY(1.4);
        out.push({ p, look, fov: ZONE_FOV });
      }
      return out;
    }
    const walkwayOf = (p: THREE.Vector3) => (radiusOf(p) < 8.5 ? 0 : 1);
    // เส้นทางจากตำแหน่งปัจจุบันในหมู่บ้านไปยังจุดชม
    function routeInVillage(from: THREE.Vector3, stop: number, part: number): Key[] {
      const target = stopKey(stop, part);
      const wFrom = walkwayOf(from);
      const wTo = ZONE_STOPS[stop].walkway;
      const keys: Key[] = [];
      const aFrom = angleOf(from);
      const aTo = angleOf(target.p);
      if (wFrom === wTo) {
        if (Math.abs(wrap(aTo - aFrom)) > 0.25) keys.push(...arcKeys(aFrom, aTo, ZONE_WALKWAYS[wFrom].r).slice(0, -1));
      } else {
        // เดินไปแนวประตู ข้ามช่องของกำแพงวงกลาง แล้วเดินต่อในทางอีกวง
        keys.push(...arcKeys(aFrom, GA, ZONE_WALKWAYS[wFrom].r));
        keys.push({ p: polar(GA, ZONE_WALKWAYS[wTo].r), look: polar(GA + (wTo > wFrom ? 0 : Math.PI), 30, EYE), fov: ZONE_FOV });
        if (Math.abs(wrap(aTo - GA)) > 0.25) keys.push(...arcKeys(GA, aTo, ZONE_WALKWAYS[wTo].r).slice(0, -1));
      }
      keys.push(target);
      return keys;
    }
    function goStop(idx: number) {
      const list = browseList();
      browseIdx = ((idx % list.length) + list.length) % list.length;
      const [stop, part] = list[browseIdx];
      const from = camera.position.clone();
      const keys = routeInVillage(from, stop, part);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const end = keys[keys.length - 1];
        camera.position.copy(end.p);
        controls.target.copy(end.look);
      } else {
        playPath([{ p: from, look: controls.target.clone(), fov: camera.fov }, ...keys], { speed: 3.2, endMin: 1.2 });
      }
      reportStop();
    }
    function flyToZone(stopIdx = 0) {
      ZONE_FOV = zoneFov();
      clearBeacon();
      rememberView();
      zoneAway = true;
      zoneAwayRef.v = true;
      callbacks.current.onAwayChange?.(true);
      const fog = scene.fog as THREE.Fog | null;
      if (fog) fog.far = 90;
      controls.maxDistance = 4.2; // ในหมู่บ้านถอยได้ไม่ไกล กล้องจึงไม่ทะลุกำแพงด้านหลัง
      const list = browseList();
      browseIdx = Math.min(stopIdx, list.length - 1);
      const [stop, part] = list[browseIdx];
      const keys = tunnelRoute(stop, part);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const end = keys[keys.length - 1];
        camera.position.copy(end.p);
        controls.target.copy(end.look);
        camera.fov = ZONE_FOV;
        camera.updateProjectionMatrix();
        controls.minDistance = 1.2;
      } else {
        playPath(keys, { speed: 9, turn: 1.8, maxDur: 6.8, endMin: 1.2 });
      }
      reportStop();
    }
    // ทางจากกล้องตอนนี้: เดินเข้าหาลานต้นไม้ เดินรอบลาน เลี้ยวเข้าอุโมงค์ไฟ ลอดประตู แล้วไปหยุดหน้ากำแพงแรก
    function tunnelRoute(stop: number, part: number): Key[] {
      const gateDir = new THREE.Vector3(ZONE_GATE.x, 0, ZONE_GATE.z).normalize();
      const gateDist = Math.hypot(ZONE_GATE.x, ZONE_GATE.z);
      const at = (s: number, y = EYE) => gateDir.clone().multiplyScalar(s).setY(y);
      const keys: Key[] = [{ p: camera.position.clone(), look: controls.target.clone(), fov: camera.fov }];
      const camA = Math.atan2(camera.position.z, camera.position.x);
      const gA = Math.atan2(gateDir.z, gateDir.x);
      const diff = wrap(gA - camA);
      // วนรอบต้น (สูงเหนือหลังคาบ้าน Exclusive) กล้องหันมองต้นตลอด
      const ringR = 7.2; // วงเสาไฟอยู่ที่ 7.7 แต่กล้องลอยสูงกว่าหัวเสา
      const sgn = Math.sign(diff) || 1;
      if (Math.abs(diff) > 0.35) {
        const n = Math.max(2, Math.ceil(Math.abs(diff) / 0.4));
        for (let i = 0; i <= n; i++) {
          const a = camA + (diff * i) / n;
          const k = i / n;
          keys.push({ p: new THREE.Vector3(Math.cos(a) * ringR, 4.0 + k * 0.9, Math.sin(a) * ringR), look: new THREE.Vector3(0, 3.0 + k * 0.6, 0), fov: baseFov() + 4 });
        }
      } else {
        keys.push({ p: at(ringR, 3.8), look: new THREE.Vector3(0, 3.4, 0), fov: baseFov() + 6 });
      }
      // ยกกล้องขึ้นแล้วหันกลับไปทางหมู่บ้าน (เห็นวิวลานและอุโมงค์ไฟจากมุมสูง) จากนั้นร่อนลงหัวอุโมงค์
      keys.push({ p: at(ringR + 0.6, 6.0), look: at(gateDist + 10, 1.5), fov: baseFov() + 10, turn: -sgn as 1 | -1 }); // มุมส่ายลดลงเมื่อเดินทวนเข็ม จึงหันต่อในทิศเดียวกับที่วนมา
      keys.push({ p: at(8.6, 2.1), look: at(gateDist + 6, 1.7), fov: baseFov() + 10 });
      keys.push({ p: at(gateDist * 0.6), look: at(gateDist + 6, 1.8), fov: baseFov() + 10 });
      keys.push({ p: at(gateDist - 1.2), look: ZC.clone().setY(1.9), fov: (baseFov() + ZONE_FOV) / 2 + 4 });
      // ลอดประตูเข้าทางเดินวงนอก แล้วผ่านช่องกำแพงวงกลางเข้าทางเดินวงใน (ถ้าจุดชมอยู่วงใน)
      keys.push({ p: polar(GA, ZONE_WALKWAYS[1].r), look: polar(GA, 4.0, 1.7), fov: ZONE_FOV });
      const wTo = ZONE_STOPS[stop].walkway;
      if (wTo === 0) keys.push({ p: polar(GA, ZONE_WALKWAYS[0].r), look: polar(GA, 2.0, 1.6), fov: ZONE_FOV });
      const target = stopKey(stop, part);
      const aTo = angleOf(target.p);
      if (Math.abs(wrap(aTo - GA)) > 0.25) keys.push(...arcKeys(GA, aTo, ZONE_WALKWAYS[wTo].r).slice(0, -1));
      keys.push(target);
      return keys;
    }
    function returnView() {
      clearBeacon();
      village.highlight(null);
      const fog = scene.fog as THREE.Fog | null;
      if (fog) fog.far = FOG_FAR;
      zoneAway = false;
      zoneAwayRef.v = false;
      controls.maxDistance = 60;
      callbacks.current.onAwayChange?.(false);
      const back = savedView ?? { pos: HOME_POS.clone(), tgt: HOME_TGT.clone(), min: 5.5 };
      savedView = null;
      const reducedNow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!inZone(camera.position.x, camera.position.z, 0.5) || reducedNow) {
        camera.fov = baseFov();
        camera.updateProjectionMatrix();
        controls.minDistance = back.min;
        animateCam(back.pos, back.tgt, reducedNow ? 1 : 1000);
        return;
      }
      // เดินกลับตามทางเดิม: ไปแนวประตู ออกประตู ผ่านอุโมงค์ (มองไปทางต้นไม้) อ้อมลานกลับไปยังมุมเดิม
      const gateDir = new THREE.Vector3(ZONE_GATE.x, 0, ZONE_GATE.z).normalize();
      const gateDist = Math.hypot(ZONE_GATE.x, ZONE_GATE.z);
      const at = (s: number, y = EYE) => gateDir.clone().multiplyScalar(s).setY(y);
      const keys: Key[] = [{ p: camera.position.clone(), look: controls.target.clone(), fov: camera.fov }];
      const w = walkwayOf(camera.position);
      keys.push(...arcKeys(angleOf(camera.position), GA, ZONE_WALKWAYS[w].r));
      if (w === 0) keys.push({ p: polar(GA, ZONE_WALKWAYS[1].r), look: polar(GA, 30), fov: ZONE_FOV });
      keys.push({ p: at(gateDist + 0.5), look: new THREE.Vector3(0, 2.4, 0), fov: baseFov() + 10 });
      keys.push({ p: at(gateDist * 0.55, 1.9), look: new THREE.Vector3(0, 2.8, 0), fov: baseFov() + 8 });
      // ออกจากอุโมงค์แล้ววนรอบต้น (มองต้นตลอด) กลับไปยังมุมเดิม
      keys.push({ p: at(8.2, 3.4), look: new THREE.Vector3(0, 3.0, 0), fov: baseFov() + 4 });
      const gA = Math.atan2(gateDir.z, gateDir.x);
      const bA = Math.atan2(back.pos.z, back.pos.x);
      const d = wrap(bA - gA);
      if (Math.abs(d) > 0.35) {
        const n = Math.max(2, Math.ceil(Math.abs(d) / 0.45));
        for (let i = 1; i < n; i++) {
          const a = gA + (d * i) / n;
          const r = 7.6 + (i / n) * Math.max(0, Math.hypot(back.pos.x, back.pos.z) - 7.6) * 0.5;
          keys.push({ p: new THREE.Vector3(Math.cos(a) * r, 3.8 + (i / n) * 0.4, Math.sin(a) * r), look: new THREE.Vector3(0, 3.0, 0), fov: baseFov() + 2 });
        }
      }
      keys.push({ p: back.pos.clone(), look: back.tgt.clone(), fov: baseFov() });
      playPath(keys, { speed: 9, turn: 1.9, maxDur: 5.5, endMin: back.min });
    }
    // ตุ๊กตาหิมะที่คลิก: กล้องเลื่อนไปหา และตุ๊กตาโยกทักทายเบา ๆ ตอนเปิดดู
    let focusDecorGroup: THREE.Group | null = null;
    // ซ่อนตุ๊กตาต้นฉบับตรงช่องที่เปิดดู เพื่อไม่ให้เห็นตัวซ้อนกัน
    let focusHidden: { groups: THREE.Object3D[]; inst: { mesh: THREE.InstancedMesh; idx: number; data: Float32Array }[] } = { groups: [], inst: [] };
    function restoreHidden() {
      focusHidden.groups.forEach((g) => (g.visible = true));
      focusHidden.inst.forEach(({ mesh, idx, data }) => {
        mesh.instanceMatrix.array.set(data, idx * 16);
        mesh.instanceMatrix.needsUpdate = true;
      });
      focusHidden = { groups: [], inst: [] };
    }
    function hideOriginal(d: Decor) {
      decorGroup.children.forEach((c) => {
        if (c.userData.decorId === d.id) {
          c.visible = false;
          focusHidden.groups.push(c);
        }
      });
      const idx = instDecor.findIndex((x) => x.id === d.id);
      if (idx >= 0) {
        const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
        instMeshes.forEach((m) => {
          const data = m.instanceMatrix.array.slice(idx * 16, idx * 16 + 16) as Float32Array;
          focusHidden.inst.push({ mesh: m, idx, data });
          m.setMatrixAt(idx, zeroM);
          m.instanceMatrix.needsUpdate = true;
        });
      }
    }
    // หาตำแหน่งกล้องรอบจุด (x, z) ที่ไม่มีอะไรบังระหว่างกล้องกับตัวตุ๊กตา
    // เริ่มจากมุมด้านนอกลาน แล้วลองเอียงซ้ายขวาทีละนิด ถ้าบังทุกมุมใช้มุมด้านนอกตามเดิม
    const viewRay = new THREE.Raycaster();
    function clearViewPos(x: number, z: number, dist: number, h: number, self: THREE.Object3D) {
      const base = Math.atan2(z, x);
      viewRay.camera = camera; // ป้ายภาพ (sprite) ในฉากต้องมีกล้องจึงตรวจการชนได้
      const skip = new Set<THREE.Object3D>([ground, decorGroup, self, ...instMeshes]);
      const blockers: THREE.Object3D[] = [];
      scene.children.forEach((c) => {
        if (!skip.has(c) && c.visible) blockers.push(c);
      });
      const from = new THREE.Vector3();
      const dir = new THREE.Vector3();
      const blocked = (pos: THREE.Vector3) => {
        // ตรวจ 3 จุดบนตัว (ฐาน กลางตัว หัว) ให้เห็นทั้งตัว
        for (const y of [0.25, 0.6, 0.95]) {
          from.set(x, y, z);
          dir.subVectors(pos, from);
          const len = dir.length();
          viewRay.set(from, dir.normalize());
          viewRay.far = len;
          const hit = viewRay.intersectObjects(blockers, true).find((i) => {
            const m = i.object as THREE.Mesh;
            return m.isMesh && m.visible && !(m.material as THREE.Material).transparent;
          });
          if (hit) return true;
        }
        return false;
      };
      const at = (off: number) => new THREE.Vector3(x + Math.cos(base + off) * dist, h, z + Math.sin(base + off) * dist);
      for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4]) {
        const p = at(off);
        if (!blocked(p)) return p;
      }
      return at(0);
    }
    function focusDecor(d: Decor | null) {
      restoreHidden();
      if (focusDecorGroup) {
        scene.remove(focusDecorGroup);
        focusDecorGroup.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose?.();
          (m.material as THREE.Material | undefined)?.dispose?.();
        });
        focusDecorGroup = null;
      }
      if (!d) {
        if (savedView) {
          animateCam(savedView.pos, savedView.tgt);
          controls.minDistance = savedView.min;
          savedView = null;
        }
        return;
      }
      const pp = SLOT_POSITIONS[d.slot];
      if (!pp) return;
      hideOriginal(d);
      const grp = buildDecorSnowman(d);
      const aa = Math.atan2(pp.z, pp.x);
      grp.position.set(pp.x, 0, pp.z);
      grp.rotation.y = -aa + Math.PI / 2;
      grp.scale.setScalar(DECOR_SCALE * 1.3);
      scene.add(grp);
      focusDecorGroup = grp;
      if (!savedView) savedView = { pos: camera.position.clone(), tgt: controls.target.clone(), min: controls.minDistance };
      // มองจากด้านนอกและสูงขึ้นเล็กน้อย ให้พุ่มต้นไม้ไม่บังตุ๊กตา
      // ถ้าเสาไฟ ม้านั่ง หรือของอื่นบังอยู่ ให้หมุนไปมุมข้าง ๆ ที่มองเห็นตัวชัด
      // บนมือถือให้ตุ๊กตาอยู่ช่วงบนของจอ เพื่อให้การ์ดด้านล่างไม่บังตัว
      const toTgt = new THREE.Vector3(pp.x, isSmall ? 0.15 : 0.9, pp.z);
      const toPos = clearViewPos(pp.x, pp.z, 3.2, 2.9, grp);
      controls.minDistance = 0.5;
      animateCam(toPos, toTgt);
      burst(new THREE.Vector3(pp.x, 1.1, pp.z), 0xffe7a3, isSmall ? 26 : 40, 0.3);
    }
    function focusOrnament(id: string | null) {
      if (!id) {
        if (savedView) {
          animateCam(savedView.pos, savedView.tgt);
          controls.minDistance = savedView.min;
          savedView = null;
        }
        return;
      }
      const o = ornLayer.get(id);
      const p = ornLayer.worldPosition(id);
      if (!o || !p) return;
      if (!savedView) savedView = { pos: camera.position.clone(), tgt: controls.target.clone(), min: controls.minDistance };
      // กล้องอยู่นอกผิวต้นตรงจุดที่แขวน มองลงมาที่ลูกบอลระดับสายตา
      const n = surfaceNormal(o.angle);
      const toPos = new THREE.Vector3(p.x + n.x * 1.7, p.y + 0.25, p.z + n.z * 1.7);
      const toTgt = new THREE.Vector3(p.x, p.y - 0.12, p.z);
      controls.minDistance = 0.5;
      animateCam(toPos, toTgt);
    }

    // ---------- วงแสงทองบนพื้นและประกายที่ช่องของตุ๊กตาใหม่ อยู่ 5 วินาทีแล้วค่อย ๆ จางหาย
    let highlight: { ring: THREE.Mesh; start: number } | null = null;
    // ตัวชี้ตำแหน่งตุ๊กตาที่เพิ่งวาง: วงแหวนเต้นบนพื้นและลูกศรที่โยกขึ้นลงเหนือหัว (ประมาณ 7 วินาที)
    let beacon: { group: THREE.Group; ring: THREE.Mesh; arrow: THREE.Mesh; start: number; top: number } | null = null;
    function clearBeacon() {
      if (!beacon) return;
      scene.remove(beacon.group);
      beacon.group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      beacon = null;
    }
    function showBeacon(x: number, z: number, big: boolean) {
      clearBeacon();
      const r = big ? 1.5 : 0.6;
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r * 0.82, r, 64),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      const top = big ? 5.0 : 1.15;
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.22 : 0.09, big ? 0.45 : 0.2, 24), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.95 }));
      arrow.rotation.x = Math.PI;
      arrow.position.y = top;
      group.add(ring, arrow);
      group.position.set(x, 0, z);
      scene.add(group);
      beacon = { group, ring, arrow, start: performance.now(), top };
      burst(new THREE.Vector3(x, top, z), 0xffe7a3, big ? 40 : 24, 0.3);
    }
    // พาเข้าไปหาตุ๊กตาที่ระบุ: กล้องเลื่อนไปใกล้ และขึ้นตัวชี้ให้เห็นทันที
    function locate(target: LocateTarget) {
      const big = target.kind === "giant";
      const p = big ? GIANT_POSITIONS[target.spot] : SLOT_POSITIONS[target.slot];
      if (!p) return;
      // จำมุมกล้องเดิมไว้ก่อนเลื่อนไปหาตุ๊กตา เพื่อให้กลับมาได้
      rememberView();
      callbacks.current.onAwayChange?.(true);
      const out = new THREE.Vector3(p.x, 0, p.z);
      if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
      out.normalize();
      const dist = big ? 8 : 3.4;
      const toTgt = new THREE.Vector3(p.x, big ? 1.8 : 0.7, p.z);
      const toPos = new THREE.Vector3(p.x + out.x * dist, big ? 4.6 : 2.4, p.z + out.z * dist);
      animateCam(toPos, toTgt);
      showBeacon(p.x, p.z, big);
    }

    function highlightDecor(slot: number) {
      const p = SLOT_POSITIONS[slot];
      if (!p) return;
      burst(new THREE.Vector3(p.x, 0.6, p.z), 0xffd76a, isSmall ? 30 : 46, 0.35);
      if (highlight) {
        scene.remove(highlight.ring);
        highlight.ring.geometry.dispose();
        (highlight.ring.material as THREE.Material).dispose();
      }
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 64),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.03, p.z);
      scene.add(ring);
      highlight = { ring, start: performance.now() };
    }

    function setDecor(list: Decor[]) {
      markShadows();
      decorById.clear();
      while (decorGroup.children.length) {
        const c = decorGroup.children.pop()!;
        c.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose?.();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose?.();
        });
      }
      for (const m of instMeshes) {
        scene.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      instMeshes = [];
      instBodies = null;
      instDecor = [];

      const valid = list.filter((d) => d.slot >= 0 && d.slot < SLOT_COUNT);
      if (valid.length === 0) return;
      const sorted = [...valid].sort((a, b) => b.createdAt - a.createdAt);
      const detailed = new Set(sorted.slice(0, DETAIL_N).map((d) => d.id));
      const n = valid.length;

      const bodyMat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.3 });
      const bodies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.36, 18, 14), bodyMat, n);
      const mids = new THREE.InstancedMesh(new THREE.SphereGeometry(0.27, 18, 14), bodyMat, n);
      const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 16, 12), bodyMat, n);
      const hats = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 14), new THREE.MeshStandardMaterial({ roughness: 0.45 }), n);
      const scarves = new THREE.InstancedMesh(new THREE.TorusGeometry(0.22, 0.045, 8, 18), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
      instMeshes = [bodies, mids, heads, hats, scarves];
      instBodies = bodies;

      const dummy = new THREE.Object3D();
      const base = new THREE.Matrix4();
      const off = new THREE.Matrix4();
      const out = new THREE.Matrix4();
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      const col = new THREE.Color();

      valid.forEach((d, i) => {
        instDecor.push(d);
        const p = SLOT_POSITIONS[d.slot];
        const a = Math.atan2(p.z, p.x);
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, -a + Math.PI / 2, 0);
        dummy.scale.setScalar(DECOR_SCALE);
        dummy.updateMatrix();
        base.copy(dummy.matrix);
        const hide = detailed.has(d.id);
        const put = (mesh: THREE.InstancedMesh, local: THREE.Matrix4) => {
          if (hide) mesh.setMatrixAt(i, zero);
          else {
            out.multiplyMatrices(base, local);
            mesh.setMatrixAt(i, out);
          }
        };
        put(bodies, off.makeTranslation(0, 0.52, 0));
        put(mids, off.makeTranslation(0, 1.05, 0));
        put(heads, off.makeTranslation(0, 1.42, 0));
        put(hats, off.makeTranslation(0, 1.55, 0));
        put(scarves, off.makeRotationX(Math.PI / 2).setPosition(0, 1.22, 0));
        const bodyHex = BODY_HEX[d.body] ?? 0xffffff;
        bodies.setColorAt(i, col.setHex(bodyHex));
        mids.setColorAt(i, col.setHex(bodyHex));
        heads.setColorAt(i, col.setHex(bodyHex));
        hats.setColorAt(i, col.setHex(HAT_COLOR[d.hat] ?? HAT_HEX));
        scarves.setColorAt(i, col.setHex(SCARF_HEX[d.scarf] ?? 0xdc2643));
      });
      for (const m of instMeshes) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        scene.add(m);
      }

      for (const d of sorted.slice(0, DETAIL_N)) {
        decorById.set(d.id, d);
        const grp = buildDecorSnowman(d);
        const pp = SLOT_POSITIONS[d.slot];
        const aa = Math.atan2(pp.z, pp.x);
        grp.position.set(pp.x, 0, pp.z);
        grp.rotation.y = -aa + Math.PI / 2;
        grp.scale.setScalar(DECOR_SCALE);
        decorGroup.add(grp);
      }
    }
    setDecor(decor);

    api.current = {
      addOrnament: (o) => ornLayer.add(o, true),
      setDecor,
      setMarker: (slot) => {
        if (slot === null) {
          marker.visible = false;
          return;
        }
        const pp = SLOT_POSITIONS[slot];
        marker.userData.base = 1;
        marker.position.set(pp.x, 0.08, pp.z);
        marker.visible = true;
      },
      setGiants: api_setGiants,
      setPickMode,
      setZoneCards: api_setZoneCards,
      setOrnaments: (list) => {
        // โหลดครั้งแรกไม่ต้องเล่นแอนิเมชัน ที่เหลือให้ลูกบอลใหม่ค่อย ๆ หล่นลงมาจากกิ่ง
        ornLayer.set(list, loadedOnce);
        markShadows();
        aura.setProgress(Math.min(list.length, TREE_CAPACITY) / TREE_CAPACITY, !loadedOnce);
        loadedOnce = true;
      },
      setPreview: (p) => {
        if (!p) {
          previewMesh.visible = false;
          return;
        }
        const pos = ornamentPosition(p.height, p.angle);
        previewMesh.position.set(pos.x, pos.y, pos.z);
        (previewMesh.material as THREE.MeshBasicMaterial).color.setHex(ORNAMENT_HEX[p.color] ?? 0xffffff);
        previewMesh.visible = true;
      },
      firework,
      setCrowd,
      highlightDecor,
      setReduced: (v) => {
        reduced = v;
      },
    };
    readyRef.current({
      launchFirework: (color: string) => api.current?.firework(color),
      celebrate: () => celebrateTree(),
      highlightDecor: (slot: number) => highlightDecor(slot),
      focusOrnament: (id: string | null) => focusOrnament(id),
      focusDecor: (d: Decor | null) => focusDecor(d),
      focusGiant: (spot: number | null) => focusGiant(spot),
      project: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15 };
      },
      // จุดของการ์ดแต่ละใบบนจอ ถ้าอยู่นอกจอจะถูกดันไปที่ขอบจอ พร้อมมุมชี้ไปหาการ์ดนั้น
      zoneSlots: (only?: Set<string>) => {
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const cx = w / 2;
        const cy = h / 2;
        const m = 40;
        const out: { id: string; x: number; y: number; visible: boolean; angle: number }[] = [];
        const p = new THREE.Vector3();
        const toCam = new THREE.Vector3();
        for (const en of village.cardEntries()) {
          const id = en.id;
          if (only && !only.has(id)) continue;
          p.copy(en.pos);
          // ซองที่หันหลังให้กล้อง (อยู่อีกด้านของกำแพง) นับเป็นมองไม่เห็น ให้ป้ายชี้ทางที่ขอบจอแทน
          const facing = toCam.copy(camera.position).sub(en.pos).dot(en.normal) > 0;
          const v = p.clone().project(camera);
          const inFront = v.z < 1;
          let sx = ((v.x + 1) / 2) * w;
          let sy = ((1 - v.y) / 2) * h;
          const visible = facing && inFront && sx >= m && sx <= w - m && sy >= m && sy <= h - m;
          let angle = 0;
          if (!visible) {
            let dx = sx - cx;
            let dy = sy - cy;
            if (!inFront) {
              dx = -dx;
              dy = -dy;
            }
            if (dx === 0 && dy === 0) dy = -1;
            const k = Math.min(Math.abs(dx) > 0 ? (cx - m) / Math.abs(dx) : Infinity, Math.abs(dy) > 0 ? (cy - m) / Math.abs(dy) : Infinity);
            sx = cx + dx * k;
            sy = cy + dy * k;
            angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          }
          out.push({ id, x: sx, y: sy, visible, angle });
        }
        return out;
      },
      // กล้องบินไปหาการ์ดใบนั้น (ใช้กับป้ายที่อยู่นอกจอ)
      focusZoneCard: (id: string) => {
        // ไปยังจุดชมของกำแพงที่ซองนั้นแขวนอยู่ แล้วขึ้นกรอบแสงรอบซอง
        const en = village.cardEntries().find((e) => e.id === id);
        if (!en) return;
        const st = ZONE_STOPS[en.stop];
        const t = (en.pos.x - st.center.x) * st.tangent.x + (en.pos.z - st.center.z) * st.tangent.z;
        const part = partOf(t);
        const idx = browseList().findIndex(([s, pt]) => s === en.stop && pt === part);
        village.highlight(id);
        if (!zoneAway || !inZone(camera.position.x, camera.position.z, 0.5)) flyToZone(Math.max(0, idx));
        else goStop(Math.max(0, idx));
      },
      flyToZone: () => flyToZone(),
      zoneStep: (delta: number) => {
        if (!zoneAway) return;
        goStop(browseIdx + delta);
      },
      returnView: () => returnView(),
      locate: (target: LocateTarget) => locate(target),
      zoomBy: (factor: number) => zoomBy(factor),
      resetView: () => resetView(),
    });

    // คอมไพล์ shader ทุกตัวล่วงหน้า แล้ววาดหนึ่งภาพให้ข้อมูลขึ้นการ์ดจอครบ ก่อนเริ่มวนลูป
    // ภาพแรกที่ผู้ใช้เห็นจึงไม่สะดุด และบอกหน้าเปิดว่าเริ่มลูกแก้วได้แล้ว
    let disposed = false;
    const begin = () => {
      if (disposed) return;
      renderer.render(scene, camera);
      document.documentElement.dataset.sceneReady = "1";
      window.dispatchEvent(new Event("xmas-scene-ready"));
      frame();
    };
    const compiling = (renderer as unknown as { compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown> }).compileAsync?.(scene, camera);
    if (compiling) compiling.then(begin, begin);
    else begin();

    return () => {
      disposed = true;
      delete document.documentElement.dataset.sceneReady;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      controls.dispose();
      celebrateTimers.forEach((id) => clearTimeout(id));
      tree.dispose();
      plaza.dispose();
      ornLayer.dispose();
      aura.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        const release = (x: THREE.Material) => {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        };
        if (Array.isArray(mat)) mat.forEach(release);
        else if (mat) release(mat);
      });
      glowTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
    // สร้างฉากครั้งเดียว ส่วนข้อมูลจะอัปเดตผ่าน api ด้านล่าง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ซิงก์จำนวนคนในโซนนี้ตามผู้ใช้ออนไลน์
  const crowdKey = `${crowd.count}|${crowd.seed}`;
  useEffect(() => {
    api.current?.setCrowd(crowd.count, crowd.seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crowdKey]);

  // ซิงก์ตุ๊กตาหิมะที่ตกแต่งแล้ว
  const decorKey = decor.map((d) => d.id).join(",");
  useEffect(() => {
    api.current?.setDecor(decor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorKey]);

  useEffect(() => {
    api.current?.setMarker(markerSlot);
  }, [markerSlot]);

  // โหมดเลือกช่องบนฉาก: เปิด/ปิดตารางช่องและอัปเดตช่องที่มีคนวางแล้ว
  useEffect(() => {
    api.current?.setPickMode(pickMode, decor.map((d) => d.slot), giantPickState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickMode, decorKey, giantPickState]);

  // ซิงก์การ์ดที่แขวนบนรั้วโซนคำอวยพร
  const zoneKey = zoneCards.map((c) => c.id).join(",");
  useEffect(() => {
    api.current?.setZoneCards(zoneCards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneKey]);

  // ซิงก์ตุ๊กตาหิมะยักษ์เมื่อมีการสนับสนุนใหม่
  const giantKey = JSON.stringify(giants);
  useEffect(() => {
    api.current?.setGiants(giants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giantKey]);

  // ซิงก์รายการลูกบอลจากเซิร์ฟเวอร์เข้าฉาก
  useEffect(() => {
    api.current?.setOrnaments(ornaments);
  }, [ornaments]);

  useEffect(() => {
    api.current?.setPreview(preview);
  }, [preview]);

  useEffect(() => {
    api.current?.setReduced(reducedMotion);
  }, [reducedMotion]);

  return <div ref={mountRef} className="xmas-canvas" data-tree-scene aria-label="ฉากต้นคริสต์มาสสามมิติ" role="img" />;
}

// การเด้งแบบลูกบอลตกพื้น ใช้กับลูกบอลที่เพิ่งแขวน
function easeOutBounce(t: number) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// จุดแสงนุ่ม ๆ สำหรับหิมะ พลุ และดาว
function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// เท็กซ์เจอร์หิมะ: จุดสว่างกับเงานุ่ม ๆ ใช้ทั้งสีและการนูนของพื้น
function makeSnowTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return new THREE.Texture();
  g.fillStyle = "#e9f1f8";
  g.fillRect(0, 0, size, size);
  // เม็ดหิมะเล็ก ๆ ทั้งสว่างและเงา
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.6 + Math.random() * 1.6;
    g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.9)" : "rgba(160,184,206,0.35)";
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // ลอนนุ่ม ๆ ให้ดูเป็นกองหิมะ
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rr = 30 + Math.random() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, rr);
    grad.addColorStop(0, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// เนินเขาหิมะรอบฉาก: ผิวเป็นลอนแบบธรรมชาติ ยอดมีหิมะ ฐานมืดกลมกลืนกับท้องฟ้าค่ำ
function buildHills(): THREE.Mesh {
  // เนินเขาอยู่เลยขอบลาน (LAND_R 56) ทุกจุดที่วางได้จึงอยู่หน้าเนินเขาเสมอ
  const R = 59;
  const H = 10;
  const geo = new THREE.CylinderGeometry(R, R, H, 200, 1, true);
  geo.translate(0, -4.6, 0);
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const cBase = new THREE.Color(0x08211a);
  const cSlope = new THREE.Color(0x1d4a3b);
  const cSnow = new THREE.Color(0xdfeaf4);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const th = Math.atan2(z, x);
    const h =
      ((Math.sin(th * 3 + 0.8) * 0.5 + 0.5) * 3.4 +
        (Math.sin(th * 7 + 2.1) * 0.5 + 0.5) * 1.5 +
        (Math.sin(th * 15 + 0.3) * 0.5 + 0.5) * 0.4) *
      1.4;
    const top = y > 0;
    if (top) p.setY(i, y + h);
    const height = top ? h : 0;
    c.copy(cBase).lerp(cSlope, top ? Math.min(height / 4.9, 1) : 0);
    c.lerp(cSnow, top ? Math.min(Math.max((height - 5) / 1.7, 0), 1) * 0.9 : 0);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, fog: false });
  const hills = new THREE.Mesh(geo, mat);
  hills.receiveShadow = false;
  return hills;
}

// แผ่นภาพเงาคน (ขาวดำ ย้อมสีทีหลังด้วย SpriteMaterial.color)
function makeSilhouetteTexture(variant: string) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  if (!g) return tex;
  g.scale(3.2, 3.05); // วาดในพิกัด 40x84 เหมือนภาพ SVG เดิม
  g.fillStyle = "#ffffff";
  g.beginPath();
  if (variant === "child") {
    g.arc(20, 22, 8, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(9, 84);
    g.lineTo(9, 58);
    g.quadraticCurveTo(9, 40, 20, 40);
    g.quadraticCurveTo(31, 40, 31, 58);
    g.lineTo(31, 84);
    g.closePath();
    g.fill();
  } else {
    g.arc(20, 12, 9, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(6, 84);
    g.lineTo(6, 52);
    g.quadraticCurveTo(6, 30, 20, 30);
    g.quadraticCurveTo(34, 30, 34, 52);
    g.lineTo(34, 84);
    g.closePath();
    g.fill();
    if (variant === "hat") {
      g.beginPath();
      g.moveTo(10.5, 6);
      g.quadraticCurveTo(20, -3, 29.5, 6);
      g.closePath();
      g.fill();
    }
    if (variant === "bag") {
      g.fillRect(26, 46, 11, 15);
    }
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}


// สุ่มแบบกำหนดค่าได้จากรหัสโซน: ทุกจอในโซนเดียวกันได้ตำแหน่งเดียวกัน
function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// แผงข้อความบนท้องฟ้า วาดจากงานศิลป์ร่วม (skyArt) ให้เหมือนตัวอย่างในหน้าแก้ไข
function makeSkyPanelTexture(text: string, by: string, theme: SkyTheme) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 256;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  if (!g) return tex;
  drawSkyPanel(g, 14, 14, 996, 228, { text, by, theme });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// เลื่อนของซานตาที่มีกวางเรนเดียร์นำหน้า
function makeSleighTexture() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 160;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  if (!g) return tex;
  drawSled(g, 512, 160);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// กล่องของขวัญ มีริบบิ้นไขว้ และโบว์ด้านบน
function makeGiftBox(size: number, color: number) {
  const box = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.1, clearcoat: 0.6 }));
  body.position.y = size / 2;
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfff7e0, roughness: 0.3, metalness: 0.4 });
  const rib1 = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 1.02, size * 0.14), ribbonMat);
  rib1.position.y = size / 2;
  const rib2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.14, size * 1.02, size * 1.02), ribbonMat);
  rib2.position.y = size / 2;
  const bow = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 12, 12), ribbonMat);
  bow.position.y = size * 1.02;
  box.add(body, rib1, rib2, bow);
  return box;
}
