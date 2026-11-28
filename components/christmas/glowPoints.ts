// จุดแสงฟุ้งที่กะพริบเองบนการ์ดจอ (ไม่ต้องอัปเดตสีทุกเฟรมด้วย CPU)
// ใช้กับไฟประดับ หลอดไฟตามกำแพง และประกายแสงที่ลอยขึ้นช้า ๆ
import * as THREE from "three";

const VERT = `
attribute vec3 color;
attribute float phase;
uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uRise;
uniform float uRiseH;
uniform float uTwinkle;
varying vec3 vColor;
varying float vA;
void main() {
  vec3 p = position;
  if (uRise > 0.0) {
    float h = mod(p.y + uTime * uRise, uRiseH);
    p.x += sin(uTime * 0.5 + phase * 3.0) * 0.3;
    p.z += cos(uTime * 0.4 + phase * 2.0) * 0.3;
    vA = smoothstep(0.0, 0.6, h) * (1.0 - smoothstep(uRiseH - 1.2, uRiseH, h));
    p.y = h + 0.2;
  } else {
    vA = 1.0 - uTwinkle * 0.45 * (1.0 - max(0.0, sin(uTime * 2.2 + phase)));
  }
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec3 vColor;
varying float vA;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vA * uOpacity);
}`;

export type GlowPoints = { points: THREE.Points; setTime: (t: number, reduced: boolean) => void; dispose: () => void };

export function glowPoints(opts: {
  positions: ArrayLike<number>;
  colors: ArrayLike<number>;
  size: number;
  map: THREE.Texture;
  opacity?: number;
  rise?: number; // ความเร็วลอยขึ้น (0 = อยู่กับที่ กะพริบแทน)
  riseHeight?: number;
  twinkle?: number; // 0–1 ความแรงของการกะพริบ
}): GlowPoints {
  const n = opts.positions.length / 3;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(Array.from(opts.positions), 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(Array.from(opts.colors), 3));
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) phase[i] = (i * 2.399) % (Math.PI * 2);
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: opts.size },
    uScale: { value: (typeof window === "undefined" ? 800 : window.innerHeight) * 0.5 * dpr },
    uRise: { value: opts.rise ?? 0 },
    uRiseH: { value: opts.riseHeight ?? 5 },
    uTwinkle: { value: opts.twinkle ?? 1 },
    uMap: { value: opts.map },
    uOpacity: { value: opts.opacity ?? 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const onResize = () => (uniforms.uScale.value = window.innerHeight * 0.5 * Math.min(window.devicePixelRatio || 1, 1.5));
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);
  return {
    points,
    setTime(t, reduced) {
      uniforms.uTime.value = reduced ? 0 : t;
    },
    dispose() {
      if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
      geo.dispose();
      mat.dispose();
    },
  };
}
