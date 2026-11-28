// ฟอนต์ไทยสำหรับข้อความขึ้นจอ โหลดจาก Google Fonts ผ่าน next/font (เก็บไว้ในเว็บเราเอง ไม่ดึงจากภายนอกตอนใช้งาน)
// ไม่โหลดล่วงหน้า ฟอนต์จะดาวน์โหลดเมื่อถูกใช้ครั้งแรก (ตอนแต่งข้อความหรือมีข้อความขึ้นจอ)
import { Charm, Chonburi, Kanit, Mali, Sriracha } from "next/font/google";

const kanit = Kanit({ subsets: ["thai", "latin"], weight: ["600"], variable: "--font-sky-kanit", display: "swap", preload: false });
const mali = Mali({ subsets: ["thai", "latin"], weight: ["700"], variable: "--font-sky-mali", display: "swap", preload: false });
const sriracha = Sriracha({ subsets: ["thai", "latin"], weight: ["400"], variable: "--font-sky-sriracha", display: "swap", preload: false });
const chonburi = Chonburi({ subsets: ["thai", "latin"], weight: ["400"], variable: "--font-sky-chonburi", display: "swap", preload: false });
const charm = Charm({ subsets: ["thai", "latin"], weight: ["700"], variable: "--font-sky-charm", display: "swap", preload: false });

// ใส่คลาสตัวแปรฟอนต์ไว้ที่ <html> เพื่อให้ canvas อ่านชื่อฟอนต์จริงได้จากทุกที่ในหน้า
export const SKY_FONT_CLASSES = [kanit.variable, mali.variable, sriracha.variable, chonburi.variable, charm.variable];
