"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Condition, Option, Product, Shop, Variant } from "@/lib/shop";

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="admin-hint">{hint}</span>}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="row" style={{ flexWrap: "wrap" }}>{children}</div>;
}

// รายการชื่อ (หมวดหมู่ ประเภท แบรนด์) เพิ่ม แก้ไข ลบได้
function OptionList({ title, items, onChange, max }: { title: string; items: Option[]; onChange: (next: Option[]) => void; max: number }) {
  return (
    <div className="admin-card" style={{ gap: 10 }}>
      <h3>{title} ({items.length}/{max})</h3>
      {items.map((o, i) => (
        <Row key={o.id}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} value={o.name} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "#e5484d" }} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ลบ
          </button>
        </Row>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        disabled={items.length >= max}
        onClick={() => onChange([...items, { id: uid("o"), name: "" }])}
      >
        + เพิ่ม{title}
      </button>
    </div>
  );
}

// ขนาดไซส์ของร้าน เช่น S, M, L, 2XL
function SizeEditor({ sizes, onChange }: { sizes: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const s = draft.trim();
    if (!s || sizes.includes(s) || sizes.length >= 12) return;
    onChange([...sizes, s]);
    setDraft("");
  }
  return (
    <div className="admin-card" style={{ gap: 10 }}>
      <h3>ไซส์ของร้าน</h3>
      <div className="chip-row">
        {sizes.map((s) => (
          <span key={s} className="chip on" style={{ display: "inline-flex", gap: 6 }}>
            {s}
            <button type="button" aria-label={`ลบไซส์ ${s}`} onClick={() => onChange(sizes.filter((x) => x !== s))} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer" }}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <Row>
        <input className="input" style={{ width: 160 }} placeholder="เช่น 4XL" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button type="button" className="btn btn-ghost" onClick={add}>
          + เพิ่มไซส์
        </button>
      </Row>
    </div>
  );
}

export function ShopAdmin({ initial }: { initial: Shop }) {
  const [data, setData] = useState<Shop>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  function edit(fn: (d: Shop) => Shop) {
    setData((d) => fn(structuredClone(d)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/shop", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || `บันทึกไม่สำเร็จ (${res.status})`);
      setDirty(false);
      setToast({ text: "บันทึกแล้ว · Vercel กำลัง deploy ประมาณ 1–2 นาที" });
    } catch (err) {
      setToast({ text: (err as Error).message, error: true });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4500);
    }
  }

  const setProducts = (next: Product[]) => edit((d) => ({ ...d, products: next }));

  return (
    <div className="admin">
      <div className="admin-top">
        <div className="admin-top-inner">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            ← กลับหน้า admin
          </Link>
          <strong className="brand" style={{ fontSize: 15 }}>
            <span className="brand-dot" /> ร้าน {data.brandName}
          </strong>
          <span className={`admin-status ${dirty ? "dirty" : ""}`}>{dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกล่าสุดแล้ว"}</span>
          <div className="spacer" />
          <Link href="/shop" target="_blank" className="btn btn-ghost btn-sm">
            ดูหน้าร้าน ↗
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </div>

      <div className="admin-body" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="admin-panel">
          <div className="admin-card">
            <h3>ข้อมูลร้าน</h3>
            <div className="grid-2">
              <Field label="ชื่อร้าน">
                <input className="input" value={data.brandName} onChange={(e) => edit((d) => ({ ...d, brandName: e.target.value }))} />
              </Field>
              <Field label="คำโปรย">
                <input className="input" value={data.tagline} onChange={(e) => edit((d) => ({ ...d, tagline: e.target.value }))} />
              </Field>
            </div>
          </div>

          <SizeEditor sizes={data.sizes} onChange={(sizes) => edit((d) => ({ ...d, sizes }))} />

          <div className="grid-2" style={{ alignItems: "start" }}>
            <OptionList title="หมวดหมู่" items={data.categories} max={20} onChange={(categories) => edit((d) => ({ ...d, categories }))} />
            <OptionList title="ประเภท" items={data.types} max={20} onChange={(types) => edit((d) => ({ ...d, types }))} />
          </div>
          <OptionList title="แบรนด์" items={data.brands} max={20} onChange={(brands) => edit((d) => ({ ...d, brands }))} />

          <ProductList data={data} setProducts={setProducts} />
        </div>
      </div>

      {toast && <div className={`admin-toast ${toast.error ? "error" : ""}`}>{toast.text}</div>}
    </div>
  );
}

function ProductList({ data, setProducts }: { data: Shop; setProducts: (next: Product[]) => void }) {
  const list = data.products;
  const [fresh, setFresh] = useState<string | null>(null);

  function patch(i: number, p: Partial<Product>) {
    setProducts(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }

  function setCondition(i: number, condition: Condition, p: Product) {
    // มือ 2 มีชิ้นเดียว ไซส์เดียว จึงตัดให้เหลือไซส์แรกที่มีจำนวน 1
    const variants: Variant[] =
      condition === "used"
        ? [{ size: p.variants[0]?.size ?? data.sizes[0] ?? "", qty: 1 }]
        : p.variants.length > 0
          ? p.variants
          : [{ size: data.sizes[0] ?? "", qty: 1 }];
    patch(i, { condition, variants });
  }

  return (
    <div className="admin-card">
      <h3>สินค้า ({list.length}/200)</h3>
      <p className="admin-hint" style={{ margin: 0 }}>
        มือ 1 ใส่ได้หลายไซส์และจำนวนคงเหลือแต่ละไซส์ · มือ 2 มีชิ้นเดียว ไซส์เดียว ระบบจะบังคับให้เหลือ 1 ชิ้น
      </p>

      {list.map((p, i) => {
        const brand = data.brands.find((b) => b.id === p.brandId)?.name ?? "";
        return (
          <details key={p.id} className="admin-item" open={p.id === fresh}>
            <summary style={{ display: "flex", gap: 10, alignItems: "center", padding: "14px 16px", cursor: "pointer", listStyle: "none" }}>
              <span style={{ fontWeight: 500 }}>{p.name || "(ยังไม่ตั้งชื่อ)"}</span>
              <span className="admin-item-tag">{p.condition === "used" ? "มือ 2" : "มือ 1"}</span>
              {brand && <span className="admin-item-tag">{brand}</span>}
            </summary>
            <div className="admin-item-body" style={{ display: "grid", gap: 12, padding: "14px 16px 16px", borderTop: "1px solid var(--border)" }}>
              <div className="admin-item-head">
                สินค้า {i + 1}
                <span style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => setProducts(swap(list, i, i - 1))}>
                  ↑
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={i === list.length - 1} onClick={() => setProducts(swap(list, i, i + 1))}>
                  ↓
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: "#e5484d" }} onClick={() => setProducts(list.filter((_, j) => j !== i))}>
                  ลบ
                </button>
              </div>

              <div className="grid-2">
                <Field label="ชื่อสินค้า">
                  <input className="input" value={p.name} onChange={(e) => patch(i, { name: e.target.value })} />
                </Field>
                <Field label="ราคา (บาท)">
                  <input className="input" type="number" min={0} step={1} value={p.price} onChange={(e) => patch(i, { price: Number(e.target.value) })} />
                </Field>
                <Field label="แบรนด์">
                  <select className="input" value={p.brandId} onChange={(e) => patch(i, { brandId: e.target.value })}>
                    {data.brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name || "(ไม่มีชื่อ)"}</option>
                    ))}
                  </select>
                </Field>
                <Field label="หมวดหมู่">
                  <select className="input" value={p.categoryId} onChange={(e) => patch(i, { categoryId: e.target.value })}>
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name || "(ไม่มีชื่อ)"}</option>
                    ))}
                  </select>
                </Field>
                <Field label="ประเภท">
                  <select className="input" value={p.typeId} onChange={(e) => patch(i, { typeId: e.target.value })}>
                    {data.types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name || "(ไม่มีชื่อ)"}</option>
                    ))}
                  </select>
                </Field>
                <Field label="สภาพ">
                  <select className="input" value={p.condition} onChange={(e) => setCondition(i, e.target.value as Condition, p)}>
                    <option value="new">มือ 1</option>
                    <option value="used">มือ 2 (ชิ้นเดียว)</option>
                  </select>
                </Field>
              </div>

              <Field label="รายละเอียด">
                <textarea className="input" rows={3} value={p.description} onChange={(e) => patch(i, { description: e.target.value })} />
              </Field>

              <VariantEditor product={p} sizes={data.sizes} onChange={(variants) => patch(i, { variants })} />

              <div className="grid-2">
                <Field label="สีประจำสินค้า (ใช้เมื่อไม่มีรูป)">
                  <div className="row">
                    <input type="color" value={p.color} onChange={(e) => patch(i, { color: e.target.value })} style={{ width: 44, height: 40, border: 0, background: "none", padding: 0 }} aria-label="เลือกสี" />
                    <input className="input" value={p.color} onChange={(e) => patch(i, { color: e.target.value })} />
                  </div>
                </Field>
                <ImageUpload value={p.image} onChange={(image) => patch(i, { image })} />
              </div>

              <ViewsUpload views={p.views ?? []} onChange={(views) => patch(i, { views })} />
            </div>
          </details>
        );
      })}

      <button
        type="button"
        className="btn btn-ghost"
        disabled={list.length >= 200 || data.brands.length === 0 || data.categories.length === 0 || data.types.length === 0}
        onClick={() => {
          const id = uid("p");
          setFresh(id);
          setProducts([
            ...list,
            {
              id,
              name: "สินค้าใหม่",
              brandId: data.brands[0].id,
              categoryId: data.categories[0].id,
              typeId: data.types[0].id,
              condition: "new",
              price: 0,
              description: "",
              image: "",
              color: "#2f4f3e",
              views: [],
              variants: [{ size: data.sizes[0] ?? "", qty: 1 }],
            },
          ]);
        }}
      >
        + เพิ่มสินค้า
      </button>
    </div>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

