import type { MetadataRoute } from "next";

// ไม่ให้เครื่องมือค้นหาเข้าหน้าแอดมินและ API
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
