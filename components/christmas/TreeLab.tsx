"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Ornament } from "@/lib/christmas/types";
import { ORNAMENT_COLORS, ORNAMENT_SHAPES, TREE_CAPACITY } from "@/lib/christmas/types";
import { buildTreeModel, TREE_VARIANT_INFO, type TreeModel } from "./treeModel";
import { createOrnamentLayer, type OrnamentLayer } from "./ornamentLayer";
import { createTreeAura, type TreeAura } from "./treeAura";

// ห้องทดลองต้นคริสต์มาส: วางต้นทั้ง 3 แบบเทียบกันบนลานเดียวกัน แสงเดียวกับฉากจริง
// ปรับจำนวนลูกบอลและเปอร์เซ็นต์ออร่าได้ ใช้เลือกแบบก่อนใส่ในฉากหลัก

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ลูกบอลตัวอย่างแบบกำหนดค่าได้ (ทุกครั้งได้ชุดเดิม)
function sampleOrnaments(n: number): Ornament[] {
  const out: Ornament[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    out.push({
      id: `lab-${i}`,
      name: "ทดสอบ",
      wish: "",
      color: ORNAMENT_COLORS[Math.floor(rnd() * ORNAMENT_COLORS.length)],
      shape: ORNAMENT_SHAPES[Math.floor(rnd() * ORNAMENT_SHAPES.length)],
      height: 0.08 + rnd() * 0.86,
      angle: rnd() * Math.PI * 2,
      createdAt: 0,
    });
  }
  return out;
}

const SPACING = 5.4;

export default function TreeLab() {
  const mountRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ setCount: (n: number) => void; setAura: (p: number) => void; celebrate: () => void; focus: (i: number) => void } | null>(null);
  const [count, setCount] = useState(300);
  const [aura, setAura] = useState(0.45);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: !small });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x0c251d, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    scene.fog = new THREE.Fog(0x0c251d, 18, 60);

    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 3.4, small ? 22 : 15.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.2, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 2.5;
    controls.maxDistance = 40;

    scene.add(new THREE.AmbientLight(0x9fb8d6, 0.35));
    const key = new THREE.DirectionalLight(0xffe2b0, 1.4);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.8);
    rim.position.set(-7, 4, -5);
    scene.add(rim);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshStandardMaterial({ color: 0xeef4fa, roughness: 0.85 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const glowTex = glowTexture();
    const trees: { model: TreeModel; orn: OrnamentLayer; aura: TreeAura }[] = [];
    TREE_VARIANT_INFO.forEach((info, i) => {
      const x = (i - 1) * SPACING;
      const model = buildTreeModel({ variant: info.id, small, glowTex });
      model.group.position.x = x;
      scene.add(model.group);
      const orn = createOrnamentLayer({ capacity: TREE_CAPACITY });
      orn.group.position.x = x;
      scene.add(orn.group);
      const aura = createTreeAura({ small, pixelRatio: renderer.getPixelRatio() });
      aura.group.position.x = x;
      scene.add(aura.group);
      trees.push({ model, orn, aura });
    });

    const all = sampleOrnaments(TREE_CAPACITY);
    let camAnim: { from: THREE.Vector3; to: THREE.Vector3; ft: THREE.Vector3; tt: THREE.Vector3; start: number } | null = null;
    api.current = {
      setCount: (n) => trees.forEach((t) => t.orn.set(all.slice(0, n), false)),
      setAura: (p) => trees.forEach((t) => t.aura.setProgress(p)),
      celebrate: () => trees.forEach((t) => t.aura.celebrate()),
      focus: (i) => {
        const x = i < 0 ? 0 : (i - 1) * SPACING;
        const to = i < 0 ? new THREE.Vector3(0, 3.4, small ? 22 : 15.5) : new THREE.Vector3(x, 2.6, 7.2);
        camAnim = { from: camera.position.clone(), to, ft: controls.target.clone(), tt: new THREE.Vector3(x, 2.1, 0), start: performance.now() };
      },
    };
    api.current.setCount(300);
    api.current.setAura(0.45);

    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (camAnim) {
        const k = Math.min((now - camAnim.start) / 900, 1);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        camera.position.lerpVectors(camAnim.from, camAnim.to, e);
        controls.target.lerpVectors(camAnim.ft, camAnim.tt, e);
        if (k >= 1) camAnim = null;
      }
      controls.update();
      trees.forEach((tr) => {
        tr.model.update(t, false);
        tr.orn.update(now, t, false);
        tr.aura.update(dt, t, false);
      });
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      trees.forEach((tr) => {
        tr.model.dispose();
        tr.orn.dispose();
        tr.aura.dispose();
      });
      glowTex.dispose();
      pmrem.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c251d", color: "#f6f1e4", fontFamily: "system-ui, sans-serif" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <b style={{ marginRight: 8 }}>ห้องทดลองต้นคริสต์มาส</b>
        <button onClick={() => api.current?.focus(-1)} style={btn}>
          ดูทั้งหมด
        </button>
        {TREE_VARIANT_INFO.map((v, i) => (
          <button key={v.id} onClick={() => api.current?.focus(i)} style={btn} title={v.note}>
            {i + 1}. {v.name}
          </button>
        ))}
        <button onClick={() => api.current?.celebrate()} style={{ ...btn, background: "#c9a24a", color: "#13291f" }}>
          ทดสอบฉลอง 100%
        </button>
      </div>
      <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "grid", gap: 6, maxWidth: 460, background: "rgba(8,24,18,0.75)", padding: 12, borderRadius: 12 }}>
        <label>
          ลูกบอล {count} / {TREE_CAPACITY}
          <input
            type="range"
            min={0}
            max={TREE_CAPACITY}
            value={count}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCount(n);
              api.current?.setCount(n);
            }}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          ออร่า {Math.round(aura * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(aura * 100)}
            onChange={(e) => {
              const p = Number(e.target.value) / 100;
              setAura(p);
              api.current?.setAura(p);
            }}
            style={{ width: "100%" }}
          />
        </label>
      </div>
    </div>
  );
}

const btn: CSSProperties = { padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(242,217,140,0.5)", background: "rgba(8,24,18,0.75)", color: "#f6f1e4", cursor: "pointer", font: "inherit", fontSize: 13 };
