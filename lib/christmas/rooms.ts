// ห้องหรือโซนของต้นคริสต์มาส: ทุกจังหวัดของไทย แต่ละห้องมีต้นไม้ ลูกบอล และคิวพลุของตัวเอง
// จังหวัดยอดนิยมขึ้นก่อนในหน้าเลือกห้อง และมีฉากฉากหลังสามมิติเฉพาะ (แลนด์มาร์ก) ส่วนจังหวัดอื่นใช้ฉากตามภูมิภาค
// ใช้แอปเดียวกัน แยกข้อมูลด้วย key ของห้อง (id ของ 4 ห้องเดิมไม่เปลี่ยน ข้อมูลเดิมจึงยังอยู่ครบ)

export const ROOM_CAPACITY = 150; // จำนวนคนออนไลน์สูงสุดต่อห้อง

// ฉากหลัง: เมืองหลวง / ดอยในหมอก / ทุ่งนา / ทะเล / เมืองเก่า
export type SceneKind = "city" | "hills" | "rice" | "sea" | "ancient";
// แลนด์มาร์กเพิ่มบนฉากหลัง
export type Landmark = "prang" | "tower" | "chedi" | "lanterns" | "whitetemple" | "lighthouse" | "karst" | "islands" | "shorecity" | "pagoda" | "lake" | "ruins" | "krathong" | "river";

export type RoomTheme = {
  id: string;
  name: string;
  region: string;
  blurb: string;
  skyTop: string;
  skyBottom: string;
  ground: string;
  accent: string;
  skyline: SceneKind;
  landmarks: Landmark[];
  popular?: number; // ลำดับยอดนิยม (1 = บนสุด)
};

const KIND: Record<SceneKind, { skyTop: string; skyBottom: string; accent: string; blurb: string }> = {
  city: { skyTop: "#0a1630", skyBottom: "#2a2550", accent: "#f5c542", blurb: "ไฟเมืองยามค่ำคืนระยิบระยับ" },
  hills: { skyTop: "#0c1f2e", skyBottom: "#2b4a5c", accent: "#7ee7b0", blurb: "หมอกบนดอยกับท้องฟ้าคริสต์มาส" },
  rice: { skyTop: "#0d1d2a", skyBottom: "#3a3a2c", accent: "#f59e0b", blurb: "ทุ่งนากว้างใต้แสงดาว อบอุ่นเหมือนบ้าน" },
  sea: { skyTop: "#06192e", skyBottom: "#0f4a5c", accent: "#38bdf8", blurb: "ชายทะเลยามค่ำ ลมเย็นและคลื่นเบา ๆ" },
  ancient: { skyTop: "#160f24", skyBottom: "#4a2a2a", accent: "#f0a35e", blurb: "เมืองเก่าใต้แสงไฟอุ่น เจดีย์เรียงราย" },
};

type Row = [id: string, name: string, region: string, kind: SceneKind, landmarks?: Landmark[], extra?: { popular?: number; blurb?: string }];

// ภูมิภาคตามการแบ่ง 6 ภาคของราชบัณฑิตยสถาน
const N = "ภาคเหนือ";
const NE = "ภาคอีสาน";
const C = "ภาคกลาง";
const E = "ภาคตะวันออก";
const W = "ภาคตะวันตก";
const S = "ภาคใต้";

