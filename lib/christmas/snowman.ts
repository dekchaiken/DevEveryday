// ชิ้นส่วนของตุ๊กตาหิมะทั้งหมด ใช้ร่วมกันทั้งเซิร์ฟเวอร์ (ตรวจข้อมูล) และหน้าเว็บ (หน้าตกแต่งและโมเดล 3 มิติ)
// ไม่มี Three.js หรือ Redis ในไฟล์นี้
// ชิ้นส่วนเดิม 7 อย่าง (hat, scarf, nose, arms, body, legs, acc) ยังใช้ชื่อเดิม ตุ๊กตาที่วางไว้แล้วจึงแสดงได้เหมือนเดิม
// ชิ้นส่วนใหม่ไม่บังคับ ข้อมูลเก่าที่ไม่มีจะใช้ค่าเริ่มต้นที่หน้าตาเหมือนตุ๊กตาเดิม

type Opt = readonly [value: string, label: string];
type PartDef = { readonly label: string; readonly group: 0 | 1 | 2; readonly options: readonly Opt[]; readonly swatch?: boolean; readonly legacy?: readonly string[] };

export const SNOW_PARTS = {
  // ---------- 1 หัวและใบหน้า ----------
  hat: {
    label: "หมวก",
    group: 0,
    options: [
      ["top", "หมวกทรงสูง"],
      ["santa", "หมวกซานตา"],
      ["beanie", "หมวกไหมพรม"],
      ["pom", "หมวกปอมปอม"],
      ["elf", "หมวกเอลฟ์"],
      ["crown", "มงกุฎ"],
      ["antlers", "เขากวาง"],
      ["holly", "พวงฮอลลี่"],
      ["beret", "เบเร่ต์"],
      ["earmuff", "ที่ปิดหู"],
      ["bow", "โบว์ใหญ่"],
      ["none", "ไม่ใส่"],
    ],
  },
  hatColor: {
    label: "สีหมวก",
    group: 0,
    swatch: true,
    options: [
      ["auto", "ตามแบบ"],
      ["red", "แดง"],
      ["green", "เขียว"],
      ["navy", "กรมท่า"],
      ["gold", "ทอง"],
      ["white", "ขาว"],
      ["pink", "ชมพู"],
      ["purple", "ม่วง"],
      ["black", "ดำ"],
    ],
  },
  eyes: {
    label: "ดวงตา",
    group: 0,
    options: [
      ["coal", "ถ่านกลม"],
      ["sparkle", "ตาวิบวับ"],
      ["happy", "ยิ้มตาปิด"],
      ["wink", "ขยิบตา"],
      ["sleepy", "ง่วงนิด ๆ"],
    ],
  },
  mouth: {
    label: "ปาก",
    group: 0,
    options: [
      ["coal", "ยิ้มถ่าน"],
      ["smile", "ยิ้มกว้าง"],
      ["open", "หัวเราะ"],
      ["o", "ปากจู๋"],
      ["tongue", "แลบลิ้น"],
    ],
  },
  nose: {
    label: "จมูก",
    group: 0,
    options: [
      ["carrot", "แครอท"],
      ["button", "กระดุมแดง"],
      ["berry", "เบอร์รี่"],
      ["star", "ดาว"],
      ["heart", "หัวใจ"],
      ["bell", "กระดิ่ง"],
    ],
  },
  cheeks: {
    label: "แก้ม",
    group: 0,
    swatch: true,
    options: [
      ["pink", "ชมพู"],
      ["peach", "พีช"],
      ["none", "ไม่มี"],
    ],
  },
  // ---------- 2 ผ้าพันคอและตัว ----------
  scarfStyle: {
    label: "แบบผ้าพันคอ",
    group: 1,
    options: [
      ["wrap", "พันคอ"],
      ["long", "ชายยาว"],
      ["knot", "ผูกปมข้าง"],
      ["bowtie", "หูกระต่าย"],
      ["cape", "ผ้าคลุมไหล่"],
      ["none", "ไม่ใส่"],
    ],
  },
  scarf: {
    label: "ลายและสีผ้า",
    group: 1,
    swatch: true,
    options: [
      ["red", "แดง"],
      ["green", "เขียว"],
      ["gold", "ทอง"],
      ["blue", "น้ำเงิน"],
      ["white", "ขาว"],
      ["pink", "ชมพู"],
      ["purple", "ม่วง"],
      ["plaid", "ลายสก็อต"],
      ["candy", "ลายแคนดี้"],
      ["fairisle", "ลายถักนอร์ดิก"],
    ],
  },
  body: {
    label: "สีหิมะ",
    group: 1,
    swatch: true,
    options: [
      ["white", "ขาว"],
      ["pearl", "มุก"],
      ["ice", "น้ำแข็ง"],
      ["mint", "มิ้นต์"],
      ["sky", "ฟ้า"],
      ["blush", "ชมพู"],
    ],
  },
  shape: {
    label: "ทรงตัว",
    group: 1,
    options: [
      ["classic", "สามก้อน"],
      ["chubby", "สองก้อนอ้วนกลม"],
      ["tall", "ผอมสูง"],
    ],
  },
  buttons: {
    label: "กระดุม",
    group: 1,
    options: [
      ["coal", "ถ่าน"],
      ["gold", "ทอง"],
      ["candy", "ลูกกวาด"],
      ["ornament", "ลูกบอลคริสต์มาส"],
      ["none", "ไม่มี"],
    ],
  },
  // ---------- 3 แขน ฐาน และของประดับ ----------
  arms: {
    label: "แขน",
    group: 2,
    options: [
      ["sticks", "กิ่งไม้"],
      ["mittens", "ถุงมือไหมพรม"],
      ["wave", "โบกมือทักทาย"],
      ["wings", "ปีกนางฟ้า"],
      ["none", "ไม่มีแขน"],
    ],
    legacy: ["gift"],
  },
  hold: {
    label: "ของในมือ",
    group: 2,
    options: [
      ["none", "ไม่ถือ"],
      ["candy", "ไม้เท้าขนม"],
      ["lantern", "โคมไฟ"],
      ["gift", "กล่องของขวัญ"],
      ["wand", "ไม้ดาววิเศษ"],
      ["pine", "ต้นสนจิ๋ว"],
      ["mug", "แก้วโกโก้"],
    ],
  },
  legs: {
    label: "ฐาน",
    group: 2,
    options: [
      ["snow", "กองหิมะ"],
      ["boots", "รองเท้าบู๊ต"],
      ["gift", "บนกล่องของขวัญ"],
      ["sled", "บนเลื่อนหิมะ"],
      ["skates", "รองเท้าสเก็ต"],
      ["none", "ไม่มีฐาน"],
    ],
  },
  acc: {
    label: "ของประดับ",
    group: 2,
    options: [
      ["none", "ไม่มี"],
      ["glasses", "แว่นกลม"],
      ["bow", "โบว์ที่คอ"],
      ["bell", "กระดิ่ง"],
      ["snowflake", "เข็มกลัดเกล็ดหิมะ"],
      ["holly", "เข็มกลัดฮอลลี่"],
      ["medal", "เหรียญดาว"],
    ],
  },
} as const satisfies Record<string, PartDef>;

