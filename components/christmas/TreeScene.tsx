"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Ornament } from "@/lib/christmas/types";
import { SLOT_COUNT, type Decor } from "@/lib/christmas/decor";
import { GIANT_SPOT_DEFS, GIANT_SPOT_RADIUS, nearestSlot, SLOT_POSITIONS } from "@/lib/christmas/slots";
import { ORNAMENT_HEX, ornamentPosition, pointToHeightAngle, radiusAt, surfaceNormal, TREE_H, TREE_R0 } from "./geometry";
import { drawGiantBoard, drawSkyPanel, drawSled, type BoardStyle, type SkyTheme } from "./skyArt";
import { DEFAULT_GIANT_LOOK, type GiantLook } from "@/lib/christmas/giant";

// ตุ๊กตายักษ์ที่ตั้งป้ายไว้: ชื่อ ข้อความ ตำแหน่ง และลุค (ถ้าไม่มีจะใช้ลุคเริ่มต้น)
type GiantSpec = { name: string; message: string; spot: number; look?: GiantLook };

export type Preview = { height: number; angle: number; color: string; shape: string } | null;

export type TreeSceneHandle = {
  launchFirework: (color: string) => void;
  skyMessage: (text: string, by: string, color: string, theme: string) => void;
  highlightDecor: (slot: number) => void;
  focusOrnament: (id: string | null) => void;
  focusDecor: (d: Decor | null) => void;
  zoomBy: (factor: number) => void;
  resetView: () => void;
  previewGiant: (spot: number, name: string, message: string) => void;
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
  giant: GiantSpec | null; // ตุ๊กตายักษ์ประจำห้องพร้อมป้ายและตำแหน่ง
  decor: Decor[]; // ตุ๊กตาหิมะที่ผู้ใช้ตกแต่งรอบต้น
  onDecorClick: (d: Decor) => void;
  markerSlot: number | null; // ช่องที่กำลังเลือกบนพื้น
  onGroundPick: (slot: number) => void; // แตะพื้นหิมะเพื่อเลือกช่องใกล้ที่สุด
  snowing: boolean; // เปิด/ปิดหิมะตก
  crowd: { count: number; seed: string }; // จำนวนคนออนไลน์ในโซนนี้ และรหัสโซนสำหรับจัดตำแหน่ง
};

