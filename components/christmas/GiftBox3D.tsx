"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// กล่องของขวัญ 3 มิติจริง (Three.js): ตัวกล่อง ฝาบานพับ ริบบิ้น และโบว์
// ลำดับการแกะเมื่อแตะ: แกะโบว์ → ฝาเปิดพร้อมแสงจากข้างใน → กล้องพุ่งเข้าแสง → วาบเข้าหน้าหลัก
// ระยะเวลารวมประมาณ 2.4 วินาที แล้วเรียก onFinish หนึ่งครั้ง

type Props = {
  opening: boolean;
  onOpen: () => void;
  onFinish: () => void;
};

const RED = 0x9a1a30;
const GOLD = 0xf2d27f;
const TOTAL = 2.4;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;

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

    const size = Math.min(360, Math.max(240, mount.clientWidth || 360));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const CAM_START = new THREE.Vector3(0, 1.9, 7.4);
    camera.position.copy(CAM_START);
    camera.lookAt(0, 1.0, 0);
    scene.add(camera);

    // แสง: ไฟหลักอุ่น ขอบแสงเย็น และแสงเติมเล็กน้อย
    const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
    key.position.set(3.5, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
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

    const redMat = new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.22 });
    const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.2, metalness: 1, emissive: 0x3a2706, emissiveIntensity: 0.25 });
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [redMat, goldMat];
    const track = <T extends THREE.BufferGeometry>(g: T) => {
      geos.push(g);
      return g;
    };

    const W = 2;
    const H = 1.6;
    const D = 2;
    const LID_H = 0.34;

    // ตัวกล่อง
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(W, H, D)), redMat);
    body.position.y = H / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    // ริบบิ้นรอบตัวกล่อง: แถบแนวนอนรอบด้านและแถบแนวตั้งกลางด้าน
    const ribbon = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), goldMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };
    const bandY = H / 2;
    const e = 0.02;
    root.add(
      ribbon(W + 0.02, 0.2, 0.05, 0, bandY, D / 2 + e), // หน้า
      ribbon(W + 0.02, 0.2, 0.05, 0, bandY, -D / 2 - e), // หลัง
      ribbon(0.05, 0.2, D + 0.02, W / 2 + e, bandY, 0), // ขวา
      ribbon(0.05, 0.2, D + 0.02, -W / 2 - e, bandY, 0), // ซ้าย
      ribbon(0.22, H, 0.05, 0, H / 2, D / 2 + e), // แนวตั้งหน้า
      ribbon(0.22, H, 0.05, 0, H / 2, -D / 2 - e), // แนวตั้งหลัง
      ribbon(0.05, H, 0.22, W / 2 + e, H / 2, 0), // แนวตั้งขวา
      ribbon(0.05, H, 0.22, -W / 2 - e, H / 2, 0), // แนวตั้งซ้าย
    );

    // ฝาบานพับที่ขอบหลัง
    const hinge = new THREE.Group();
    hinge.position.set(0, H, -D / 2);
    root.add(hinge);
    const lid = new THREE.Group();
    lid.position.set(0, LID_H / 2, D / 2);
    hinge.add(lid);
    const lidMesh = new THREE.Mesh(track(new THREE.BoxGeometry(W + 0.14, LID_H, D + 0.14)), redMat);
    lidMesh.castShadow = true;
    lidMesh.receiveShadow = true;
    lid.add(lidMesh);
    const lidTop = LID_H / 2 + e;
    lid.add(
      ribbon(W + 0.16, 0.06, 0.2, 0, lidTop, 0), // แถบขวางบนฝา
    );
    const lidRibbonV = ribbon(0.24, 0.06, D + 0.16, 0, lidTop, 0);
    lid.add(lidRibbonV);
    lid.add(ribbon(0.24, LID_H + 0.02, 0.06, 0, 0, D / 2 + 0.08));

    // โบว์: ห่วงสองข้าง ปมตรงกลาง และหางริบบิ้นสองเส้น
    const bow = new THREE.Group();
    bow.position.set(0, LID_H / 2 + 0.06, 0);
    lid.add(bow);
    const loopGeo = track(new THREE.TorusGeometry(0.3, 0.055, 16, 48));
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

    // แสงและประกายจากข้างใน
    const glowTex = glowTexture();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1cf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, H + 0.2, 0);
    glow.scale.setScalar(0.01);
    scene.add(glow);
    const inner = new THREE.PointLight(0xffe2a0, 0, 9, 1.6);
    inner.position.set(0, H + 0.2, 0);
    scene.add(inner);


    // ประกายที่กระจายตอนแกะโบว์
    const SPARK = 60;
    const sparkPos = new Float32Array(SPARK * 3);
    const sparkVel = new Float32Array(SPARK * 3);
    for (let i = 0; i < SPARK; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 1.2;
      sparkVel[i * 3] = Math.cos(a) * s;
      sparkVel[i * 3 + 1] = 0.6 + Math.random() * 1.6;
      sparkVel[i * 3 + 2] = Math.sin(a) * s;
    }
    const sparkGeo = track(new THREE.BufferGeometry());
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ color: 0xf5d48a, size: 0.12, map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sparks.position.set(0, H + 0.2, 0);
    scene.add(sparks);

    // โหมดทดสอบ (เฉพาะตอนพัฒนา): ?giftFrame=ms แสดงเฟรมนิ่งของเวลานั้น เพื่อตรวจทีละเฟรม
    const seekParam = process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("giftFrame") : null;
    const seek = seekParam !== null ? Number(seekParam) : null;

    // จุดเวลาเริ่มของแอนิเมชันเปิด
    let openAt = -1;
    let finished = false;
    let raf = 0;
    const t0 = performance.now();

    function resize() {
      const w = Math.min(360, Math.max(240, mount!.clientWidth || 360));
      renderer.setSize(w, w);
    }
    window.addEventListener("resize", resize);

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const idle = (now - t0) / 1000;

      if (openAt < 0 && openingRef.current) openAt = now;

      if (openAt < 0 && seek === null) {
        // รอให้แตะ: กล่องหมุนช้า ๆ และลอยขึ้นลงเบา ๆ
        root.rotation.y = Math.sin(idle * 0.7) * 0.32 - 0.25;
        root.position.y = Math.sin(idle * 1.4) * 0.05;
        root.rotation.x = Math.sin(idle * 0.5) * 0.03;
        glow.scale.setScalar(0.01);
        // เอียงเล็กน้อยไปทางจอ ให้เห็นด้านหน้า ฝา และด้านข้างพร้อมกัน
        camera.position.lerp(CAM_START, 0.08);
        camera.lookAt(0, 1.0, 0);
      } else {
        const t = seek !== null ? seek / 1000 : (now - openAt) / 1000;
        root.position.y = 0;
        root.rotation.x = 0;
        root.rotation.y = -0.25 + easeInOut(clamp01(t / 0.6)) * 0.25;

        // 1) แกะโบว์ 0–0.6 วินาที: โบว์ลอยขึ้น หมุน และหายไป ประกายกระจาย
        const u = easeOut(clamp01(t / 0.6));
        bow.position.y = LID_H / 2 + 0.06 + u * 1.4;
        bow.rotation.y = u * 3.2;
        bow.scale.setScalar(Math.max(0.001, 1 - u));
        lidRibbonV.position.y = lidTop - u * 0.6;
        lidRibbonV.rotation.z = u * 0.5;
        lidRibbonV.material = goldMat;
        if (!reduce) {
          const sp = clamp01((t - 0.15) / 1.2);
          sparks.material = sparks.material as THREE.PointsMaterial;
          (sparks.material as THREE.PointsMaterial).opacity = (1 - sp) * 0.95;
          for (let i = 0; i < SPARK; i++) {
            const dt = Math.max(0, t - 0.15);
            sparkPos[i * 3] = sparkVel[i * 3] * dt * 0.6;
            sparkPos[i * 3 + 1] = sparkVel[i * 3 + 1] * dt - 2.2 * dt * dt;
            sparkPos[i * 3 + 2] = sparkVel[i * 3 + 2] * dt * 0.6;
          }
          sparkGeo.getAttribute("position").needsUpdate = true;
        }

        // 2) ฝาเปิด 0.45–1.35 วินาที พร้อมแสงจากข้างใน
        const lidT = easeInOut(clamp01((t - 0.45) / 0.9));
        hinge.rotation.x = -lidT * 1.95;
        const lightT = clamp01((t - 0.9) / 0.7);
        inner.intensity = easeOut(lightT) * 36;
        glow.material.opacity = easeOut(clamp01((t - 0.8) / 0.5)) * 0.95;
        glow.scale.setScalar(0.01 + easeOut(clamp01((t - 0.8) / 1.0)) * 3.2);

        // 3) กล้องพุ่งเข้าแสง 1.25–2.2 วินาที
        const camT = easeIn(clamp01((t - 1.25) / 0.95));
        camera.position.lerpVectors(CAM_START, new THREE.Vector3(0, 3.1, 2.1), camT);
        camera.lookAt(0, 1.7, 0);
        glow.scale.setScalar(0.01 + easeOut(clamp01((t - 0.8) / 1.0)) * 3.2 + camT * 1.2);
        glow.material.opacity = Math.min(1, 0.95 + camT * 0.05);

        if (!finished && seek === null && t >= TOTAL) {
          finished = true;
          finishRef.current();
        }
      }

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      glowTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // ฉากสร้างครั้งเดียว การเริ่มเปิดอ่านจาก ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="gift3d" onClick={onOpen} aria-label="แตะเพื่อแกะของขวัญ">
      <div ref={mountRef} className="gift3d-canvas" />
    </button>
  );
}
