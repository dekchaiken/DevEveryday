import type { MetadataRoute } from "next";

// แผนผังเว็บสำหรับเครื่องมือค้นหา ใช้โดเมนจาก NEXT_PUBLIC_SITE_URL ถ้ามี
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.8 },
  ];
}
