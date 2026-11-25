"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Ornament } from "@/lib/christmas/types";
import { ORNAMENT_HEX, ornamentPosition, pointToHeightAngle, radiusAt, TREE_H, TREE_R0 } from "./geometry";

export type Preview = { height: number; angle: number; color: string; shape: string } | null;

export type TreeSceneHandle = {
  launchFirework: (color: string) => void;
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
  giant: { name: string; message: string } | null; // ตุ๊กตาหิมะยักษ์พร้อมป้าย
};

// ฉากต้นคริสต์มาสด้วย Three.js: ใบไม้แบบจุดระยิบ ไฟประดับ ลูกบอลโลหะ หิมะ และพลุ
export default function TreeScene({ ornaments, preview, reducedMotion, onPick, onOrnamentClick, onError, onReady, ground: groundColor, giant }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  // ตัวช่วยที่ฉากใช้ร่วมกับ React โดยไม่ต้อง re-render
  const api = useRef<{
    addOrnament: (o: Ornament) => void;
    setOrnaments: (list: Ornament[]) => void;
    setPreview: (p: Preview) => void;
    firework: (color: string) => void;
    setReduced: (v: boolean) => void;
    setGiant: (g: { name: string; message: string } | null) => void;
  } | null>(null);
  const callbacks = useRef({ onPick, onOrnamentClick });
  callbacks.current = { onPick, onOrnamentClick };
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
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

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
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.35;

    // ---------- แสง ----------
    scene.add(new THREE.AmbientLight(0x9fb8d6, 0.35));
    const key = new THREE.DirectionalLight(0xffe2b0, 1.4);
    key.position.set(4, 9, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.8);
    rim.position.set(-7, 4, -5);
    scene.add(rim);
    const starLight = new THREE.PointLight(0xffc857, 2.4, 6, 2);
    starLight.position.set(0, TREE_H + 0.4, 0.4);
    scene.add(starLight);

    // ---------- พื้นหิมะ ----------
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(7, 96),
      new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.95, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    // ---------- ลำต้น ----------
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 }),
    );
    trunk.position.y = 0.45;
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
      box.position.set(x, y, z);
      box.rotation.y = i * 0.7;
      scene.add(box);
    });

    // ---------- ใบไม้: จุดสีเขียวหลายโทนกระจายบนผิวกรวย ----------
    const treeGroup = new THREE.Group();
    scene.add(treeGroup);
    const FOLIAGE = isSmall ? 6000 : 11000;
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
      new THREE.PointsMaterial({ size: isSmall ? 0.075 : 0.06, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 }),
    );
    treeGroup.add(foliage);

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
    const ornMeshes = new Map<string, { mesh: THREE.Object3D; born: number }>();
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
      if (o.shape === "gift") {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.205, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.4 }));
        mesh.add(ribbon);
      }
      const p = ornamentPosition(o.height, o.angle);
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData.ornamentId = o.id;
      return mesh;
    }

    function addOrnamentMesh(o: Ornament, animate: boolean) {
      if (ornMeshes.has(o.id)) return;
      const mesh = makeOrnamentMesh(o);
      if (animate) mesh.scale.setScalar(0.01);
      ornGroup.add(mesh);
      ornMeshes.set(o.id, { mesh, born: animate ? performance.now() : 0 });
      ornaments3D.set(o.id, o);
    }

    // ---------- ตัวอย่างลูกบอลก่อนยืนยัน ----------
    const previewMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    previewMesh.visible = false;
    scene.add(previewMesh);

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
    function firework(colorName: string) {
      const hex = ORNAMENT_HEX[colorName] ?? 0xffd76a;
      const n = isSmall ? 90 : 160;
      // จุดระเบิดต้องอยู่ในกรอบกล้อง: เหนือยอดต้นเล็กน้อยและกระจายซ้ายขวา
      const origin = new THREE.Vector3((Math.random() - 0.5) * 6, 3.9 + Math.random() * 0.9, -2.5 + Math.random() * 3.5);
      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const sp = 1.1 + Math.random() * 1.3;
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
      if (bursts.length > 10) {
        const old = bursts.shift();
        if (old) {
          scene.remove(old.points);
          old.points.geometry.dispose();
        }
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
      const hit = raycaster.intersectObject(hitCone, false)[0];
      if (hit) {
        const local = treeGroup.worldToLocal(hit.point.clone());
        const pick = pointToHeightAngle(local.x, local.y, local.z);
        callbacks.current.onPick(pick.height, pick.angle);
      }
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
    const clock = new THREE.Clock();
    function frame() {
      const t = clock.getElapsedTime();
      const now = performance.now();

      controls.autoRotate = !reduced;
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
        const age = entry.born ? (now - entry.born) / 500 : 1;
        if (age < 1) {
          const e = 1 - Math.pow(1 - Math.max(age, 0), 3);
          entry.mesh.scale.setScalar(Math.max(e, 0.01));
        } else if (entry.mesh.scale.x !== 1) {
          entry.mesh.scale.setScalar(1);
        }
        if (!reduced) entry.mesh.rotation.y = Math.sin(t * 0.8 + entry.mesh.position.x) * 0.08;
      });

      if (previewMesh.visible) {
        (previewMesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.2 * Math.sin(t * 4);
      }

      const pos = snowGeo.getAttribute("position") as THREE.BufferAttribute;
      if (!reduced) {
        for (let i = 0; i < SNOW; i++) {
          let y = pos.getY(i) - snowSpeed[i] * 0.012;
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
    frame();

    // ---------- ตุ๊กตาหิมะยักษ์ของห้อง พร้อมป้ายห้อย ----------
    let giantGroup: THREE.Group | null = null;
    function buildGiant(g: { name: string; message: string }) {
      const grp = new THREE.Group();
      const snow = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, clearcoat: 0.3 });
      const addBall = (r: number, y: number) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 32), snow);
        m.position.y = y;
        grp.add(m);
      };
      addBall(0.62, 0.62);
      addBall(0.46, 1.5);
      addBall(0.33, 2.2);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.42, 32), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 }));
      hat.position.y = 2.55;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 32), hat.material);
      brim.position.y = 2.33;
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 16, 40), new THREE.MeshStandardMaterial({ color: 0xdc2643, roughness: 0.6 }));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = 1.86;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 16), new THREE.MeshStandardMaterial({ color: 0xff8a1f }));
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 2.2, 0.34);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      [-0.11, 0.11].forEach((x) => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), eyeMat);
        e.position.set(x, 2.3, 0.3);
        grp.add(e);
      });
      grp.add(hat, brim, scarf, nose);
      // ป้ายห้อยจากไม้ที่ข้างตุ๊กตา
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 512;
      signCanvas.height = 300;
      const c2 = signCanvas.getContext("2d")!;
      c2.fillStyle = "#0f2a22";
      c2.fillRect(0, 0, 512, 300);
      c2.strokeStyle = "#f5c542";
      c2.lineWidth = 10;
      c2.strokeRect(12, 12, 488, 276);
      c2.fillStyle = "#ffe08a";
      c2.font = "bold 46px sans-serif";
      c2.textAlign = "center";
      c2.fillText(g.name.slice(0, 20), 256, 110);
      c2.fillStyle = "#f8fafc";
      c2.font = "34px sans-serif";
      c2.fillText(g.message.slice(0, 40), 256, 175);
      c2.fillText(g.message.slice(40, 80), 256, 220);
      const signTex = new THREE.CanvasTexture(signCanvas);
      signTex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
      sign.position.set(0.95, 1.45, 0.25);
      sign.rotation.y = -0.25;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x6b4423 }));
      post.position.set(0.95, 0.75, 0.25);
      grp.add(sign, post);
      grp.position.set(-3.4, 0, 0.9);
      grp.scale.setScalar(1.05);
      return grp;
    }
    const api_setGiant = (g: { name: string; message: string } | null) => {
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
    api_setGiant(giant);

    api.current = {
      addOrnament: (o) => addOrnamentMesh(o, true),
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
      setReduced: (v) => {
        reduced = v;
        controls.autoRotate = !v;
      },
    };
    readyRef.current({ launchFirework: (color: string) => api.current?.firework(color) });

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

  // ซิงก์ตุ๊กตาหิมะยักษ์เมื่อมีการสนับสนุนใหม่
  const giantKey = giant ? `${giant.name}|${giant.message}` : "";
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
