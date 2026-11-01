export type HistoryItem = {
  year: string;
  title: string;
  detail: string;
};

export type Member = {
  id: string;
  name: string;
  role: string;
  bio: string;
  skills: string[];
  color: string;
  joinedAt: string; // YYYY-MM-DD
  isNew: boolean;
  history: HistoryItem[];
};

export type Service = {
  id: string;
  title: string;
  description: string;
  eta: string;
};

export type Plan = {
  id: string;
  name: string;
  price: string;
  unit: string;
  highlight: boolean;
  features: string[];
};

export type Step = {
  id: string;
  title: string;
  description: string;
};

export type SiteInfo = {
  name: string;
  tagline: string;
  headline: string;
  subheadline: string;
  badge: string;
  ctaPrimary: string;
  ctaSecondary: string;
  email: string;
  footer: string;
};

// ธุรกิจอื่นภายใต้ทีม DevEveryday ที่แสดงเป็นการ์ดลิงก์ไปยังเว็บของธุรกิจนั้น
export type Brand = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string; // https://... ไปยังเว็บของธุรกิจนั้น
  image: string; // "/uploads/..." รูปโลโก้หรือรูปปก (ว่างได้)
  color: string; // #rrggbb สีประจำธุรกิจ
  icon: BrandIcon; // ไอคอน SVG ที่แสดงบนการ์ดเมื่อไม่มีรูป
};

export const BRAND_ICONS = ["shirt", "store", "code", "coffee", "globe", "spark"] as const;
export type BrandIcon = (typeof BRAND_ICONS)[number];

export type Project = {
  id: string;
  title: string;
  client: string;
  category: string;
  description: string;
  tags: string[];
  url: string; // ลิงก์ไปเว็บงาน (ว่างได้)
  image: string; // "/uploads/..." จากหน้า admin หรือว่างไว้ให้ระบบวาดพรีวิวให้
  color: string; // #rrggbb ใช้เป็นสีหลักของ mockup
  featured: boolean; // การ์ดใหญ่ 2 คอลัมน์
  serviceId: string; // id ของบริการที่ผลงานนี้เกี่ยวข้อง (ว่างได้)
  demoUrl: string; // ลิงก์ demo ที่ deploy แยกไว้ (ว่างได้) จะฝังใน iframe ตอนกดดู
  frame: "browser" | "phone"; // กรอบที่ใช้แสดง demo
};

// เทศกาลของหน้าแรก: เกิดซ้ำทุกปีตาม MM-DD เปลี่ยนสีหลักและแสดงแถบประกาศอัตโนมัติ
export type LandingSeason = {
  id: string;
  name: string;
  start: string; // MM-DD
  end: string; // MM-DD
  active: boolean;
  accent: string; // #rrggbb
  badge: string; // ข้อความป้ายเล็กบนหัวข้อ
  announcement: string; // แถบประกาศด้านบนสุด
  decor: string; // ชุดตกแต่ง: none | halloween
  dark: boolean; // ใช้พาเลทมืดของเทศกาลนั้น
};

export type Reason = { title: string; description: string };

export type Content = {
  seasons: LandingSeason[];
  reasons: Reason[];
  site: SiteInfo;
  stack: string[];
  brands: Brand[];
  projects: Project[];
  services: Service[];
  plans: Plan[];
  process: Step[];
  team: Member[];
  contact: { types: string[] };
};
