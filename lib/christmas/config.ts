// การตั้งค่าระบบคริสต์มาส (โหมดชำระเงิน ราคา ฯลฯ) เก็บใน Redis และแก้ได้จากหน้า admin
import { cmd, storeConfigured } from "@/lib/redis";

export type PayMode = "manual" | "gateway";

export type ChristmasConfig = {
  enabled: boolean; // เปิดรับการสนับสนุนหรือไม่
  payMode: PayMode; // manual = PromptPay QR แอดมินยืนยันเอง, gateway = Omise อัตโนมัติ
  presetPrices: number[]; // ราคาปุ่มเลือกเร็ว (บาท)
  customMin: number; // ยอดขั้นต่ำที่กรอกเอง (บาท)
  customMax: number; // ยอดสูงสุดที่กรอกเอง (บาท)
};

export const DEFAULT_CONFIG: ChristmasConfig = {
  enabled: false, // ปิดไว้จนกว่าแอดมินจะตั้งค่าบัญชีรับเงินและเปิดเอง
  payMode: "manual",
  presetPrices: [19, 29, 99],
  customMin: 19,
  customMax: 5000,
};

let memConfig: ChristmasConfig | null = null;

export async function getConfig(): Promise<ChristmasConfig> {
  if (!storeConfigured()) return memConfig ?? DEFAULT_CONFIG;
  const raw = await cmd<string | null>("GET", "xmas:config");
  if (!raw) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ChristmasConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setConfig(next: ChristmasConfig) {
  if (!storeConfigured()) {
    memConfig = next;
    return;
  }
  await cmd("SET", "xmas:config", JSON.stringify(next));
}

// ตรวจค่าที่ส่งมาจากหน้า admin ให้อยู่ในช่วงที่ยอมรับได้
export function validateConfig(input: Record<string, unknown>): { value: ChristmasConfig } | { error: string } {
  const payMode = input.payMode === "gateway" ? "gateway" : input.payMode === "manual" ? "manual" : null;
  if (!payMode) return { error: "โหมดชำระเงินไม่ถูกต้อง" };
  const presets = Array.isArray(input.presetPrices) ? input.presetPrices.map(Number) : [];
  if (presets.length < 1 || presets.length > 6 || presets.some((p) => !Number.isInteger(p) || p < 1 || p > 100000)) {
    return { error: "ราคาปุ่มเลือกเร็วต้องเป็นจำนวนเต็ม 1–6 ค่า" };
  }
  const customMin = Number(input.customMin);
  const customMax = Number(input.customMax);
  if (!Number.isInteger(customMin) || customMin < 1) return { error: "ยอดขั้นต่ำไม่ถูกต้อง" };
  if (!Number.isInteger(customMax) || customMax < customMin || customMax > 100000) return { error: "ยอดสูงสุดไม่ถูกต้อง" };
  return {
    value: {
      enabled: input.enabled !== false,
      payMode,
      presetPrices: presets,
      customMin,
      customMax,
    },
  };
}
