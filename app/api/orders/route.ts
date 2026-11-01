import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { applyCoupon, linesWithProducts, subtotalOf, type CartLine } from "@/lib/pricing";
import { addOrder, ordersConfigured, type Order } from "@/lib/orders";
import { tooMany } from "@/lib/leads";
import { getShop } from "@/lib/shop";

export const runtime = "nodejs";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// วันที่ตามเวลาไทย เพื่อให้คูปองหมดอายุตรงกับที่ลูกค้าเห็น
const todayTH = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

// สั่งซื้อแบบโอนเงิน: ตรวจสินค้า ไซส์ จำนวน และคูปองฝั่งเซิร์ฟเวอร์ แล้วบันทึกเป็นคำสั่งซื้อรอชำระ
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (clip(body.website, 200)) return NextResponse.json({ ok: true });

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (tooMany(ip)) return NextResponse.json({ error: "ทำรายการบ่อยเกินไป ลองใหม่อีกครั้งภายหลัง" }, { status: 429 });

  const c = (body.customer ?? {}) as Record<string, unknown>;
  const customer = {
    name: clip(c.name, 120),
    phone: clip(c.phone, 30),
    email: clip(c.email, 160),
    address: clip(c.address, 400),
    note: clip(c.note, 300),
  };
  if (!customer.name) return NextResponse.json({ error: "กรุณากรอกชื่อผู้รับ" }, { status: 400 });
  if (customer.phone.replace(/\D/g, "").length < 9) return NextResponse.json({ error: "กรุณากรอกเบอร์โทรให้ถูกต้อง" }, { status: 400 });
  if (customer.email && !EMAIL.test(customer.email)) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  if (!customer.address) return NextResponse.json({ error: "กรุณากรอกที่อยู่จัดส่ง" }, { status: 400 });

  const shop = getShop();
  const rawLines = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  if (rawLines.length === 0 || rawLines.length > 30) return NextResponse.json({ error: "ตะกร้าว่างหรือมีรายการมากเกินไป" }, { status: 400 });

  // ตรวจทุกบรรทัดกับข้อมูลร้านจริง ไม่เชื่อราคาหรือจำนวนที่ส่งมาจากเบราว์เซอร์
  const lines: CartLine[] = rawLines.map((l, i) => ({
    key: `${l.productId}:${l.size}`,
    productId: clip(l.productId, 60),
    size: clip(l.size, 20),
    qty: Math.floor(Number(l.qty)),
  }));
  for (const l of lines) {
    const p = shop.products.find((x) => x.id === l.productId);
    if (!p) return NextResponse.json({ error: "มีสินค้าที่ไม่มีในร้านแล้ว กรุณาเช็กตะกร้าใหม่" }, { status: 400 });
    const v = p.variants.find((x) => x.size === l.size);
    if (!v || v.qty <= 0) return NextResponse.json({ error: `${p.name} ไซส์ ${l.size} หมดแล้ว` }, { status: 409 });
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > v.qty) {
      return NextResponse.json({ error: `${p.name} ไซส์ ${l.size} เหลือ ${v.qty} ชิ้น` }, { status: 409 });
    }
  }

  const subtotal = subtotalOf(shop, lines);
  let discount = 0;
  let coupon = "";
  const code = clip(body.coupon, 30);
  if (code) {
    const r = applyCoupon(shop, code, lines, todayTH());
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    discount = r.discount;
    coupon = r.coupon.code;
  }

  if (!ordersConfigured()) {
    return NextResponse.json({ error: "ระบบสั่งซื้อยังไม่พร้อม กรุณาติดต่อทางไลน์หรืออีเมล" }, { status: 503 });
  }

  const now = new Date();
  const order: Order = {
    id: `CM${now.toISOString().slice(2, 10).replace(/-/g, "")}${randomBytes(2).toString("hex").toUpperCase()}`,
    createdAt: now.toISOString(),
    customer,
    lines: linesWithProducts(shop, lines).map(({ l, p }) => ({ name: p.name, size: l.size, qty: l.qty, price: p.price })),
    subtotal,
    coupon,
    discount,
    total: Math.max(0, subtotal - discount),
    status: "awaiting_payment",
    tracking: "",
    adminNote: "",
    updatedAt: now.toISOString(),
  };
  try {
    await addOrder(order);
    return NextResponse.json({ ok: true, orderId: order.id, total: order.total, payment: shop.payment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
