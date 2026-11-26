// ลิงก์โซเชียลของผู้เยี่ยมชม (Instagram / Facebook) ใช้ร่วมกันทั้งเบราว์เซอร์และเซิร์ฟเวอร์
// เก็บเฉพาะชื่อผู้ใช้ (username) ไม่เก็บ URL ที่พิมพ์มาเอง เพื่อให้ลิงก์ที่แสดงเป็นลิงก์ที่เราสร้างเอง
// ผู้ใช้พิมพ์ได้ทั้ง @ชื่อ, ชื่อผู้ใช้เฉยๆ หรือวางลิงก์เต็ม

export type Social = {
  ig?: string; // username ของ Instagram (ลิงก์ได้เสมอ)
  fb?: string; // username หรือ id ของ Facebook (ลิงก์ได้)
  fbText?: string; // ชื่อที่แสดงบน Facebook ที่พิมพ์มาเป็นชื่อเฉยๆ (แสดงเป็นข้อความ ไม่มีลิงก์)
};

const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
const FB_USER_RE = /^[A-Za-z0-9.]{5,50}$/;
const FB_ID_RE = /^\d{5,20}$/;
const IG_RESERVED = ["p", "reel", "reels", "stories", "explore", "accounts", "direct"];

export type SocialParse = { value?: string; text?: string; error?: string };

// แยกชื่อผู้ใช้ออกจากลิงก์ (ถ้าเป็นลิงก์) โดยต้องเป็นโดเมนของแพลตฟอร์มนั้นเท่านั้น
function urlPath(raw: string, domains: string[]): { path: string; search: URLSearchParams } | null | "wrong" {
  // ถือเป็นลิงก์เฉพาะเมื่อมี http(s):// หรือมีชื่อโดเมนของแพลตฟอร์มอยู่ มิฉะนั้นเป็นชื่อผู้ใช้ เช่น fah.kim
  if (!/^https?:\/\//i.test(raw) && !/(instagram|facebook|fb)\.com/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!domains.some((d) => host === d || host.endsWith(`.${d}`))) return "wrong";
  return { path: url.pathname.split("/").filter(Boolean)[0] ?? "", search: url.searchParams };
}

export function parseIg(raw: string): SocialParse {
  const s = raw.trim();
  if (!s) return {};
  const u = urlPath(s, ["instagram.com"]);
  if (u === "wrong") return { error: "ลิงก์ Instagram ไม่ถูกต้อง" };
  const name = u ? u.path : s.replace(/^@/, "");
  if (!IG_RE.test(name) || IG_RESERVED.includes(name.toLowerCase())) {
    return { error: "Instagram ใช้ได้เฉพาะ a–z 0–9 จุด และขีดล่าง (ไม่เกิน 30 ตัว)" };
  }
  return { value: name };
}

export function parseFb(raw: string): SocialParse {
  const s = raw.trim();
  if (!s) return {};
  const u = urlPath(s, ["facebook.com", "fb.com"]);
  if (u === "wrong") return { error: "ลิงก์ Facebook ไม่ถูกต้อง" };
  if (u) {
    const id = u.search.get("id");
    if (u.path === "profile.php" && id && FB_ID_RE.test(id)) return { value: id };
    if (FB_USER_RE.test(u.path)) return { value: u.path };
    return { error: "ลิงก์ Facebook ไม่ถูกต้อง ลองวางลิงก์โปรไฟล์หรือพิมพ์ชื่อผู้ใช้" };
  }
  // ชื่อผู้ใช้แบบอักษรอังกฤษ/ตัวเลขล้วน ลิงก์ได้; ชื่อแสดงผลอื่น (มีเว้นวรรค ภาษาไทย) แสดงเป็นข้อความ
  const user = s.replace(/^@/, "");
  if (FB_USER_RE.test(user)) return { value: user };
  return { text: s.slice(0, 50) };
}

// สร้างค่าที่จะส่งไปเก็บ จากข้อความที่ผู้ใช้พิมพ์ทั้งสองช่อง
export function buildSocial(ig: string, fb: string): { social: Social; error?: string } {
  const a = parseIg(ig);
  if (a.error) return { social: {}, error: a.error };
  const b = parseFb(fb);
  if (b.error) return { social: {}, error: b.error };
  const social: Social = {};
  if (a.value) social.ig = a.value;
  if (b.value) social.fb = b.value;
  if (b.text) social.fbText = b.text;
  return { social };
}

// ทำความสะอาดข้อมูลที่รับจากหน้าเว็บ (ใช้ทั้งฝั่งเซิร์ฟเวอร์) คืนเฉพาะฟิลด์ที่ถูกต้อง
export function sanitizeSocial(v: unknown, isBlocked: (s: string) => boolean = () => false): Social {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: Social = {};
  if (typeof o.ig === "string" && IG_RE.test(o.ig)) out.ig = o.ig;
  if (typeof o.fb === "string" && (FB_USER_RE.test(o.fb) || FB_ID_RE.test(o.fb))) out.fb = o.fb;
  if (typeof o.fbText === "string") {
    const t = o.fbText.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
    if (t && !isBlocked(t)) out.fbText = t;
  }
  return out;
}

export type SocialLink = { key: string; label: string; href?: string };

// รายการที่จะแสดงเป็นลิงก์ (href สร้างจาก username เท่านั้น จึงไม่มีลิงก์แปลกปลอม)
export function socialLinks(s?: Social | null): SocialLink[] {
  if (!s) return [];
  const out: SocialLink[] = [];
  if (s.ig) out.push({ key: "ig", label: `@${s.ig}`, href: `https://www.instagram.com/${s.ig}/` });
  if (s.fb) {
    const href = FB_ID_RE.test(s.fb) ? `https://www.facebook.com/profile.php?id=${s.fb}` : `https://www.facebook.com/${s.fb}`;
    out.push({ key: "fb", label: FB_ID_RE.test(s.fb) ? "Facebook" : `fb/${s.fb}`, href });
  }
  if (s.fbText) out.push({ key: "fbtext", label: `Facebook: ${s.fbText}` });
  return out;
}
