"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SHOP_LIMITS, type Season, type Announcement, type Banner, type Branch, type Collection, type Condition, type Coupon, type Option, type Product, type Section, type SectionId, type Shop, type Variant } from "@/lib/shop";
import { processProductImage, type CheckResult, type Processed } from "@/lib/imaging";
import { Storefront } from "@/components/shop/Storefront";

type Tab = "theme" | "home" | "products" | "collections" | "coupons" | "campaigns" | "store";
const TABS: { key: Tab; label: string }[] = [
  { key: "theme", label: "ธีมและสี" },
  { key: "home", label: "หน้าแรกและแบนเนอร์" },
  { key: "campaigns", label: "ประกาศและเทศกาล" },
  { key: "collections", label: "คอลเลกชัน" },
  { key: "products", label: "สินค้า" },
  { key: "coupons", label: "คูปอง" },
  { key: "store", label: "ข้อมูลร้าน" },
];

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const swap = <T,>(list: T[], a: number, b: number): T[] => {
  const n = [...list];
  [n[a], n[b]] = [n[b], n[a]];
  return n;
};
const removeAt = <T,>(list: T[], i: number): T[] => list.filter((_, j) => j !== i);
const replaceAt = <T,>(list: T[], i: number, v: T): T[] => list.map((x, j) => (j === i ? v : x));

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="admin-hint">{hint}</span>}
    </div>
  );
}

function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="admin-card">
      <div className="admin-head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Item({ title, tag, children }: { title: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <details className="admin-item">
      <summary>
        <span className="admin-item-title">{title || "(ยังไม่ตั้งชื่อ)"}</span>
        {tag && <span className="admin-item-tag">{tag}</span>}
      </summary>
      <div className="admin-item-body">{children}</div>
    </details>
  );
}

function Controls({ index, count, onUp, onDown, onRemove }: { index: number; count: number; onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <>
      <span style={{ flex: 1 }} />
      <button type="button" className="btn btn-ghost btn-sm" onClick={onUp} disabled={index === 0} aria-label="เลื่อนขึ้น">
        ↑
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDown} disabled={index === count - 1} aria-label="เลื่อนลง">
        ↓
      </button>
      <button type="button" className="btn btn-ghost btn-sm" style={{ color: "#e5484d" }} onClick={onRemove}>
        ลบ
      </button>
    </>
  );
}

function Add({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost" disabled={disabled} onClick={onClick}>
      + {label}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="row">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, height: 40, border: 0, background: "none", padding: 0 }} aria-label={label} />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

// อัปโหลดรูป: ตรวจและตัดพื้นหลังก่อน แล้วส่งขึ้นเซิร์ฟเวอร์
function ImageField({ label, value, onChange, onProcessed, hint }: { label: string; value: string; onChange: (v: string) => void; onProcessed?: (p: Processed) => void; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<CheckResult | null>(null);

  async function upload(file: File, process: boolean) {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      let blob: Blob = file;
      let name = file.name;
      if (process) {
        const p = await processProductImage(file);
        setReport(p.report);
        if (p.report.errors.length) throw new Error("รูปนี้ยังใช้ไม่ได้ ดูคำแนะนำด้านล่าง");
        blob = p.blob;
        name = "product.png";
        onProcessed?.(p);
      }
      const body = new FormData();
      body.append("file", new File([blob], name, { type: blob.type || "image/png" }));
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
    <Field label={label} hint={hint}>
      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f, Boolean(onProcessed));
            e.target.value = "";
          }}
        />
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
            เอารูปออก
          </button>
        )}
        {busy && <span className="admin-hint">กำลังประมวลผล...</span>}
      </div>
      {report && (
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13 }}>
          {report.errors.map((e) => (
            <li key={e} style={{ color: "#e5484d" }}>{e}</li>
          ))}
          {report.warnings.map((w) => (
            <li key={w} style={{ color: "#f5a524" }}>{w}</li>
          ))}
          {!report.errors.length && !report.warnings.length && <li style={{ color: "#17c964" }}>รูปผ่านการตรวจแล้ว</li>}
        </ul>
      )}
      {error && <span className="admin-hint" style={{ color: "#e5484d" }}>{error}</span>}
    </Field>
  );
}

