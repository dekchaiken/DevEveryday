"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// ประตูคริสต์มาส 3 มิติ: ประตูตกลงมาจากด้านบนพร้อมเด้ง แล้วแง้มเปิด แสงอุ่นทะลักออกมา
// กล้องพุ่งเข้าแสง แล้วจอขาวนวล จากนั้นเรียก onDone (ให้พาไปหน้าเลือกสถานที่)

type Props = { onDone: () => void };

const TOTAL = 3.0;
const RED = 0xa3202f;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t * t;
function bounceOut(t: number) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,246,220,1)");
    grd.addColorStop(0.35, "rgba(241,205,140,0.6)");
    grd.addColorStop(1, "rgba(241,205,140,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function DoorTransition({ onDone }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // ไม่มี WebGL: ข้ามแอนิเมชันไปเลย
      const id = window.setTimeout(() => doneRef.current(), 400);
      return () => window.clearTimeout(id);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const textures: THREE.Texture[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];
    const track = <T extends THREE.BufferGeometry>(g: T) => {
      geos.push(g);
      return g;
    };
    const material = <T extends THREE.Material>(m: T) => {
      mats.push(m);
      return m;
    };

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;

    const aspect = window.innerWidth / window.innerHeight;
    const k = Math.max(1, 1.05 / Math.min(1, aspect * 1.1));
    const camStart = new THREE.Vector3(0, 1.7 * k, 9.5 * k);
    const camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 100);
    camera.position.copy(camStart);
    camera.lookAt(0, 1.6, 0);
    scene.add(camera);

    const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
    key.position.set(3, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.0);
    rim.position.set(-4, 3, -3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x3a5a4a, 0.5));

    // แสงอุ่นที่อยู่หลังประตู ใช้เป็นแสงที่ทะลักออกตอนประตูเปิด
    const glowTex = glowTexture();
    textures.push(glowTex);
    const glow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(16, 16)),
      material(new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })),
    );
    glow.position.set(0, 1.6, -1.6);
    scene.add(glow);

    // พื้นหิมะหน้าประตู
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 40)), material(new THREE.MeshStandardMaterial({ color: 0xf2f7fb, roughness: 0.9 })));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const wood = material(new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.7 }));
    const snow = material(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
    const green = material(new THREE.MeshStandardMaterial({ color: 0x1f7a4d, roughness: 0.7 }));
    const gold = material(new THREE.MeshStandardMaterial({ color: 0xf7d774, metalness: 1, roughness: 0.25, emissive: 0x3a2706, emissiveIntensity: 0.25 }));
    const paint = material(new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    const bulbColors = [0xffd76a, 0xff6b8a, 0x7dd3fc, 0x86efac];

    // ประตูทั้งบาน: วงกบ ซุ้มด้านบน และแผ่นประตูที่บานพับอยู่ด้านซ้าย
    const doorway = new THREE.Group();
    scene.add(doorway);
    const post = track(new THREE.BoxGeometry(0.25, 3.2, 0.3));
    const left = new THREE.Mesh(post, wood);
    left.position.set(-1.1, 1.6, 0);
    const right = new THREE.Mesh(post, wood);
    right.position.set(1.1, 1.6, 0);
    const lintel = new THREE.Mesh(track(new THREE.BoxGeometry(2.45, 0.28, 0.3)), wood);
    lintel.position.set(0, 3.3, 0);
    const cap = new THREE.Mesh(track(new THREE.BoxGeometry(2.7, 0.14, 0.44)), snow);
    cap.position.set(0, 3.5, 0);
    doorway.add(left, right, lintel, cap);

    // ไฟประดับรอบวงกบ
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const bulb = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.05, 10, 8)),
        material(new THREE.MeshBasicMaterial({ color: bulbColors[i % bulbColors.length] })),
      );
      const angle = Math.PI * t; // ครึ่งวงกลมด้านบน
      bulb.position.set(Math.cos(Math.PI - angle) * 1.22, 1.7 + Math.sin(angle) * 1.95, 0.2);
      doorway.add(bulb);
    }

    // บานประตู: หมุนรอบขอบซ้าย
    const hinge = new THREE.Group();
    hinge.position.set(-0.95, 0, 0.05);
    doorway.add(hinge);
    const leaf = new THREE.Mesh(track(new RoundedBoxGeometry(1.9, 3.0, 0.14, 3, 0.04)), paint);
    leaf.position.set(0.95, 1.5, 0);
    leaf.castShadow = true;
    hinge.add(leaf);
    // กรอบแผงทองสองชั้นบนบานประตู
    const panelTop = new THREE.Mesh(track(new THREE.BoxGeometry(1.25, 0.9, 0.03)), gold);
    panelTop.position.set(0.95, 2.05, 0.09);
    const panelBot = new THREE.Mesh(track(new THREE.BoxGeometry(1.25, 1.15, 0.03)), gold);
    panelBot.position.set(0.95, 0.85, 0.09);
    hinge.add(panelTop, panelBot);
    // พวงหรีดบนประตู และลูกบิด
    const wreath = new THREE.Mesh(track(new THREE.TorusGeometry(0.34, 0.07, 12, 32)), green);
    wreath.position.set(0.95, 2.1, 0.12);
    const bow = new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 10, 8)), paint);
    bow.position.set(0.95, 1.74, 0.16);
    const knob = new THREE.Mesh(track(new THREE.SphereGeometry(0.09, 12, 10)), gold);
    knob.position.set(1.7, 1.4, 0.12);
    hinge.add(wreath, bow, knob);

    // ฉากเริ่มต้น: ประตูอยู่สูงกว่าจอ แล้วจะตกลงมา
    doorway.position.y = 7;

    const startedAt = performance.now();
    let raf = 0;
    let finished = false;

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const t = (now - startedAt) / 1000;
      // เครื่องที่ตั้งค่าลดการเคลื่อนไหวจะไปถึงขั้นสุดท้ายเร็วขึ้นและไม่สั่นกล้อง
      const tt = reduce ? t * 2.5 : t;

      // 1) ประตูตกลงมาและเด้ง 0–0.9 วินาที
      doorway.position.y = 7 * (1 - bounceOut(clamp01(tt / 0.9)));
      // 2) สั่นเล็กน้อยตอนลงถึงพื้น
      camera.position.copy(camStart);
      if (!reduce && tt > 0.9 && tt < 1.2) camera.position.x += Math.sin((tt - 0.9) * 60) * 0.05 * (1 - (tt - 0.9) / 0.3);
      // 3) บานประตูแง้มเปิด 1.1–1.9 วินาที
      hinge.rotation.y = -easeInOut(clamp01((tt - 1.1) / 0.8)) * 1.9;
      // 4) แสงทะลักออกมา 1.3–2.3 วินาที
      const lightT = clamp01((tt - 1.3) / 1.0);
      glow.material.opacity = Math.min(1, lightT * 1.2);
      glow.scale.setScalar(1 + lightT * 0.8);
      // 5) กล้องพุ่งเข้าไปในแสง 2.0–2.8 วินาที
      const camT = easeIn(clamp01((tt - 2.0) / 0.8));
      camera.position.z = camStart.z + (0.4 - camStart.z) * camT;
      camera.lookAt(0, 1.6, 0);
      // 6) จอขาวนวลค่อย ๆ ปิดท้าย 2.5–3.0 วินาที
      if (flashRef.current) flashRef.current.style.opacity = String(clamp01((tt - 2.5) / 0.5));

      if (!finished && tt >= TOTAL) {
        finished = true;
        doneRef.current();
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="xdoor" role="presentation" aria-hidden>
      <div ref={mountRef} className="xdoor-canvas" />
      <div ref={flashRef} className="xdoor-flash" />
    </div>
  );
}
