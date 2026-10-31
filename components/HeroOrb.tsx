"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ฉากหลัง: ลูกบอลกระจกใสนุ่มๆ ลอยตามจังหวะและขยับตามเมาส์
export function HeroOrb() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.z = 10;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xbfdcff, 2.2);
    key.position.set(3, 4, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0x7aa7ff, 40, 30);
    rim.position.set(-4, -2, 4);
    scene.add(rim);

    const palette = [0x3b9cff, 0x7c6cff, 0x6fe3ff];
    const orbs = palette.map((color, i) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.12,
        metalness: 0,
        transmission: 0.92,
        thickness: 1.4,
        ior: 1.35,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 6), mat);
      mesh.userData.home = new THREE.Vector3((i - 1) * 3.3, Math.sin(i * 1.7) * 0.9, -i * 0.5);
      mesh.userData.scale = 0.62 + i * 0.1;
      mesh.position.copy(mesh.userData.home);
      mesh.scale.setScalar(mesh.userData.scale);
      scene.add(mesh);
      return mesh;
    });

    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      const t = clock.getElapsedTime();
      orbs.forEach((mesh, i) => {
        const h = mesh.userData.home as THREE.Vector3;
        mesh.position.x = h.x + mx * 0.3 * (i + 1);
        mesh.position.y = h.y + Math.sin(t * 0.6 + i * 2) * 0.35 - my * 0.25 * (i + 1);
        mesh.rotation.y = t * 0.12 + i;
        mesh.rotation.x = Math.sin(t * 0.3 + i) * 0.2;
      });
      camera.position.x += (mx * 0.3 - camera.position.x) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    if (reduce) {
      renderer.render(scene, camera);
    } else {
      frame();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      orbs.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={wrapRef} className="hero-orb" aria-hidden />;
}
