// ประมวลผลรูปสินค้าในเบราว์เซอร์ของแอดมิน: ตรวจรูป ตัดพื้นหลัง และแนะนำจุดแขวน
// ใช้วิธี flood fill จากขอบรูป จึงเหมาะกับพื้นหลังเรียบ (ตามที่แนะนำตอนถ่าย)
// ไม่ใช้โมเดล AI ทำให้ไม่มีค่าใช้จ่ายต่อรูป และไม่มีไลบรารีที่ติดลิขสิทธิ์

export const MIN_SHORT_SIDE = 800;
export const MAX_PROCESS_SIDE = 1200;
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export type CheckResult = { errors: string[]; warnings: string[] };
export type Processed = {
  blob: Blob;
  preview: string; // data URL สำหรับแสดงผลก่อนอัปโหลด
  hook: { x: number; y: number };
  report: CheckResult;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("เปิดไฟล์รูปไม่ได้"));
    };
    img.src = url;
  });
}

// ย่อรูปให้ด้านยาวไม่เกินขนาดที่กำหนดแล้วคืน ImageData
function toImageData(img: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("ประมวลผลรูปบนเบราว์เซอร์นี้ไม่ได้");
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// ค่าสีมัธยฐานและความแปรปรวนของขอบรูป ใช้ตรวจว่าพื้นหลังเรียบหรือไม่
function borderStats(data: ImageData) {
  const { width: w, height: h, data: px } = data;
  const samples: [number, number, number][] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 60));
  for (let x = 0; x < w; x += step) {
    for (const y of [0, h - 1]) samples.push(pixel(px, w, x, y));
  }
  for (let y = 0; y < h; y += step) {
    for (const x of [0, w - 1]) samples.push(pixel(px, w, x, y));
  }
  const med = [0, 1, 2].map((c) => median(samples.map((s) => s[c])));
  const dists = samples.map((s) => dist(s, med as [number, number, number]));
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const sd = Math.sqrt(dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length);
  return { bg: med as [number, number, number], spread: sd };
}

function pixel(px: Uint8ClampedArray, w: number, x: number, y: number): [number, number, number] {
  const i = (y * w + x) * 4;
  return [px[i], px[i + 1], px[i + 2]];
}
function dist(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// flood fill จากขอบรูป: พิกเซลที่สีใกล้พื้นหลังและเชื่อมกับขอบเท่านั้นจะถูกตัดออก
function removeBg(data: ImageData, bg: [number, number, number]) {
  const { width: w, height: h, data: px } = data;
  const TOL = 42;
  const FEATHER = 22;
  const bgMask = new Uint8Array(w * h); // 1 = พื้นหลังที่เชื่อมกับขอบ
  const stack: number[] = [];
  const near = (i: number) => dist(pixel(px, w, i % w, Math.floor(i / w)), bg) <= TOL;

  const seed = (i: number) => {
    if (!bgMask[i] && near(i)) {
      bgMask[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }

  let removed = 0;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (bgMask[i]) {
      px[p + 3] = 0;
      removed++;
      continue;
    }
    // ขอบนุ่ม: พิกเซลที่สีใกล้พื้นหลังมากๆ ให้โปร่งบางลง
    const d = dist(pixel(px, w, i % w, Math.floor(i / w)), bg);
    if (d < TOL + FEATHER) px[p + 3] = Math.round(255 * Math.max(0, Math.min(1, (d - TOL) / FEATHER)));
  }
  return removed / (w * h);
}

// จุดแขวน: จุดกึ่งกลางบนของตัวเสื้อ คิดจากแถวบนสุดที่มีพิกเซลทึบพอสมควร
function suggestHook(data: ImageData) {
  const { width: w, height: h, data: px } = data;
  for (let y = 0; y < h; y++) {
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 128) {
        if (minX < 0) minX = x;
        maxX = x;
      }
    }
    if (minX >= 0 && maxX - minX > w * 0.08) {
      return { x: Math.round(((minX + maxX) / 2 / w) * 100), y: Math.round((y / h) * 100) };
    }
  }
  return { x: 50, y: 10 };
}

// ตรวจพื้นที่ของตัวเสื้อ: ตัวเล็กเกินไปหรือชิดขอบรูปมากไป
function coverage(data: ImageData) {
  const { width: w, height: h, data: px } = data;
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 128) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count === 0) return null;
  return {
    area: (maxX - minX + 1) * (maxY - minY + 1) / (w * h),
    touchesEdge: minX <= 1 || minY <= 1 || maxX >= w - 2 || maxY >= h - 2,
  };
}

// ตรวจรูปก่อนประมวลผล: ขนาด ชนิดไฟล์ และรูปแนวนอน
export function precheck(file: File): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) errors.push("รองรับเฉพาะ PNG, JPG และ WebP");
  if (file.size > MAX_INPUT_BYTES) errors.push("ไฟล์ใหญ่เกิน 8 MB");
  return { errors, warnings };
}

// ประมวลผลรูปเต็มขั้นตอน: ตรวจ ตัดพื้นหลัง หาจุดแขวน และคืน PNG โปร่งใส
export async function processProductImage(file: File): Promise<Processed> {
  const pre = precheck(file);
  if (pre.errors.length) throw new Error(pre.errors.join(" · "));

  const img = await loadImage(file);
  const shortSide = Math.min(img.naturalWidth, img.naturalHeight);
  const report: CheckResult = { errors: [], warnings: [] };
  if (shortSide < MIN_SHORT_SIDE) report.errors.push(`รูปเล็กเกินไป ด้านสั้นต้องอย่างน้อย ${MIN_SHORT_SIDE}px (ตอนนี้ ${shortSide}px)`);
  if (img.naturalWidth / img.naturalHeight > 1.3) report.warnings.push("ดูเป็นรูปแนวนอน ควรถ่ายแนวตั้งหรือสี่เหลี่ยมให้เสื้ออยู่กลางภาพ");

  const data = toImageData(img, MAX_PROCESS_SIDE);
  const { bg, spread } = borderStats(data);
  if (spread > 26) report.warnings.push("พื้นหลังไม่เรียบ ควรถ่ายหน้าพื้นสีเดียว เช่น ผ้าขาวหรือกระดาษสี");

  const removedShare = removeBg(data, bg);
  if (removedShare < 0.05) report.errors.push("หาตัวเสื้อจากพื้นหลังไม่เจอ ลองถ่ายให้พื้นหลังต่างจากสีเสื้อมากขึ้น");
  if (removedShare > 0.97) report.errors.push("ทั้งรูปถูกมองว่าเป็นพื้นหลัง ลองถ่ายใหม่ให้เสื้อชัดกว่าพื้นหลัง");

  const cov = coverage(data);
  if (cov && cov.area < 0.22) report.warnings.push("ตัวเสื้อเล็กในภาพ ควรถ่ายให้เสื้อเต็มกรอบมากขึ้น");
  if (cov && cov.touchesEdge) report.warnings.push("ตัวเสื้อชิดขอบรูป ควรเว้นระยะรอบตัวเสื้อ");

  const hook = suggestHook(data);

  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("บันทึกรูปไม่สำเร็จ"))), "image/png"),
  );
  return { blob, preview: canvas.toDataURL("image/png"), hook, report };
}
