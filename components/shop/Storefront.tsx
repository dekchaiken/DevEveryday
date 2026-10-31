"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { isLive, type Coupon, type Product, type Shop } from "@/lib/shop";
import { ShopIntro } from "@/components/shop/ShopIntro";

type Line = { key: string; productId: string; size: string; qty: number };
type Tab = "popular" | "collections" | "trending" | "branches";

const today0 = "";

// เสื้อ placeholder เมื่อยังไม่มีรูป วาดด้วยสีของสินค้า
function ProductArt({ p, className = "" }: { p: Product; className?: string }) {
  if (p.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.image} alt={p.name} className={`sf-art-img ${className}`} loading="lazy" />;
  }
  return (
    <svg viewBox="0 0 120 130" className={`sf-art-svg ${className}`} role="img" aria-label={p.name}>
      <path
        d="M40 8 L16 22 L4 48 L22 56 L26 44 L26 124 L94 124 L94 44 L98 56 L116 48 L104 22 L80 8 Q60 22 40 8 Z"
        fill={p.color}
      />
      <path d="M40 8 Q60 26 80 8" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
    </svg>
  );
}

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;
const stock = (p: Product) => p.variants.reduce((s, v) => s + v.qty, 0);

// ตรวจคูปองตามเงื่อนไข: ช่วงวัน สถานะ สิทธิ์การใช้ ยอดขั้นต่ำ และหมวดหรือคอลเลกชันที่กำหนด
function applyCoupon(code: string, shop: Shop, lines: Line[], today: string) {
  const c = shop.coupons.find((x) => x.code === code.trim().toUpperCase());
  if (!c) return { error: "ไม่พบคูปองนี้" } as const;
  if (!c.active || !isLive(c, today)) return { error: "คูปองนี้ไม่อยู่ในช่วงใช้งาน" } as const;
  if (c.usageLimit > 0 && c.used >= c.usageLimit) return { error: "คูปองนี้ถูกใช้ครบแล้ว" } as const;
  const items = lines.map((l) => ({ l, p: shop.products.find((x) => x.id === l.productId) })).filter((x) => x.p) as { l: Line; p: Product }[];
  const inScope = items.filter(({ p }) => {
    if (c.scope === "category") return p.categoryId === c.scopeId;
    if (c.scope === "collection") return p.collectionIds.includes(c.scopeId);
    return true;
  });
  const subtotal = items.reduce((s, { l, p }) => s + p.price * l.qty, 0);
  const scoped = inScope.reduce((s, { l, p }) => s + p.price * l.qty, 0);
  if (subtotal < c.minSpend) return { error: `ยอดขั้นต่ำ ${baht(c.minSpend)}` } as const;
  if (scoped === 0) return { error: "คูปองนี้ใช้กับสินค้าในตะกร้าไม่ได้" } as const;
  const discount = c.type === "percent" ? Math.floor((scoped * c.value) / 100) : Math.min(c.value, scoped);
  return { coupon: c as Coupon, discount } as const;
}

