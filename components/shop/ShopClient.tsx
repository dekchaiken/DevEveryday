"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Product, Shop } from "@/lib/shop";

type Line = { key: string; productId: string; size: string; qty: number };

// เสื้อแบบ placeholder ใช้เมื่อสินค้ายังไม่มีรูป วาดด้วยสีของสินค้า
function Garment({ color, title }: { color: string; title: string }) {
  return (
    <svg viewBox="0 0 120 130" role="img" aria-label={title} className="garment">
      <path
        d="M40 8 L16 22 L4 48 L22 56 L26 44 L26 124 L94 124 L94 44 L98 56 L116 48 L104 22 L80 8 Q60 22 40 8 Z"
        fill={color}
      />
      <path d="M40 8 Q60 26 80 8" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      <path d="M26 56 L94 56" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
    </svg>
  );
}

function ProductImage({ p }: { p: Product }) {
  if (p.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.image} alt={p.name} className="garment-img" loading="lazy" />;
  }
  return <Garment color={p.color} title={p.name} />;
}

function totalQty(p: Product) {
  return p.variants.reduce((s, v) => s + v.qty, 0);
}

export function ShopClient({ shop }: { shop: Shop }) {
  const [category, setCategory] = useState("all");
  const [condition, setCondition] = useState<"all" | "new" | "used">("all");
  const [size, setSize] = useState("all");
  const [open, setOpen] = useState<Product | null>(null);
  const [pickedSize, setPickedSize] = useState("");
  const [bagOpen, setBagOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const brandName = (id: string) => shop.brands.find((b) => b.id === id)?.name ?? "";
  const categoryName = (id: string) => shop.categories.find((c) => c.id === id)?.name ?? "";
  const typeName = (id: string) => shop.types.find((t) => t.id === id)?.name ?? "";

  const visible = useMemo(
    () =>
      shop.products.filter(
        (p) =>
          (category === "all" || p.categoryId === category) &&
          (condition === "all" || p.condition === condition) &&
          (size === "all" || p.variants.some((v) => v.size === size && v.qty > 0)),
      ),
    [shop.products, category, condition, size],
  );

  const bagCount = lines.reduce((s, l) => s + l.qty, 0);
  const bagTotal = lines.reduce((s, l) => {
    const p = shop.products.find((x) => x.id === l.productId);
    return s + (p ? p.price * l.qty : 0);
  }, 0);

  function openProduct(p: Product) {
    setOpen(p);
    const firstAvailable = p.variants.find((v) => v.qty > 0)?.size ?? "";
    setPickedSize(firstAvailable);
  }

  function addToBag(p: Product, s: string) {
    const variant = p.variants.find((v) => v.size === s);
    if (!variant || variant.qty <= 0) return;
    const key = `${p.id}:${s}`;
    setLines((cur) => {
      const found = cur.find((l) => l.key === key);
      // ไม่ให้เกินจำนวนคงเหลือ (มือ 2 มีชิ้นเดียว จึงเพิ่มได้ครั้งเดียว)
      if (found) {
        if (found.qty >= variant.qty) return cur;
        return cur.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...cur, { key, productId: p.id, size: s, qty: 1 }];
    });
    setBagOpen(true);
  }

  function changeQty(key: string, delta: number) {
    setLines((cur) =>
      cur.flatMap((l) => {
        if (l.key !== key) return [l];
        const next = l.qty + delta;
        return next <= 0 ? [] : [{ ...l, qty: next }];
      }),
    );
  }

  const sizeOptions = open ? open.variants : [];
  const inBagFor = (p: Product, s: string) => lines.find((l) => l.key === `${p.id}:${s}`)?.qty ?? 0;

  return (
    <div className="shop">
      <header className="shop-top">
        <div className="shop-top-inner">
          <a href="/" className="shop-back">
            ← DevEveryday
          </a>
          <div className="shop-brand">
            <span className="shop-mark">CM</span>
            <div>
              <strong>{shop.brandName}</strong>
              <span>{shop.tagline}</span>
            </div>
          </div>
          <button type="button" className="shop-bag-btn" onClick={() => setBagOpen(true)} aria-label="ตะกร้า">
            ตะกร้า <span className="shop-bag-count">{bagCount}</span>
          </button>
        </div>
      </header>

      <section className="shop-filters" aria-label="ตัวกรองสินค้า">
        <div className="chip-row">
          <button type="button" className={`chip ${category === "all" ? "on" : ""}`} onClick={() => setCategory("all")}>
            ทั้งหมด
          </button>
          {shop.categories.map((c) => (
            <button key={c.id} type="button" className={`chip ${category === c.id ? "on" : ""}`} onClick={() => setCategory(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="shop-filter-row">
          <div className="chip-row">
            {(["all", "new", "used"] as const).map((k) => (
              <button key={k} type="button" className={`chip ${condition === k ? "on" : ""}`} onClick={() => setCondition(k)}>
                {k === "all" ? "มือ 1 และมือ 2" : k === "new" ? "มือ 1" : "มือ 2"}
              </button>
            ))}
          </div>
          <label className="shop-size">
            ไซส์
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="all">ทุกไซส์</option>
              {shop.sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <main className="rack-wrap">
        <div className="rack" aria-label="ราวแขวนสินค้า">
          <div className="rail" />
          <div className="rack-items">
            {visible.length === 0 && <p className="rack-empty">ยังไม่มีสินค้าตามตัวกรองนี้</p>}
            {visible.map((p, i) => {
              const soldOut = totalQty(p) === 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`hang ${soldOut ? "sold" : ""}`}
                  style={{ "--d": `${i * 70}ms`, "--c": p.color } as CSSProperties}
                  onClick={() => openProduct(p)}
                >
                  <span className="hook" aria-hidden="true" />
                  <span className="garment-wrap">
                    <ProductImage p={p} />
                  </span>
                  <span className="hang-label">
                    <strong>{p.name}</strong>
                    <span>
                      {p.condition === "used" ? "มือ 2" : "มือ 1"} · ฿{p.price.toLocaleString("th-TH")}
                    </span>
                    {soldOut && <em>หมด</em>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {open && (
        <div className="shop-overlay" onClick={() => setOpen(null)}>
          <div className="shop-modal" role="dialog" aria-modal="true" aria-label={open.name} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="shop-close" onClick={() => setOpen(null)} aria-label="ปิด">
              ✕
            </button>
            <div className="shop-modal-art" style={{ "--c": open.color } as CSSProperties}>
              <div className="garment-wrap big">
                <ProductImage p={open} />
              </div>
            </div>
            <div className="shop-modal-info">
              <span className="shop-kicker">
                {brandName(open.brandId)} · {categoryName(open.categoryId)} · {typeName(open.typeId)}
              </span>
              <h2>{open.name}</h2>
              <div className="shop-price-row">
                <span className="shop-price">฿{open.price.toLocaleString("th-TH")}</span>
                <span className={`cond ${open.condition}`}>{open.condition === "used" ? "มือ 2 · ชิ้นเดียว" : "มือ 1"}</span>
              </div>
              <p className="shop-desc">{open.description}</p>

              <div className="shop-sizes">
                <span>เลือกไซส์</span>
                <div className="chip-row">
                  {sizeOptions.map((v) => (
                    <button
                      key={v.size}
                      type="button"
                      className={`chip size ${pickedSize === v.size ? "on" : ""}`}
                      disabled={v.qty <= 0}
                      onClick={() => setPickedSize(v.size)}
                    >
                      {v.size}
                      <small>{v.qty > 0 ? `เหลือ ${v.qty}` : "หมด"}</small>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="shop-add"
                disabled={!pickedSize || inBagFor(open, pickedSize) >= (open.variants.find((v) => v.size === pickedSize)?.qty ?? 0)}
                onClick={() => addToBag(open, pickedSize)}
              >
                เพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
      )}

      {bagOpen && (
        <aside className="shop-bag" aria-label="ตะกร้า">
          <div className="shop-bag-head">
            <strong>ตะกร้า</strong>
            <button type="button" className="shop-close" onClick={() => setBagOpen(false)} aria-label="ปิดตะกร้า">
              ✕
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="rack-empty">ยังไม่มีสินค้าในตะกร้า</p>
          ) : (
            <ul className="bag-lines">
              {lines.map((l) => {
                const p = shop.products.find((x) => x.id === l.productId);
                if (!p) return null;
                return (
                  <li key={l.key}>
                    <div>
                      <strong>{p.name}</strong>
                      <span>
                        ไซส์ {l.size} · ฿{p.price.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="qty">
                      <button type="button" onClick={() => changeQty(l.key, -1)} aria-label="ลดจำนวน">
                        −
                      </button>
                      <span>{l.qty}</span>
                      <button type="button" onClick={() => changeQty(l.key, 1)} aria-label="เพิ่มจำนวน">
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="shop-bag-foot">
            <div>
              <span>รวม</span>
              <strong>฿{bagTotal.toLocaleString("th-TH")}</strong>
            </div>
            <button type="button" className="shop-add" disabled>
              ชำระเงิน (เร็วๆ นี้)
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
