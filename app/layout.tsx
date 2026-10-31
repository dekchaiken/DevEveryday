import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ReturnTransition } from "@/components/ReturnTransition";

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-thai",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevEveryday · รับทำเว็บไซต์และแอปพลิเคชัน",
  description: "ทีมพัฒนาที่รับทำ Landing Page, เว็บองค์กร, Web App, E-commerce และระบบ API",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// ตั้งธีมก่อนแสดงผลเพื่อไม่ให้กระพริบ: ใช้ค่าที่เคยเลือกไว้ ไม่งั้นใช้ตามระบบ
// หน้าแรกล็อกการเลื่อนไว้ก่อนระหว่างที่ loader กำลังแสดง (Loader จะปลดล็อกเอง)
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}try{if(location.pathname==='/'){document.documentElement.classList.add('is-loading')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plexThai.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ReturnTransition name="DevEveryday" />
        {children}
      </body>
    </html>
  );
}