// ฉากต้นคริสต์มาสด้วย Three.js: ใบไม้แบบจุดระยิบ ไฟประดับ ลูกบอลโลหะ หิมะ และพลุ
export default function TreeScene({ ornaments, preview, reducedMotion, onPick, onOrnamentClick, onError, onReady, ground: groundColor, giant, decor, onDecorClick, markerSlot, onGroundPick, snowing, crowd }: Props) {
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
    setGiant: (g: GiantSpec | null) => void;
    setDecor: (list: Decor[]) => void;
    setMarker: (slot: number | null) => void;
  } | null>(null);
  const callbacks = useRef({ onPick, onOrnamentClick, onDecorClick, onGroundPick });
  callbacks.current = { onPick, onOrnamentClick, onDecorClick, onGroundPick };
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  // สร้างฉากครั้งเดียวเมื่อ mount
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      onError();
      return;
    }
    const isSmall = window.matchMedia("(max-width: 767px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    // หมอกบาง ๆ ทำให้พื้นหิมะไกลค่อย ๆ กลมกลืนกับท้องฟ้าค่ำ
    scene.fog = new THREE.Fog(0x0c251d, 14, 40);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 2.6, 9.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4.5;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.enablePan = false;
    controls.autoRotate = false; // ไม่หมุนเอง ผู้ใช้หมุนดูได้เอง

    // ---------- แสง ----------
    scene.add(new THREE.AmbientLight(0x9fb8d6, 0.35));
    const key = new THREE.DirectionalLight(0xffe2b0, 1.4);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key);
    key.target.position.set(0, 1, 0);
    scene.add(key.target);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.8);
    rim.position.set(-7, 4, -5);
    scene.add(rim);
    const starLight = new THREE.PointLight(0xffc857, 2.4, 6, 2);
    starLight.position.set(0, TREE_H + 0.4, 0.4);
    scene.add(starLight);

    // ---------- พื้นหิมะ ----------
    // พื้นหิมะ: ผิวเป็นลอนกองหิมะเบา ๆ รอบนอก โคนต้นเรียบ และมีเม็ดหิมะจากเท็กซ์เจอร์
    const groundGeo = new THREE.PlaneGeometry(96, 96, 220, 220);
    groundGeo.rotateX(-Math.PI / 2);
    const gp = groundGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i);
      const z = gp.getZ(i);
      const d = Math.hypot(x, z);
      const drift = (Math.sin(x * 0.55 + Math.cos(z * 0.7)) * Math.cos(z * 0.45 - x * 0.3) * 0.6 + Math.sin(x * 1.7 + z * 1.3) * 0.25) * 0.11;
      const edge = Math.min(Math.max((d - 10) / 10, 0), 1); // ลานด้านในเรียบ ให้ของประดับวางได้พอดี
      gp.setY(i, drift * edge * edge);
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

    // ---------- ลำต้น ----------
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 }),
    );
    trunk.position.y = 0.45;
    trunk.castShadow = true;
    scene.add(trunk);

    // ---------- กล่องของขวัญใต้ต้น ----------
    const giftColors = [0xdc2643, 0x3b82f6, 0xf5c542, 0x22c55e, 0xf472b6];
    const giftSpots = [
      [1.55, 0.2, 0.4, 0.34],
      [-1.35, 0.15, 0.9, 0.26],
      [0.4, 0.14, 1.6, 0.22],
      [-0.7, 0.2, -1.3, 0.3],
      [1.1, 0.12, -1.0, 0.2],
    ];
    giftSpots.forEach(([x, y, z, size], i) => {
      const color = giftColors[i % giftColors.length];
      const box = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.1, clearcoat: 0.6 }),
      );
      body.position.y = size / 2;
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfff7e0, roughness: 0.3, metalness: 0.4, emissive: 0x332200, emissiveIntensity: 0.2 });
      const rib1 = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 1.02, size * 0.14), ribbonMat);
      rib1.position.y = size / 2;
      const rib2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.14, size * 1.02, size * 1.02), ribbonMat);
      rib2.position.y = size / 2;
      const bow = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 14, 14), ribbonMat);
      bow.position.y = size * 1.02;
      box.add(body, rib1, rib2, bow);
      box.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      box.position.set(x, y, z);
      box.rotation.y = i * 0.7;
      scene.add(box);
    });

    // ---------- ใบไม้: จุดสีเขียวหลายโทนกระจายบนผิวกรวย ----------
    const treeGroup = new THREE.Group();
    scene.add(treeGroup);
    const FOLIAGE = isSmall ? 1500 : 3200;
    const fPos = new Float32Array(FOLIAGE * 3);
    const fCol = new Float32Array(FOLIAGE * 3);
    const greens = [0x14532d, 0x166534, 0x15803d, 0x16a34a, 0x22c55e, 0x0f3d24];
    const tmp = new THREE.Color();
    for (let i = 0; i < FOLIAGE; i++) {
      const h = Math.pow(Math.random(), 0.8);
      const a = Math.random() * Math.PI * 2;
      const r = radiusAt(h) * (0.78 + Math.random() * 0.22);
      fPos[i * 3] = Math.cos(a) * r;
      fPos[i * 3 + 1] = h * TREE_H + 0.1 + (Math.random() - 0.5) * 0.04;
      fPos[i * 3 + 2] = Math.sin(a) * r;
      tmp.setHex(greens[Math.floor(Math.random() * greens.length)]);
      fCol[i * 3] = tmp.r;
      fCol[i * 3 + 1] = tmp.g;
      fCol[i * 3 + 2] = tmp.b;
    }
    const foliageGeo = new THREE.BufferGeometry();
    foliageGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
    foliageGeo.setAttribute("color", new THREE.BufferAttribute(fCol, 3));
    const foliage = new THREE.Points(
      foliageGeo,
      new THREE.PointsMaterial({ size: isSmall ? 0.05 : 0.04, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    treeGroup.add(foliage);

    // ใบสนจริง: กิ่งย่อยเป็นแผ่นมีขอบหยักและห้อยลง ปลายกิ่งมีหิมะเกาะ
    const frondMesh = new THREE.Mesh(
      buildFronds(isSmall),
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.78, metalness: 0 }),
    );
    frondMesh.castShadow = true;
    frondMesh.receiveShadow = true;
    treeGroup.add(frondMesh);
    // ชั้นในของพุ่มที่สั้นและมืดกว่า เติมช่องว่างให้ต้นดูหนาและมีเงาซ้อน
    const innerMesh = new THREE.Mesh(
      buildFronds(isSmall, 0.72, true),
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 }),
    );
    innerMesh.castShadow = true;
    innerMesh.receiveShadow = true;
    treeGroup.add(innerMesh);

    // กรวยโปร่งแสงสำหรับรับการคลิกบนผิวต้น
    const hitCone = new THREE.Mesh(
      new THREE.ConeGeometry(TREE_R0 + 0.02, TREE_H, 40, 1, true),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hitCone.position.y = TREE_H / 2 + 0.1;
    treeGroup.add(hitCone);

    // ---------- ดาวบนยอด ----------
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? 0.36 : 0.16;
      const ang = Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(ang) * rr;
      const y = Math.sin(ang) * rr;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    const starMesh = new THREE.Mesh(
      starGeo,
      new THREE.MeshPhysicalMaterial({ color: 0xffd76a, metalness: 0.9, roughness: 0.18, emissive: 0xffa500, emissiveIntensity: 0.35, clearcoat: 1 }),
    );
    starMesh.position.set(0, TREE_H + 0.32, 0);
    scene.add(starMesh);
    const glowTex = makeGlowTexture();
    const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd76a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    starGlow.scale.set(1.8, 1.8, 1);
    starGlow.position.copy(starMesh.position);
    scene.add(starGlow);

    // ---------- ไฟประดับแบบเกลียว กระพริบ ----------
    const LIGHTS = 70;
    const lightMeshes: THREE.Mesh[] = [];
    const lightColors = [0xffd76a, 0xff6b6b, 0x7dd3fc, 0xffffff, 0xf9a8d4];
    for (let i = 0; i < LIGHTS; i++) {
      const t = i / LIGHTS;
      const h = 0.06 + t * 0.9;
      const a = t * Math.PI * 9;
      const r = radiusAt(h) * 1.02;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 10, 10),
        new THREE.MeshBasicMaterial({ color: lightColors[i % lightColors.length] }),
      );
      bulb.position.set(Math.cos(a) * r, h * TREE_H + 0.1, Math.sin(a) * r);
      treeGroup.add(bulb);
      lightMeshes.push(bulb);
    }

    // ---------- ลูกบอลและของตกแต่งที่ผู้ใช้แขวน ----------
    const ornGroup = new THREE.Group();
    scene.add(ornGroup);
    // swing = สถานะตัวแกว่ง (มุม และความเร็วเชิงมุม) จำลองด้วยสปริง-แดมเปอร์
    const ornMeshes = new Map<string, { mesh: THREE.Object3D; born: number; target: THREE.Vector3; landed: boolean; color: number; swing: { x: number; z: number; vx: number; vz: number }; body: THREE.Object3D; string: THREE.Mesh; bow: THREE.Object3D; hookY: number }>();
    const ornaments3D = new Map<string, Ornament>();
    let loadedOnce = false;

    function makeOrnamentMesh(o: Ornament) {
      const color = ORNAMENT_HEX[o.color] ?? 0xf5c542;
      const mat = new THREE.MeshPhysicalMaterial({ color, metalness: 0.65, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });
      let geo: THREE.BufferGeometry;
      if (o.shape === "star") {
        geo = new THREE.ExtrudeGeometry(starShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
        geo.scale(0.36, 0.36, 0.36);
        geo.center();
      } else if (o.shape === "gift") {
        geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      } else if (o.shape === "bell") {
        const pts = [new THREE.Vector2(0.02, 0.12), new THREE.Vector2(0.07, 0.08), new THREE.Vector2(0.09, -0.02), new THREE.Vector2(0.12, -0.08), new THREE.Vector2(0.02, -0.08)];
        geo = new THREE.LatheGeometry(pts, 20);
      } else {
        geo = new THREE.SphereGeometry(0.11, 28, 28);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // ห่วงแขวนเล็ก ๆ ที่ยอดของชิ้นงาน ทำให้ดูเป็นของที่แขวนอยู่จริง
      const hookY = o.shape === "star" ? 0.2 : o.shape === "gift" ? 0.13 : 0.135;
      const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.03, 0.008, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 }),
      );
      hook.position.y = hookY;
      mesh.add(hook);
      mesh.userData.hookY = hookY;
      if (o.shape === "gift") {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.205, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.4 }));
        mesh.add(ribbon);
      }
      const p = ornamentPosition(o.height, o.angle);
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData.ornamentId = o.id;
      mesh.userData.color = color;
      return mesh;
    }

    function addOrnamentMesh(o: Ornament, animate: boolean) {
      if (ornMeshes.has(o.id)) return;
      const body = makeOrnamentMesh(o);
      const target = body.position.clone();
      const hookY = (body.userData.hookY as number) ?? 0.135;
      // ตัวชิ้นงานวางออกจากผิวต้นตามแนวปกติ เพื่อให้แนบผิวเป็นระนาบเดียวกัน
      // ดาวและระฆังหันระนาบตามผิวต้นด้วย การแกว่งหมุนรอบจุดแนบ
      const nrm = surfaceNormal(o.angle);
      // ลูกบอลห้อยจากห่วงลงมาบนเชือกสั้น ๆ ที่ผูกกับกิ่ง (จุดหมุนอยู่ที่กิ่ง)
      body.position.set(nrm.x * 0.03, animate ? 0 : -ORN_STRING, nrm.z * 0.03);
      body.rotation.set(0, -o.angle + Math.PI / 2, 0);
      const pivot = new THREE.Group();
      pivot.position.copy(target);
      pivot.add(body);
      const string = new THREE.Mesh(STRING_GEO, STRING_MAT);
      string.scale.y = animate ? 0.001 : ORN_STRING - hookY;
      pivot.add(string);
      const bow = makeRibbonBow();
      if (animate) bow.scale.setScalar(0.001);
      pivot.add(bow);
      ornGroup.add(pivot);
      ornMeshes.set(o.id, {
        mesh: pivot,
        born: animate ? performance.now() : 0,
        target,
        landed: !animate,
        color: (body.userData.color as number) ?? 0xffd76a,
        swing: { x: 0, z: 0, vx: 0, vz: 0 },
        body,
        string,
        bow,
        hookY,
      });
      ornaments3D.set(o.id, o);
    }

    // ---------- ตัวอย่างลูกบอลก่อนยืนยัน ----------
    const previewMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    previewMesh.visible = false;
    scene.add(previewMesh);

    // ---------- ของประดับรอบลาน: ทางเดินโค้งไม่เป็นวงกลม โคมไฟเรียงตามทาง กลุ่มต้นสน กล่องของขวัญกองกัน และกองหิมะ ----------
    // ตั้งค่าสุ่มคงที่ เพื่อให้ทุกเครื่องเห็นการจัดวางเดียวกัน
    const dressRnd = seededRandom("dressing-v2");
    const dressing = new THREE.Group();
    scene.add(dressing);
    // ทางเดินหิมะ: เส้นโค้งปิดที่ไม่สม่ำเสมอ สร้างเป็นริบบิ้นแบนบนพื้น
    const pathPts: THREE.Vector3[] = [];
    for (let k = 0; k < 9; k++) {
      const th = (k / 9) * Math.PI * 2;
      const rr = 9.1 + 0.8 * Math.sin(3 * th + 0.5) + 0.45 * Math.cos(5 * th) + (dressRnd() - 0.5) * 0.4;
      pathPts.push(new THREE.Vector3(Math.cos(th) * rr, 0.012, Math.sin(th) * rr));
    }
    const pathCurve = new THREE.CatmullRomCurve3(pathPts, true, "catmullrom", 0.5);
    const PATH_SEG = 260;
    const ppos: number[] = [];
    const pidx: number[] = [];
    for (let i = 0; i <= PATH_SEG; i++) {
      const u = i / PATH_SEG;
      const pt = pathCurve.getPointAt(u);
      const tg = pathCurve.getTangentAt(u);
      const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
      const w = 0.28 + 0.06 * Math.sin(u * 40);
      ppos.push(pt.x + side.x * w, 0.012, pt.z + side.z * w, pt.x - side.x * w, 0.012, pt.z - side.z * w);
      if (i < PATH_SEG) {
        const v = i * 2;
        pidx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute("position", new THREE.Float32BufferAttribute(ppos, 3));
    pathGeo.setIndex(pidx);
    pathGeo.computeVertexNormals();
    const pathMesh = new THREE.Mesh(pathGeo, new THREE.MeshStandardMaterial({ color: 0xcfdbe7, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
    pathMesh.receiveShadow = true;
    dressing.add(pathMesh);
    // โคมไฟเรียงตามทาง ระยะไม่เท่ากัน
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.7 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd38a });
    let lu = dressRnd() * 0.05;
    while (lu < 1) {
      const pt = pathCurve.getPointAt(lu);
      const out = new THREE.Vector3(pt.x, 0, pt.z).normalize();
      const x = pt.x + out.x * 0.5;
      const z = pt.z + out.z * 0.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 8), poleMat);
      pole.position.set(x, 0.85, z);
      pole.castShadow = true;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), lampMat);
      lamp.position.set(x, 1.8, z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 4), poleMat);
      cap.position.set(x, 1.98, z);
      cap.rotation.y = Math.PI / 4;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd38a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(0.9, 0.9, 1);
      halo.position.set(x, 1.8, z);
      dressing.add(pole, lamp, cap, halo);
      lu += 0.07 + dressRnd() * 0.09;
    }
    // กลุ่มต้นสนขนาดต่าง ๆ เป็นป่าเล็ก ๆ ที่ไม่สม่ำเสมอ
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x0f3d24, roughness: 0.85 });
    const pineCap = new THREE.MeshStandardMaterial({ color: 0xeef5fb, roughness: 0.7 });
    const groves = [
      { a: 0.4, r: 14.5, n: 7 },
      { a: 1.9, r: 13.2, n: 5 },
      { a: 3.3, r: 15.5, n: 6 },
      { a: 4.6, r: 13.8, n: 4 },
      { a: 5.9, r: 14.8, n: 6 },
    ];
    for (const g of groves) {
      const cx = Math.cos(g.a) * g.r;
      const cz = Math.sin(g.a) * g.r;
      for (let k = 0; k < g.n; k++) {
        const h = 1.3 + dressRnd() * 1.6;
        const sc = 0.8 + dressRnd() * 0.5;
        const tree = new THREE.Group();
        for (let t = 0; t < 3; t++) {
          const rad = (0.7 - t * 0.18) * sc;
          const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h * 0.6, 12), pineMat);
          cone.position.y = h * 0.3 + t * h * 0.22;
          cone.castShadow = true;
          const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.5, h * 0.18, 12), pineCap);
          cap.position.y = cone.position.y + h * 0.27;
          tree.add(cone, cap);
        }
        tree.position.set(cx + (dressRnd() - 0.5) * 3.2, 0, cz + (dressRnd() - 0.5) * 3.2);
        tree.rotation.y = dressRnd() * Math.PI;
        dressing.add(tree);
      }
    }
    // กล่องของขวัญกองกันเป็นกลุ่ม 2–3 กล่อง บางกองมีกล่องซ้อนด้านบน
    const giftCols = [0xdc2643, 0x3b82f6, 0xf5c542, 0x22c55e, 0xf472b6];
    for (let c = 0; c < 6; c++) {
      const a = dressRnd() * Math.PI * 2;
      const r = 10.6 + dressRnd() * 1.4;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const n = 2 + Math.floor(dressRnd() * 2);
      for (let k = 0; k < n; k++) {
        const size = 0.2 + dressRnd() * 0.2;
        const g = makeGiftBox(size, giftCols[Math.floor(dressRnd() * giftCols.length)]);
        g.position.set(cx + (dressRnd() - 0.5) * 0.7, 0, cz + (dressRnd() - 0.5) * 0.7);
        g.rotation.y = dressRnd() * Math.PI;
        g.traverse((o) => {
          o.castShadow = true;
          o.receiveShadow = true;
        });
        dressing.add(g);
        if (k === 0 && dressRnd() < 0.6) {
          const top = makeGiftBox(size * 0.7, giftCols[Math.floor(dressRnd() * giftCols.length)]);
          top.position.set(g.position.x + 0.02, size, g.position.z - 0.01);
          top.rotation.y = dressRnd();
          top.traverse((o) => {
            o.castShadow = true;
          });
          dressing.add(top);
        }
      }
    }
    // กองหิมะที่ไม่สม่ำเสมอ
    const moundMat = new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.9 });
    for (let k = 0; k < 22; k++) {
      const a = dressRnd() * Math.PI * 2;
      const r = 9.6 + dressRnd() * 6;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.4 + dressRnd() * 0.6, 16, 10), moundMat);
      m.scale.set(1 + dressRnd() * 0.8, 0.35 + dressRnd() * 0.2, 1 + dressRnd() * 0.6);
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.y = dressRnd() * Math.PI;
      m.receiveShadow = true;
      dressing.add(m);
    }

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
        const angle = rnd() * Math.PI * 2;
        const dist = 15 + rnd() * 5;
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
    const SNOW = isSmall ? 500 : 1100;
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

    function firework(colorName: string) {
      const hex = ORNAMENT_HEX[colorName] ?? 0xffd76a;
      const n = isSmall ? 90 : 160;
      // จุดระเบิดต้องอยู่ในกรอบกล้อง: เหนือยอดต้นเล็กน้อยและกระจายซ้ายขวา
      const origin = new THREE.Vector3((Math.random() - 0.5) * 6, 3.9 + Math.random() * 0.9, -2.5 + Math.random() * 3.5);
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
    function skyMessage(text: string, by: string, colorName: string, theme: string) {
      disposeSky();
      const hex = ORNAMENT_HEX[colorName] ?? 0xffd76a;
      const group = new THREE.Group();
      scene.add(group);
      const panel = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSkyPanelTexture(text, by, theme as SkyTheme), transparent: true, opacity: 0, depthWrite: false }));
      panel.position.set(0, 5.2, -1.6);
      panel.scale.set(isSmall ? 5.8 : 6.4, isSmall ? 1.45 : 1.6, 1);
      group.add(panel);
      const now = performance.now();
      const dur = theme === "sleigh" ? 9000 : 7000;
      sky = { group, panel, start: now, dur, nextSpark: now, hex, theme };
      if (theme === "sleigh") {
        const sled = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSleighTexture(), transparent: true, opacity: 0, depthWrite: false }));
        sled.scale.set(4.4, 1.4, 1);
        group.add(sled);
        sky.sled = sled;
      }
      if (theme === "sparkle") {
        const ring = makeSparkleRing(hex);
        group.add(ring);
        sky.sparkle = ring;
      }
      if (theme === "snow") storm = 1;
      const n = isSmall ? 50 : 90;
      if (theme === "fireworks") {
        burst(new THREE.Vector3(-2.6, 5.4, -1.6), hex, n, 0.6);
        burst(new THREE.Vector3(2.6, 5.4, -1.6), 0xffffff, n, 0.6);
        // ระเบิดลูกที่สองและสามตามมาเป็นชุด ให้ท้องฟ้าดูอลังการ
        window.setTimeout(() => {
          if (sky?.group === group) burst(new THREE.Vector3(0.2, 6.2, -2.2), 0xffe7a3, Math.round(n * 0.8), 0.7);
        }, 900);
        window.setTimeout(() => {
          if (sky?.group === group) {
            burst(new THREE.Vector3(-4.2, 4.6, -1.8), 0xfff6d6, Math.round(n * 0.7), 0.55);
            burst(new THREE.Vector3(4.2, 4.6, -1.8), hex, Math.round(n * 0.7), 0.55);
          }
        }, 1700);
      } else {
        burst(new THREE.Vector3(-2.6, 5.4, -1.6), hex, Math.round(n / 2), 0.4);
        burst(new THREE.Vector3(2.6, 5.4, -1.6), 0xffffff, Math.round(n / 2), 0.4);
      }
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
      const ornHit = raycaster.intersectObjects(ornGroup.children, true)[0];
      if (ornHit) {
        let obj: THREE.Object3D | null = ornHit.object;
        while (obj && !obj.userData.ornamentId) obj = obj.parent;
        const o = obj ? ornaments3D.get(obj.userData.ornamentId as string) : undefined;
        if (o) {
          callbacks.current.onOrnamentClick(o);
          return;
        }
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
      if (instBodies) {
        const ih = raycaster.intersectObject(instBodies, false)[0];
        if (ih && ih.instanceId !== undefined && instDecor[ih.instanceId]) {
          callbacks.current.onDecorClick(instDecor[ih.instanceId]);
          return;
        }
      }
      const hit = raycaster.intersectObject(hitCone, false)[0];
      if (hit) {
        const local = treeGroup.worldToLocal(hit.point.clone());
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
      const hit = raycaster.intersectObjects(ornGroup.children, true)[0];
      renderer.domElement.style.cursor = hit ? "pointer" : "";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    // ---------- วนลูปภาพ ----------
    let reduced = reducedMotion;
    let raf = 0;
    const startedAt = performance.now();
    function frame() {
      const t = (performance.now() - startedAt) / 1000;
      if (focusDecorGroup) {
        // โยกตัวเบา ๆ และกระโดดนิดหนึ่ง เหมือนกำลังทักทาย
        focusDecorGroup.rotation.z = Math.sin(t * 2.4) * 0.09;
        focusDecorGroup.position.y = Math.abs(Math.sin(t * 2.6)) * 0.1;
      }
      const now = performance.now();

      if (camAnim) {
        const k = Math.min((now - camAnim.start) / 900, 1);
        const e = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
        controls.target.lerpVectors(camAnim.fromTgt, camAnim.toTgt, e);
        if (k >= 1) camAnim = null;
      }
      controls.autoRotate = false;
      controls.update();

      lightMeshes.forEach((b, i) => {
        const on = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.7);
        (b.material as THREE.MeshBasicMaterial).opacity = on;
        (b.material as THREE.MeshBasicMaterial).transparent = true;
        b.scale.setScalar(0.85 + on * 0.25);
      });
      starMesh.rotation.y = reduced ? 0 : t * 0.6;
      starGlow.material.opacity = 0.65 + 0.2 * Math.sin(t * 2);
      starLight.intensity = 2.0 + 0.5 * Math.sin(t * 2);

      ornMeshes.forEach((entry) => {
        if (entry.born && !entry.landed) {
          // ลูกบอลค่อย ๆ ลงมาตามเชือก เชือกยืดออกจากกิ่ง และโบว์ผูกติดกิ่งก่อน
          const k = Math.min((now - entry.born) / 1100, 1);
          const e = easeOutBounce(k);
          entry.body.position.y = -ORN_STRING * e;
          entry.string.scale.y = Math.max(0.001, -(entry.body.position.y + entry.hookY));
          entry.bow.scale.setScalar(Math.min(k * 3, 1));
          entry.mesh.rotation.z = Math.sin(k * 14) * 0.5 * (1 - k);
          if (k >= 1) {
            entry.landed = true;
            entry.body.position.y = -ORN_STRING;
            entry.string.scale.y = ORN_STRING - entry.hookY;
            entry.bow.scale.setScalar(1);
            // แรงกระแทกตอนลงถึงจุดแขวน ทำให้ลูกบอลแกว่งออกไปและค่อย ๆ หยุด
            entry.swing.vx = 0.9 * (Math.random() > 0.5 ? 1 : -1);
            entry.swing.vz = (Math.random() - 0.5) * 0.9;
            entry.mesh.position.copy(entry.target);
            const col = entry.color;
            burst(entry.target.clone().add(new THREE.Vector3(0, 0.1, 0)), col, isSmall ? 14 : 24, 0.25);
          }
        } else if (!reduced) {
          // สปริง-แดมเปอร์: ดึงกลับสู่แนวดิ่ง มีแรงลมเบา ๆ และแรงหน่วงทำให้การแกว่งค่อย ๆ หยุด
          const sw = entry.swing;
          const K = 16; // ความแข็งของเชือก
          const C = 1.6; // แรงหน่วง
          const wind = Math.sin(t * 0.9 + entry.target.x * 1.7) * 0.6 + Math.sin(t * 2.3 + entry.target.z) * 0.25;
          const dt = 1 / 60;
          sw.vx += (-K * sw.x - C * sw.vx + wind * 2.0) * dt;
          sw.vz += (-K * sw.z - C * sw.vz + wind * 0.8) * dt;
          sw.x = Math.max(-0.7, Math.min(0.7, sw.x + sw.vx * dt));
          sw.z = Math.max(-0.7, Math.min(0.7, sw.z + sw.vz * dt));
          entry.mesh.rotation.x = sw.x;
          entry.mesh.rotation.z = sw.z;
          entry.mesh.rotation.y = Math.sin(t * 0.8 + entry.target.x) * 0.05;
        }
      });

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
        sky.panel.position.y = 5.2 + Math.sin(t * 1.2) * 0.06;
        if (sky.sled) {
          (sky.sled.material as THREE.SpriteMaterial).opacity = alpha;
          const k = Math.min(age / dur, 1);
          sky.sled.position.set(-16 + 32 * k, 4.3 + Math.sin(age * 3.2) * 0.14, -2.4);
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

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    // ---------- ตุ๊กตาหิมะยักษ์ของห้อง พร้อมป้ายห้อย ----------
    let giantGroup: THREE.Group | null = null;
    // ตุ๊กตายักษ์: ลุคที่ผู้ซื้อเลือก และถือป้ายข้อความด้วยมือขวา
    function buildGiant(g: GiantSpec) {
      const look = g.look ?? DEFAULT_GIANT_LOOK;
      const grp = new THREE.Group();
      const figure = buildDecorSnowman({ ...look, id: "giant" } as unknown as Decor);
      figure.scale.setScalar(2.1);
      grp.add(figure);

      // ป้ายข้อความ วาดจากงานศิลป์ร่วม
      const boardCv = document.createElement("canvas");
      boardCv.width = 1024;
      boardCv.height = 640;
      const bg = boardCv.getContext("2d");
      const boardTex = new THREE.CanvasTexture(boardCv);
      if (bg) drawGiantBoard(bg, 14, 14, 996, 612, { name: g.name, message: g.message, style: (look.board as BoardStyle) ?? "spruce" });
      boardTex.colorSpace = THREE.SRGBColorSpace;
      boardTex.needsUpdate = true;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.83), new THREE.MeshBasicMaterial({ map: boardTex, transparent: true }));
      // ป้ายอยู่ฝั่งที่หันเข้าหาใจกลางฉาก เพื่อให้มองเห็นได้จากมุมกล้องหลัก
      const side = (GIANT_SPOT_DEFS[g.spot] ? Math.cos(GIANT_SPOT_DEFS[g.spot].angle) : 1) > 0 ? -1 : 1;
      board.position.set(side * 1.2, 1.3, 0.3);
      board.rotation.y = side * -0.3;
      // มือที่กุมขอบป้าย
      const glove = new THREE.MeshStandardMaterial({ color: 0x9b1c31, roughness: 0.5 });
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), glove);
      hand.position.set(side * 0.56, 1.2, 0.32);
      const hand2 = hand.clone();
      hand2.position.set(side * 1.84, 1.12, 0.4);
      grp.add(board, hand, hand2);

      const def = GIANT_SPOT_DEFS[g.spot] ?? GIANT_SPOT_DEFS[0];
      const gx = Math.cos(def.angle) * GIANT_SPOT_RADIUS;
      const gz = Math.sin(def.angle) * GIANT_SPOT_RADIUS;
      grp.position.set(gx, 0, gz);
      // หันหน้าเข้าหาผู้ชม เพื่อให้เห็นป้ายที่ถืออยู่ (ตำแหน่งอื่นหมุนเล็กน้อยไปทางต้น)
      grp.rotation.y = -0.2 + (gx > 0 ? -0.15 : 0.15);
      return grp;
    }
    const api_setGiant = (g: GiantSpec | null) => {
      if (giantGroup) {
        scene.remove(giantGroup);
        giantGroup.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose?.();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose?.();
        });
        giantGroup = null;
      }
      if (g) {
        giantGroup = buildGiant(g);
        scene.add(giantGroup);
      }
    };

    // ---------- ตุ๊กตาหิมะที่ผู้ใช้ตกแต่ง วางรอบต้น ----------
    const decorGroup = new THREE.Group();
    scene.add(decorGroup);
    const decorById = new Map<string, Decor>();
    const SLOT_R = 2.7;
    const slotAngle = (i: number) => (i / SLOT_COUNT) * Math.PI * 2 + 0.4;
    const BODY_HEX: Record<string, number> = { white: 0xffffff, mint: 0xd1fae5, sky: 0xdbeafe, blush: 0xfce7f3, pearl: 0xfff6e6, ice: 0xd6f3ff };
    const SCARF_HEX: Record<string, number> = { red: 0xdc2643, green: 0x16a34a, gold: 0xf5c542, blue: 0x3b82f6, white: 0xf8fafc, plaid: 0xb91c3c };
    const HAT_HEX = 0x1f2937;
    // ตั้งตุ๊กตายักษ์หลังค่าสีทั้งหมดพร้อมแล้ว (กันการเข้าถึงก่อนประกาศ)
    api_setGiant(giant);

    function buildDecorSnowman(d: Decor) {
      const grp = new THREE.Group();
      const bodyMat = new THREE.MeshPhysicalMaterial({ color: BODY_HEX[d.body] ?? 0xffffff, roughness: 0.5, clearcoat: 0.3 });
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
      const eye = new THREE.MeshStandardMaterial({ color: 0x111111 });
      [-0.07, 0.07].forEach((x) => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), eye);
        e.position.set(x, 1.46, 0.18);
        add(e);
      });
      // จมูก
      const noseMat = d.nose === "bell" ? new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.7, roughness: 0.25 }) : d.nose === "star" ? new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.6, roughness: 0.3 }) : d.nose === "button" ? new THREE.MeshStandardMaterial({ color: 0xdc2643 }) : new THREE.MeshStandardMaterial({ color: 0xff8a1f });
      const nose = new THREE.Mesh(d.nose === "button" || d.nose === "bell" ? new THREE.SphereGeometry(0.04, 12, 12) : new THREE.ConeGeometry(0.035, 0.2, 12), noseMat);
      if (d.nose === "carrot") nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 1.4, 0.22);
      add(nose);
      // ผ้าพันคอ
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 14, 32), new THREE.MeshStandardMaterial({ color: SCARF_HEX[d.scarf] ?? 0xdc2643, roughness: 0.6 }));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = 1.22;
      add(scarf);
      // หมวก
      const hatMat = new THREE.MeshStandardMaterial({ color: d.hat === "santa" ? 0xdc2643 : d.hat === "crown" ? 0xf5c542 : HAT_HEX, roughness: 0.45 });
      if (d.hat === "top" || d.hat === "santa") {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.3, 24), hatMat);
        crown.position.y = 1.68;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 28), hatMat);
        brim.position.y = 1.52;
        add(crown, brim);
      } else if (d.hat === "beanie") {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: SCARF_HEX[d.scarf] ?? 0x3b82f6 }));
        cap.position.y = 1.5;
        add(cap);
      } else if (d.hat === "crown") {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 6), hatMat);
        crown.position.y = 1.55;
        add(crown);
      }
      // เครื่องประดับ
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
    const HAT_COLOR: Record<string, number> = { top: 0x1f2937, beanie: 0x3b82f6, santa: 0xdc2643, crown: 0xf5c542, pom: 0xf8fafc, holly: 0x16a34a };

    // มุมมองบุคคลที่หนึ่ง: เลื่อนกล้องไปใกล้ลูกบอลที่เลือก และกลับมาที่เดิมเมื่อปิด
    type CamAnim = { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3; start: number };
    let camAnim: CamAnim | null = null;
    let savedView: { pos: THREE.Vector3; tgt: THREE.Vector3; min: number } | null = null;
    function animateCam(toPos: THREE.Vector3, toTgt: THREE.Vector3) {
      camAnim = { fromPos: camera.position.clone(), toPos, fromTgt: controls.target.clone(), toTgt, start: performance.now() };
    }
    const HOME_POS = new THREE.Vector3(0, 2.6, 9.2);
    const HOME_TGT = new THREE.Vector3(0, 1.85, 0);
    // ซูมเข้า/ออกทีละขั้นแบบนุ่ม (ปุ่มบนจอ) ระยะถูกจำกัดตามค่าที่ตั้งไว้
    function zoomBy(factor: number) {
      const dir = camera.position.clone().sub(controls.target);
      const len = Math.min(Math.max(dir.length() * factor, controls.minDistance), controls.maxDistance);
      const toPos = controls.target.clone().add(dir.normalize().multiplyScalar(len));
      animateCam(toPos, controls.target.clone());
      savedView = null;
    }
    // ดูตัวอย่างป้ายประจำห้องที่ตำแหน่งที่เลือก (แสดงเฉพาะในเครื่องนี้ 9 วินาที ไม่บันทึก)
    let previewGroup: THREE.Group | null = null;
    let previewTimer = 0;
    function previewGiant(spot: number, name: string, message: string) {
      if (previewGroup) {
        scene.remove(previewGroup);
        previewGroup = null;
      }
      if (giantGroup) giantGroup.visible = false;
      previewGroup = buildGiant({ name, message, spot });
      scene.add(previewGroup);
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => {
        if (previewGroup) {
          scene.remove(previewGroup);
          previewGroup.traverse((o) => {
            const m = o as THREE.Mesh;
            m.geometry?.dispose?.();
            (m.material as THREE.Material | undefined)?.dispose?.();
          });
          previewGroup = null;
        }
        if (giantGroup) giantGroup.visible = true;
      }, 9000);
    }
    function resetView() {
      animateCam(HOME_POS.clone(), HOME_TGT.clone());
      controls.minDistance = 4.5;
      savedView = null;
    }
    // ตุ๊กตาหิมะที่คลิก: กล้องเลื่อนไปหา และตุ๊กตาโยกทักทายเบา ๆ ตอนเปิดดู
    let focusDecorGroup: THREE.Group | null = null;
    function focusDecor(d: Decor | null) {
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
      const grp = buildDecorSnowman(d);
      const aa = Math.atan2(pp.z, pp.x);
      grp.position.set(pp.x, 0, pp.z);
      grp.rotation.y = -aa + Math.PI / 2;
      grp.scale.setScalar(DECOR_SCALE * 1.3);
      scene.add(grp);
      focusDecorGroup = grp;
      if (!savedView) savedView = { pos: camera.position.clone(), tgt: controls.target.clone(), min: controls.minDistance };
      const out = new THREE.Vector3(pp.x, 0, pp.z).normalize();
      const toTgt = new THREE.Vector3(pp.x, 0.95, pp.z);
      const toPos = new THREE.Vector3(pp.x + out.x * 2.6, 1.5, pp.z + out.z * 2.6);
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
      const entry = ornMeshes.get(id);
      const o = ornaments3D.get(id);
      if (!entry || !o) return;
      if (!savedView) savedView = { pos: camera.position.clone(), tgt: controls.target.clone(), min: controls.minDistance };
      const p = new THREE.Vector3();
      entry.mesh.getWorldPosition(p);
      // กล้องอยู่นอกผิวต้นตรงจุดที่แขวน มองลงมาที่ลูกบอลระดับสายตา
      const n = surfaceNormal(o.angle);
      const toPos = new THREE.Vector3(p.x + n.x * 1.7, p.y + 0.25, p.z + n.z * 1.7);
      const toTgt = new THREE.Vector3(p.x, p.y - 0.12, p.z);
      controls.minDistance = 0.5;
      animateCam(toPos, toTgt);
    }

    // ---------- วงแสงทองบนพื้นและประกายที่ช่องของตุ๊กตาใหม่ อยู่ 5 วินาทีแล้วค่อย ๆ จางหาย
    let highlight: { ring: THREE.Mesh; start: number } | null = null;
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
      addOrnament: (o) => addOrnamentMesh(o, true),
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
      setGiant: api_setGiant,
      setOrnaments: (list) => {
        const ids = new Set(list.map((o) => o.id));
        for (const [id, entry] of ornMeshes) {
          if (!ids.has(id)) {
            ornGroup.remove(entry.mesh);
            ornMeshes.delete(id);
            ornaments3D.delete(id);
          }
        }
        // โหลดครั้งแรกไม่ต้องเล่นแอนิเมชัน ที่เหลือให้ลูกบอลใหม่ค่อย ๆ ปรากฏ
        const animateNew = loadedOnce;
        loadedOnce = true;
        list.forEach((o) => addOrnamentMesh(o, animateNew));
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
      skyMessage: (text: string, by: string, color: string, theme: string) => skyMessage(text, by, color, theme),
      highlightDecor: (slot: number) => highlightDecor(slot),
      focusOrnament: (id: string | null) => focusOrnament(id),
      focusDecor: (d: Decor | null) => focusDecor(d),
      zoomBy: (factor: number) => zoomBy(factor),
      resetView: () => resetView(),
      previewGiant: (spot: number, name: string, message: string) => previewGiant(spot, name, message),
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
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
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

  // ซิงก์ตุ๊กตาหิมะยักษ์เมื่อมีการสนับสนุนใหม่
  const giantKey = giant ? `${giant.name}|${giant.message}|${giant.spot}` : "";
  useEffect(() => {
    api.current?.setGiant(giant);
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

  return <div ref={mountRef} className="xmas-canvas" aria-label="ฉากต้นคริสต์มาสสามมิติ" role="img" />;
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

// กิ่งสนหลายชั้นรอบต้น: แต่ละกิ่งเป็นแผ่นหยักที่ห้อยลงตามความยาว ไล่สีจากโคนเข้มไปปลายอ่อน และมีหิมะเกาะปลายบางกิ่ง
function buildFronds(small: boolean, rScale = 1, inner = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const cBase = new THREE.Color(0x0c3320);
  const cMid = new THREE.Color(0x166534);
  const cTip = new THREE.Color(0x2fa35a);
  const cSnow = new THREE.Color(0xf1f7fc);
  const tmp = new THREE.Color();
  const TIERS = small ? 18 : 30;
  const PER = small ? 12 : 20;
  const SEG = small ? 5 : 6;
  let vi = 0;

  for (let t = 0; t < TIERS; t++) {
    const hN = 0.05 + (t / (TIERS - 1)) * 0.9;
    const y0 = hN * TREE_H + 0.1;
    const R = radiusAt(hN) * 1.02 * rScale;
    for (let k = 0; k < PER; k++) {
      const ang = ((k + (t % 2) * 0.5) / PER) * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
      const len = R * (0.95 + Math.random() * 0.3) + 0.08;
      const droop = 0.08 + Math.random() * 0.1;
      const width = 0.11 + Math.random() * 0.05 + hN * 0.03;
      const snowy = Math.random() < 0.42;
      const cx = Math.cos(ang);
      const cz = Math.sin(ang);
      const lx = -cz; // เวกเตอร์ด้านข้างของกิ่ง
      const lz = cx;
      const start = vi;
      for (let i = 0; i <= SEG; i++) {
        const s = i / SEG;
        const u = len * s;
        const w = -droop * len * s * s; // ห้อยลงปลาย
        const taper = Math.sin(Math.PI * Math.min(s * 0.9 + 0.1, 1)) * (1 - s * 0.45);
        const jag = i % 2 === 0 ? 1 : 0.62; // ขอบหยักแบบเข็มสน
        const hw = width * taper * jag + 0.004;
        for (const side of [1, -1]) {
          const v = hw * side;
          const jx = (Math.random() - 0.5) * 0.01;
          pos.push(cx * u + lx * v + jx, y0 + w + 0.02 * s, cz * u + lz * v);
          // สีไล่จากโคนเข้มไปปลายอ่อน
          tmp.copy(cBase).lerp(cMid, Math.min(s * 1.4, 1)).lerp(cTip, Math.max(0, (s - 0.6) * 2.5));
          if (inner) tmp.multiplyScalar(0.55); // ชั้นในมืดกว่า ให้ดูมีมิติ
          else if (snowy && s > 0.55 && side === 1) tmp.lerp(cSnow, Math.min((s - 0.55) * 1.6, 0.92));
          col.push(tmp.r, tmp.g, tmp.b);
          vi++;
        }
      }
      for (let i = 0; i < SEG; i++) {
        const a = start + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
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

// ความยาวเชือกจากจุดแขวนถึงลูกบอล และเชือกกับโบว์ผูกกิ่งที่ใช้ร่วมกันทุกชิ้น
const ORN_STRING = 0.34;
const STRING_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6);
  g.translate(0, -0.5, 0); // ปลายบนอยู่ที่จุดแขวน ยืดลงด้านล่างตามการ scale
  return g;
})();
const STRING_MAT = new THREE.MeshStandardMaterial({ color: 0xe9e2cc, roughness: 0.7, metalness: 0 });

// โบว์ริบบิ้นสั้น ๆ ที่ผูกเชือกไว้กับกิ่ง
function makeRibbonBow() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xdc2643, roughness: 0.45 });
  const loop = new THREE.SphereGeometry(0.024, 10, 8);
  const l = new THREE.Mesh(loop, mat);
  l.scale.set(1.35, 0.8, 0.5);
  l.position.set(-0.02, 0.012, 0);
  const r = new THREE.Mesh(loop, mat);
  r.scale.set(1.35, 0.8, 0.5);
  r.position.set(0.02, 0.012, 0);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), mat);
  knot.position.y = 0.012;
  g.add(l, r, knot);
  return g;
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