// ตารางไซส์และจำนวนคงเหลือ (มือ 2 แก้ได้แค่ไซส์ จำนวนคงที่ 1)
function VariantEditor({ product, sizes, onChange }: { product: Product; sizes: string[]; onChange: (v: Variant[]) => void }) {
  const used = product.condition === "used";
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>ไซส์และจำนวนคงเหลือ</span>
      {product.variants.map((v, i) => (
        <Row key={i}>
          <select className="input" style={{ width: 120 }} value={v.size} onChange={(e) => onChange(product.variants.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))}>
            {sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            style={{ width: 120 }}
            disabled={used}
            value={v.qty}
            onChange={(e) => onChange(product.variants.map((x, j) => (j === i ? { ...x, qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)))}
          />
          {!used && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "#e5484d" }} onClick={() => onChange(product.variants.filter((_, j) => j !== i))}>
              ลบไซส์นี้
            </button>
          )}
        </Row>
      ))}
      {!used && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ justifySelf: "start" }}
          disabled={product.variants.length >= 12}
          onClick={() => onChange([...product.variants, { size: sizes[0] ?? "", qty: 1 }])}
        >
          + เพิ่มไซส์
        </button>
      )}
    </div>
  );
}

function ImageUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !json.path) throw new Error(json.error || `อัปโหลดไม่สำเร็จ (${res.status})`);
      onChange(json.path);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label="รูปสินค้า (PNG, JPG, WebP ไม่เกิน 2 MB)" hint="ควรเป็นรูปที่ตัดพื้นหลังแล้ว (PNG) ถ้าไม่ใส่ระบบจะวาดเสื้อจากสีให้">
      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }} />
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }} />
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
            เอารูปออก
          </button>
        )}
        {busy && <span className="admin-hint">กำลังอัปโหลด...</span>}
      </div>
      {error && <span className="admin-hint" style={{ color: "#e5484d" }}>{error}</span>}
    </Field>
  );
}

