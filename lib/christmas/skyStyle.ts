// รูปแบบของ "ข้อความอวยพรขึ้นจอ" ใช้ร่วมกันทั้งเซิร์ฟเวอร์ (ตรวจข้อมูล) และหน้าเว็บ (หน้าแต่งและการแสดงจริง)
// ไม่มีโค้ดวาดในไฟล์นี้ ข้อความเก่าที่ไม่มีรูปแบบจะใช้ค่าเริ่มต้นที่หน้าตาเหมือนรุ่นเดิม

export const SKY_THEMES = ["fireworks", "snow", "sparkle", "sleigh", "aurora", "lanterns", "hearts", "confetti", "starfall"] as const;
export const SKY_FONTS = ["plex", "kanit", "mali", "sriracha", "chonburi", "charm"] as const;
export const SKY_PALETTES = ["gold", "ruby", "frost", "rose", "emerald", "midnight"] as const;
export const SKY_FRAMES = ["ornate", "ribbon", "glass", "neon"] as const;
export const SKY_INTROS = ["rise", "burst", "type", "unfurl"] as const;

export type SkyThemeId = (typeof SKY_THEMES)[number];
export type SkyFont = (typeof SKY_FONTS)[number];
export type SkyPalette = (typeof SKY_PALETTES)[number];
export type SkyFrame = (typeof SKY_FRAMES)[number];
export type SkyIntro = (typeof SKY_INTROS)[number];
export type SkyStyle = { theme: SkyThemeId; font: SkyFont; palette: SkyPalette; frame: SkyFrame; intro: SkyIntro };

export const DEFAULT_SKY_STYLE: SkyStyle = { theme: "fireworks", font: "plex", palette: "gold", frame: "ornate", intro: "rise" };

// ระยะเวลาการแสดงบนจอ (ms) ยาวพอให้เห็นเปิดตัว อ่านข้อความ และปิดฉาก
export const SKY_SHOW_MS = 10000;

export const SKY_THEME_INFO: Record<SkyThemeId, { label: string; hint: string }> = {
  fireworks: { label: "พลุฉลอง", hint: "พลุยิงขึ้นฟ้าแล้วแตกเป็นประกายทั่วจอ" },
  snow: { label: "หิมะโปรยปราย", hint: "หิมะหลายชั้นลอยผ่านหน้าจอ" },
  sparkle: { label: "ประกายทอง", hint: "ฝุ่นทองหมุนวนรอบข้อความ" },
  sleigh: { label: "เลื่อนซานตา", hint: "เลื่อนกวางบินผ่านพร้อมหางประกาย" },
  aurora: { label: "แสงเหนือ", hint: "ม่านแสงเหนือพลิ้วบนฟ้า" },
  lanterns: { label: "โคมลอย", hint: "โคมลอยนับสิบลอยขึ้นฟ้า" },
  hearts: { label: "หัวใจลอย", hint: "หัวใจลอยขึ้นพร้อมประกาย" },
  confetti: { label: "กระดาษสี", hint: "ปืนกระดาษสียิงจากสองข้าง" },
  starfall: { label: "ฝนดาวตก", hint: "ดาวตกพาดผ่านฟ้าเป็นสาย" },
};
export const SKY_FONT_INFO: Record<SkyFont, { label: string }> = {
  plex: { label: "เรียบหรู" },
  kanit: { label: "หนาทันสมัย" },
  mali: { label: "กลมน่ารัก" },
  sriracha: { label: "ลายมือ" },
  chonburi: { label: "คลาสสิก" },
  charm: { label: "อักษรวิจิตร" },
};
export const SKY_PALETTE_INFO: Record<SkyPalette, { label: string; swatch: [string, string] }> = {
  gold: { label: "ทองสปรูซ", swatch: ["#0f3a2c", "#f5c542"] },
  ruby: { label: "แดงทับทิม", swatch: ["#7d0d24", "#f9d57a"] },
  frost: { label: "น้ำแข็ง", swatch: ["#13304f", "#cfeeff"] },
  rose: { label: "ชมพูกุหลาบ", swatch: ["#6b1d45", "#ffc7dd"] },
  emerald: { label: "มรกต", swatch: ["#064e3b", "#a7f3d0"] },
  midnight: { label: "เที่ยงคืน", swatch: ["#0b1030", "#c7d2fe"] },
};
export const SKY_FRAME_INFO: Record<SkyFrame, { label: string }> = {
  ornate: { label: "กรอบทองหรู" },
  ribbon: { label: "ริบบิ้นโบว์" },
  glass: { label: "กระจกฝ้า" },
  neon: { label: "ไฟนีออน" },
};
export const SKY_INTRO_INFO: Record<SkyIntro, { label: string }> = {
  rise: { label: "ลอยขึ้นนุ่ม ๆ" },
  burst: { label: "ระเบิดแสง" },
  type: { label: "พิมพ์ทีละตัว" },
  unfurl: { label: "คลี่ม้วนผ้า" },
};

function pick<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

// อ่านรูปแบบจากข้อมูลที่ส่งมา ค่าที่ไม่รู้จักใช้ค่าเริ่มต้น (ไม่ทำให้คำสั่งซื้อล้ม)
export function parseSkyStyle(v: unknown, theme?: unknown): SkyStyle {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    theme: pick(o.theme ?? theme, SKY_THEMES, DEFAULT_SKY_STYLE.theme),
    font: pick(o.font, SKY_FONTS, DEFAULT_SKY_STYLE.font),
    palette: pick(o.palette, SKY_PALETTES, DEFAULT_SKY_STYLE.palette),
    frame: pick(o.frame, SKY_FRAMES, DEFAULT_SKY_STYLE.frame),
    intro: pick(o.intro, SKY_INTROS, DEFAULT_SKY_STYLE.intro),
  };
}
