// ออร่าความคืบหน้าของต้น: ประกายทอง ชมพู และฟ้า หมุนเกลียวรอบต้นและไต่จากโคนขึ้นไปถึงระดับเปอร์เซ็นต์ที่แขวนแล้ว
// มีวงแสงบนพื้นรอบโคนต้นที่สว่างขึ้นตามความคืบหน้า และโหมดฉลองเมื่อครบ 100%
// ทั้งหมดคำนวณใน shader จึงเป็นการวาดเพียงไม่กี่ครั้งต่อเฟรม
import * as THREE from "three";
import { TREE_BASE_Y, TREE_H, TREE_R0 } from "./geometry";

export type TreeAura = {
  group: THREE.Group;
  setProgress: (p: number, instant?: boolean) => void;
  celebrate: () => void;
  update: (dt: number, t: number, reduced: boolean) => void;
  dispose: () => void;
};

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uCelebrate;
  uniform float uPixel;
  attribute float aH;
  attribute float aA;
  attribute float aR;
  attribute float aSeed;
  varying float vAlpha;
  varying vec3 vColor;
  const float H = ${TREE_H.toFixed(3)};
  const float BASE = ${TREE_BASE_Y.toFixed(3)};
  const float R0 = ${TREE_R0.toFixed(3)};
  void main() {
    float speed = 0.035 + aSeed * 0.05;
    // ประกายไต่จากโคนขึ้นไปเรื่อย ๆ แล้ววนกลับมาที่โคน แต่ไม่เกินระดับความคืบหน้า
    float cycle = fract(aH + uTime * speed);
    float top = max(uProgress, 0.0001);
    float h = cycle * top;
    float ang = aA + h * 7.0 + uTime * (0.25 + aSeed * 0.2);
    float rad = (R0 * pow(max(1.0 - h, 0.0), 0.92) + 0.04) * (1.1 + aR * 0.16) + uCelebrate * (0.35 + aSeed * 0.6);
    vec3 pos = vec3(cos(ang) * rad, BASE + h * H + sin(uTime * 3.0 + aSeed * 20.0) * 0.03, sin(ang) * rad);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // ประกายบริเวณแนวหน้าสุด (ใกล้ระดับเปอร์เซ็นต์) สว่างที่สุด
    float front = smoothstep(top - 0.12, top, h);
    float fadeIn = smoothstep(0.0, 0.06, cycle);
    float fadeOut = 1.0 - smoothstep(0.92, 1.0, cycle);
    float twinkle = 0.55 + 0.45 * sin(uTime * (3.0 + aSeed * 4.0) + aSeed * 40.0);
    vAlpha = (0.35 + front * 0.9 + uCelebrate * 0.8) * fadeIn * fadeOut * twinkle * step(0.002, uProgress);
    vec3 gold = vec3(1.0, 0.74, 0.22);
    vec3 rose = vec3(1.0, 0.38, 0.6);
    vec3 ice = vec3(0.4, 0.78, 1.0);
    vColor = aSeed < 0.6 ? gold : (aSeed < 0.82 ? rose : ice);
    float size = (0.085 + aSeed * 0.08) * (1.0 + front * 0.9 + uCelebrate * 1.4);
    gl_PointSize = size * uPixel / max(-mv.z, 0.1);
  }
`;

// ชั้นสี: ผสมแบบปกติ จึงเห็นประกายสีทอง ชมพู ฟ้า ได้แม้อยู่หน้าหิมะสีขาว
const FRAG_COLOR = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * 1.15, a * vAlpha * 0.75);
  }
`;
// ชั้นแกน: บวกแสง ทำให้กลางประกายสว่างเรืองเหมือนมีแสงจริง
const FRAG_CORE = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.22, 0.0, d);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.55) * core, core * vAlpha);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uCelebrate;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    // วงแสงบาง ๆ รอบโคนต้น มีคลื่นแสงวิ่งออกไปเบา ๆ
    float ring = smoothstep(0.62, 0.78, r) * (1.0 - smoothstep(0.82, 1.0, r));
    float wave = 0.5 + 0.5 * sin(r * 18.0 - uTime * 2.2);
    float a = ring * (0.25 + 0.75 * wave) * (0.04 + uProgress * 0.96) + uCelebrate * smoothstep(1.0, 0.3, r) * 0.6;
    vec3 col = mix(vec3(1.0, 0.7, 0.2), vec3(1.0, 0.86, 0.5), wave);
    gl_FragColor = vec4(col, min(a, 1.0) * 0.6);
  }