// รูปหลายมุมสำหรับหมุน 360°: อัปโหลดทีละหลายไฟล์ เรียงตามลำดับที่เลือก
function ViewsUpload({ views, onChange }: { views: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: File[]) {
    setBusy(true);
    setError("");
    const added: string[] = [];
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
        if (!res.ok || !json.path) throw new Error(json.error || `อัปโหลดไม่สำเร็จ (${res.status})`);
        added.push(json.path);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      onChange([...views, ...added].slice(0, 36));
      setBusy(false);
    }
  }

  return (
    <Field label="รูปหมุน 360° (ถ่ายรอบตัวเสื้อ 8–24 รูป เรียงตามลำดับ)" hint="ลำดับตามชื่อที่เลือก ถ้ามีอย่างน้อย 2 รูป ลูกค้าจะลากหมุนดูได้">
      <div style={{ display: "grid", gap: 10 }}>
        {views.length > 0 && (
          <div className="chip-row">
            {views.map((src, k) => (
              <span key={src + k} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }} />
                <button
                  type="button"
                  aria-label={`เอารูปที่ ${k + 1} ออก`}
                  onClick={() => onChange(views.filter((_, j) => j !== k))}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 99, border: 0, background: "#e5484d", color: "#fff", cursor: "pointer", fontSize: 11 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            disabled={busy || views.length >= 36}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void upload(files);
              e.target.value = "";
            }}
          />
          {busy && <span className="admin-hint">กำลังอัปโหลด...</span>}
          {views.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])}>
              ล้างทั้งหมด
            </button>
          )}
        </div>
        {error && <span className="admin-hint" style={{ color: "#e5484d" }}>{error}</span>}
      </div>
    </Field>
  );
}
