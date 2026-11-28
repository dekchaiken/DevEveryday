// วาดรูปตัวอย่างตุ๊กตาหิมะเป็นภาพนิ่ง (ใช้กับปุ่มตัวเลือกในหน้าตกแต่ง และการ์ดข้อมูลตุ๊กตา)
// ใช้ตัววาด WebGL ตัวเดียวร่วมกันทั้งหน้า วาดทีละรูปตอนเครื่องว่าง แล้วจำรูปไว้ (ไม่วาดซ้ำ)
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildSnowman, disposeSnowman } from "./snowmanModel";

export type SnowView = "full" | "head" | "face" | "body" | "feet";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const cache = new Map<string, string>();
const waiting = new Map<string, ((url: string) => void)[]>();
const queue: { key: string; parts: Record<string, string>; view: SnowView; size: number }[] = [];
let running = false;

function setup() {
  if (renderer) return true;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return false;
  }
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  const key = new THREE.DirectionalLight(0xfff0d8, 1.7);
  key.position.set(2, 4, 5);
  scene.add(key, new THREE.AmbientLight(0xb8c8e0, 0.5));
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  return true;
}

function frame(view: SnowView, a: { headY: number; headR: number; top: number }) {
  const cam = camera!;
  // มุมกล้องแต่ละแบบ: หัว (หมวก หน้า) ตัว (ผ้าพันคอ กระดุม) เท้า (ฐาน) หรือทั้งตัว
  if (view === "head") {
    const cy = a.headY + (a.top - a.headY) * 0.38;
    const d = Math.max(1.15, (a.top - a.headY + a.headR) * 2.6);
    cam.position.set(0.25, cy + 0.06, d);
    cam.lookAt(0, cy, 0);
  } else if (view === "face") {
    cam.position.set(0.12, a.headY + 0.04, 0.95);
    cam.lookAt(0, a.headY - 0.01, 0);
  } else if (view === "body") {
    cam.position.set(0.4, a.headY - 0.15, 2.4);
    cam.lookAt(0, a.headY - 0.32, 0);
  } else if (view === "feet") {
    cam.position.set(0.6, 0.75, 2.6);
    cam.lookAt(0, 0.32, 0);
  } else {
    const h = a.top;
    cam.position.set(0.7, h * 0.58, h * 1.62 + 0.35);
    cam.lookAt(0, h * 0.47, 0);
  }
}

function pump() {
  if (running) return;
  running = true;
  const step = () => {
    const job = queue.shift();
    if (!job) {
      running = false;
      return;
    }
    let url = "";
    if (setup() && renderer && scene && camera) {
      renderer.setSize(job.size, job.size, false);
      const model = buildSnowman(job.parts, { contact: job.view === "full" || job.view === "feet" });
      // หันเฉียงเล็กน้อยให้เห็นมิติ
      model.rotation.y = job.view === "face" ? -0.15 : -0.35;
      scene.add(model);
      frame(job.view, model.userData.anchors);
      renderer.render(scene, camera);
      url = renderer.domElement.toDataURL("image/png");
      scene.remove(model);
      disposeSnowman(model);
    }
    cache.set(job.key, url);
    (waiting.get(job.key) ?? []).forEach((cb) => cb(url));
    waiting.delete(job.key);
    // วาดทีละรูปตอนเครื่องว่าง หน้าจอจึงไม่สะดุด
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(step, { timeout: 120 });
    else setTimeout(step, 16);
  };
  step();
}

export function snowmanKey(parts: Record<string, string>, view: SnowView, size: number) {
  return `${view}|${size}|${Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("&")}`;
}

// ขอรูปตัวอย่าง: ถ้ามีในที่จำแล้วคืนทันที ไม่งั้นเข้าคิวแล้วเรียก cb เมื่อวาดเสร็จ
export function requestSnowmanImage(parts: Record<string, string>, view: SnowView, size: number, cb: (url: string) => void): string | null {
  const key = snowmanKey(parts, view, size);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const list = waiting.get(key);
  if (list) list.push(cb);
  else {
    waiting.set(key, [cb]);
    queue.push({ key, parts, view, size });
    pump();
  }
  return null;
}

// ตอนพัฒนา: เรียกวาดรูปตัวอย่างจากคอนโซลเพื่อตรวจมุมกล้อง
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __snowThumb?: unknown }).__snowThumb = requestSnowmanImage;
}
