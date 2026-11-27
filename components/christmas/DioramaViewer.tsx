"use client";

// หน้าต่างตัวอย่างฐาน Exclusive แบบ 3 มิติ
// - ลากพื้นที่ว่างเพื่อหมุนดู (ไม่หมุนเองตอนไม่ได้กด)
// - แตะหรือลากชิ้นของเพื่อเลือกและย้ายตำแหน่งบนฐานอย่างอิสระ (ตรวจการชนและขอบฐานให้)
// - ปุ่มหมุนดู 90° สำหรับมือถือ และสลับมุมมองจากด้านบน
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { fits, type GiantLook } from "@/lib/christmas/giant";
import { buildDiorama, ITEM_Y, setSelectedRing } from "./diorama";
import { shade } from "./zoneScenery";

type Props = {
  look: GiantLook;
  name: string;
  message: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  // เรียกตอนปล่อยชิ้นที่ลาก (ระหว่างลากขยับในหน้าจอเองโดยไม่แตะข้อมูล)
  onMove: (id: string, x: number, z: number) => void;
};

type V3 = [number, number, number];
const SIDE_VIEW: { pos: V3; target: V3 } = { pos: [0, 1.5, 4.6], target: [0, 0.8, 0] };
const TOP_VIEW: { pos: V3; target: V3 } = { pos: [0, 4.2, 0.01], target: [0, 0.3, 0] };
const UP = new THREE.Vector3(0, 1, 0);

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

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function DioramaViewer({ look, name, message, selectedId, onSelect, onMove }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const spinRef = useRef(0); // มุมที่ยังต้องหมุนรอบแกนตั้ง (เรเดียน) จากปุ่มหมุนดู
  const [top, setTop] = useState(false);

  // ค่าล่าสุดสำหรับ listener ที่ผูกครั้งเดียว
  const latest = useRef({ look, selectedId, onSelect, onMove });
  latest.current = { look, selectedId, onSelect, onMove };

  // ตั้งฉาก กล้อง แสง และลูปการแสดงผลครั้งเดียว พร้อมการลาก/เลือกชิ้น
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
    const canvas = renderer.domElement;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(...SIDE_VIEW.pos);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(...SIDE_VIEW.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.5;
    cameraRef.current = camera;
    controlsRef.current = controls;

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

    const ground = new THREE.Mesh(new THREE.CircleGeometry(2.6, 56), new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- การเลือกและลากชิ้นบนฐาน ---
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(UP.clone(), -ITEM_Y);
    const hit = new THREE.Vector3();
    let drag: { id: string; pointerId: number; dx: number; dz: number; x: number; z: number; moved: boolean } | null = null;
    let tap: { x: number; y: number } | null = null;

    const aim = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    // หาชิ้นของที่อยู่ใต้ตัวชี้ (เดินขึ้นไปหากลุ่มที่มี itemId)
    const itemAt = (): string | null => {
      const content = contentRef.current;
      if (!content) return null;
      for (const h of ray.intersectObjects(content.children, true)) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (typeof o.userData.itemId === "string") return o.userData.itemId;
          o = o.parent;
        }
      }
      return null;
    };
    const itemGroup = (id: string) => contentRef.current?.children.find((c) => c.userData.itemId === id) ?? null;

    const onDown = (e: PointerEvent) => {
      aim(e);
      const id = itemAt();
      if (!id) {
        // แตะพื้นที่ว่าง: ถ้าไม่ลากก็จะยกเลิกการเลือกตอนปล่อย ส่วนการลากจะหมุนมุมมองตามปกติ
        tap = { x: e.clientX, y: e.clientY };
        return;
      }
      tap = null;
      const item = latest.current.look.items.find((i) => i.id === id);
      if (!item || !ray.ray.intersectPlane(plane, hit)) return;
      controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
      wrap.style.cursor = "grabbing";
      drag = { id, pointerId: e.pointerId, dx: item.x - hit.x, dz: item.z - hit.z, x: item.x, z: item.z, moved: false };
      latest.current.onSelect(id);
    };

    const onMoveEv = (e: PointerEvent) => {
      aim(e);
      if (!drag) {
        wrap.style.cursor = itemAt() ? "grab" : "";
        return;
      }
      if (e.pointerId !== drag.pointerId || !ray.ray.intersectPlane(plane, hit)) return;
      const d = drag;
      const { look: cur } = latest.current;
      const item = cur.items.find((i) => i.id === d.id);
      if (!item) return;
      const nx = hit.x + d.dx;
      const nz = hit.z + d.dz;
      // ไม่ให้ชิ้นออกนอกฐานหรือทับชิ้นอื่น: ถ้าตำแหน่งนี้ใช้ไม่ได้ก็คงตำแหน่งเดิมไว้
      if (!fits(cur.items, { kind: item.kind, x: nx, z: nz }, d.id)) return;
      d.x = nx;
      d.z = nz;
      d.moved = true;
      itemGroup(d.id)?.position.set(nx, ITEM_Y, nz);
    };

    const onUpEv = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.pointerId) {
        const d = drag;
        drag = null;
        controls.enabled = true;
        wrap.style.cursor = "";
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (d.moved) latest.current.onMove(d.id, round3(d.x), round3(d.z));
        return;
      }
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 6) latest.current.onSelect(null);
      tap = null;
    };

    // ดักตอนกดที่กรอบก่อนตัวควบคุมกล้องจะเริ่มหมุน
    wrap.addEventListener("pointerdown", onDown, { capture: true });
    canvas.addEventListener("pointermove", onMoveEv);
    canvas.addEventListener("pointerup", onUpEv);
    canvas.addEventListener("pointercancel", onUpEv);

    // --- ขนาดและลูปแสดงผล ---
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
    const loop = () => {
      // หมุนดูทีละ 90° ตามปุ่ม: ขยับทีละนิดต่อเฟรมให้ดูนุ่ม
      if (spinRef.current > 0.0001) {
        const step = Math.min(spinRef.current, 0.05);
        spinRef.current -= step;
        const off = camera.position.clone().sub(controls.target).applyAxisAngle(UP, step);
        camera.position.copy(controls.target).add(off);
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    sceneRef.current = scene;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointerdown", onDown, { capture: true });
      canvas.removeEventListener("pointermove", onMoveEv);
      canvas.removeEventListener("pointerup", onUpEv);
      canvas.removeEventListener("pointercancel", onUpEv);
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      canvas.remove();
      sceneRef.current = null;
      contentRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  // สร้างฐานและของใหม่ทุกครั้งที่ลุค ชื่อ หรือข้อความเปลี่ยน
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (contentRef.current) {
      scene.remove(contentRef.current);
      disposeTree(contentRef.current);
    }
    const fig = buildDiorama({ look, name, message });
    setSelectedRing(fig.group, latest.current.selectedId);
    scene.add(fig.group);
    contentRef.current = fig.group;
  }, [look, name, message]);

  // เปลี่ยนการเลือกแค่เปิดวงแหวน ไม่ต้องสร้างฉากใหม่
  useEffect(() => {
    if (contentRef.current) setSelectedRing(contentRef.current, selectedId);
  }, [selectedId]);

  // สลับมุมมองจากด้านบนกับมุมมอง 3 มิติ
  useEffect(() => {
    const cam = cameraRef.current;
    const ctl = controlsRef.current;
    if (!cam || !ctl) return;
    const v = top ? TOP_VIEW : SIDE_VIEW;
    cam.position.set(...v.pos);
    ctl.target.set(...v.target);
    ctl.update();
  }, [top]);

  return (
    <div className="xmas-viewer-box">
      <div ref={wrapRef} className="xmas-viewer" role="img" aria-label="ตัวอย่างฐาน Exclusive แบบ 3 มิติ ลากชิ้นของเพื่อย้ายตำแหน่ง" />
      <div className="xmas-viewer-tools">
        <button type="button" aria-pressed={top} onClick={() => setTop((t) => !t)}>
          {top ? "มุมมอง 3 มิติ" : "มุมมองจากด้านบน"}
        </button>
        <button type="button" onClick={() => (spinRef.current += Math.PI / 2)}>
          หมุนดู 90°
        </button>
      </div>
    </div>
  );
}
