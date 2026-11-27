"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// กล่องของขวัญ 3 มิติ (Three.js) ลำดับการแกะเมื่อแตะ:
// 1) ดึงโบว์ออกและสั่นเล็กน้อย 2) ฝาเด้งแล้วเปิด 3) แสงและลูกบอลกระจายออกมา
// 4) ต้นคริสต์มาสเล็กงอกขึ้นจากกล่อง มีดาวบนยอด 5) กล้องพุ่งเข้าหาต้น แล้วเรียก onFinish
// หน้าหลักจะเปิดด้วยวงกลมที่ขยายจากดาว (ดู .xmas-gift.is-leaving ใน christmas.css)

type Props = {
  opening: boolean;
  onOpen: () => void;
  onFinish: () => void;
};

const RED = 0xa3202f;
const GOLD = 0xf7d774;
const TOTAL = 3.2; // วินาทีนับจากแตะจนจบ แล้วเรียก onFinish หนึ่งครั้ง
const W = 2;
const H = 1.6;
const D = 2;
const LID_H = 0.34;
const ORNAMENTS = 22;
const SNOW = 120;
const ORNAMENT_COLORS = [GOLD, 0xd7263d, 0xffffff, 0x3b82f6, 0xf59e0b];

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ลายกระดาษห่อของขวัญ: พื้นแดงมีจุดทองจาง ๆ เรียงสลับแถว
function paperTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#a3202f";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(247,215,116,0.3)";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 32 + (row % 2 ? 32 : 16);
        const y = row * 32 + 16;
        g.beginPath();
        g.arc(x % 256, y, 4.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  tex.anisotropy = 4;
  return tex;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,250,230,1)");
    grd.addColorStop(0.35, "rgba(241,220,162,0.55)");
    grd.addColorStop(1, "rgba(241,220,162,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// รูปดาวห้าแฉกสำหรับยอดต้น
function starShape(outer: number, inner: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export default function GiftBox3D({ opening, onOpen, onFinish }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef(opening);
  openingRef.current = opening;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // ไม่มี WebGL: ไม่แสดงกล่อง 3 มิติ แต่ยังเปิดต่อได้ด้วยฉากจางเท่านั้น
      let fallbackTimer = 0;
      const check = window.setInterval(() => {
        if (openingRef.current) {
          window.clearInterval(check);
          fallbackTimer = window.setTimeout(() => finishRef.current(), 900);
        }
      }, 100);
      return () => {
        window.clearInterval(check);
        window.clearTimeout(fallbackTimer);
      };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 1;

    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
    // ระยะกล้องปรับตามสัดส่วนจอ: จอแนวตั้งถอยออกไป กล่องจึงไม่ล้นจอ
    const framing = () => {
      const aspect = window.innerWidth / window.innerHeight;
      const k = 1.7 / Math.min(1, aspect * 1.2);
      return new THREE.Vector3(0, 1.9 * k, 7.4 * k);
    };
    // ตำแหน่งกล้องตอนพุ่งเข้าหาต้น: จอแคบต้องถอยไกลกว่า ไม่งั้นต้นจะล้นจอ
    const endPos = () => {
      const aspect = window.innerWidth / window.innerHeight;
      return new THREE.Vector3(0, 3.0, 6.2 * Math.max(1, 0.75 / aspect));
    };
    let camStart = framing();
    camera.position.copy(camStart);
    camera.lookAt(0, 1.0, 0);
    scene.add(camera);

    // แสง: ไฟหลักอุ่น ขอบแสงเย็น แสงเติมเบา ๆ
    const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
    key.position.set(3.5, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.1);
    rim.position.set(-5, 4, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x3a5a4a, 0.4));

    // พื้นรับเงา
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.32 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const root = new THREE.Group();
    scene.add(root);

    const textures: THREE.Texture[] = [];
    const paperTex = paperTexture();
    const glowTex = glowTexture();
    textures.push(paperTex, glowTex);

    const paperMat = new THREE.MeshPhysicalMaterial({ map: paperTex, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: GOLD,
      metalness: 1,
      roughness: 0.22,
      clearcoat: 0.5,
      clearcoatRoughness: 0.15,
      emissive: 0x3a2706,
      emissiveIntensity: 0.2,
    });
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1f7a4d, roughness: 0.75 });
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
    const ornMats = ORNAMENT_COLORS.map(
      (c) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.35, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
    );
    const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, map: glowTex, transparent: true, opacity: 0.75, depthWrite: false });

    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [paperMat, goldMat, treeMat, barkMat, snowMat, ...ornMats];
    const track = <T extends THREE.BufferGeometry>(g: T) => {
      geos.push(g);
      return g;
    };

    // ตัวกล่องมุมโค้งมน
    const body = new THREE.Mesh(track(new RoundedBoxGeometry(W, H, D, 4, 0.1)), paperMat);
    body.position.y = H / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    // ริบบิ้นทองรอบตัวกล่อง
    const ribbon = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), goldMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };
    const bandY = H / 2;
    const e = 0.03;
    root.add(
      ribbon(W + 0.04, 0.2, 0.06, 0, bandY, D / 2 + e),
      ribbon(W + 0.04, 0.2, 0.06, 0, bandY, -D / 2 - e),
      ribbon(0.06, 0.2, D + 0.04, W / 2 + e, bandY, 0),
      ribbon(0.06, 0.2, D + 0.04, -W / 2 - e, bandY, 0),
      ribbon(0.22, H, 0.06, 0, H / 2, D / 2 + e),
      ribbon(0.22, H, 0.06, 0, H / 2, -D / 2 - e),
      ribbon(0.06, H, 0.22, W / 2 + e, H / 2, 0),
      ribbon(0.06, H, 0.22, -W / 2 - e, H / 2, 0),
    );

    // ฝาบานพับที่ขอบหลัง
    const hinge = new THREE.Group();
    hinge.position.set(0, H, -D / 2);
    root.add(hinge);
    const lid = new THREE.Group();
    lid.position.set(0, LID_H / 2, D / 2);
    hinge.add(lid);
    const lidMesh = new THREE.Mesh(track(new RoundedBoxGeometry(W + 0.14, LID_H, D + 0.14, 3, 0.06)), paperMat);
    lidMesh.castShadow = true;
    lidMesh.receiveShadow = true;
    lid.add(lidMesh);
    const lidTop = LID_H / 2 + e;
    lid.add(ribbon(W + 0.16, 0.06, 0.2, 0, lidTop, 0));
    lid.add(ribbon(0.24, 0.06, D + 0.16, 0, lidTop, 0));
    lid.add(ribbon(0.24, LID_H + 0.02, 0.06, 0, 0, D / 2 + 0.08));

    // โบว์: ห่วงสองข้าง ปมตรงกลาง และหางริบบิ้นสองเส้น
    const bow = new THREE.Group();
    bow.position.set(0, LID_H / 2 + 0.06, 0);
    lid.add(bow);
    const loopGeo = track(new THREE.TorusGeometry(0.3, 0.05, 16, 48));
    const loopL = new THREE.Mesh(loopGeo, goldMat);
    loopL.position.set(-0.32, 0.22, 0);
    loopL.rotation.set(0, 0, 0.4);
    loopL.scale.set(1.2, 0.8, 0.6);
    const loopR = loopL.clone();
    loopR.position.x = 0.32;
    loopR.rotation.z = -0.4;
    const knot = new THREE.Mesh(track(new THREE.SphereGeometry(0.17, 24, 18)), goldMat);
    knot.position.set(0, 0.16, 0.02);
    const tailL = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.03, 0.6)), goldMat);
    tailL.position.set(-0.14, 0.06, 0.34);
    tailL.rotation.set(0.35, 0.4, 0);
    const tailR = tailL.clone();
    tailR.position.x = 0.14;
    tailR.rotation.y = -0.4;
    bow.add(loopL, loopR, knot, tailL, tailR);
    bow.traverse((o) => {
      o.castShadow = true;
    });

    // ต้นคริสต์มาสเล็ก: เริ่มจากซ่อนอยู่ในกล่อง แล้วงอกขึ้นมา พร้อมลูกบอลและดาวบนยอด
    const treeGroup = new THREE.Group();
    treeGroup.position.set(0, H * 0.25, 0);
    treeGroup.scale.setScalar(0.001);
    root.add(treeGroup);
    const tiers: [number, number, number][] = [
      [0.95, 1.2, 0.6],
      [0.72, 1.0, 1.35],
      [0.45, 0.8, 2.0],
    ];
    tiers.forEach(([r, h, yc], ti) => {
      const cone = new THREE.Mesh(track(new THREE.ConeGeometry(r, h, 18)), treeMat);
      cone.position.y = yc;
      cone.castShadow = true;
      treeGroup.add(cone);
      // ลูกบอลบนเนื้อต้น วางตามผิวกรวยที่ความสูงเดียวกัน
      const n = 4 + ti;
      const by = yc - h / 2 + h * 0.45;
      const rho = r * (1 - 0.45);
      for (let k = 0; k < n; k++) {
        const th = (k / n) * Math.PI * 2 + ti * 0.5;
        const bauble = new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 12, 10)), ornMats[(k + ti) % 2 === 0 ? 0 : 1]);
        bauble.position.set(Math.cos(th) * rho * 1.02, by, Math.sin(th) * rho * 1.02);
        treeGroup.add(bauble);
      }
    });
    const trunk = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.4, 0.22)), barkMat);
    trunk.position.y = -0.1;
    treeGroup.add(trunk);
    const star = new THREE.Mesh(
      track(new THREE.ExtrudeGeometry(starShape(0.32, 0.14), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 })),
      goldMat,
    );
    star.position.y = 2.5;
    star.scale.setScalar(0.001);
    treeGroup.add(star);

    // ลูกบอลที่กระจายออกจากกล่องตอนแสงออก
    const ornaments: { mesh: THREE.Mesh; v: THREE.Vector3; delay: number }[] = [];
    for (let i = 0; i < ORNAMENTS; i++) {
      const r = 0.07 + Math.random() * 0.06;
      const mesh = new THREE.Mesh(track(new THREE.SphereGeometry(r, 14, 10)), ornMats[i % ornMats.length]);
      mesh.visible = false;
      root.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const s = 1.2 + Math.random() * 1.6;
      ornaments.push({
        mesh,
        v: new THREE.Vector3(Math.cos(a) * s * 0.8, 2.6 + Math.random() * 1.4, Math.sin(a) * s * 0.8),
        delay: Math.random() * 0.3,
      });
    }

    // แสงและดวงแสงจากข้างใน
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1cf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, H + 0.9, 0);
    glow.scale.setScalar(0.01);
    scene.add(glow);
    const inner = new THREE.PointLight(0xffe2a0, 0, 9, 1.6);
    inner.position.set(0, H + 0.6, 0.3);
    scene.add(inner);

    // หิมะตกเบา ๆ รอบกล่อง
    const snowPos = new Float32Array(SNOW * 3);
    for (let i = 0; i < SNOW; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 7;
      snowPos[i * 3 + 1] = Math.random() * 6 - 1;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const snowGeo = track(new THREE.BufferGeometry());
    snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
    scene.add(new THREE.Points(snowGeo, snowMat));

    // โหมดทดสอบ (เฉพาะตอนพัฒนา): ?giftFrame=ms แสดงเฟรมนิ่งของเวลานั้น เพื่อตรวจทีละเฟรม
    const seekParam = process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("giftFrame") : null;
    const seek = seekParam !== null ? Number(seekParam) : null;

    // ขยับตามเคอร์เซอร์เล็กน้อยตอนรอให้แตะ
    let px = 0;
    let py = 0;
    const onPointer = (ev: PointerEvent) => {
      px = (ev.clientX / window.innerWidth) * 2 - 1;
      py = (ev.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer);

    let openAt = -1;
    let finished = false;
    let raf = 0;
    const t0 = performance.now();
    let last = t0;

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      camStart = framing();
    }
    window.addEventListener("resize", resize);

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const idle = (now - t0) / 1000;

      if (openAt < 0 && openingRef.current) openAt = now;

      if (openAt < 0 && seek === null) {
        // รอให้แตะ: กล่องหมุนช้า ลอยขึ้นลง และสั่นเป็นระยะ ๆ เพื่อชวนให้แตะ
        const wig = idle % 2.8;
        root.rotation.y = Math.sin(idle * 0.6) * 0.35 - 0.2 + px * 0.12;
        root.rotation.x = Math.sin(idle * 0.5) * 0.03 + py * 0.05;
        root.rotation.z = wig < 0.3 ? Math.sin((wig / 0.3) * Math.PI * 3) * 0.05 : 0;
        root.position.y = Math.sin(idle * 1.3) * 0.06;
        camera.position.lerp(new THREE.Vector3(camStart.x + px * 0.4, camStart.y - py * 0.2, camStart.z), 0.06);
        camera.lookAt(0, 1.0, 0);
      } else {
        const t = seek !== null ? seek / 1000 : (now - openAt) / 1000;
        // เครื่องที่ตั้งค่าลดการเคลื่อนไหวจะเล่นเร็วขึ้น ไม่มีการสั่นและกระจายลูกบอล
        const tt = reduce ? t * 2.5 : t;
        root.position.y = 0;
        root.rotation.x = 0;
        root.rotation.z = reduce ? 0 : Math.sin(tt * 70) * 0.03 * (1 - clamp01(tt / 0.3));
        root.rotation.y = -0.2 + easeInOut(clamp01(tt / 0.6)) * 0.2;

        // 1) ดึงโบว์ออก 0.05–0.75 วินาที
        const bu = easeOut(clamp01((tt - 0.05) / 0.7));
        bow.position.y = LID_H / 2 + 0.06 + bu * 1.6;
        bow.rotation.y = bu * 4.2;
        bow.rotation.z = bu * 0.4;
        bow.scale.setScalar(Math.max(0.001, 1 - bu));

        // 2) ฝาเด้งขึ้นเล็กน้อยแล้วเปิดออก 0.4–1.35 วินาที
        const hop = Math.sin(clamp01((tt - 0.4) / 0.4) * Math.PI) * 0.2;
        hinge.position.y = H + hop;
        hinge.rotation.x = -easeInOut(clamp01((tt - 0.55) / 0.8)) * 2.1;

        // 3) แสงออกจากกล่อง และลูกบอลกระจาย 1.0 วินาทีเป็นต้นไป
        inner.intensity = easeOut(clamp01((tt - 1.0) / 0.6)) * 14;
        glow.material.opacity = easeOut(clamp01((tt - 1.0) / 0.5)) * 0.85;
        glow.scale.setScalar(0.01 + easeOut(clamp01((tt - 1.0) / 1.0)) * 2.6);
        if (!reduce) {
          const burstT = tt - 1.05;
          for (const o of ornaments) {
            const lo = burstT - o.delay;
            const life = 1.4;
            if (lo <= 0 || lo > life) {
              o.mesh.visible = false;
              continue;
            }
            o.mesh.visible = true;
            o.mesh.position.set(o.v.x * lo, H + 0.15 + o.v.y * lo - 4.8 * lo * lo, o.v.z * lo);
            o.mesh.rotation.x += dt * 6;
            o.mesh.rotation.y += dt * 4;
            const pop = easeOutBack(clamp01(lo / 0.25));
            const fade = 1 - clamp01((lo - (life - 0.4)) / 0.4);
            o.mesh.scale.setScalar(Math.max(0.001, pop * fade));
          }
        }

        // 4) ต้นคริสต์มาสงอกขึ้นจากกล่อง 1.25–2.15 วินาที แล้วหมุนช้า ๆ
        const rt = clamp01((tt - 1.25) / 0.9);
        const rise = easeOutBack(rt);
        treeGroup.scale.setScalar(Math.max(0.001, rise));
        treeGroup.position.y = H * 0.25 + (H * 0.75 + 0.02) * easeOut(rt);
        treeGroup.rotation.y = Math.max(0, tt - 1.25) * 0.9;

        // 5) ดาวบนยอดเด้งขึ้น 2.0–2.5 วินาที แล้วหมุนเบา ๆ
        star.scale.setScalar(Math.max(0.001, easeOutBack(clamp01((tt - 2.0) / 0.5))));
        star.rotation.y = tt * 1.5;

        // 6) กล้องพุ่งเข้าหาต้น 2.2–3.1 วินาที
        const camT = easeInOut(clamp01((tt - 2.2) / 0.9));
        camera.position.lerpVectors(camStart, endPos(), camT);
        camera.lookAt(0, 1.2 + camT * 1.4, 0);

        if (!finished && seek === null && tt >= TOTAL) {
          finished = true;
          finishRef.current();
        }
      }

      // หิมะตกช้า ๆ ตลอดเวลา
      for (let i = 0; i < SNOW; i++) {
        snowPos[i * 3 + 1] -= dt * 0.3;
        snowPos[i * 3] += Math.sin(idle + i) * dt * 0.05;
        if (snowPos[i * 3 + 1] < -1) snowPos[i * 3 + 1] = 5;
      }
      snowGeo.getAttribute("position").needsUpdate = true;

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // ฉากสร้างครั้งเดียว การเริ่มเปิดอ่านจาก ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="gift3d" onClick={onOpen} aria-label="แตะเพื่อแกะของขวัญ">
      <span ref={mountRef} className="gift3d-canvas" />
    </button>
  );
}
