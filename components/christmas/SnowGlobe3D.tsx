"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildTreeModel } from "./treeModel";
import { giftBox, snowman } from "./zoneScenery";

// ลูกแก้วหิมะ 3 มิติสำหรับหน้าเปิด: ข้างในเป็นต้นคริสต์มาสตัวเดียวกับลานจริง
// รอแตะ: ลูกแก้วหมุนช้า หิมะโปรยในแก้ว · แตะแล้ว: ลูกแก้วสั่น หิมะหมุนวน ไฟต้นสว่างขึ้น ดาวเปล่งแสง
// แล้วกล้องพุ่งเข้าไปในลูกแก้วจนแสงทองเต็มจอ (onFinish) หน้าหลักจางเข้ามาแทน
// ไม่มีเงาแบบ shadow map (ใช้เงานุ่มจากภาพแทน) และคอมไพล์ shader ก่อนแสดงภาพแรก ภาพจึงลื่นตั้งแต่เฟรมแรก

type Props = {
  opening: boolean;
  onOpen: () => void;
  onFinish: () => void;
  onFlash?: (k: number) => void; // ความสว่างของแสงทองเต็มจอ 0–1 (ให้หน้าเปิดทำชั้นแสงแบบ CSS)
};

const TOTAL = 3.3; // วินาทีนับจากแตะจนแสงเต็มจอ
const GLOBE_R = 1.15;
const SNOW = 260;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
const glowTex = () =>
  canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(255,240,200,0.6)");
    grd.addColorStop(1, "rgba(255,230,170,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
// เงานุ่มใต้ฐาน
const shadowTex = () =>
  canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(0.6, "rgba(0,0,0,0.2)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
// ป้ายทองเหลืองหน้าฐาน
const plaqueTex = () =>
  canvasTex(512, 128, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, "#f3dd9c");
    grd.addColorStop(0.5, "#c99a3f");
    grd.addColorStop(1, "#8d6a25");
    g.fillStyle = grd;
    g.beginPath();
    g.roundRect(4, 4, 504, 120, 26);
    g.fill();
    g.strokeStyle = "rgba(90,60,15,0.7)";
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(16, 16, 480, 96, 18);
    g.stroke();
    g.fillStyle = "#4a3009";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "italic 600 54px Georgia, 'Times New Roman', serif";
    g.fillText("Merry Christmas", 256, 66);
  });