export function Storefront({ shop, preview = false }: { shop: Shop; preview?: boolean }) {
  const [today, setToday] = useState(today0);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("popular");
  const [collection, setCollection] = useState<string>("all");
  const [showMore, setShowMore] = useState(8);
  const [open, setOpen] = useState<Product | null>(null);
  const [pickedSize, setPickedSize] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [wish, setWish] = useState<string[]>([]);
  const [cookie, setCookie] = useState(true);

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
    try {
      const saved = JSON.parse(localStorage.getItem("cm-wish") ?? "[]");
      if (Array.isArray(saved)) setWish(saved.filter((x) => typeof x === "string"));
      setCookie(localStorage.getItem("cm-cookie") !== "ok");
    } catch {
      // ใช้ค่าเริ่มต้นถ้าเบราว์เซอร์ไม่ให้เข้าถึง localStorage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cm-wish", JSON.stringify(wish));
    } catch {
      // ไม่มีผลกับการใช้งาน
    }
  }, [wish]);

  const theme = shop.theme;
  const themeVars = {
    "--shop-primary": theme.primary,
    "--shop-accent": theme.accent,
    "--shop-bg": theme.background,
    "--shop-text": theme.text,
  } as CSSProperties;

  const liveBanners = shop.banners.filter((b) => b.active && isLive(b, today));
  const liveAnnouncements = shop.announcements.filter((a) => a.active && isLive(a, today));
  const sec = (id: string) => shop.sections.find((s) => s.id === id)?.enabled !== false;

  const popular = shop.products.filter((p) => p.popular);
  const trendingAll = shop.products.filter((p) => p.trending);
  const trending = collection === "all" ? trendingAll : shop.products.filter((p) => p.collectionIds.includes(collection));
  const shownTrending = trending.slice(0, showMore);

  // สไลด์แบนเนอร์หมุนอัตโนมัติ
  useEffect(() => {
    if (liveBanners.length < 2) return;
    const t = window.setInterval(() => setSlide((s) => (s + 1) % liveBanners.length), 6000);
    return () => window.clearInterval(t);
  }, [liveBanners.length]);

  const cur = liveBanners.length ? liveBanners[Math.min(slide, liveBanners.length - 1)] : null;

  const bagCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => {
    const p = shop.products.find((x) => x.id === l.productId);
    return s + (p ? p.price * l.qty : 0);
  }, 0);
  const total = Math.max(0, subtotal - (applied?.discount ?? 0));

  function addToBag(p: Product, s: string) {
    const v = p.variants.find((x) => x.size === s);
    if (!v || v.qty <= 0) return;
    const key = `${p.id}:${s}`;
    setLines((cur) => {
      const f = cur.find((l) => l.key === key);
      if (f) return f.qty >= v.qty ? cur : cur.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...cur, { key, productId: p.id, size: s, qty: 1 }];
    });
    setBagOpen(true);
  }

  function changeQty(key: string, d: number) {
    setLines((cur) => cur.flatMap((l) => (l.key !== key ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));
  }

  function tryCoupon() {
    const r = applyCoupon(code, shop, lines, today);
    if ("error" in r) {
      setApplied(null);
      setCouponMsg(r.error ?? "");
    } else {
      setApplied({ code: r.coupon.code, discount: r.discount });
      setCouponMsg(`ใช้คูปอง ${r.coupon.code} แล้ว ลด ${baht(r.discount)}`);
    }
  }

  function toggleWish(id: string) {
    setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  }

  function openProduct(p: Product) {
    setOpen(p);
    setPickedSize(p.variants.find((v) => v.qty > 0)?.size ?? "");
    setShowGuide(false);
  }

  function ProductCard({ p }: { p: Product }) {
    const sold = stock(p) === 0;
    const liked = wish.includes(p.id);
    return (
      <article className="sf-card">
        <button type="button" className="sf-card-art" onClick={() => openProduct(p)} aria-label={`ดู ${p.name}`}>
          <ProductArt p={p} />
          {sold && <span className="sf-badge sold">หมด</span>}
          {p.condition === "used" && !sold && <span className="sf-badge">มือ 2</span>}
        </button>
        <button type="button" className={`sf-heart ${liked ? "on" : ""}`} onClick={() => toggleWish(p.id)} aria-pressed={liked} aria-label="บันทึกไว้ดูภายหลัง">
          {liked ? "♥" : "♡"}
        </button>
        <div className="sf-card-body">
          <strong>{p.name}</strong>
          <span>{baht(p.price)}</span>
          <div className="sf-sizes">
            {p.variants.map((v) => (
              <span key={v.size} className={v.qty > 0 ? "" : "out"}>
                {v.size}
              </span>
            ))}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="sf" style={themeVars}>
      {!preview && <ShopIntro name={shop.brandName} count={shop.products.length} />}

      {sec("announcement") && liveAnnouncements.length > 0 && (
        <div className="sf-announce" role="status">
          {liveAnnouncements.map((a) => (
            <span key={a.id}>{a.text}</span>
          ))}
        </div>
      )}

      <header className="sf-head">
        <a href="#top" className="sf-logo" id="top">
          {shop.brandName}
        </a>
        <nav className="sf-nav" aria-label="เมนูหลัก">
          <a href="#popular">ยอดนิยม</a>
          <a href="#collections">คอลเลกชัน</a>
          <a href="#trending">กำลังมาแรง</a>
          {sec("branches") && <a href="#branches">สาขา</a>}
          <a href="#footer">ติดต่อ</a>
        </nav>
        <div className="sf-head-actions">
          <span className="sf-wish-count" aria-label="รายการโปรด">
            ♡ {wish.length}
          </span>
          <button type="button" className="sf-bag-btn" onClick={() => setBagOpen(true)}>
            ตะกร้า <b>{bagCount}</b>
          </button>
        </div>
      </header>

      {sec("hero") && cur && (
        <section className="sf-hero" aria-roledescription="carousel" aria-label="แบนเนอร์">
          <div className="sf-hero-media" key={cur.id}>
            {cur.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur.image} alt="" className="sf-hero-img" />
            ) : (
              <div className="sf-hero-fallback" />
            )}
          </div>
          <div className="sf-hero-copy" key={`${cur.id}-copy`}>
            <span className="sf-kicker">{shop.brandName}</span>
            <h1>{cur.title}</h1>
            <p>{cur.subtitle}</p>
            {cur.link && (
              <a href={cur.link} className="sf-cta">
                เลือกชมเลย →
              </a>
            )}
          </div>
          {liveBanners.length > 1 && (
            <>
              <div className="sf-dots" role="tablist" aria-label="เลือกแบนเนอร์">
                {liveBanners.map((b, i) => (
                  <button key={b.id} type="button" className={i === slide ? "on" : ""} onClick={() => setSlide(i)} aria-label={`แบนเนอร์ที่ ${i + 1}`} />
                ))}
              </div>
              <button type="button" className="sf-arrow prev" onClick={() => setSlide((s) => (s - 1 + liveBanners.length) % liveBanners.length)} aria-label="ก่อนหน้า">
                ‹
              </button>
              <button type="button" className="sf-arrow next" onClick={() => setSlide((s) => (s + 1) % liveBanners.length)} aria-label="ถัดไป">
                ›
              </button>
            </>
          )}
        </section>
      )}

      {sec("popular") && popular.length > 0 && (
        <section id="popular" className="sf-section">
          <div className="sf-section-head">
            <h2>สินค้ายอดนิยม</h2>
            <button type="button" className={tab === "popular" ? "on" : ""} onClick={() => setTab("popular")}>
              ดูทั้งหมด
            </button>
          </div>
          <div className="sf-row">
            {popular.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {sec("collections") && shop.collections.length > 0 && (
        <section id="collections" className="sf-section">
          <div className="sf-section-head">
            <h2>คอลเลกชัน</h2>
          </div>
          <div className="sf-collections">
            {shop.collections.map((c) => (
              <a
                key={c.id}
                href="#trending"
                className={`sf-collection ${collection === c.id ? "on" : ""}`}
                onClick={() => {
                  setCollection(c.id);
                  setShowMore(8);
                }}
              >
                <div className="sf-collection-art">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" />
                  ) : (
                    <span>{c.name.charAt(0)}</span>
                  )}
                </div>
                <strong>{c.name}</strong>
                <span>{c.description}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {sec("trending") && (
        <section id="trending" className="sf-section">
          <div className="sf-section-head">
            <h2>{collection === "all" ? "กำลังมาแรง" : shop.collections.find((c) => c.id === collection)?.name ?? "สินค้า"}</h2>
            {collection !== "all" && (
              <button
                type="button"
                onClick={() => {
                  setCollection("all");
                  setShowMore(8);
                }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
          <div className="sf-grid">
            {shownTrending.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          {trending.length === 0 && <p className="sf-empty">ยังไม่มีสินค้าในหมวดนี้</p>}
          {trending.length > showMore && (
            <div className="sf-more">
              <button type="button" onClick={() => setShowMore((n) => n + 8)}>
                ดูเพิ่มเติม
              </button>
            </div>
          )}
        </section>
      )}

      {sec("branches") && shop.branches.length > 0 && (
        <section id="branches" className="sf-section">
          <div className="sf-section-head">
            <h2>สาขาของเรา</h2>
          </div>
          <div className="sf-branches">
            {shop.branches.map((b) => (
              <article key={b.id} className="sf-branch">
                <strong>{b.name}</strong>
                <span>{b.address}</span>
                <small>{b.hours}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      {sec("newsletter") && (
        <section className="sf-section sf-news">
          <h2>รับข่าวสารและโปรโมชั่นก่อนใคร</h2>
          <p>ฝากอีเมลไว้ รับข่าวการเปิดคอลเลกชันใหม่และคูปองพิเศษ</p>
          <form className="sf-news-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="อีเมลของคุณ" aria-label="อีเมล" required />
            <button type="submit" disabled>
              เร็วๆ นี้
            </button>
          </form>
        </section>
      )}

      <footer id="footer" className="sf-foot">
        <div>
          <strong>{shop.brandName}</strong>
          <span>{shop.footer.note}</span>
        </div>
        <div>
          <span>อีเมล: {shop.footer.email}</span>
          {shop.footer.lineUrl && (
            <a href={shop.footer.lineUrl} target="_blank" rel="noopener noreferrer">
              แชต LINE ↗
            </a>
          )}
        </div>
        <div className="sf-foot-links">
          <span>นโยบายการจัดส่ง</span>
          <span>นโยบายการคืนสินค้า</span>
          <span>นโยบายความเป็นส่วนตัว</span>
        </div>
      </footer>

      {cookie && !preview && (
        <div className="sf-cookie" role="dialog" aria-label="การใช้คุกกี้">
          <span>เว็บนี้ใช้คุกกี้เพื่อจำรายการโปรดและตะกร้าของคุณ</span>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem("cm-cookie", "ok");
              } catch {
                // ไม่มีผลกับการใช้งาน
              }
              setCookie(false);
            }}
          >
            รับทราบ
          </button>
        </div>
      )}

      {open && (
        <div className="sf-overlay" onClick={() => setOpen(null)}>
          <div className="sf-modal" role="dialog" aria-modal="true" aria-label={open.name} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="sf-close" onClick={() => setOpen(null)} aria-label="ปิด">
              ✕
            </button>
            <div className="sf-modal-art">
              <ProductArt p={open} />
            </div>
            <div className="sf-modal-info">
              <span className="sf-kicker">{shop.brands.find((b) => b.id === open.brandId)?.name ?? ""}</span>
              <h2>{open.name}</h2>
              <div className="sf-price-row">
                <strong>{baht(open.price)}</strong>
                <span className={`sf-cond ${open.condition}`}>{open.condition === "used" ? "มือ 2 · ชิ้นเดียว" : "มือ 1"}</span>
              </div>
              <p className="sf-desc">{open.description}</p>
              <div className="sf-size-row">
                <span>ไซส์</span>
                {open.sizeGuide && (
                  <button type="button" className="sf-link" onClick={() => setShowGuide((v) => !v)}>
                    ตารางไซส์
                  </button>
                )}
              </div>
              {showGuide && <p className="sf-guide">{open.sizeGuide}</p>}
              <div className="sf-size-pick">
                {open.variants.map((v) => (
                  <button key={v.size} type="button" className={pickedSize === v.size ? "on" : ""} disabled={v.qty <= 0} onClick={() => setPickedSize(v.size)}>
                    {v.size}
                    <small>{v.qty > 0 ? `เหลือ ${v.qty}` : "หมด"}</small>
                  </button>
                ))}
              </div>
              <div className="sf-modal-actions">
                <button
                  type="button"
                  className="sf-add"
                  disabled={!pickedSize || (open.variants.find((v) => v.size === pickedSize)?.qty ?? 0) <= 0}
                  onClick={() => addToBag(open, pickedSize)}
                >
                  เพิ่มลงตะกร้า
                </button>
                <button type="button" className="sf-wish-btn" onClick={() => toggleWish(open.id)}>
                  {wish.includes(open.id) ? "♥ บันทึกแล้ว" : "♡ บันทึกไว้ดูภายหลัง"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bagOpen && (
        <aside className="sf-bag" aria-label="ตะกร้า">
          <div className="sf-bag-head">
            <strong>ตะกร้า ({bagCount})</strong>
            <button type="button" className="sf-close" onClick={() => setBagOpen(false)} aria-label="ปิดตะกร้า">
              ✕
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="sf-empty">ยังไม่มีสินค้าในตะกร้า</p>
          ) : (
            <ul className="sf-lines">
              {lines.map((l) => {
                const p = shop.products.find((x) => x.id === l.productId);
                if (!p) return null;
                return (
                  <li key={l.key}>
                    <div>
                      <strong>{p.name}</strong>
                      <span>
                        ไซส์ {l.size} · {baht(p.price)}
                      </span>
                    </div>
                    <div className="sf-qty">
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
          <div className="sf-coupon">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="รหัสคูปอง" aria-label="รหัสคูปอง" />
            <button type="button" onClick={tryCoupon} disabled={!code.trim() || lines.length === 0}>
              ใช้คูปอง
            </button>
            {couponMsg && <small>{couponMsg}</small>}
          </div>
          <div className="sf-totals">
            <div>
              <span>ยอดรวม</span>
              <span>{baht(subtotal)}</span>
            </div>
            {applied && (
              <div>
                <span>ส่วนลด ({applied.code})</span>
                <span>-{baht(applied.discount)}</span>
              </div>
            )}
            <div className="sf-total">
              <strong>รวมทั้งหมด</strong>
              <strong>{baht(total)}</strong>
            </div>
          </div>
          <button type="button" className="sf-add" disabled>
            ชำระเงิน (เร็วๆ นี้)
          </button>
        </aside>
      )}
    </div>
  );
}
