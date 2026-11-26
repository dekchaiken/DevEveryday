// สร้างข้อความ QR ของ PromptPay ตามมาตรฐาน EMVCo (ไม่ต้องใช้บริการภายนอก)
// ข้อมูลผู้รับเงินตั้งผ่านตัวแปรแวดล้อม XMAS_PROMPTPAY_ID / XMAS_PROMPTPAY_NAME / XMAS_PROMPTPAY_CITY

function field(id: string, value: string) {
  return id + String(value.length).padStart(2, "0") + value;
}

// CRC-16/CCITT-FALSE ตามที่ PromptPay ใช้
function crc16(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// แปลงเบอร์มือถือเป็นรูปแบบ 0066xxxxxxxxx, ส่งเลขบัตร/เลขผู้เสียภาษี 13 หลักตรง ๆ
// หรือเลข e-Wallet 15 หลัก (เช่นเลขวอลเล็ตทรูมันนี่) ตามมาตรฐาน PromptPay
function target(id: string) {
  const digits = id.replace(/\D/g, "");
  if (digits.length === 15) return { sub: "03", value: digits };
  if (digits.length === 13) return { sub: "02", value: digits };
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return { sub: "01", value: "0066" + local };
}

export function promptPayPayload(amountBaht: number, orderRef: string): string | null {
  const id = process.env.XMAS_PROMPTPAY_ID;
  if (!id) return null;
  const t = target(id);
  const merchant = field("00", "A000000677010111") + field(t.sub, t.value);
  const body =
    field("00", "01") +
    field("01", "12") +
    field("29", merchant) +
    field("53", "764") +
    field("54", amountBaht.toFixed(2)) +
    field("58", "TH") +
    field("59", (process.env.XMAS_PROMPTPAY_NAME ?? "DevEveryday").slice(0, 25)) +
    field("60", (process.env.XMAS_PROMPTPAY_CITY ?? "Bangkok").slice(0, 15)) +
    field("62", field("05", orderRef.slice(0, 25)));
  const withCrc = body + "6304";
  return withCrc + crc16(withCrc);
}
