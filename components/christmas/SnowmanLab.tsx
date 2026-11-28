"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { optionsOf, randomSnow, SNOW_PART_KEYS, type SnowPartKey } from "@/lib/christmas/snowman";
import { buildSnowman } from "./snowmanModel";
import { buildDiorama } from "./diorama";
import { makeItem, type GiantLook } from "@/lib/christmas/giant";

// หน้าตรวจโมเดล: แถวบนเรียงตัวเลือกของชิ้นที่ระบุใน ?part= (ค่าเริ่มต้น hat) แถวล่างเป็นชุดสุ่ม
export default function SnowmanLab() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x173b30);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xfff0d8, 1.6);
    key.position.set(3, 6, 5);
    key.castShadow = true;
    scene.add(key, new THREE.AmbientLight(0x9fb8d6, 0.4));
    const params = new URLSearchParams(location.search);
    const updates: ((t: number, r: boolean) => void)[] = [];
    if (params.get("ex")) {
      // บ้าน Exclusive ทุกแบบ พร้อมรั้วต่างกัน และของตกแต่งใหม่วางหน้าบ้าน
      const styles = ["cottage", "cabin", "gingerbread", "igloo"];
      const fences = ["candy", "picket", "lights", "hedge"];
      const kinds = [
        ["reindeer", "lamppost", "giftstack"],
        ["sled", "nutcracker", "bench"],
        ["snowman", "pine", "candy"],
        ["lantern", "reindeer", "bauble"],
      ];
      styles.forEach((house, i) => {
        const items = kinds[i].map((k, j) => makeItem(`i${j}`, k, -0.6 + j * 0.6, 0.6 + (j % 2) * 0.15));
        const look: GiantLook = { base: ["red", "mint", "pink", "blue"][i], items, board: "spruce", house, wall: ["cream", "wood", "pink", "sky"][i], roof: ["red", "forest", "berry", "navy"][i], fence: fences[i] };
        const d = buildDiorama({ look, name: "ทดสอบ", message: "สุขสันต์วันคริสต์มาส" });
        d.group.position.set(-4.5 + i * 3, 0, 0);
        scene.add(d.group);
        updates.push(d.update);
      });
      const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
      void cam;
    } else {
    const part = (params.get("part") ?? "hat") as SnowPartKey;
    const list: Record<string, string>[] = [];
    if (SNOW_PART_KEYS.includes(part)) for (const [v] of optionsOf(part)) list.push({ [part]: v });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 8; i++) list.push(randomSnow(rnd));
    const perRow = Math.max(6, Math.ceil(list.length / 2));
    list.forEach((p, i) => {
      const s = buildSnowman(p);
      const row = Math.floor(i / perRow);
      s.position.set((i % perRow) * 1.25 - (perRow * 1.25) / 2 + 0.6, 0, -row * 2.2);
      scene.add(s);
    });
    }
    const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 3, 9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, -1);
    controls.update();
    (window as unknown as { __labView?: unknown }).__labView = (x: number, y: number, z: number, tx: number, ty: number, tz: number) => {
      camera.position.set(x, y, z);
      controls.target.set(tx, ty, tz);
      controls.update();
    };
    let raf = 0;
    const loop = () => {
      const t = performance.now() / 1000;
      updates.forEach((u) => u(t, false));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div ref={ref} style={{ position: "fixed", inset: 0 }} />;
}