// แผงเลือกธีมและสี พร้อมพรีวิวสด
function ThemePanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const t = data.theme;
  const set = (k: keyof Shop["theme"], v: string) => edit((d) => ({ ...d, theme: { ...d.theme, [k]: v } }));
  return (
    <Card title="ธีมทั้งเว็บ" actions={<span className="admin-hint">ดูผลทันทีที่พรีวิวทางขวา</span>}>
      <div className="grid-2">
        <ColorField label="สีหลัก (ปุ่ม แถบประกาศ ท้ายเว็บ)" value={t.primary} onChange={(v) => set("primary", v)} />
        <ColorField label="สีรอง (ป้าย ไฮไลต์ ปุ่มแบนเนอร์)" value={t.accent} onChange={(v) => set("accent", v)} />
        <ColorField label="สีพื้นหลัง" value={t.background} onChange={(v) => set("background", v)} />
        <ColorField label="สีตัวอักษร" value={t.text} onChange={(v) => set("text", v)} />
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {[
          { name: "ขาวดำ", v: { primary: "#0b0b0b", accent: "#c8a165", background: "#f6f4f0", text: "#111111" } },
          { name: "ครีมน้ำตาล", v: { primary: "#3b2a1e", accent: "#e0b97a", background: "#faf6ef", text: "#2a2019" } },
          { name: "น้ำเงินสด", v: { primary: "#1d3b6b", accent: "#f5a524", background: "#f4f7fb", text: "#14213d" } },
        ].map((preset) => (
          <button key={preset.name} type="button" className="btn btn-ghost btn-sm" onClick={() => edit((d) => ({ ...d, theme: preset.v }))}>
            ชุดสี: {preset.name}
          </button>
        ))}
      </div>
    </Card>
  );
}

