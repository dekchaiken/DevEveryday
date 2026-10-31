import * as simple from "simple-icons";

// ไอคอนเทคโนโลยีมาจาก simple-icons (SVG path ล้วน) ใช้ได้เฉพาะฝั่ง server
// หน้า admin พิมพ์ชื่อเทคโนโลยีอะไรก็ได้ ระบบจะหาไอคอนที่ชื่อตรงกันให้เอง
type SimpleIcon = { title: string; slug: string; path: string };

const ICONS = (Object.values(simple) as unknown[]).filter(
  (v): v is SimpleIcon => typeof v === "object" && v !== null && "path" in v && "title" in v,
);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findTechIcon(name: string): { path: string } | null {
  const key = norm(name);
  if (!key) return null;

  const exact = ICONS.find((i) => norm(i.title) === key || i.slug === key);
  if (exact) return { path: exact.path };

  // รองรับชื่อสั้นๆ เช่น "Tailwind" -> Tailwind CSS (ต้องยาวอย่างน้อย 4 ตัว กันการจับคู่มั่ว)
  if (key.length >= 4) {
    const loose = ICONS.find((i) => norm(i.slug).startsWith(key));
    if (loose) return { path: loose.path };
  }

  return null;
}