const ROWS: Row[] = [
  // ---------- ยอดนิยม: ฉากเฉพาะของจังหวัด ----------
  ["bangkok", "กรุงเทพฯ", C, "city", ["tower", "prang", "river"], { popular: 1, blurb: "ไฟเมืองหลวงยามค่ำคืน ตึกสูงระยิบระยับ วัดอรุณริมเจ้าพระยา" }],
  ["chiang-mai", "เชียงใหม่", N, "hills", ["chedi", "lanterns"], { popular: 2, blurb: "หมอกบนดอย พระธาตุดอยสุเทพสีทอง และโคมลอยบนท้องฟ้า" }],
  ["phuket", "ภูเก็ต", S, "sea", ["lighthouse", "islands"], { popular: 3, blurb: "ทะเลอันดามันยามค่ำ ประภาคารแหลมพรหมเทพ และเรือไฟกลางทะเล" }],
  ["chonburi", "ชลบุรี", E, "sea", ["shorecity", "islands"], { popular: 4, blurb: "ไฟเมืองพัทยาริมหาด เกาะกลางทะเล และเรือประมงส่องไฟ" }],
  ["khon-kaen", "ขอนแก่น", NE, "rice", ["pagoda", "lake"], { popular: 5, blurb: "บึงแก่นนครกับพระธาตุเก้าชั้น ทุ่งนาและแสงดาวยามค่ำ" }],
  ["krabi", "กระบี่", S, "sea", ["karst"], { popular: 6, blurb: "ภูเขาหินปูนกลางทะเลอันดามัน ใต้แสงดาวคริสต์มาส" }],
  ["chiang-rai", "เชียงราย", N, "hills", ["whitetemple", "lanterns"], { popular: 7, blurb: "วัดร่องขุ่นสีขาวเรืองแสง ท่ามกลางทะเลหมอกบนดอย" }],
  ["ayutthaya", "พระนครศรีอยุธยา", C, "ancient", ["ruins", "krathong"], { popular: 8, blurb: "เจดีย์และปรางค์เมืองเก่าต้องแสงไฟ กระทงลอยบนสายน้ำ" }],
  ["nakhon-ratchasima", "นครราชสีมา", NE, "hills", ["lanterns"], { popular: 9, blurb: "ประตูสู่อีสาน ขุนเขาเขาใหญ่และลมหนาวเย็นสบาย" }],
  ["songkhla", "สงขลา", S, "sea", ["islands", "shorecity"], { popular: 10, blurb: "หาดสมิหลาและเกาะหนูเกาะแมว ไฟเมืองหาดใหญ่ไกล ๆ" }],

  // ---------- ภาคเหนือ ----------
  ["lampang", "ลำปาง", N, "hills", ["chedi"]],
  ["lamphun", "ลำพูน", N, "hills", ["chedi"]],
  ["mae-hong-son", "แม่ฮ่องสอน", N, "hills", ["lanterns"], { blurb: "เมืองสามหมอก ทะเลหมอกบนยอดดอย" }],
  ["nan", "น่าน", N, "hills"],
  ["phayao", "พะเยา", N, "hills", ["lake"]],
  ["phrae", "แพร่", N, "hills"],
  ["uttaradit", "อุตรดิตถ์", N, "hills"],

  // ---------- ภาคอีสาน ----------
  ["amnat-charoen", "อำนาจเจริญ", NE, "rice"],
  ["bueng-kan", "บึงกาฬ", NE, "rice", ["river"]],
  ["buriram", "บุรีรัมย์", NE, "rice", ["ruins"]],
  ["chaiyaphum", "ชัยภูมิ", NE, "hills"],
  ["kalasin", "กาฬสินธุ์", NE, "rice", ["lake"]],
  ["loei", "เลย", NE, "hills", ["lanterns"], { blurb: "ทะเลหมอกภูกระดึงและเมืองเชียงคานยามค่ำ" }],
  ["maha-sarakham", "มหาสารคาม", NE, "rice"],
  ["mukdahan", "มุกดาหาร", NE, "rice", ["river"]],
  ["nakhon-phanom", "นครพนม", NE, "rice", ["river", "pagoda"]],
  ["nong-bua-lamphu", "หนองบัวลำภู", NE, "rice"],
  ["nong-khai", "หนองคาย", NE, "rice", ["river"], { blurb: "ริมโขงยามค่ำ ไฟสะพานมิตรภาพทอดข้ามน้ำ" }],
  ["roi-et", "ร้อยเอ็ด", NE, "rice", ["pagoda", "lake"]],
  ["sakon-nakhon", "สกลนคร", NE, "rice", ["lake"]],
  ["sisaket", "ศรีสะเกษ", NE, "rice"],
  ["surin", "สุรินทร์", NE, "rice", ["ruins"]],
  ["ubon-ratchathani", "อุบลราชธานี", NE, "rice", ["river"]],
  ["udon-thani", "อุดรธานี", NE, "rice", ["lake"]],
  ["yasothon", "ยโสธร", NE, "rice"],

  // ---------- ภาคกลาง ----------
  ["ang-thong", "อ่างทอง", C, "rice"],
  ["chai-nat", "ชัยนาท", C, "rice", ["river"]],
  ["kamphaeng-phet", "กำแพงเพชร", C, "ancient", ["ruins"]],
  ["lopburi", "ลพบุรี", C, "ancient", ["ruins"]],
  ["nakhon-nayok", "นครนายก", C, "hills"],
  ["nakhon-pathom", "นครปฐม", C, "rice", ["pagoda"]],
  ["nakhon-sawan", "นครสวรรค์", C, "rice", ["river"]],
  ["nonthaburi", "นนทบุรี", C, "city", ["river"]],
  ["pathum-thani", "ปทุมธานี", C, "city"],
  ["phetchabun", "เพชรบูรณ์", C, "hills", ["lanterns"], { blurb: "ทะเลหมอกเขาค้อ ลมหนาวบนยอดเขา" }],
  ["phichit", "พิจิตร", C, "rice"],
  ["phitsanulok", "พิษณุโลก", C, "rice", ["river"]],
  ["samut-prakan", "สมุทรปราการ", C, "city", ["river"]],
  ["samut-sakhon", "สมุทรสาคร", C, "sea"],
  ["samut-songkhram", "สมุทรสงคราม", C, "rice", ["river", "krathong"]],
  ["saraburi", "สระบุรี", C, "hills"],
  ["sing-buri", "สิงห์บุรี", C, "rice"],
  ["sukhothai", "สุโขทัย", C, "ancient", ["ruins", "krathong"], { blurb: "อุทยานประวัติศาสตร์ เจดีย์โบราณต้องแสงไฟ" }],
  ["suphan-buri", "สุพรรณบุรี", C, "rice"],
  ["uthai-thani", "อุทัยธานี", C, "rice", ["river"]],

  // ---------- ภาคตะวันออก ----------
  ["chachoengsao", "ฉะเชิงเทรา", E, "rice", ["river"]],
  ["chanthaburi", "จันทบุรี", E, "sea"],
  ["prachinburi", "ปราจีนบุรี", E, "hills"],
  ["rayong", "ระยอง", E, "sea", ["islands"]],
  ["sa-kaeo", "สระแก้ว", E, "rice"],
  ["trat", "ตราด", E, "sea", ["islands"]],

  // ---------- ภาคตะวันตก ----------
  ["kanchanaburi", "กาญจนบุรี", W, "hills", ["river"], { blurb: "แม่น้ำแควใต้แสงดาว ขุนเขาในหมอกบาง ๆ" }],
  ["phetchaburi", "เพชรบุรี", W, "sea"],
  ["prachuap-khiri-khan", "ประจวบคีรีขันธ์", W, "sea", ["islands"]],
  ["ratchaburi", "ราชบุรี", W, "hills"],
  ["tak", "ตาก", W, "hills"],

  // ---------- ภาคใต้ ----------
  ["chumphon", "ชุมพร", S, "sea", ["islands"]],
  ["nakhon-si-thammarat", "นครศรีธรรมราช", S, "sea", ["chedi"]],
  ["narathiwat", "นราธิวาส", S, "sea"],
  ["pattani", "ปัตตานี", S, "sea"],
  ["phang-nga", "พังงา", S, "sea", ["karst"]],
  ["phatthalung", "พัทลุง", S, "rice", ["lake"]],
  ["ranong", "ระนอง", S, "sea", ["islands"]],
  ["satun", "สตูล", S, "sea", ["karst"]],
  ["surat-thani", "สุราษฎร์ธานี", S, "sea", ["islands"]],
  ["trang", "ตรัง", S, "sea", ["karst"]],
  ["yala", "ยะลา", S, "hills"],
];

export const ROOMS: RoomTheme[] = ROWS.map(([id, name, region, kind, landmarks = [], extra = {}]) => ({
  id,
  name,
  region,
  blurb: extra.blurb ?? KIND[kind].blurb,
  skyTop: KIND[kind].skyTop,
  skyBottom: KIND[kind].skyBottom,
  ground: "#f2ecdc",
  accent: KIND[kind].accent,
  skyline: kind,
  landmarks,
  ...(extra.popular ? { popular: extra.popular } : {}),
}));

export const ROOM_REGIONS = [N, NE, C, E, W, S];

export function getRoom(id: string | null | undefined): RoomTheme | null {
  return ROOMS.find((r) => r.id === id) ?? null;
}