// ไม้ขัดเงาของฐาน: ลายเสี้ยนแนวนอน
const woodTex = () =>
  canvasTex(256, 256, (g) => {
    g.fillStyle = "#4a2414";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${120 + Math.random() * 60},${50 + Math.random() * 30},${20 + Math.random() * 20},${0.15 + Math.random() * 0.25})`;
      g.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * 256;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(80, y + Math.random() * 6 - 3, 170, y + Math.random() * 6 - 3, 256, y);
      g.stroke();
    }
  });

// ขอบแก้วเรืองแสงแบบ fresnel (สว่างที่ขอบ โปร่งตรงกลาง) ราคาถูกกว่าแก้วหักเหแสงจริงมาก
const FRESNEL_VERT = `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRESNEL_FRAG = `
uniform vec3 uColor;
uniform float uPower;
uniform float uStrength;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
  gl_FragColor = vec4(uColor * f * uStrength, f * uStrength);
}`;

export default function SnowGlobe3D({ opening, onOpen, onFinish, onFlash }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef(opening);
  openingRef.current = opening;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const flashRef = useRef(onFlash);
  flashRef.current = onFlash;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      // ไม่มี WebGL: แตะแล้วจางเข้าหน้าหลักทันที
      let fallbackTimer = 0;
      const check = window.setInterval(() => {
        if (openingRef.current) {
          window.clearInterval(check);
          fallbackTimer = window.setTimeout(() => finishRef.current(), 600);
        }
      }, 100);
      return () => {
        window.clearInterval(check);
        window.clearTimeout(fallbackTimer);
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.6 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setClearColor(0x000000, 0);
    const cv = renderer.domElement;
    cv.style.width = "100%";
    cv.style.height = "100%";
    cv.style.display = "block";
    cv.style.opacity = "0";
    cv.style.transition = "opacity 0.9s ease";
    mount.appendChild(cv);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.8;

    const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.05, 60);
    // ระยะกล้องตามสัดส่วนจอ (จอแนวตั้งถอยออก ลูกแก้วไม่ล้นจอ)
    const framing = () => {
      const aspect = window.innerWidth / window.innerHeight;
      const k = 1 / Math.min(1, aspect * 1.05);
      return new THREE.Vector3(0, 1.55, 8.6 * k);
    };
    let camStart = framing();
    // มองต่ำกว่ากลางลูกแก้วเล็กน้อย ลูกแก้วจึงอยู่ใต้หัวข้อ ไม่ทับตัวอักษร
    const lookStart = new THREE.Vector3(0, 1.05, 0);
    camera.position.copy(camStart);
    camera.lookAt(lookStart);

    scene.add(new THREE.AmbientLight(0x7f97b6, 0.45));
    const key = new THREE.DirectionalLight(0xfff0d6, 1.6);
    key.position.set(3, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 0.9);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const disposables: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
    const glow = keep(glowTex());

    const root = new THREE.Group();
    scene.add(root);

    // ---------- ฐานไม้กลึงขอบทอง ป้ายทองเหลือง ----------
    const wood = keep(woodTex());
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(3, 1);
    const woodMat = keep(new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.18 }));
    const goldMat = keep(new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 1, roughness: 0.22 }));
    const prof = [
      [0, 0],
      [1.25, 0],
      [1.3, 0.04],
      [1.3, 0.12],
      [1.2, 0.16],
      [1.08, 0.42],
      [1.02, 0.5],
      [1.08, 0.56],
      [1.06, 0.62],
      [0.96, 0.66],
      [0, 0.66],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const base = new THREE.Mesh(keep(new THREE.LatheGeometry(prof, 72)), woodMat);
    root.add(base);
    for (const [r, y] of [
      [1.305, 0.08],
      [1.085, 0.55],
    ]) {
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(r, 0.018, 8, 96)), goldMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      root.add(ring);
    }
    const plaque = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.9, 0.22)), keep(new THREE.MeshStandardMaterial({ map: keep(plaqueTex()), metalness: 0.7, roughness: 0.3 })));
    plaque.position.set(0, 0.3, 1.155);
    plaque.rotation.x = -0.36;
    root.add(plaque);
    // เงานุ่มบนพื้น
    const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(4.2, 4.2)), keep(new THREE.MeshBasicMaterial({ map: keep(shadowTex()), transparent: true, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    scene.add(shadow);

    // ---------- ข้างในลูกแก้ว: เนินหิมะ ต้นคริสต์มาส ตุ๊กตาหิมะ ของขวัญ ----------
    const inner = new THREE.Group();
    inner.position.y = 0.66;
    root.add(inner);
    const globeCenterY = 0.66 + GLOBE_R * 0.78;
    // เนินหิมะเต็มก้นแก้ว: ขอบเนินชนผิวแก้วพอดีที่ความสูงนี้
    const GROUND_Y = 0.12; // เหนือฐาน (พิกัดภายในกลุ่ม inner)
    const rG = Math.sqrt(GLOBE_R * GLOBE_R - (globeCenterY - 0.66 - GROUND_Y) ** 2) - 0.01;
    const MOUND = 0.17;
    const heightAt = (r: number) => GROUND_Y + MOUND * Math.cos(Math.min(r / rG, 1) * Math.PI * 0.5);
    const groundGeo = keep(new THREE.CircleGeometry(rG, 72, 0, Math.PI * 2));
    groundGeo.rotateX(-Math.PI / 2);
    const gp = groundGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i);
      const z = gp.getZ(i);
      gp.setY(i, heightAt(Math.hypot(x, z)) + 0.012 * Math.sin(x * 11) * Math.cos(z * 9));
    }
    groundGeo.computeVertexNormals();
    const snowMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xdfeeff), sheenRoughness: 0.4 }));
    const ground = new THREE.Mesh(groundGeo, snowMat);
    inner.add(ground);
    const floorY = heightAt(0) - 0.02;
    const tree = buildTreeModel({ variant: "classic", small: true, glowTex: glow });
    tree.group.scale.setScalar(0.2);
    tree.group.position.y = floorY;
    inner.add(tree.group);
    disposables.push(tree);
    const sm = snowman();
    sm.scale.setScalar(0.36);
    sm.position.set(0.44, heightAt(Math.hypot(0.44, 0.3)) - 0.02, 0.3);
    sm.rotation.y = -0.6;
    inner.add(sm);
    [
      [-0.42, 0.34, 0.15, 0xc8102e],
      [-0.26, 0.52, 0.11, 0x1f7a4d],
      [0.16, 0.56, 0.1, 0xd9b25a],
    ].forEach(([x, z, s, c]) => {
      const gb = giftBox(s, c, 0xf5e6b8);
      gb.position.set(x, heightAt(Math.hypot(x, z)) - 0.03, z);
      gb.rotation.y = x * 3;
      inner.add(gb);
    });

    // ---------- แก้ว: ผิวสะท้อนบาง ๆ + ขอบเรืองแสงแบบ fresnel + ไฮไลต์จุดสะท้อน ----------
    const glassGeo = keep(new THREE.SphereGeometry(GLOBE_R, 64, 48));
    const glass = new THREE.Mesh(
      glassGeo,
      keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 1.6 })),
    );
    glass.position.y = globeCenterY;
    glass.renderOrder = 3;
    root.add(glass);
    const rimUniforms = { uColor: { value: new THREE.Color(0xcfe6ff) }, uPower: { value: 2.6 }, uStrength: { value: 0.75 } };
    const rimGlass = new THREE.Mesh(glassGeo, keep(new THREE.ShaderMaterial({ vertexShader: FRESNEL_VERT, fragmentShader: FRESNEL_FRAG, uniforms: rimUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    rimGlass.position.copy(glass.position);
    rimGlass.renderOrder = 4;
    root.add(rimGlass);
    const spec = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    spec.scale.set(0.42, 0.26, 1);
    spec.position.set(-0.48, globeCenterY + 0.56, 0.86);
    root.add(spec);

    // ---------- หิมะในลูกแก้ว ----------
    const snowPos = new Float32Array(SNOW * 3);
    const snowVel = new Float32Array(SNOW * 3);
    const rndInGlobe = (i: number) => {
      for (;;) {
        const x = (Math.random() * 2 - 1) * GLOBE_R * 0.9;
        const y = (Math.random() * 2 - 1) * GLOBE_R * 0.9;
        const z = (Math.random() * 2 - 1) * GLOBE_R * 0.9;
        if (x * x + y * y + z * z < (GLOBE_R * 0.88) ** 2 && y > -GLOBE_R * 0.55) {
          snowPos.set([x, y + globeCenterY, z], i * 3);
          return;
        }
      }
    };
    for (let i = 0; i < SNOW; i++) rndInGlobe(i);
    const snowGeo = keep(new THREE.BufferGeometry());
    snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
    const snowPts = new THREE.Points(snowGeo, keep(new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, map: glow, transparent: true, opacity: 0.95, depthWrite: false })));
    snowPts.renderOrder = 2;
    root.add(snowPts);

    // ---------- แสงจากดาวบนยอดต้น และประกายที่แตกออกตอนดาวสว่าง ----------
    const starWorld = () => tree.starPosition.clone().multiplyScalar(0.2).add(new THREE.Vector3(0, floorY + 0.66, 0));
    const burstGlow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: 0xffe6a6, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
    burstGlow.renderOrder = 5;
    scene.add(burstGlow);
    const SPARK = 90;
    const sparkPos = new Float32Array(SPARK * 3);
    const sparkDir = new Float32Array(SPARK * 3);
    for (let i = 0; i < SPARK; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      sparkDir.set([r * Math.cos(a), u, r * Math.sin(a)], i * 3);
    }
    const sparkGeo = keep(new THREE.BufferGeometry());
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = keep(new THREE.PointsMaterial({ color: 0xffe6a6, size: 0.05, map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.renderOrder = 6;
    scene.add(sparks);

    // ขยับตามเคอร์เซอร์เล็กน้อยตอนรอให้แตะ
    let px = 0;
    let py = 0;
    const onPointer = (ev: PointerEvent) => {
      px = (ev.clientX / window.innerWidth) * 2 - 1;
      py = (ev.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer);

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      camStart = framing();
    };
    window.addEventListener("resize", resize);

    let raf = 0;
    let openAt = -1;
    let finished = false;
    let last = performance.now();
    const t0 = last;
    const camPos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const target = new THREE.Vector3();
    let started = false;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const idle = (now - t0) / 1000;
      if (openAt < 0 && openingRef.current) openAt = now;
      const t = openAt < 0 ? -1 : ((now - openAt) / 1000) * (reduce ? 2.2 : 1);

      // ลูกแก้วหมุนช้า ๆ ลอยขึ้นลง ตอนแตะสั่นแรงแล้วค่อยหยุด
      let shake = 0;
      if (t >= 0) shake = reduce ? 0 : Math.exp(-t * 3.2) * Math.sin(t * 28) * clamp01(t / 0.08);
      root.rotation.y = (openAt < 0 ? Math.sin(idle * 0.35) * 0.45 + px * 0.15 : root.rotation.y * 0.96) + 0;
      root.rotation.z = shake * 0.1;
      root.rotation.x = shake * 0.04 + (openAt < 0 ? py * 0.04 : 0);
      root.position.y = (openAt < 0 ? Math.sin(idle * 1.1) * 0.03 : 0) + (t >= 0 ? Math.sin(clamp01(t / 0.9) * Math.PI) * 0.12 : 0);

      // หิมะ: ปกติโปรยลงช้า ๆ ตอนเขย่าหมุนวนขึ้นแรงแล้วค่อยตกลง
      const swirl = t >= 0 ? Math.exp(-t * 0.9) * clamp01(t / 0.15) : 0;
      const cy = globeCenterY + root.position.y;
      for (let i = 0; i < SNOW; i++) {
        const ix = i * 3;
        let x = snowPos[ix];
        let y = snowPos[ix + 1];
        let z = snowPos[ix + 2];
        const ry = y - cy;
        // แรงหมุนรอบแกนตั้ง + ลอยขึ้น
        snowVel[ix] += (-z * 2.4 * swirl - snowVel[ix] * 1.8) * dt;
        snowVel[ix + 2] += (x * 2.4 * swirl - snowVel[ix + 2] * 1.8) * dt;
        snowVel[ix + 1] += (swirl * 2.2 * (0.6 - ry) - 0.25 - snowVel[ix + 1] * 1.6) * dt;
        x += snowVel[ix] * dt + Math.sin(idle * 0.8 + i) * 0.02 * dt;
        y += snowVel[ix + 1] * dt;
        z += snowVel[ix + 2] * dt;
        const d = Math.hypot(x, y - cy, z);
        if (d > GLOBE_R * 0.9) {
          const k = (GLOBE_R * 0.9) / d;
          x *= k;
          z *= k;
          y = cy + (y - cy) * k;
        }
        if (y - cy < -GLOBE_R * 0.45 + 0.05 * Math.sin(i)) {
          // ตกถึงพื้นแล้วกลับไปเริ่มด้านบน (ช่วงเขย่าให้ฟุ้งขึ้นจากพื้นเลย)
          if (swirl > 0.2) snowVel[ix + 1] = 1.2 + Math.random();
          else {
            rndInGlobe(i);
            snowPos[ix + 1] = cy + GLOBE_R * (0.4 + Math.random() * 0.4);
            snowVel[ix] = snowVel[ix + 1] = snowVel[ix + 2] = 0;
            continue;
          }
        }
        snowPos[ix] = x;
        snowPos[ix + 1] = y;
        snowPos[ix + 2] = z;
      }
      snowGeo.getAttribute("position").needsUpdate = true;

      tree.update(idle, reduce);
      const star = starWorld().applyMatrix4(new THREE.Matrix4().makeRotationY(root.rotation.y)).add(new THREE.Vector3(0, root.position.y, 0));

      if (t < 0) {
        // รอแตะ: กล้องลอยตามเคอร์เซอร์เล็กน้อย
        camPos.set(camStart.x + px * 0.35, camStart.y - py * 0.15, camStart.z);
        camera.position.lerp(camPos, 0.06);
        camera.lookAt(lookStart);
        renderer.toneMappingExposure = 0.9;
      } else {
        // ไฟต้นและห้องสว่างขึ้น
        renderer.toneMappingExposure = 0.9 + easeOut(clamp01((t - 0.3) / 1.2)) * 0.35;
        rimUniforms.uStrength.value = 0.75 + easeOut(clamp01((t - 0.4) / 1.0)) * 0.6;
        // ดาวเปล่งแสงและประกายแตกออก 1.1–2.2 วินาที
        const sb = clamp01((t - 1.1) / 0.5);
        burstGlow.position.copy(star);
        const pulse = Math.sin(clamp01((t - 1.1) / 1.2) * Math.PI);
        burstGlow.scale.setScalar(0.05 + easeOut(sb) * 1.1 + pulse * 0.4);
        (burstGlow.material as THREE.SpriteMaterial).opacity = Math.min(1, easeOut(sb) * 1.1);
        const st = clamp01((t - 1.15) / 1.1);
        for (let i = 0; i < SPARK; i++) {
          const d = easeOut(st) * (0.35 + (i % 7) * 0.06);
          sparkPos[i * 3] = star.x + sparkDir[i * 3] * d;
          sparkPos[i * 3 + 1] = star.y + sparkDir[i * 3 + 1] * d - st * st * 0.15;
          sparkPos[i * 3 + 2] = star.z + sparkDir[i * 3 + 2] * d;
        }
        sparkGeo.getAttribute("position").needsUpdate = true;
        sparkMat.opacity = st > 0 && st < 1 ? Math.sin(st * Math.PI) : 0;
        // กล้องพุ่งเข้าไปในลูกแก้วตรงไปที่ดาว 1.5–3.3 วินาที
        const ct = easeInOut(clamp01((t - 1.5) / (TOTAL - 1.5)));
        target.copy(star);
        camPos.copy(camStart).lerp(new THREE.Vector3(star.x, star.y + 0.04, star.z + 0.5), ct);
        camera.position.lerp(camPos, 0.25);
        look.copy(lookStart).lerp(target, easeOut(clamp01((t - 1.2) / 1.2)));
        camera.lookAt(look);
        // แสงทองเต็มจอช่วงท้าย
        flashRef.current?.(Math.pow(clamp01((t - (TOTAL - 1.0)) / 1.0), 2));
        if (!finished && t >= TOTAL) {
          finished = true;
          finishRef.current();
        }
      }
      renderer.render(scene, camera);
      if (!started) {
        started = true;
        cv.style.opacity = "1";
      }
    }

    // คอมไพล์ shader ทั้งหมดก่อนเริ่ม ภาพแรกจึงไม่สะดุด
    let cancelled = false;
    const start = () => {
      if (!cancelled) raf = requestAnimationFrame(frame);
    };
    const compiled = (renderer as unknown as { compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown> }).compileAsync?.(scene, camera);
    if (compiled) compiled.then(start, start);
    else start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
      });
      disposables.forEach((d) => d.dispose());
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      cv.remove();
    };
    // ฉากสร้างครั้งเดียว การเริ่มเปิดอ่านจาก ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="gift3d" onClick={onOpen} aria-label="แตะลูกแก้วหิมะเพื่อเข้าสู่ลานคริสต์มาส">
      <span ref={mountRef} className="gift3d-canvas" />
    </button>
  );
}