// แบนเนอร์หน้าแรก ตั้งวันเริ่มและวันจบได้ นอกช่วงนั้นจะไม่แสดง
function BannersPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const list = data.banners;
  const setList = (next: Banner[]) => edit((d) => ({ ...d, banners: next }));
  const patch = (i: number, p: Partial<Banner>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  return (
    <Card title={`แบนเนอร์หน้าแรก (${list.length}/${SHOP_LIMITS.banners})`}>
      {list.map((b, i) => (
        <Item key={b.id} title={b.title} tag={b.active ? "เปิดอยู่" : "ปิด"}>
          <div className="admin-item-head">
            แบนเนอร์ {i + 1}
            <Controls index={i} count={list.length} onUp={() => setList(swap(list, i, i - 1))} onDown={() => setList(swap(list, i, i + 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="หัวข้อ"><input className="input" value={b.title} onChange={(e) => patch(i, { title: e.target.value })} /></Field>
            <Field label="ลิงก์ (/shop หรือ https://)"><input className="input" value={b.link} onChange={(e) => patch(i, { link: e.target.value })} /></Field>
          </div>
          <Field label="คำโปรย"><textarea className="input" rows={2} value={b.subtitle} onChange={(e) => patch(i, { subtitle: e.target.value })} /></Field>
          <div className="grid-2">
            <Field label="เริ่มแสดง" hint="ว่างคือไม่จำกัด"><input className="input" type="date" value={b.start} onChange={(e) => patch(i, { start: e.target.value })} /></Field>
            <Field label="หยุดแสดง" hint="ว่างคือไม่จำกัด"><input className="input" type="date" value={b.end} onChange={(e) => patch(i, { end: e.target.value })} /></Field>
          </div>
          <label className="row" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={b.active} onChange={(e) => patch(i, { active: e.target.checked })} /> เปิดใช้แบนเนอร์นี้
          </label>
          <ImageField label="รูปแบนเนอร์ (แนวนอน แนะนำ 1920×900)" value={b.image} onChange={(image) => patch(i, { image })} />
        </Item>
      ))}
      <Add label="เพิ่มแบนเนอร์" disabled={list.length >= SHOP_LIMITS.banners} onClick={() => setList([...list, { id: uid("bn"), title: "แบนเนอร์ใหม่", subtitle: "", image: "", link: "/shop", active: true, start: "", end: "" }])} />
    </Card>
  );
}

// ประกาศแถบบนสุดและงานเทศกาล
function CampaignsPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const list = data.announcements;
  const setList = (next: Announcement[]) => edit((d) => ({ ...d, announcements: next }));
  const patch = (i: number, p: Partial<Announcement>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  return (
    <>
      <Card title="ประกาศแถบบนสุด">
        <p className="admin-hint" style={{ margin: 0 }}>ตั้งวันเริ่มและวันจบเพื่อทำแคมเปญตามเทศกาลหรือช่วงกิจกรรม ประกาศนอกช่วงจะหายไปเองอัตโนมัติ</p>
        {list.map((a, i) => (
          <Item key={a.id} title={a.text} tag={a.active ? "เปิดอยู่" : "ปิด"}>
            <div className="admin-item-head">
              ประกาศ {i + 1}
              <Controls index={i} count={list.length} onUp={() => setList(swap(list, i, i - 1))} onDown={() => setList(swap(list, i, i + 1))} onRemove={() => setList(removeAt(list, i))} />
            </div>
            <Field label="ข้อความ"><input className="input" value={a.text} onChange={(e) => patch(i, { text: e.target.value })} /></Field>
            <div className="grid-2">
              <Field label="เริ่ม"><input className="input" type="date" value={a.start} onChange={(e) => patch(i, { start: e.target.value })} /></Field>
              <Field label="จบ"><input className="input" type="date" value={a.end} onChange={(e) => patch(i, { end: e.target.value })} /></Field>
            </div>
            <label className="row" style={{ fontSize: 14 }}>
              <input type="checkbox" checked={a.active} onChange={(e) => patch(i, { active: e.target.checked })} /> เปิดใช้ประกาศนี้
            </label>
          </Item>
        ))}
        <Add label="เพิ่มประกาศ" disabled={list.length >= SHOP_LIMITS.announcements} onClick={() => setList([...list, { id: uid("an"), text: "ประกาศใหม่", active: true, start: "", end: "" }])} />
      </Card>
    </>
  );
}

// คอลเลกชัน สินค้าจะเลือกอยู่ในคอลเลกชันได้ในแผงสินค้า
// ธีมตามเทศกาล: ตั้งวันเริ่มและจบแบบ MM-DD เกิดซ้ำทุกปี เมื่ออยู่ในช่วงจะเปลี่ยนสีและประกาศให้อัตโนมัติ
function SeasonsPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const list = data.seasons ?? [];
  const setList = (next: Season[]) => edit((d) => ({ ...d, seasons: next }));
  const patch = (i: number, p: Partial<Season>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  const mdOk = (v: string) => /^\d{2}-\d{2}$/.test(v);
  return (
    <Card title={`ธีมตามเทศกาล (${list.length}/${SHOP_LIMITS.seasons})`} actions={<span className="admin-hint">เกิดซ้ำทุกปี ช่วงข้ามปีได้ เช่น 12-25 ถึง 01-05</span>}>
      {list.map((s, i) => (
        <Item key={s.id} title={s.name} tag={s.active ? "เปิดใช้" : "ปิด"}>
          <div className="admin-item-head">
            เทศกาล {i + 1}
            <Controls index={i} count={list.length} onUp={() => setList(swap(list, i, i - 1))} onDown={() => setList(swap(list, i, i + 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="ชื่อเทศกาล"><input className="input" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
            <Field label="ข้อความประกาศ"><input className="input" value={s.announcement} onChange={(e) => patch(i, { announcement: e.target.value })} /></Field>
            <Field label="เริ่ม (MM-DD)" hint={mdOk(s.start) ? "" : "รูปแบบ 01-31"}><input className="input" value={s.start} onChange={(e) => patch(i, { start: e.target.value })} /></Field>
            <Field label="จบ (MM-DD)" hint={mdOk(s.end) ? "" : "รูปแบบ 01-31"}><input className="input" value={s.end} onChange={(e) => patch(i, { end: e.target.value })} /></Field>
          </div>
          <div className="grid-2">
            <ColorField label="สีหลัก" value={s.theme.primary} onChange={(v) => patch(i, { theme: { ...s.theme, primary: v } })} />
            <ColorField label="สีรอง" value={s.theme.accent} onChange={(v) => patch(i, { theme: { ...s.theme, accent: v } })} />
            <ColorField label="สีพื้นหลัง" value={s.theme.background} onChange={(v) => patch(i, { theme: { ...s.theme, background: v } })} />
            <ColorField label="สีตัวอักษร" value={s.theme.text} onChange={(v) => patch(i, { theme: { ...s.theme, text: v } })} />
          </div>
          <label className="row" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={s.active} onChange={(e) => patch(i, { active: e.target.checked })} /> เปิดใช้เทศกาลนี้
          </label>
        </Item>
      ))}
      <Add label="เพิ่มเทศกาล" disabled={list.length >= SHOP_LIMITS.seasons} onClick={() => setList([...list, { id: uid("ss"), name: "เทศกาลใหม่", start: "01-01", end: "01-03", announcement: "", theme: { primary: "#0b0b0b", accent: "#c8a165", background: "#f6f4f0", text: "#111111" }, active: false }])} />
    </Card>
  );
}

function CollectionsPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const list = data.collections;
  const setList = (next: Collection[]) => edit((d) => ({ ...d, collections: next }));
  const patch = (i: number, p: Partial<Collection>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  return (
    <Card title={`คอลเลกชัน (${list.length}/${SHOP_LIMITS.collections})`}>
      {list.map((c, i) => (
        <Item key={c.id} title={c.name} tag={`${data.products.filter((p) => p.collectionIds.includes(c.id)).length} ชิ้น`}>
          <div className="admin-item-head">
            คอลเลกชัน {i + 1}
            <Controls index={i} count={list.length} onUp={() => setList(swap(list, i, i - 1))} onDown={() => setList(swap(list, i, i + 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="ชื่อคอลเลกชัน"><input className="input" value={c.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
            <Field label="คำอธิบาย"><input className="input" value={c.description} onChange={(e) => patch(i, { description: e.target.value })} /></Field>
          </div>
          <ImageField label="รูปคอลเลกชัน" value={c.image} onChange={(image) => patch(i, { image })} />
        </Item>
      ))}
      <Add label="เพิ่มคอลเลกชัน" disabled={list.length >= SHOP_LIMITS.collections} onClick={() => setList([...list, { id: uid("col"), name: "คอลเลกชันใหม่", description: "", image: "" }])} />
    </Card>
  );
}

// คูปอง: ประเภท มูลค่า ยอดขั้นต่ำ จำนวนสิทธิ์ และขอบเขตหมวดหรือคอลเลกชัน
function CouponsPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const list = data.coupons;
  const setList = (next: Coupon[]) => edit((d) => ({ ...d, coupons: next }));
  const patch = (i: number, p: Partial<Coupon>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  return (
    <Card title={`คูปองส่วนลด (${list.length}/${SHOP_LIMITS.coupons})`}>
      {list.map((c, i) => (
        <Item key={c.id} title={c.code || "(ไม่มีรหัส)"} tag={`ใช้แล้ว ${c.used}${c.usageLimit ? `/${c.usageLimit}` : ""}`}>
          <div className="admin-item-head">
            คูปอง {i + 1}
            <Controls index={i} count={list.length} onUp={() => setList(swap(list, i, i - 1))} onDown={() => setList(swap(list, i, i + 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="รหัสคูปอง" hint="A-Z 0-9 _ -"><input className="input" value={c.code} onChange={(e) => patch(i, { code: e.target.value.toUpperCase() })} /></Field>
            <Field label="ประเภทส่วนลด">
              <select className="input" value={c.type} onChange={(e) => patch(i, { type: e.target.value as Coupon["type"] })}>
                <option value="percent">เปอร์เซ็นต์ (%)</option>
                <option value="fixed">จำนวนบาท</option>
              </select>
            </Field>
            <Field label={c.type === "percent" ? "ส่วนลด (%)" : "ส่วนลด (บาท)"}><input className="input" type="number" min={1} value={c.value} onChange={(e) => patch(i, { value: Number(e.target.value) })} /></Field>
            <Field label="ยอดขั้นต่ำ (บาท)"><input className="input" type="number" min={0} value={c.minSpend} onChange={(e) => patch(i, { minSpend: Number(e.target.value) })} /></Field>
            <Field label="จำนวนสิทธิ์ทั้งหมด" hint="0 = ไม่จำกัด"><input className="input" type="number" min={0} value={c.usageLimit} onChange={(e) => patch(i, { usageLimit: Number(e.target.value) })} /></Field>
            <Field label="ใช้ไปแล้ว" hint="ระบบนับให้เองเมื่อมีการสั่งซื้อจริง"><input className="input" value={c.used} readOnly /></Field>
            <Field label="ใช้กับ">
              <select className="input" value={c.scope} onChange={(e) => patch(i, { scope: e.target.value as Coupon["scope"], scopeId: "" })}>
                <option value="all">ทุกสินค้า</option>
                <option value="category">เฉพาะหมวดหมู่</option>
                <option value="collection">เฉพาะคอลเลกชัน</option>
              </select>
            </Field>
            {c.scope !== "all" && (
              <Field label={c.scope === "category" ? "หมวดหมู่" : "คอลเลกชัน"}>
                <select className="input" value={c.scopeId} onChange={(e) => patch(i, { scopeId: e.target.value })}>
                  <option value="">เลือก...</option>
                  {(c.scope === "category" ? data.categories : data.collections).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="เริ่มใช้ได้" hint="ว่างคือไม่จำกัด"><input className="input" type="date" value={c.start} onChange={(e) => patch(i, { start: e.target.value })} /></Field>
            <Field label="หมดอายุ" hint="ว่างคือไม่จำกัด"><input className="input" type="date" value={c.end} onChange={(e) => patch(i, { end: e.target.value })} /></Field>
          </div>
          <label className="row" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={c.active} onChange={(e) => patch(i, { active: e.target.checked })} /> เปิดใช้คูปองนี้
          </label>
        </Item>
      ))}
      <Add
        label="เพิ่มคูปอง"
        disabled={list.length >= SHOP_LIMITS.coupons}
        onClick={() => setList([...list, { id: uid("cp"), code: "NEWCODE", type: "percent", value: 10, minSpend: 0, usageLimit: 0, used: 0, scope: "all", scopeId: "", active: true, start: "", end: "" }])}
      />
    </Card>
  );
}

// เปิดปิดส่วนของหน้าร้าน ลำดับคงที่ตามหน้าเว็บ
const SECTION_LABELS: Record<SectionId, string> = {
  announcement: "แถบประกาศบนสุด",
  hero: "แบนเนอร์หน้าแรก",
  popular: "สินค้ายอดนิยม",
  collections: "คอลเลกชัน",
  trending: "กำลังมาแรง",
  branches: "สาขา",
  newsletter: "ฝากอีเมลรับข่าว",
};

function SectionsPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const setSection = (id: SectionId, enabled: boolean) =>
    edit((d) => ({ ...d, sections: d.sections.map((s: Section) => (s.id === id ? { ...s, enabled } : s)) }));
  return (
    <Card title="ส่วนของหน้าร้าน" actions={<span className="admin-hint">เปิดหรือปิดส่วนแต่ละส่วน</span>}>
      {data.sections.map((s) => (
        <label key={s.id} className="row" style={{ fontSize: 14, padding: "6px 0" }}>
          <input type="checkbox" checked={s.enabled} onChange={(e) => setSection(s.id, e.target.checked)} /> {SECTION_LABELS[s.id]}
        </label>
      ))}
    </Card>
  );
}

function BranchesPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const list = data.branches;
  const setList = (next: Branch[]) => edit((d) => ({ ...d, branches: next }));
  const patch = (i: number, p: Partial<Branch>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  return (
    <Card title={`สาขา (${list.length}/${SHOP_LIMITS.branches})`}>
      {list.map((b, i) => (
        <Item key={b.id} title={b.name}>
          <div className="admin-item-head">
            สาขา {i + 1}
            <Controls index={i} count={list.length} onUp={() => setList(swap(list, i, i - 1))} onDown={() => setList(swap(list, i, i + 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <Field label="ชื่อสาขา"><input className="input" value={b.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
          <Field label="ที่อยู่"><textarea className="input" rows={2} value={b.address} onChange={(e) => patch(i, { address: e.target.value })} /></Field>
          <Field label="เวลาเปิด"><input className="input" value={b.hours} onChange={(e) => patch(i, { hours: e.target.value })} /></Field>
        </Item>
      ))}
      <Add label="เพิ่มสาขา" disabled={list.length >= SHOP_LIMITS.branches} onClick={() => setList([...list, { id: uid("br"), name: "สาขาใหม่", address: "", hours: "" }])} />
    </Card>
  );
}

function OptionList({ title, items, onChange }: { title: string; items: Option[]; onChange: (next: Option[]) => void }) {
  return (
    <div className="admin-card" style={{ gap: 10 }}>
      <h3>{title} ({items.length}/{SHOP_LIMITS.options})</h3>
      {items.map((o, i) => (
        <div key={o.id} className="row" style={{ flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 160 }} value={o.name} onChange={(e) => onChange(replaceAt(items, i, { ...o, name: e.target.value }))} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "#e5484d" }} onClick={() => onChange(removeAt(items, i))}>
            ลบ
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" disabled={items.length >= SHOP_LIMITS.options} onClick={() => onChange([...items, { id: uid("o"), name: "" }])}>
        + เพิ่ม{title}
      </button>
    </div>
  );
}

function StorePanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const [sizeDraft, setSizeDraft] = useState("");
  const addSize = () => {
    const s = sizeDraft.trim();
    if (!s || data.sizes.includes(s) || data.sizes.length >= SHOP_LIMITS.sizes) return;
    edit((d) => ({ ...d, sizes: [...d.sizes, s] }));
    setSizeDraft("");
  };
  return (
    <>
      <Card title="ข้อมูลร้าน">
        <div className="grid-2">
          <Field label="ชื่อร้าน"><input className="input" value={data.brandName} onChange={(e) => edit((d) => ({ ...d, brandName: e.target.value }))} /></Field>
          <Field label="คำโปรย"><input className="input" value={data.tagline} onChange={(e) => edit((d) => ({ ...d, tagline: e.target.value }))} /></Field>
          <Field label="อีเมลติดต่อ"><input className="input" value={data.footer.email} onChange={(e) => edit((d) => ({ ...d, footer: { ...d.footer, email: e.target.value } }))} /></Field>
          <Field label="ลิงก์ LINE (https://)"><input className="input" value={data.footer.lineUrl} onChange={(e) => edit((d) => ({ ...d, footer: { ...d.footer, lineUrl: e.target.value } }))} /></Field>
        </div>
        <Field label="ข้อความท้ายเว็บ"><input className="input" value={data.footer.note} onChange={(e) => edit((d) => ({ ...d, footer: { ...d.footer, note: e.target.value } }))} /></Field>
      </Card>
      <Card title="ไซส์ของร้าน">
        <div className="chip-row">
          {data.sizes.map((s) => (
            <span key={s} className="chip on" style={{ display: "inline-flex", gap: 6 }}>
              {s}
              <button type="button" aria-label={`ลบไซส์ ${s}`} onClick={() => edit((d) => ({ ...d, sizes: d.sizes.filter((x) => x !== s) }))} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer" }}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="row">
          <input className="input" style={{ width: 160 }} placeholder="เช่น 4XL" value={sizeDraft} onChange={(e) => setSizeDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSize()} />
          <button type="button" className="btn btn-ghost" onClick={addSize}>
            + เพิ่มไซส์
          </button>
        </div>
      </Card>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <OptionList title="หมวดหมู่" items={data.categories} onChange={(categories) => edit((d) => ({ ...d, categories }))} />
        <OptionList title="ประเภท" items={data.types} onChange={(types) => edit((d) => ({ ...d, types }))} />
      </div>
      <OptionList title="แบรนด์" items={data.brands} onChange={(brands) => edit((d) => ({ ...d, brands }))} />
      <Card title="ข้อมูลการโอนเงิน (แสดงหลังลูกค้าสั่งซื้อ)">
        <div className="grid-2">
          <Field label="ธนาคาร"><input className="input" value={data.payment.bankName} onChange={(e) => edit((d) => ({ ...d, payment: { ...d.payment, bankName: e.target.value } }))} /></Field>
          <Field label="ชื่อบัญชี"><input className="input" value={data.payment.accountName} onChange={(e) => edit((d) => ({ ...d, payment: { ...d.payment, accountName: e.target.value } }))} /></Field>
          <Field label="เลขบัญชี"><input className="input" value={data.payment.accountNo} onChange={(e) => edit((d) => ({ ...d, payment: { ...d.payment, accountNo: e.target.value } }))} /></Field>
          <Field label="พร้อมเพย์"><input className="input" value={data.payment.promptpay} onChange={(e) => edit((d) => ({ ...d, payment: { ...d.payment, promptpay: e.target.value } }))} /></Field>
        </div>
      </Card>
      <SectionsPanel data={data} edit={edit} />
      <BranchesPanel data={data} edit={edit} />
    </>
  );
}

// แผงสินค้า: เพิ่มคอลเลกชัน ติดป้ายยอดนิยมหรือกำลังมาแรง และตารางไซส์
function ProductsPanel({ data, edit }: { data: Shop; edit: (fn: (d: Shop) => Shop) => void }) {
  const list = data.products;
  const setList = (next: Product[]) => edit((d) => ({ ...d, products: next }));
  const patch = (i: number, p: Partial<Product>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  const [fresh, setFresh] = useState<string | null>(null);

  return (
    <Card title={`สินค้า (${list.length}/${SHOP_LIMITS.products})`} actions={<span className="admin-hint">มือ 2 มีชิ้นเดียวและไซส์เดียวเสมอ</span>}>
      {list.map((p, i) => (
        <details key={p.id} className="admin-item" open={p.id === fresh}>
          <summary>
            <span className="admin-item-title">{p.name || "(ยังไม่ตั้งชื่อ)"}</span>
            <span className="admin-item-tag">{p.condition === "used" ? "มือ 2" : "มือ 1"}</span>
            {p.popular && <span className="admin-item-tag">ยอดนิยม</span>}
            {p.trending && <span className="admin-item-tag">มาแรง</span>}
          </summary>
          <div className="admin-item-body">
            <div className="admin-item-head">
              สินค้า {i + 1}
              <Controls index={i} count={list.length} onUp={() => setList(swap(list, i, i - 1))} onDown={() => setList(swap(list, i, i + 1))} onRemove={() => setList(removeAt(list, i))} />
            </div>
            <div className="grid-2">
              <Field label="ชื่อสินค้า"><input className="input" value={p.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
              <Field label="ราคา (บาท)"><input className="input" type="number" min={0} value={p.price} onChange={(e) => patch(i, { price: Number(e.target.value) })} /></Field>
              <Field label="แบรนด์">
                <select className="input" value={p.brandId} onChange={(e) => patch(i, { brandId: e.target.value })}>
                  {data.brands.map((b) => <option key={b.id} value={b.id}>{b.name || "(ไม่มีชื่อ)"}</option>)}
                </select>
              </Field>
              <Field label="หมวดหมู่">
                <select className="input" value={p.categoryId} onChange={(e) => patch(i, { categoryId: e.target.value })}>
                  {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name || "(ไม่มีชื่อ)"}</option>)}
                </select>
              </Field>
              <Field label="ประเภท">
                <select className="input" value={p.typeId} onChange={(e) => patch(i, { typeId: e.target.value })}>
                  {data.types.map((t) => <option key={t.id} value={t.id}>{t.name || "(ไม่มีชื่อ)"}</option>)}
                </select>
              </Field>
              <Field label="สภาพ">
                <select
                  className="input"
                  value={p.condition}
                  onChange={(e) => {
                    const condition = e.target.value as Condition;
                    const variants: Variant[] =
                      condition === "used" ? [{ size: p.variants[0]?.size ?? data.sizes[0] ?? "", qty: 1 }] : p.variants.length ? p.variants : [{ size: data.sizes[0] ?? "", qty: 1 }];
                    patch(i, { condition, variants });
                  }}
                >
                  <option value="new">มือ 1</option>
                  <option value="used">มือ 2 (ชิ้นเดียว)</option>
                </select>
              </Field>
            </div>
            <Field label="รายละเอียด"><textarea className="input" rows={3} value={p.description} onChange={(e) => patch(i, { description: e.target.value })} /></Field>
            <Field label="ตารางไซส์ (แสดงในหน้าสินค้า)"><textarea className="input" rows={2} value={p.sizeGuide} onChange={(e) => patch(i, { sizeGuide: e.target.value })} /></Field>
            <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
              <label className="row" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={p.popular} onChange={(e) => patch(i, { popular: e.target.checked })} /> แสดงในสินค้ายอดนิยม
              </label>
              <label className="row" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={p.trending} onChange={(e) => patch(i, { trending: e.target.checked })} /> แสดงในกำลังมาแรง
              </label>
            </div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>คอลเลกชัน:</span>
              {data.collections.map((c) => {
                const on = p.collectionIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip ${on ? "on" : ""}`}
                    onClick={() => patch(i, { collectionIds: on ? p.collectionIds.filter((x) => x !== c.id) : [...p.collectionIds, c.id] })}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <VariantEditor product={p} sizes={data.sizes} onChange={(variants) => patch(i, { variants })} />
            <div className="grid-2" style={{ alignItems: "start" }}>
              <ColorField label="สีประจำสินค้า (ใช้เมื่อไม่มีรูป)" value={p.color} onChange={(color) => patch(i, { color })} />
              <ImageField label="รูปสินค้า (ตัดพื้นหลังอัตโนมัติ)" value={p.image} onChange={(image) => patch(i, { image })} onProcessed={(r) => patch(i, { hook: r.hook })} hint="ระบบตรวจรูปและตัดพื้นหลังให้ ถ้ารูปไม่ผ่านจะแจ้งเหตุผล" />
            </div>
            <ImageField label="รูปด้านข้าง (ถ้ามี)" value={p.side} onChange={(side) => patch(i, { side })} />
          </div>
        </details>
      ))}
      <Add
        label="เพิ่มสินค้า"
        disabled={list.length >= SHOP_LIMITS.products || data.brands.length === 0 || data.categories.length === 0 || data.types.length === 0}
        onClick={() => {
          const id = uid("p");
          setFresh(id);
          setList([
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
              sizeGuide: "",
              image: "",
              views: [],
              side: "",
              hook: { x: 50, y: 10 },
              color: "#2f4f3e",
              variants: [{ size: data.sizes[0] ?? "", qty: 1 }],
              collectionIds: [],
              popular: false,
              trending: false,
            },
          ]);
        }}
      />
    </Card>
  );
}

function VariantEditor({ product, sizes, onChange }: { product: Product; sizes: string[]; onChange: (v: Variant[]) => void }) {
  const used = product.condition === "used";
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>ไซส์และจำนวนคงเหลือ</span>
      {product.variants.map((v, i) => (
        <div key={i} className="row" style={{ flexWrap: "wrap" }}>
          <select className="input" style={{ width: 120 }} value={v.size} onChange={(e) => onChange(replaceAt(product.variants, i, { ...v, size: e.target.value }))}>
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input" type="number" min={0} style={{ width: 120 }} disabled={used} value={v.qty} onChange={(e) => onChange(replaceAt(product.variants, i, { ...v, qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} />
          {!used && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "#e5484d" }} onClick={() => onChange(removeAt(product.variants, i))}>
              ลบไซส์นี้
            </button>
          )}
        </div>
      ))}
      {!used && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} disabled={product.variants.length >= SHOP_LIMITS.variants} onClick={() => onChange([...product.variants, { size: sizes[0] ?? "", qty: 1 }])}>
          + เพิ่มไซส์
        </button>
      )}
    </div>
  );
}

export function ShopStudio({ initial }: { initial: Shop }) {
  const [data, setData] = useState<Shop>(initial);
  const [tab, setTab] = useState<Tab>("theme");
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
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">
            คำสั่งซื้อ
          </Link>
          <Link href="/shop" target="_blank" className="btn btn-ghost btn-sm">
            ดูหน้าร้านจริง ↗
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </div>

      <div className="studio">
        <div className="studio-main">
          <nav className="studio-tabs" aria-label="หมวดของร้าน">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="studio-panel">
            {tab === "theme" && <ThemePanel data={data} edit={edit} />}
            {tab === "home" && (
              <>
                <BannersPanel data={data} edit={edit} />
                <SectionsPanel data={data} edit={edit} />
              </>
            )}
            {tab === "campaigns" && (
              <>
                <SeasonsPanel data={data} edit={edit} />
                <CampaignsPanel data={data} edit={edit} />
              </>
            )}
            {tab === "collections" && <CollectionsPanel data={data} edit={edit} />}
            {tab === "products" && <ProductsPanel data={data} edit={edit} />}
            {tab === "coupons" && <CouponsPanel data={data} edit={edit} />}
            {tab === "store" && <StorePanel data={data} edit={edit} />}
          </div>
        </div>
        <aside className="studio-live" aria-label="พรีวิวหน้าร้าน">
          <div className="studio-live-head">พรีวิวสด (ตามข้อมูลที่กำลังแก้ ยังไม่บันทึก)</div>
          <div className="studio-live-frame">
            <Storefront shop={data} preview />
          </div>
        </aside>
      </div>

      {toast && <div className={`admin-toast ${toast.error ? "error" : ""}`}>{toast.text}</div>}
    </div>
  );
}

