"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { SnowParts } from "@/lib/christmas/snowman";
import { buildSnowman, disposeSnowman } from "./snowmanModel";
import { requestSnowmanImage, type SnowView } from "./snowmanRender";

// ตัวอย่างตุ๊กตาหิมะแบบ 3 มิติที่หมุนดูได้ (ลากเพื่อหมุน ปล่อยแล้วหมุนช้า ๆ เอง)
// focus: ซูมไปที่ส่วนที่กำลังแต่ง (หัว ตัว หรือทั้งตัว) ให้เห็นผลชัด
export function Snowman3D({ parts, focus = "full", className }: { parts: SnowParts; focus?: "full" | "head" | "body"; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ set: (p: SnowParts) => void; focus: (f: string) => void } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y";

    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.65;
    const key = new THREE.DirectionalLight(0xfff0d8, 1.8);
    key.position.set(2.5, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.5;
    key.shadow.camera.right = 1.5;
    key.shadow.camera.top = 2.5;
    key.shadow.camera.bottom = -0.5;
    key.shadow.bias = -0.0005;
    scene.add(key, new THREE.AmbientLight(0xb8c8e0, 0.45));
    const rim = new THREE.DirectionalLight(0x9fd8ff, 0.8);
    rim.position.set(-3, 2.5, -3);
    scene.add(rim);
    // พื้นหิมะกลมรับเงา
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: 0.22 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
    const holder = new THREE.Group();
    scene.add(holder);
    let model: ReturnType<typeof buildSnowman> | null = null;
    let anchors = { headY: 1.36, headR: 0.215, top: 1.9 };
    const camPos = new THREE.Vector3(0, 1.3, 5);
    const camTgt = new THREE.Vector3(0, 0.95, 0);
    const wantPos = camPos.clone();
    const wantTgt = camTgt.clone();
    let focusNow = "full";
    const aim = () => {
      const a = anchors;
      if (focusNow === "head") {
        wantTgt.set(0, a.headY + 0.08, 0);
        wantPos.set(0, a.headY + 0.25, 2.2);
      } else if (focusNow === "body") {
        wantTgt.set(0, a.headY - 0.3, 0);
        wantPos.set(0, a.headY - 0.05, 3.0);
      } else {
        wantTgt.set(0, a.top * 0.48, 0);
        wantPos.set(0, a.top * 0.62, a.top * 2.3 + 0.7);
      }
    };
    const set = (p: SnowParts) => {
      if (model) {
        holder.remove(model);
        disposeSnowman(model);
      }
      model = buildSnowman(p);
      model.traverse((o) => {
        o.castShadow = true;
      });
      holder.add(model);
      anchors = model.userData.anchors;
      aim();
    };
    api.current = {
      set,
      focus: (f) => {
        focusNow = f;
        aim();
      },
    };

    // ลากเพื่อหมุน
    let dragging = false;
    let lastX = 0;
    let spin = 0.35;
    let idleAt = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      spin += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
      idleAt = performance.now();
    };
    const up = () => (dragging = false);
    renderer.domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging && !reduce && now - idleAt > 2500) spin += dt * 0.35;
      holder.rotation.y += (spin - holder.rotation.y) * Math.min(1, dt * 8);
      camPos.lerp(wantPos, Math.min(1, dt * 5));
      camTgt.lerp(wantTgt, Math.min(1, dt * 5));
      camera.position.copy(camPos);
      camera.lookAt(camTgt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (model) disposeSnowman(model);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      env.dispose();
      pm.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.set(parts);
  }, [parts]);
  useEffect(() => {
    api.current?.focus(focus);
  }, [focus]);

  return <div ref={mountRef} className={className} aria-label="ตัวอย่างตุ๊กตาหิมะ ลากเพื่อหมุนดู" role="img" />;
}

// รูปตัวอย่างนิ่ง (ใช้ในการ์ดข้อมูลและปุ่มตัวเลือก) วาดครั้งเดียวแล้วจำไว้
export function SnowmanImage({ parts, view = "full", size = 256, className, alt = "" }: { parts: Record<string, string>; view?: SnowView; size?: number; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const key = JSON.stringify(parts) + view + size;
  useEffect(() => {
    let alive = true;
    const hit = requestSnowmanImage(parts, view, size, (u) => alive && setUrl(u));
    setUrl(hit);
    return () => {
      alive = false;
    };
    // key รวมค่าทุกอย่างที่ใช้วาดแล้ว
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url ? <img src={url} alt={alt} className={className} draggable={false} /> : <span className={`${className ?? ""} is-loading`} aria-hidden />;
}
