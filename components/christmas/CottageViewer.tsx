"use client";

// หน้าต่างตัวอย่างบ้าน Exclusive แบบ 3 มิติ: หมุนดูได้ ปรับตามสี ของตกแต่ง และข้อความที่กรอก
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GiantLook } from "@/lib/christmas/giant";
import { buildGiantFigure } from "./giantSign";
import { shade } from "./zoneScenery";

type Updatable = { update: (t: number, reduced: boolean) => void };

// คืนหน่วยความจำของทุกชิ้นในกลุ่ม (รูปทรง วัสดุ และเท็กซ์เจอร์)
function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
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

export function CottageViewer({ look, name, message }: { look: GiantLook; name: string; message: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const figureRef = useRef<Updatable | null>(null);
  const reducedRef = useRef(false);

  // ตั้งฉาก กล้อง แสง และลูปการแสดงผลครั้งเดียว
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // เครื่องที่ไม่รองรับ WebGL จะไม่แสดงตัวอย่าง 3 มิติ
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 1.9, 7.9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.25, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4.6;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.5;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa8c8, 1.2));
    const key = new THREE.DirectionalLight(0xffe2b0, 1.7);
    key.position.set(3, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.35);
    fill.position.set(-4, 3, -2);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(4.2, 56), new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedRef.current = reduced;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 1.1;

    const resize = () => {
      const w = wrap.clientWidth || 1;
      const h = wrap.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let raf = 0;
    const started = performance.now();
    const loop = () => {
      const t = (performance.now() - started) / 1000;
      figureRef.current?.update(t, reducedRef.current);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    sceneRef.current = scene;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      contentRef.current = null;
      figureRef.current = null;
    };
  }, []);

  // สร้างบ้านและป้ายใหม่ทุกครั้งที่ลุคหรือข้อความเปลี่ยน
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (contentRef.current) {
      scene.remove(contentRef.current);
      disposeTree(contentRef.current);
    }
    const fig = buildGiantFigure({ look, name, message, side: 1 });
    const group = new THREE.Group();
    group.add(shade(fig.group));
    scene.add(group);
    contentRef.current = group;
    figureRef.current = fig;
  }, [look, name, message]);

  return <div ref={wrapRef} className="xmas-viewer" role="img" aria-label="ตัวอย่างบ้านหิมะ Exclusive แบบ 3 มิติ หมุนดูได้" />;
}
