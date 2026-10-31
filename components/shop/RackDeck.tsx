"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import type { Product } from "@/lib/shop";
import { HangingGarment } from "@/components/shop/HangingGarment";

const VISIBLE_RANGE = 4; // จำนวนชิ้นที่เห็นข้างละกี่ชิ้น นอกนั้นซ่อน

function firstAvailable(p: Product) {
  return p.variants.find((v) => v.qty > 0)?.size ?? p.variants[0]?.size ?? "";
}

// ราวแบบ deck: ชิ้นที่เลือกอยู่กลางและใหญ่ ชิ้นข้างเคียงเรียงไปทางซ้ายขวาและลึกลงไปตามระยะ
// ไล่ดูได้ด้วยปุ่ม ลูกศรคีย์บอร์ด ล้อเมาส์ ลากนิ้ว หรือคลิกชิ้นข้างๆ
export function RackDeck({
  products,
  onOpen,
  onQuickAdd,
  empty,
}: {
  products: Product[];
  onOpen: (p: Product) => void;
  onQuickAdd: (p: Product, size: string) => void;
  empty: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const wheelLock = useRef(0);
  const drag = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  const count = products.length;
  const idx = Math.min(index, Math.max(0, count - 1));
  const cur = products[idx];

  // เมื่อรายการเปลี่ยนตามตัวกรอง ให้กลับไปชิ้นแรก
  useEffect(() => {
    setIndex(0);
  }, [products]);

  function step(delta: number) {
    if (count === 0) return;
    setIndex((i) => Math.min(count - 1, Math.max(0, i + delta)));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "Enter" && cur) onOpen(cur);
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(dx) < 18) return;
    const now = Date.now();
    if (now - wheelLock.current < 380) return;
    wheelLock.current = now;
    step(dx > 0 ? 1 : -1);
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    drag.current = e.clientX;
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (drag.current === null) return;
    const dx = e.clientX - drag.current;
    drag.current = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  }

  if (empty || !cur) return <p className="rack-empty">ยังไม่มีสินค้าตามตัวกรองนี้</p>;

  const size = sizes[cur.id] ?? firstAvailable(cur);
  const sizeQty = cur.variants.find((v) => v.size === size)?.qty ?? 0;
  const soldOut = cur.variants.every((v) => v.qty === 0);

  return (
    <div className="deck">
      <div
        ref={stage}
        className="deck-stage"
        tabIndex={0}
        role="listbox"
        aria-label="ราวสินค้า ใช้ลูกศรซ้ายขวาเพื่อไล่ดู"
        onKeyDown={onKey}
        onWheel={onWheel}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="deck-rail" />
        {products.map((p, i) => {
          const d = i - idx;
          if (Math.abs(d) > VISIBLE_RANGE) return null;
          const abs = Math.abs(d);
          const style = {
            "--d": `${d}`,
            "--abs": `${abs}`,
            zIndex: 50 - abs,
            opacity: abs > 3 ? 0 : 1 - abs * 0.15,
          } as CSSProperties;
          return (
            <div
              key={p.id}
              className={`deck-item ${d === 0 ? "active" : ""}`}
              style={style}
              onClick={() => (d === 0 ? onOpen(p) : setIndex(i))}
              role="option"
              aria-selected={d === 0}
              aria-label={p.name}
            >
              <HangingGarment product={p} shift={0} live={d === 0} />
            </div>
          );
        })}
        {count > 1 && (
          <>
            <button type="button" className="deck-nav prev" onClick={() => step(-1)} disabled={idx === 0} aria-label="ชิ้นก่อนหน้า">
              ‹
            </button>
            <button type="button" className="deck-nav next" onClick={() => step(1)} disabled={idx === count - 1} aria-label="ชิ้นถัดไป">
              ›
            </button>
          </>
        )}
        <span className="deck-count">
          {idx + 1} / {count}
        </span>
      </div>

      <div className="deck-caption" key={cur.id}>
        <div className="deck-caption-main">
          <span className="deck-kicker">{cur.condition === "used" ? "มือ 2 · ชิ้นเดียว" : "มือ 1"}</span>
          <strong>{cur.name}</strong>
          <span className="deck-price">฿{cur.price.toLocaleString("th-TH")}</span>
        </div>
        <div className="deck-buy">
          <div className="chip-row">
            {cur.variants.map((v) => (
              <button
                key={v.size}
                type="button"
                className={`chip size ${size === v.size ? "on" : ""}`}
                disabled={v.qty <= 0}
                onClick={() => setSizes((s) => ({ ...s, [cur.id]: v.size }))}
              >
                {v.size}
              </button>
            ))}
          </div>
          <div className="deck-actions">
            <button type="button" className="shop-add" disabled={soldOut || sizeQty <= 0} onClick={() => onQuickAdd(cur, size)}>
              {soldOut ? "สินค้าหมด" : "เพิ่มลงตะกร้า"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onOpen(cur)}>
              ดูรายละเอียด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
