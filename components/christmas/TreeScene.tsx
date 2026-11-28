"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TREE_CAPACITY, type Ornament } from "@/lib/christmas/types";
import { SLOT_COUNT, type Decor } from "@/lib/christmas/decor";
// ตำแหน่งวาดบนฉากใช้ชุด DISPLAY (ช่องที่ถูกปิดหลังผังเปลี่ยนย้ายไปแสดงที่ช่องเปิดใกล้สุด)
import { distToPath, GIANT_DISPLAY as GIANT_POSITIONS, GIANT_MODEL_SCALE, inZone, nearestSlot, SLOT_DISPLAY_POSITIONS as SLOT_POSITIONS, ZONE, ZONE_CAPACITY, ZONE_GATE } from "@/lib/christmas/slots";
import { LAND_R } from "@/lib/christmas/grid";
import type { CardRecord } from "@/lib/christmas/cardSpec";
import { ORNAMENT_HEX, ornamentPosition, pointToHeightAngle, surfaceNormal, TREE_TOP_Y } from "./geometry";
import { buildTreeModel, type TreeVariant } from "./treeModel";
import { createOrnamentLayer } from "./ornamentLayer";
import { createTreeAura } from "./treeAura";
import { buildPlaza } from "./plazaScenery";
import { drawGiantBoard, drawSkyPanel, drawSled, type BoardStyle, type SkyTheme } from "./skyArt";
import { DEFAULT_GIANT_LOOK, parseGiantLook, type GiantLook } from "@/lib/christmas/giant";
import { buildWishVillage } from "./wishVillage";
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
  flyToZone: () => void; // ซูมออกเป็นแผนที่ แล้วไปที่โซนคำอวยพร
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
  onGroundPick: (slot: number) => void; // แตะพื้นหิมะเพื่อเลือกช่องใกล้ที่สุด
  zoneCards?: CardRecord[]; // การ์ดที่แขวนบนรั้วโซนคำอวยพร
  onZoneCardClick?: (id: string) => void;
  onAwayChange?: (away: boolean) => void; // บอกพาเรนต์ว่ากล้องอยู่นอกมุมเดิมหรือไม่
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
export default function TreeScene({ ornaments, preview, reducedMotion, onPick, onOrnamentClick, onError, onReady, ground: groundColor, giants, decor, onDecorClick, onGiantClick, markerSlot, onGroundPick, snowing, crowd, zoneCards = [], onZoneCardClick, onAwayChange }: Props) {
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
  } | null>(null);
  const callbacks = useRef({ onPick, onOrnamentClick, onDecorClick, onGiantClick, onGroundPick, onZoneCardClick, onAwayChange });
  callbacks.current = { onPick, onOrnamentClick, onDecorClick, onGiantClick, onGroundPick, onZoneCardClick, onAwayChange };
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
    let lastShadowAt = 0;
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
    const tree = buildTreeModel({ variant: TREE_VARIANT, small: isSmall, glowTex });
    scene.add(tree.group);
    const hitCone = tree.hitMesh;
    // ลานหินลายทองรอบต้น รั้วไม้เท้าลูกกวาดกับโคมไฟ และอุโมงค์ซุ้มไฟตามทางไปโซนคำอวยพร
    const plaza = buildPlaza({ gate: ZONE_GATE, glowTex, small: isSmall });
    scene.add(plaza.group);

    // ---------- ลูกบอลคำอวยพร: ห้อยจากกิ่งจริง รองรับได้ถึง 999 ลูก (ornamentLayer.ts) ----------
    const ornLayer = createOrnamentLayer({
      capacity: TREE_CAPACITY,
      // ลูกบอลหล่นลงถึงจุดแขวน: มีประกายสีเดียวกับลูกบอลแตกออกเบา ๆ
      onLanded: (pos, color) => burst(pos.clone().add(new THREE.Vector3(0, 0.08, 0)), color, isSmall ? 14 : 24, 0.25),
    });
    scene.add(ornLayer.group);
    let loadedOnce = false;

    // ---------- ออร่าความคืบหน้า: ไต่จากโคนถึงยอดตามจำนวนคำอวยพร (treeAura.ts) ----------
    const aura = createTreeAura({ small: isSmall, pixelRatio: renderer.getPixelRatio() });
    scene.add(aura.group);

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
    // ---------- ปรับขนาดและเรนเดอร์ ----------
    function resize() {
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      // จอแคบให้ถอยกล้องออกเพื่อให้ต้นไม้ไม่ถูกตัด
      camera.fov = camera.aspect < 0.8 ? 50 : 38;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

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
      // แตะพื้นหิมะ: เลือกช่องวางตุ๊กตาหิมะที่ใกล้ที่สุด
      const g = raycaster.intersectObject(ground, false)[0];
      if (g) callbacks.current.onGroundPick(nearestSlot(g.point.x, g.point.z));
    };
    // เมื่อเลื่อนเมาส์ไปโดนลูกบอลให้เปลี่ยนเคอร์เซอร์เป็นมือชี้
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      renderer.domElement.style.cursor = ornLayer.pick(raycaster) ? "pointer" : "";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    // ---------- วนลูปภาพ ----------
    let reduced = reducedMotion;
    let raf = 0;
    const startedAt = performance.now();
    let lastFrameAt = startedAt;
    function frame() {
      const t = (performance.now() - startedAt) / 1000;
      if (focusDecorGroup) {
        // โยกตัวเบา ๆ และกระโดดนิดหนึ่ง เหมือนกำลังทักทาย
        focusDecorGroup.rotation.z = Math.sin(t * 2.4) * 0.09;
        focusDecorGroup.position.y = Math.abs(Math.sin(t * 2.6)) * 0.1;
      }
      const now = performance.now();
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
        const k = 1 + 0.12 * Math.sin(t * 4);
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
      if (now - lastShadowAt > 250) {
        renderer.shadowMap.needsUpdate = true;
        lastShadowAt = now;
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

    function buildDecorSnowman(d: Decor) {
      const grp = new THREE.Group();
      // ผิวหิมะ: มีเงาแวววาวเบา ๆ จากชั้นขนนุ่ม (sheen) และคลิ้วเคลือบใส
      const bodyMat = new THREE.MeshPhysicalMaterial({ color: BODY_HEX[d.body] ?? 0xffffff, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25, sheen: 0.7, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xdfeeff) });
      const add = (...ms: THREE.Object3D[]) => grp.add(...ms);
      const ball = (r: number, y: number, mat: THREE.Material) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 22), mat);
        m.position.y = y;
        add(m);
        return m;
      };
      // ขา/ฐาน
      if (d.legs === "snow") {
        const base = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 16), bodyMat);
        base.scale.set(1, 0.28, 1);
        base.position.y = 0.04;
        add(base);
      } else if (d.legs === "gift") {
        const gift = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.62), new THREE.MeshPhysicalMaterial({ color: 0xdc2643, roughness: 0.4, clearcoat: 0.5 }));
        gift.position.y = 0.15;
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.64), new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.5, roughness: 0.3 }));
        ribbon.position.y = 0.15;
        add(gift, ribbon);
      } else if (d.legs === "boots") {
        const bootMat = new THREE.MeshStandardMaterial({ color: 0x3f2a1a, roughness: 0.6 });
        [-0.13, 0.13].forEach((x) => {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 16), bootMat);
          b.position.set(x, 0.08, 0.04);
          add(b);
        });
      }
      // ตัว
      ball(0.36, 0.52, bodyMat);
      ball(0.27, 1.05, bodyMat);
      // หัว
      ball(0.2, 1.42, bodyMat);
      // กระดุมสามเม็ดบนลำตัว
      const btnMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3, metalness: 0.2 });
      [0.62, 0.52, 0.42].forEach((y) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), btnMat);
        b.position.set(0, y, 0.33);
        add(b);
      });
      // เงาสัมผัสพื้นให้ตุ๊กตาดูนั่งอยู่บนหิมะจริง
      const contact = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0x0b2a1f, transparent: true, opacity: 0.2, depthWrite: false }));
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = 0.006;
      add(contact);
      const eye = new THREE.MeshStandardMaterial({ color: 0x111111 });
      [-0.07, 0.07].forEach((x) => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), eye);
        e.position.set(x, 1.46, 0.18);
        add(e);
        // แสงในดวงตา ทำให้ดูมีชีวิต
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        hl.position.set(x + 0.006, 1.468, 0.196);
        add(hl);
      });
      // จมูก
      const noseMat = d.nose === "bell" ? new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.7, roughness: 0.25 }) : d.nose === "star" ? new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.6, roughness: 0.3 }) : d.nose === "button" ? new THREE.MeshStandardMaterial({ color: 0xdc2643 }) : new THREE.MeshStandardMaterial({ color: 0xff8a1f });
      const nose = new THREE.Mesh(d.nose === "button" || d.nose === "bell" ? new THREE.SphereGeometry(0.04, 12, 12) : new THREE.ConeGeometry(0.035, 0.2, 12), noseMat);
      if (d.nose === "carrot") nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 1.4, 0.22);
      if (d.nose === "heart") {
        // จมูกรูปหัวใจ: รูปร่างแบนที่ฉายออกมาเล็กน้อย
        const hs = new THREE.Shape();
        hs.moveTo(0, -0.035);
        hs.bezierCurveTo(-0.01, -0.012, -0.035, 0.0, -0.035, 0.02);
        hs.bezierCurveTo(-0.035, 0.045, -0.012, 0.05, 0, 0.03);
        hs.bezierCurveTo(0.012, 0.05, 0.035, 0.045, 0.035, 0.02);
        hs.bezierCurveTo(0.035, 0.0, 0.01, -0.012, 0, -0.035);
        const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.014, bevelEnabled: false, curveSegments: 16 }), new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 }));
        heart.position.set(0, 1.4, 0.2);
        add(heart);
      } else if (d.nose === "star") {
        const starShape = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
          const rad = i % 2 === 0 ? 0.05 : 0.022;
          if (i === 0) starShape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else starShape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        starShape.closePath();
        const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.02, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.6, roughness: 0.3 }));
        star.position.set(0, 1.4, 0.2);
        add(star);
      } else {
        add(nose);
      }
      // ผ้าพันคอ
      // ผ้าพันคอ: เส้นโค้งรอบคอพร้อมชายผ้าที่ห้อยลงด้านหน้า
      const scarfMat = new THREE.MeshPhysicalMaterial({ color: SCARF_HEX[d.scarf] ?? 0xdc2643, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) });
      const scarfCurve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-0.22, 1.2, 0.02),
          new THREE.Vector3(0, 1.17, 0.23),
          new THREE.Vector3(0.22, 1.2, 0.02),
          new THREE.Vector3(0.2, 1.23, -0.11),
          new THREE.Vector3(0, 1.25, -0.21),
          new THREE.Vector3(-0.2, 1.23, -0.11),
        ],
        true,
      );
      add(new THREE.Mesh(new THREE.TubeGeometry(scarfCurve, 64, 0.04, 14, true), scarfMat));
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.03), scarfMat);
      tail.position.set(0.11, 1.0, 0.24);
      tail.rotation.z = -0.1;
      add(tail);
      // หมวก
      const hatMat = new THREE.MeshStandardMaterial({ color: d.hat === "santa" ? 0xdc2643 : d.hat === "crown" ? 0xf5c542 : HAT_HEX, roughness: 0.45 });
      if (d.hat === "top" || d.hat === "santa") {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.3, 24), hatMat);
        crown.position.y = 1.68;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 28), hatMat);
        brim.position.y = 1.52;
        // แถบสีรอบหมวกทรงสูง
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0xdc2643, roughness: 0.5 }));
        band.position.y = 1.6;
        add(crown, brim, band);
      } else if (d.hat === "beanie") {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: SCARF_HEX[d.scarf] ?? 0x3b82f6 }));
        cap.position.y = 1.5;
        add(cap);
      } else if (d.hat === "crown") {
        const crownShape = new THREE.Shape();
        crownShape.moveTo(-0.2, 0);
        crownShape.lineTo(-0.2, 0.2);
        crownShape.lineTo(-0.1, 0.07);
        crownShape.lineTo(0, 0.24);
        crownShape.lineTo(0.1, 0.07);
        crownShape.lineTo(0.2, 0.2);
        crownShape.lineTo(0.2, 0);
        crownShape.closePath();
        const crownGeo = new THREE.ExtrudeGeometry(crownShape, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2, curveSegments: 1 });
        crownGeo.translate(0, 0, -0.17);
        const crown = new THREE.Mesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.7, roughness: 0.25 }));
        crown.position.y = 1.5;
        add(crown);
        // อัญมณีสามเม็ดบนมงกุฎ
        [
          [0, 1.56, 0.2, 0xdc2643],
          [-0.12, 1.53, 0.19, 0x22a95a],
          [0.12, 1.53, 0.19, 0x3b82f6],
        ].forEach(([x, y, z, c]) => {
          const gem = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), new THREE.MeshStandardMaterial({ color: c as number, metalness: 0.2, roughness: 0.15 }));
          gem.position.set(x as number, y as number, z as number);
          add(gem);
        });
      }
      // หมวกเบเร่ต์และที่ปิดหู (หมวกฟรี)
      if (d.hat === "beret") {
        const beret = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 14), new THREE.MeshStandardMaterial({ color: 0xdc2643, roughness: 0.7 }));
        beret.scale.set(1, 0.32, 1);
        beret.position.set(0.02, 1.58, 0);
        beret.rotation.z = 0.12;
        const stem = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), new THREE.MeshStandardMaterial({ color: 0x7f1d1d }));
        stem.position.set(0.06, 1.66, 0);
        add(beret, stem);
      } else if (d.hat === "earmuff") {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 }));
        band.position.set(0, 1.42, 0);
        const cupMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.5 });
        [-1, 1].forEach((side) => {
          const cup = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), cupMat);
          cup.position.set(side * 0.21, 1.42, 0);
          add(cup);
        });
        add(band);
      }
      // เครื่องประดับ
      if (d.acc === "snowflake") {
        // เข็มกลัดเกล็ดหิมะที่หน้าอก
        const ice = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.2, metalness: 0.1, emissive: 0x0c4a6e, emissiveIntensity: 0.25 });
        [0, Math.PI / 3, -Math.PI / 3].forEach((a) => {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.016), ice);
          bar.position.set(0, 1.02, 0.28);
          bar.rotation.z = a;
          add(bar);
        });
      }
      if (d.acc === "glasses") {
        const gm = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3, metalness: 0.4 });
        [-0.07, 0.07].forEach((x) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 20), gm);
          ring.position.set(x, 1.46, 0.19);
          add(ring);
        });
      } else if (d.acc === "bow") {
        const bm = new THREE.MeshStandardMaterial({ color: 0xdc2643, roughness: 0.5 });
        const l = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 12), bm);
        l.rotation.z = Math.PI / 2;
        l.position.set(-0.05, 1.2, 0.2);
        const r = l.clone();
        r.position.x = 0.05;
        r.rotation.z = -Math.PI / 2;
        add(l, r);
      } else if (d.acc === "bell") {
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.7, roughness: 0.25 }));
        bell.position.set(0.14, 1.12, 0.2);
        add(bell);
      }
      // ของตกแต่งหัวเพิ่มเติม
      if (d.hat === "pom") {
        const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
        pom.position.y = 1.72;
        add(pom);
      } else if (d.hat === "holly") {
        const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 10, 28), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 }));
        wreath.rotation.x = Math.PI / 2;
        wreath.position.y = 1.5;
        add(wreath);
      }
      // หมวกพิเศษของตุ๊กตายักษ์: ทิอารา เขากวาง หมวกเอลฟ์
      if (d.hat === "tiara") {
        const gold = new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.8, roughness: 0.2 });
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 40), gold);
        band.rotation.x = Math.PI / 2;
        band.position.y = 1.52;
        add(band);
        [-0.1, 0, 0.1].forEach((x, i) => {
          const gem = new THREE.Mesh(new THREE.OctahedronGeometry(i === 1 ? 0.045 : 0.03, 0), new THREE.MeshStandardMaterial({ color: i === 1 ? 0xdc2643 : 0x7dd3fc, metalness: 0.2, roughness: 0.1 }));
          gem.position.set(x, 1.58 + (i === 1 ? 0.03 : 0), 0.18);
          add(gem);
        });
      } else if (d.hat === "antlers") {
        const antler = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.85 });
        [-1, 1].forEach((side) => {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.34, 8), antler);
          stem.position.set(side * 0.12, 1.66, 0);
          stem.rotation.z = side * -0.5;
          add(stem);
          const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.22, 6), antler);
          fork.position.set(side * 0.22, 1.86, 0);
          fork.rotation.z = side * -1.0;
          add(fork);
          const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.14, 6), antler);
          tine.position.set(side * 0.25, 1.98, 0.02);
          tine.rotation.z = side * -0.3;
          add(tine);
        });
      } else if (d.hat === "elf") {
        const green = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 24), green);
        cone.position.set(0.04, 1.8, 0);
        cone.rotation.z = -0.25;
        const trim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
        trim.rotation.x = Math.PI / 2;
        trim.position.y = 1.5;
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12), new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.8, roughness: 0.2 }));
        bell.position.set(0.22, 2.05, 0.02);
        add(cone, trim, bell);
      }
      // พวงมาลัยรอบคอ
      if (d.acc === "wreath") {
        const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 12, 40), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 }));
        wreath.rotation.x = Math.PI / 2;
        wreath.position.y = 1.16;
        add(wreath);
        [0, 1.2, 2.4, 3.6, 4.8].forEach((a) => {
          const berry = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), new THREE.MeshStandardMaterial({ color: 0xdc2643, roughness: 0.4 }));
          berry.position.set(Math.cos(a) * 0.26, 1.16, Math.sin(a) * 0.26);
          add(berry);
        });
      }
      // แขน
      // แขนกิ่งไม้: ติดที่ข้างตัว ยกขึ้นเล็กน้อย มีกิ่งแยกที่ปลาย
      const stickMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
      const ARM_ANGLE = 0.75;
      const armTip = (side: number) => new THREE.Vector3(side * (0.42 + 0.21 * Math.sin(ARM_ANGLE)), 1.12 + 0.21 * Math.cos(ARM_ANGLE), 0);
      if (d.arms === "sticks") {
        [-1, 1].forEach((side) => {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.42, 8), stickMat);
          st.rotation.z = side * -ARM_ANGLE;
          st.position.set(side * 0.42, 1.12, 0);
          add(st);
          const tip = armTip(side);
          [-0.5, 0, 0.5].forEach((tilt) => {
            const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.1, 6), stickMat);
            twig.position.set(tip.x + side * 0.02, tip.y + 0.05, 0);
            twig.rotation.z = side * (-0.5 + tilt * 0.5);
            add(twig);
          });
        });
      } else if (d.arms === "gift") {
        const armSide = (side: number) => {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.4, 8), stickMat);
          st.rotation.z = side * -ARM_ANGLE;
          st.position.set(side * 0.42, 1.12, 0);
          add(st);
        };
        armSide(1);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), new THREE.MeshPhysicalMaterial({ color: 0xdc2643, roughness: 0.4 }));
        box.position.copy(armTip(1)).add(new THREE.Vector3(0.08, 0.06, 0.06));
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.22), new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.5, roughness: 0.3 }));
        ribbon.position.copy(box.position);
        add(box, ribbon);
      }
      if (d.arms === "wings") {
        [-1, 1].forEach((side) => {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), bodyMat);
          wing.scale.set(1.5, 0.45, 0.5);
          wing.position.set(side * 0.44, 0.98, 0);
          wing.rotation.z = side * -0.35;
          add(wing);
        });
      }
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
    scene.add(marker);

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
    type WalkAnim = { curve: THREE.CatmullRomCurve3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3; start: number; dur: number; fov0: number; endMin: number };
    let walkAnim: WalkAnim | null = null;
    function animateCam(toPos: THREE.Vector3, toTgt: THREE.Vector3, dur = 900) {
      if (walkAnim) {
        camera.fov = walkAnim.fov0;
        camera.updateProjectionMatrix();
        walkAnim = null;
      }
      camAnim = { fromPos: camera.position.clone(), toPos, fromTgt: controls.target.clone(), toTgt, start: performance.now(), dur };
    }
    // เดินกล้องไปตามเส้นโค้ง (ใช้กับทางเดินอุโมงค์ไฟไปโซนคำอวยพร) มองไปข้างหน้าตามทาง แล้วค่อยหันไปหาจุดหมาย
    function walkCam(points: THREE.Vector3[], toTgt: THREE.Vector3, dur: number, endMin = 0.5) {
      camAnim = null;
      controls.minDistance = 0.2;
      const curve = new THREE.CatmullRomCurve3([camera.position.clone(), ...points], false, "centripetal");
      walkAnim = { curve, fromTgt: controls.target.clone(), toTgt, start: performance.now(), dur, fov0: walkAnim?.fov0 ?? camera.fov, endMin };
    }
    const smooth = (a: number, b: number, x: number) => {
      const k = Math.min(Math.max((x - a) / (b - a), 0), 1);
      return k * k * (3 - 2 * k);
    };
    function stepWalk(now: number) {
      if (!walkAnim) return;
      const w = walkAnim;
      const k = Math.min((now - w.start) / w.dur, 1);
      // เร่งออกตัว เดินคงที่ช่วงกลาง แล้วชะลอตอนถึง
      const e = k < 0.15 ? (k * k) / 0.3 : k > 0.85 ? 1 - ((1 - k) * (1 - k)) / 0.3 : 0.075 + (k - 0.15) * (0.85 / 0.7);
      const pos = w.curve.getPointAt(Math.min(Math.max(e, 0), 1));
      const ahead = w.curve.getPointAt(Math.min(e + 0.06, 1));
      ahead.y = Math.max(pos.y - 0.25, 0.8);
      const tgt = new THREE.Vector3().lerpVectors(w.fromTgt, ahead, smooth(0, 0.12, e));
      tgt.lerp(w.toTgt, smooth(0.78, 1, e));
      camera.position.copy(pos);
      controls.target.copy(tgt);
      // มุมกล้องกว้างขึ้นเล็กน้อยระหว่างเดิน ให้รู้สึกเหมือนวาปผ่านอุโมงค์
      const warp = Math.sin(Math.min(e, 1) * Math.PI);
      camera.fov = w.fov0 + warp * 12;
      camera.updateProjectionMatrix();
      if (k >= 1) {
        camera.fov = w.fov0;
        camera.updateProjectionMatrix();
        controls.minDistance = w.endMin;
        walkAnim = null;
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
    let zoneTimers: number[] = [];
    let zoneAway = false;
    function rememberView() {
      if (!savedView) savedView = { pos: camera.position.clone(), tgt: controls.target.clone(), min: controls.minDistance };
    }
    function flyToZone() {
      zoneTimers.forEach((t) => clearTimeout(t));
      zoneTimers = [];
      clearBeacon();
      rememberView();
      zoneAway = true;
      callbacks.current.onAwayChange?.(true);
      const fog = scene.fog as THREE.Fog | null;
      if (fog) fog.far = 120;
      controls.minDistance = 0.5;
      const reducedNow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const { pts, tgt } = tunnelRoute();
      if (reducedNow) {
        // ลดการเคลื่อนไหว: วาปไปถึงทันที
        animateCam(pts[pts.length - 1], tgt, 1);
        return;
      }
      walkCam(pts, tgt, isSmall ? 6200 : 6800);
    }
    // ทางเดินจากจุดที่กล้องอยู่: อ้อมต้นไปหัวทาง เดินลอดซุ้มไฟ ผ่านประตู แล้วหยุดในลานระหว่างกำแพงการ์ดสองวง
    function tunnelRoute() {
      const gate = new THREE.Vector3(ZONE_GATE.x, 0, ZONE_GATE.z);
      const dir = gate.clone().normalize();
      const total = gate.length();
      const EYE = 1.75;
      const camA = Math.atan2(camera.position.z, camera.position.x);
      const gateA = Math.atan2(dir.z, dir.x);
      let diff = gateA - camA;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      const camR = Math.hypot(camera.position.x, camera.position.z);
      // อ้อมรอบต้น (ถ้ากล้องอยู่คนละฝั่งกับทาง)
      if (Math.abs(diff) > 0.5) {
        const r = Math.min(Math.max(camR, 9.5), 14);
        for (const f of [0.35, 0.7]) {
          const a = camA + diff * f;
          pts.push(new THREE.Vector3(Math.cos(a) * r, 4.4 - f * 1.4, Math.sin(a) * r));
        }
      }
      for (const s of [8.2, 12, total * 0.72, total - 1.6]) pts.push(dir.clone().multiplyScalar(s).setY(EYE));
      pts.push(new THREE.Vector3(ZONE.x, EYE, ZONE.z + ZONE.half - 1.4));
      // หยุดในทางเดินวงแหวนระหว่างกำแพงสองวง เห็นต้นสนกลางลานทั้งต้นและกำแพงการ์ดฝั่งตรงข้าม
      const end = new THREE.Vector3(ZONE.x, isSmall ? 2.8 : 2.5, ZONE.z + (isSmall ? 8.7 : 8.35));
      pts.push(end);
      return { pts, tgt: new THREE.Vector3(ZONE.x, isSmall ? 2.0 : 2.2, ZONE.z + 1) };
    }
    function returnView() {
      zoneTimers.forEach((t) => clearTimeout(t));
      zoneTimers = [];
      clearBeacon();
      const fog = scene.fog as THREE.Fog | null;
      if (fog) fog.far = FOG_FAR;
      zoneAway = false;
      callbacks.current.onAwayChange?.(false);
      const back = savedView ?? { pos: HOME_POS.clone(), tgt: HOME_TGT.clone(), min: 5.5 };
      savedView = null;
      controls.minDistance = back.min;
      // ถ้ากล้องอยู่ในหมู่บ้าน ให้เดินกลับออกทางประตูและอุโมงค์ ไม่ทะลุกำแพง
      const inVillage = inZone(camera.position.x, camera.position.z, 0.5);
      if (inVillage && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const gate = new THREE.Vector3(ZONE_GATE.x, 0, ZONE_GATE.z);
        const dir = gate.clone().normalize();
        const total = gate.length();
        const pts = [
          new THREE.Vector3(ZONE.x, 1.9, ZONE.z + ZONE.half - 2.2),
          dir.clone().multiplyScalar(total - 1.2).setY(1.9),
          dir.clone().multiplyScalar(total * 0.55).setY(2.2),
          dir.clone().multiplyScalar(9).setY(2.8),
        ];
        // อ้อมรอบต้นกลับไปยังมุมเดิม (ไม่ตัดผ่านต้น)
        const gA = Math.atan2(dir.z, dir.x);
        const bA = Math.atan2(back.pos.z, back.pos.x);
        let d = bA - gA;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const bR = Math.min(Math.max(Math.hypot(back.pos.x, back.pos.z), 9.5), 14);
        if (Math.abs(d) > 0.5) for (const f of [0.35, 0.7]) pts.push(new THREE.Vector3(Math.cos(gA + d * f) * bR, 3.2 + f * 0.6, Math.sin(gA + d * f) * bR));
        pts.push(back.pos);
        walkCam(pts, back.tgt, 4200, back.min);
      } else {
        animateCam(back.pos, back.tgt, 1000);
      }
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
      const out = new THREE.Vector3(pp.x, 0, pp.z).normalize();
      // มองจากด้านนอกและสูงขึ้นเล็กน้อย ให้พุ่มต้นไม้ไม่บังตุ๊กตา
      // บนมือถือให้ตุ๊กตาอยู่ช่วงบนของจอ เพื่อให้การ์ดด้านล่างไม่บังตัว
      const toTgt = new THREE.Vector3(pp.x, isSmall ? 0.15 : 0.9, pp.z);
      const toPos = new THREE.Vector3(pp.x + out.x * 3.2, 2.9, pp.z + out.z * 3.2);
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
        marker.position.set(pp.x, 0.03, pp.z);
        marker.visible = true;
      },
      setGiants: api_setGiants,
      setZoneCards: api_setZoneCards,
      setOrnaments: (list) => {
        // โหลดครั้งแรกไม่ต้องเล่นแอนิเมชัน ที่เหลือให้ลูกบอลใหม่ค่อย ๆ หล่นลงมาจากกิ่ง
        ornLayer.set(list, loadedOnce);
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
        // มองตรงจากด้านหน้าซอง (ตามทิศหน้ากำแพง) จึงไม่ถูกกำแพงอื่นบัง
        const en = village.cardEntries().find((e) => e.id === id);
        if (!en) return;
        const target = en.pos.clone();
        const toPos = target.clone().addScaledVector(en.normal, 2.4).setY(Math.max(1.3, target.y + 0.35));
        controls.minDistance = 0.5;
        animateCam(toPos, target, reduced ? 1 : 900);
      },
      flyToZone: () => flyToZone(),
      returnView: () => returnView(),
      locate: (target: LocateTarget) => locate(target),
      zoomBy: (factor: number) => zoomBy(factor),
      resetView: () => resetView(),
    });

    // เริ่มวนลูปภาพหลังประกาศทุกตัวแปรครบแล้ว
    frame();

    return () => {
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
  const R = 42;
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
      (Math.sin(th * 3 + 0.8) * 0.5 + 0.5) * 3.4 +
      (Math.sin(th * 7 + 2.1) * 0.5 + 0.5) * 1.5 +
      (Math.sin(th * 15 + 0.3) * 0.5 + 0.5) * 0.4;
    const top = y > 0;
    if (top) p.setY(i, y + h);
    const height = top ? h : 0;
    c.copy(cBase).lerp(cSlope, top ? Math.min(height / 3.5, 1) : 0);
    c.lerp(cSnow, top ? Math.min(Math.max((height - 3.6) / 1.2, 0), 1) * 0.9 : 0);
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
