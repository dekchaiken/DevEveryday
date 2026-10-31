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

export type Content = {
  site: SiteInfo;
  stack: string[];
  projects: Project[];
  services: Service[];
  plans: Plan[];
  process: Step[];
  team: Member[];
  contact: { types: string[] };
};