`;

export function createTreeAura(opts: { small: boolean; pixelRatio: number }): TreeAura {
  const N = opts.small ? 900 : 1700;
  const aH = new Float32Array(N);
  const aA = new Float32Array(N);
  const aR = new Float32Array(N);
  const aSeed = new Float32Array(N);
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    aH[i] = Math.random();
    aA[i] = Math.random() * Math.PI * 2;
    aR[i] = Math.random();
    aSeed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aH", new THREE.BufferAttribute(aH, 1));
  geo.setAttribute("aA", new THREE.BufferAttribute(aA, 1));
  geo.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uCelebrate: { value: 0 },
    uPixel: { value: 420 * opts.pixelRatio },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_COLOR, uniforms, transparent: true, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const coreMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_CORE, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const corePoints = new THREE.Points(geo, coreMat);
  corePoints.frustumCulled = false;

  // วงแสงทองรอบต้นที่ระดับความคืบหน้าปัจจุบัน ไต่ขึ้นทุกครั้งที่มีคนแขวน
  const frontGeo = new THREE.TorusGeometry(1, 0.022, 8, 96);
  frontGeo.rotateX(Math.PI / 2);
  const frontMat = new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.9, toneMapped: false });
  const front = new THREE.Mesh(frontGeo, frontMat);
  const frontGlowGeo = new THREE.TorusGeometry(1, 0.075, 8, 96);
  frontGlowGeo.rotateX(Math.PI / 2);
  const frontGlowMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const frontGlow = new THREE.Mesh(frontGlowGeo, frontGlowMat);

  const ringUniforms = { uTime: uniforms.uTime, uProgress: uniforms.uProgress, uCelebrate: uniforms.uCelebrate };
  const ringMat = new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: RING_FRAG,
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
  });
  const ringGeo = new THREE.PlaneGeometry(5.2, 5.2);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.03;
  ring.renderOrder = 2;

  const group = new THREE.Group();
  group.add(points, corePoints, front, frontGlow, ring);

  let target = 0;
  let celebrateAt = -1;
  let clock = 0;

  return {
    group,
    setProgress(p, instant) {
      target = Math.min(Math.max(p, 0), 1);
      if (instant) uniforms.uProgress.value = target;
    },
    celebrate() {
      celebrateAt = clock;
    },
    update(dt, t, reduced) {
      clock = t;
      uniforms.uTime.value = reduced ? t * 0.3 : t;
      // ค่อย ๆ ไต่ขึ้นไปหาระดับใหม่ (ไม่กระโดด) ให้เห็นว่าออร่าเพิ่มขึ้นทุกครั้งที่มีคนแขวน
      const cur = uniforms.uProgress.value;
      uniforms.uProgress.value = cur + (target - cur) * Math.min(1, dt * 1.6);
      // วงแสงระดับความคืบหน้า: แสดงเฉพาะตอนยังไม่ครบ ขยับตามความสูงจริงของพุ่ม
      const p = uniforms.uProgress.value;
      const showFront = p > 0.004 && p < 0.995;
      front.visible = showFront;
      frontGlow.visible = showFront;
      if (showFront) {
        const y = TREE_BASE_Y + p * TREE_H;
        const rr = (TREE_R0 * Math.pow(Math.max(1 - p, 0), 0.92) + 0.04) * 1.1;
        const pulse = reduced ? 1 : 1 + 0.03 * Math.sin(t * 3);
        front.position.y = y;
        frontGlow.position.y = y;
        front.scale.setScalar(rr * pulse);
        frontGlow.scale.setScalar(rr * pulse);
        frontGlowMat.opacity = 0.22 + (reduced ? 0 : 0.1 * Math.sin(t * 3));
      }
      if (celebrateAt >= 0) {
        const k = t - celebrateAt;
        // พุ่งออกแรงช่วงแรก แล้วค่อย ๆ กลับเป็นเกลียวเต็มต้น (ราว 8 วินาที)
        uniforms.uCelebrate.value = k < 8 ? Math.sin(Math.min(k / 8, 1) * Math.PI) * (k < 1 ? k : 1) : 0;
        if (k >= 8) celebrateAt = -1;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      coreMat.dispose();
      frontGeo.dispose();
      frontMat.dispose();
      frontGlowGeo.dispose();
      frontGlowMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