export type SnowPartKey = keyof typeof SNOW_PARTS;
export type SnowParts = Record<SnowPartKey, string>;
export const SNOW_PART_KEYS = Object.keys(SNOW_PARTS) as SnowPartKey[];
export const SNOW_GROUPS = ["หัวและหน้า", "ผ้าพันคอ·ตัว", "แขน·ฐาน·ประดับ"] as const;

// ค่าเริ่มต้น = หน้าตาของตุ๊กตารุ่นเดิม (ข้อมูลเก่าที่ไม่มีชิ้นใหม่จะดูเหมือนเดิม)
export const DEFAULT_SNOW: SnowParts = {
  hat: "top",
  hatColor: "auto",
  eyes: "coal",
  mouth: "coal",
  nose: "carrot",
  cheeks: "pink",
  scarfStyle: "wrap",
  scarf: "red",
  body: "white",
  shape: "classic",
  buttons: "coal",
  arms: "sticks",
  hold: "none",
  legs: "snow",
  acc: "none",
};
// ชิ้นส่วนรุ่นแรกที่ต้องมีเสมอ (ชิ้นใหม่ไม่บังคับ)
const REQUIRED: SnowPartKey[] = ["hat", "scarf", "nose", "arms", "body", "legs", "acc"];

export function optionsOf(key: SnowPartKey): readonly Opt[] {
  return SNOW_PARTS[key].options;
}
export function labelOf(key: SnowPartKey, value: string): string {
  return optionsOf(key).find((o) => o[0] === value)?.[1] ?? value;
}
function allowed(key: SnowPartKey): string[] {
  const def = SNOW_PARTS[key] as PartDef;
  return [...def.options.map((o) => o[0]), ...(def.legacy ?? [])];
}

// อ่านชิ้นส่วนจากข้อมูลที่ส่งมา: ชิ้นรุ่นแรกต้องถูกต้อง (ไม่งั้นคืน null) ชิ้นใหม่ที่ไม่มีหรือไม่รู้จักใช้ค่าเริ่มต้น
export function parseSnowParts(v: unknown): SnowParts | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out = { ...DEFAULT_SNOW };
  for (const key of SNOW_PART_KEYS) {
    const val = String(o[key] ?? "");
    if (allowed(key).includes(val)) out[key] = val;
    else if (REQUIRED.includes(key)) return null;
  }
  return out;
}

// เติมค่าเริ่มต้นให้ข้อมูลเก่า (ใช้ตอนแสดงผล ไม่ตรวจความถูกต้อง)
export function withDefaults(v: Partial<Record<string, unknown>>): SnowParts {
  const out = { ...DEFAULT_SNOW };
  for (const key of SNOW_PART_KEYS) {
    const val = v[key];
    if (typeof val === "string" && allowed(key).includes(val)) out[key] = val;
  }
  return out;
}

// สุ่มชุดแต่งที่เข้ากัน (ปุ่ม "สุ่มชุดแต่ง" ในหน้าตกแต่ง)
export function randomSnow(rnd: () => number = Math.random): SnowParts {
  const out = { ...DEFAULT_SNOW };
  for (const key of SNOW_PART_KEYS) {
    const opts = optionsOf(key).filter((o) => o[0] !== "none" || key === "hold" || key === "acc");
    out[key] = opts[Math.floor(rnd() * opts.length)][0];
  }
  return out;
}
