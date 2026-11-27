// เซสชันแอดมิน: โทเคนเป็น HMAC ของ "epoch" ที่เก็บในฐานข้อมูล
// ออกจากระบบจะเพิ่ม epoch ทำให้โทเคนเก่าทุกอันใช้ไม่ได้ทันที (ไม่ต้องรอหมดอายุ)
// ใช้ Web Crypto เพื่อให้ทำงานได้ทั้งใน Middleware (Edge) และ Route Handler (Node)
import { cmd, storeConfigured } from "@/lib/redis";

export const SESSION_COOKIE = "de_admin";
const PAYLOAD = "admin-session-v2";
const EPOCH_KEY = "xmas:admin:epoch";
const encoder = new TextEncoder();

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function currentEpoch(): Promise<string> {
  if (!storeConfigured()) return "0";
  return (await cmd<string | null>("GET", EPOCH_KEY)) ?? "0";
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  return sign(secret, `${PAYLOAD}:${await currentEpoch()}`);
}

export async function isValidSession(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!token || !secret) return false;
  return safeEqual(token, await sign(secret, `${PAYLOAD}:${await currentEpoch()}`));
}

// ยกเลิกทุกเซสชันที่เคยออก (ใช้ตอนออกจากระบบ)
export async function revokeAllSessions(): Promise<void> {
  if (storeConfigured()) await cmd("INCR", EPOCH_KEY);
}
