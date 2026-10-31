"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Brand, BrandIcon, Content, HistoryItem, Member, Plan, Project, Service, Step } from "@/lib/types";

type TabKey = "site" | "services" | "projects" | "brands" | "process" | "plans" | "team" | "contact";
const TABS: { key: TabKey; label: string }[] = [
  { key: "site", label: "ข้อมูลทั่วไป" },
  { key: "services", label: "บริการ" },
  { key: "projects", label: "ผลงาน" },
  { key: "brands", label: "ธุรกิจในเครือ" },
  { key: "process", label: "ขั้นตอน" },
  { key: "plans", label: "แพ็กเกจ" },
  { key: "team", label: "ทีมงาน" },
  { key: "contact", label: "ฟอร์มติดต่อ" },
];

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ย้ายตำแหน่งรายการขึ้น/ลง
function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
const removeAt = <T,>(list: T[], i: number): T[] => list.filter((_, idx) => idx !== i);
const replaceAt = <T,>(list: T[], i: number, value: T): T[] => list.map((x, idx) => (idx === i ? value : x));

export function AdminEditor({ initial }: { initial: Content }) {
  const router = useRouter();
  const [data, setData] = useState<Content>(initial);
  const [tab, setTab] = useState<TabKey>("site");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  // เตือนก่อนปิดหน้าถ้ามีการแก้ไขที่ยังไม่บันทึก
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // แก้ไขข้อมูลแบบ immutable แล้วทำเครื่องหมายว่ายังไม่บันทึก
  function edit(fn: (d: Content) => Content) {
    setData((d) => fn(structuredClone(d)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || `บันทึกไม่สำเร็จ (${res.status})`);
      setDirty(false);
      setToast({ text: "บันทึกแล้ว · Vercel กำลัง deploy ประมาณ 1–2 นาที" });
    } catch (err) {
      setToast({ text: (err as Error).message, error: true });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const counts: Partial<Record<TabKey, number>> = {
    services: data.services.length,
    projects: data.projects.length,
    brands: data.brands.length,
    process: data.process.length,
    plans: data.plans.length,
    team: data.team.length,
  };

  return (
    <div className="admin">
      <div className="admin-top">
        <div className="admin-top-inner">
          <strong className="brand" style={{ fontSize: 15 }}>
            <span className="brand-dot" /> Admin
          </strong>
          <span className={`admin-status ${dirty ? "dirty" : ""}`}>{dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกล่าสุดแล้ว"}</span>
          <div className="spacer" />
          <Link href="/admin/shop" className="btn btn-ghost btn-sm">
            ร้านเสื้อผ้า
          </Link>
          <Link href="/" target="_blank" className="btn btn-ghost btn-sm">
            ดูเว็บ ↗
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            ออกจากระบบ
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </div>

      <div className="admin-body">
        <nav className="admin-tabs" aria-label="หมวดข้อมูล">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`admin-tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}>
              <span>{t.label}</span>
              {counts[t.key] !== undefined && <span className="admin-tab-count">{counts[t.key]}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-panel">
          {tab === "site" && <SitePanel data={data} edit={edit} />}
          {tab === "services" && <ServicesPanel data={data} edit={edit} goTo={setTab} />}
          {tab === "projects" && <ProjectsPanel data={data} edit={edit} />}
          {tab === "brands" && <BrandsPanel data={data} edit={edit} />}
          {tab === "process" && <ProcessPanel data={data} edit={edit} />}
          {tab === "plans" && <PlansPanel data={data} edit={edit} />}
          {tab === "team" && <TeamPanel data={data} edit={edit} />}
          {tab === "contact" && <ContactPanel data={data} edit={edit} />}
        </div>
      </div>

      {toast && <div className={`admin-toast ${toast.error ? "error" : ""}`}>{toast.text}</div>}
    </div>
  );
}

type Edit = (fn: (d: Content) => Content) => void;

/* ---------- shared field components ---------- */

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="admin-hint">{hint}</span>}
    </div>
  );
}

function Text({ value, onChange, multiline, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; type?: string }) {
  return multiline ? (
    <textarea className="input" rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
}

// กรอกหลายบรรทัด/คั่นด้วยคอมมา: เก็บเป็นข้อความชั่วคราว แล้วค่อยบันทึกตอน blur
function ListText({ value, onCommit, multiline, placeholder }: { value: string[]; onCommit: (v: string[]) => void; multiline?: boolean; placeholder?: string }) {
  const sep = multiline ? "\n" : ",";
  const [raw, setRaw] = useState(value.join(multiline ? "\n" : ", "));
  return (
    <textarea
      className="input"
      rows={multiline ? 4 : 2}
      value={raw}
      placeholder={placeholder}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => onCommit(raw.split(sep).map((s) => s.trim()).filter(Boolean))}
    />
  );
}

function ItemControls({ index, count, onUp, onDown, onRemove }: { index: number; count: number; onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <>
      <span style={{ flex: 1 }} />
      <button type="button" className="btn btn-ghost btn-sm" onClick={onUp} disabled={index === 0} aria-label="เลื่อนขึ้น">
        ↑
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDown} disabled={index === count - 1} aria-label="เลื่อนลง">
        ↓
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove} style={{ color: "#e5484d" }}>
        ลบ
      </button>
    </>
  );
}

function AddButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" className="btn btn-ghost" onClick={onClick} disabled={disabled}>
      + {label}
    </button>
  );
}

/* ---------- panels ---------- */

function SitePanel({ data, edit }: { data: Content; edit: Edit }) {
  const s = data.site;
  const set = (key: keyof Content["site"], v: string) => edit((d) => ({ ...d, site: { ...d.site, [key]: v } }));
  return (
    <>
      <div className="admin-card">
        <h3>ข้อความหน้าแรก</h3>
        <div className="grid-2">
          <Field label="ชื่อเว็บ / แบรนด์"><Text value={s.name} onChange={(v) => set("name", v)} /></Field>
          <Field label="Tagline"><Text value={s.tagline} onChange={(v) => set("tagline", v)} /></Field>
        </div>
        <Field label="Badge เล็กด้านบนหัวข้อ"><Text value={s.badge} onChange={(v) => set("badge", v)} /></Field>
        <Field label="หัวข้อหลัก" hint="คำสุดท้ายสองคำจะถูกไล่สีให้เด่น"><Text multiline value={s.headline} onChange={(v) => set("headline", v)} /></Field>
        <Field label="คำอธิบายใต้หัวข้อ"><Text multiline value={s.subheadline} onChange={(v) => set("subheadline", v)} /></Field>
      </div>
      <div className="admin-card">
        <h3>ปุ่มและการติดต่อ</h3>
        <div className="grid-2">
          <Field label="ปุ่มหลัก"><Text value={s.ctaPrimary} onChange={(v) => set("ctaPrimary", v)} /></Field>
          <Field label="ปุ่มรอง"><Text value={s.ctaSecondary} onChange={(v) => set("ctaSecondary", v)} /></Field>
        </div>
        <Field label="อีเมลติดต่อ"><Text type="email" value={s.email} onChange={(v) => set("email", v)} /></Field>
        <Field label="ข้อความ footer"><Text value={s.footer} onChange={(v) => set("footer", v)} /></Field>
      </div>
      <div className="admin-card">
        <h3>เทคโนโลยีที่แสดงแถบด้านล่างหน้าแรก</h3>
        <Field label="คั่นด้วยคอมมา" hint="คลิกออกจากช่องเพื่อบันทึกรายการ">
          <ListText value={data.stack} onCommit={(v) => edit((d) => ({ ...d, stack: v }))} />
        </Field>
      </div>
    </>
  );
}

// รายการที่พับเก็บได้ หัวแสดงชื่อและป้ายสั้นๆ ส่วนปุ่มจัดการอยู่ในเนื้อหาด้านใน
function Item({ title, tag, children, open }: { title: string; tag?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="admin-item" open={open}>
      <summary>
        <span className="admin-item-title">{title || "(ยังไม่ตั้งชื่อ)"}</span>
        {tag && <span className="admin-item-tag">{tag}</span>}
      </summary>
      <div className="admin-item-body">{children}</div>
    </details>
  );
}

function ServicesPanel({ data, edit, goTo }: { data: Content; edit: Edit; goTo: (t: TabKey) => void }) {
  const list = data.services;
  const setList = (next: Service[]) => edit((d) => ({ ...d, services: next }));
  const linkedOf = (id: string) => data.projects.filter((p) => p.serviceId === id);

  // เพิ่มผลงานใหม่ที่ผูกกับบริการนี้ไว้ล่วงหน้า แล้วพาไปแท็บผลงานเพื่อกรอกรายละเอียด
  function addProjectFor(serviceId: string) {
    edit((d) => ({
      ...d,
      projects: [
        ...d.projects,
        { id: uid("w"), title: "ผลงานใหม่", client: "", category: "", description: "", tags: [], url: "", image: "", color: "#0070f3", featured: false, serviceId, demoUrl: "", frame: "browser" },
      ],
    }));
    goTo("projects");
  }

  return (
    <div className="admin-card">
      <div className="admin-head">
        <h2>บริการ</h2>
        <span className="admin-hint">{list.length}/12 รายการ · ผลงานที่ผูกไว้จะขึ้นในป๊อปอัปของแต่ละบริการ</span>
      </div>
      {list.map((s, i) => {
        const linked = linkedOf(s.id);
        return (
          <Item key={s.id} title={s.title} tag={`ผลงาน ${linked.length}`}>
            <div className="admin-item-head">
              #{i + 1}
              <ItemControls index={i} count={list.length} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onRemove={() => setList(removeAt(list, i))} />
            </div>
            <div className="grid-2">
              <Field label="ชื่อบริการ"><Text value={s.title} onChange={(v) => setList(replaceAt(list, i, { ...s, title: v }))} /></Field>
              <Field label="ระยะเวลา"><Text value={s.eta} onChange={(v) => setList(replaceAt(list, i, { ...s, eta: v }))} /></Field>
            </div>
            <Field label="รายละเอียด"><Text multiline value={s.description} onChange={(v) => setList(replaceAt(list, i, { ...s, description: v }))} /></Field>

            <div className="admin-linked-box" style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>ผลงานในบริการนี้</span>
              {linked.length > 0 ? (
                <div className="admin-linked">
                  {linked.map((p) => (
                    <span key={p.id} className="project-tag">
                      {p.title}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="admin-hint">ยังไม่มีผลงานผูกกับบริการนี้ ป๊อปอัปจะไม่ถูกเปิดจนกว่าจะมีผลงาน</span>
              )}
              <div className="row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addProjectFor(s.id)}>
                  + เพิ่มผลงานในบริการนี้
                </button>
                {linked.length > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo("projects")}>
                    จัดการผลงาน →
                  </button>
                )}
              </div>
            </div>
          </Item>
        );
      })}
      <AddButton disabled={list.length >= 12} label="เพิ่มบริการ" onClick={() => setList([...list, { id: uid("s"), title: "บริการใหม่", description: "", eta: "" }])} />
    </div>
  );
}

function ProjectsPanel({ data, edit }: { data: Content; edit: Edit }) {
  const list = data.projects;
  const setList = (next: Project[]) => edit((d) => ({ ...d, projects: next }));
  // รายการที่เพิ่งกดเพิ่มจะเปิดขึ้นมาให้กรอกทันที
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="admin-card">
      <h3>ผลงาน ({list.length}/12)</h3>
      <p className="admin-hint" style={{ margin: 0 }}>
        ติ๊ก “งานเด่น” เพื่อให้การ์ดนั้นกินพื้นที่ 2 คอลัมน์ ถ้าไม่ใส่รูป ระบบจะวาดพรีวิวจากสีของงานให้เอง
      </p>
      {list.map((p, i) => (
        <Item key={p.id} title={p.title} open={p.id === fresh} tag={data.services.find((s) => s.id === p.serviceId)?.title ?? "ไม่ผูกกับบริการ"}>
          <div className="admin-item-head">
            ผลงาน {i + 1}
            <ItemControls index={i} count={list.length} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="ชื่อผลงาน"><Text value={p.title} onChange={(v) => setList(replaceAt(list, i, { ...p, title: v }))} /></Field>
            <Field label="ลูกค้า"><Text value={p.client} onChange={(v) => setList(replaceAt(list, i, { ...p, client: v }))} /></Field>
            <Field label="หมวดงาน"><Text value={p.category} onChange={(v) => setList(replaceAt(list, i, { ...p, category: v }))} /></Field>
            <Field label="ลิงก์เว็บไซต์" hint="ว่างได้ ต้องขึ้นต้นด้วย https://"><Text type="url" value={p.url} onChange={(v) => setList(replaceAt(list, i, { ...p, url: v }))} /></Field>
          </div>
          <Field label="รายละเอียด"><Text multiline value={p.description} onChange={(v) => setList(replaceAt(list, i, { ...p, description: v }))} /></Field>
          <Field label="แท็กเทคโนโลยี" hint="คั่นด้วยคอมมา คลิกออกจากช่องเพื่อบันทึก">
            <ListText value={p.tags} onCommit={(v) => setList(replaceAt(list, i, { ...p, tags: v }))} />
          </Field>
          <div className="grid-2">
            <Field label="สีประจำผลงาน (ใช้กับพรีวิว)">
              <div className="row">
                <input type="color" value={p.color} onChange={(e) => setList(replaceAt(list, i, { ...p, color: e.target.value }))} style={{ width: 44, height: 40, border: 0, background: "none", padding: 0 }} aria-label="เลือกสี" />
                <Text value={p.color} onChange={(v) => setList(replaceAt(list, i, { ...p, color: v }))} />
              </div>
            </Field>
            <Field label="งานเด่น">
              <label className="row" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={p.featured} onChange={(e) => setList(replaceAt(list, i, { ...p, featured: e.target.checked }))} /> กินพื้นที่ 2 คอลัมน์
              </label>
            </Field>
          </div>
          <div className="grid-2">
            <Field label="แสดงในหมวดบริการ" hint="ผลงานจะขึ้นในป๊อปอัปของบริการที่เลือก">
              <select className="input" value={p.serviceId} onChange={(e) => setList(replaceAt(list, i, { ...p, serviceId: e.target.value }))}>
                <option value="">ไม่ผูกกับบริการ</option>
                {data.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="รูปแบบการแสดง demo">
              <select className="input" value={p.frame} onChange={(e) => setList(replaceAt(list, i, { ...p, frame: e.target.value === "phone" ? "phone" : "browser" }))}>
                <option value="browser">กรอบ browser (เว็บ/แดชบอร์ด)</option>
                <option value="phone">กรอบมือถือ (แอป)</option>
              </select>
            </Field>
          </div>
          <Field label="ลิงก์ live demo (https)" hint="ว่างได้ ต้องเป็นเว็บที่อนุญาตให้ฝังได้ (ตั้ง frame-ancestors) ถ้าไม่ได้จะใช้รูปปกแทน">
            <Text type="url" value={p.demoUrl} onChange={(v) => setList(replaceAt(list, i, { ...p, demoUrl: v }))} />
          </Field>
          <ImageField value={p.image} onChange={(v) => setList(replaceAt(list, i, { ...p, image: v }))} />
        </Item>
      ))}
      <AddButton
        disabled={list.length >= 12}
        label="เพิ่มผลงาน"
        onClick={() => {
          const id = uid("w");
          setFresh(id);
          setList([
            ...list,
            { id, title: "ผลงานใหม่", client: "", category: "", description: "", tags: [], url: "", image: "", color: "#0070f3", featured: false, serviceId: "", demoUrl: "", frame: "browser" },
          ]);
        }}
      />
    </div>
  );
}

function BrandsPanel({ data, edit }: { data: Content; edit: Edit }) {
  const list = data.brands;
  const setList = (next: Brand[]) => edit((d) => ({ ...d, brands: next }));
  return (
    <div className="admin-card">
      <div className="admin-head">
        <h2>ธุรกิจในเครือ</h2>
        <span className="admin-hint">{list.length}/8 รายการ · ขึ้นเป็นการ์ดในหัวข้อ “ในเครือ” ของหน้าแรก</span>
      </div>
      {list.map((b, i) => (
        <Item key={b.id} title={b.name} tag={b.url ? "มีลิงก์" : "ยังไม่มีลิงก์"}>
          <div className="admin-item-head">
            ธุรกิจ {i + 1}
            <ItemControls index={i} count={list.length} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="ชื่อธุรกิจ"><Text value={b.name} onChange={(v) => setList(replaceAt(list, i, { ...b, name: v }))} /></Field>
            <Field label="คำโปรย (บรรทัดเดียว)"><Text value={b.tagline} onChange={(v) => setList(replaceAt(list, i, { ...b, tagline: v }))} /></Field>
          </div>
          <Field label="รายละเอียด"><Text multiline value={b.description} onChange={(v) => setList(replaceAt(list, i, { ...b, description: v }))} /></Field>
          <div className="grid-2">
            <Field label="ลิงก์ (https:// หรือ path ภายในเว็บ)" hint="ว่างได้ ถ้าว่างการ์ดจะไม่เป็นลิงก์ ตัวอย่าง: https://example.com หรือ /shop">
              <Text value={b.url} onChange={(v) => setList(replaceAt(list, i, { ...b, url: v }))} />
            </Field>
            <Field label="สีประจำธุรกิจ">
              <div className="row">
                <input type="color" value={b.color} onChange={(e) => setList(replaceAt(list, i, { ...b, color: e.target.value }))} style={{ width: 44, height: 40, border: 0, background: "none", padding: 0 }} aria-label="เลือกสี" />
                <Text value={b.color} onChange={(v) => setList(replaceAt(list, i, { ...b, color: v }))} />
              </div>
            </Field>
          </div>
          <div className="grid-2">
            <Field label="ไอคอนบนการ์ด" hint="ใช้เมื่อไม่ได้ใส่รูป">
              <select className="input" value={b.icon} onChange={(e) => setList(replaceAt(list, i, { ...b, icon: e.target.value as BrandIcon }))}>
                <option value="shirt">เสื้อผ้า</option>
                <option value="store">ร้านค้า</option>
                <option value="code">เว็บ / ซอฟต์แวร์</option>
                <option value="coffee">คาเฟ่ / อาหาร</option>
                <option value="globe">ทั่วไป</option>
                <option value="spark">แบรนด์ / ไลฟ์สไตล์</option>
              </select>
            </Field>
          </div>
          <ImageField value={b.image} onChange={(v) => setList(replaceAt(list, i, { ...b, image: v }))} />
        </Item>
      ))}
      <AddButton
        disabled={list.length >= 8}
        label="เพิ่มธุรกิจ"
        onClick={() => setList([...list, { id: uid("b"), name: "ธุรกิจใหม่", tagline: "", description: "", url: "", image: "", color: "#0070f3", icon: "store" }])}
      />
    </div>
  );
}

// เลือกรูปจากเครื่อง อัปโหลดขึ้น GitHub ผ่าน API แล้วเก็บ path ที่ได้ไว้ในข้อมูล
function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    <Field label="รูปพรีวิว (PNG, JPG หรือ WebP ไม่เกิน 2 MB)" hint="รูปจะขึ้นเว็บหลังกด “บันทึกการเปลี่ยนแปลง” และ Vercel deploy เสร็จ">
      <div className="row" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" style={{ width: 96, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
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

function ProcessPanel({ data, edit }: { data: Content; edit: Edit }) {
  const list = data.process;
  const setList = (next: Step[]) => edit((d) => ({ ...d, process: next }));
  return (
    <div className="admin-card">
      <h3>ขั้นตอนการทำงาน ({list.length}/6)</h3>
      {list.map((s, i) => (
        <div className="admin-item" key={s.id}>
          <div className="admin-item-head">
            ขั้นที่ {i + 1}
            <ItemControls index={i} count={list.length} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <Field label="ชื่อขั้นตอน"><Text value={s.title} onChange={(v) => setList(replaceAt(list, i, { ...s, title: v }))} /></Field>
          <Field label="รายละเอียด"><Text multiline value={s.description} onChange={(v) => setList(replaceAt(list, i, { ...s, description: v }))} /></Field>
        </div>
      ))}
      <AddButton disabled={list.length >= 6} label="เพิ่มขั้นตอน" onClick={() => setList([...list, { id: uid("pr"), title: "ขั้นตอนใหม่", description: "" }])} />
    </div>
  );
}

function PlansPanel({ data, edit }: { data: Content; edit: Edit }) {
  const list = data.plans;
  const setList = (next: Plan[]) => edit((d) => ({ ...d, plans: next }));
  return (
    <div className="admin-card">
      <h3>แพ็กเกจราคา ({list.length}/4)</h3>
      {list.map((p, i) => (
        <div className="admin-item" key={p.id}>
          <div className="admin-item-head">
            แพ็กเกจ {i + 1}
            <ItemControls index={i} count={list.length} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="ชื่อแพ็กเกจ"><Text value={p.name} onChange={(v) => setList(replaceAt(list, i, { ...p, name: v }))} /></Field>
            <Field label="ราคา / ข้อความราคา"><Text value={p.price} onChange={(v) => setList(replaceAt(list, i, { ...p, price: v }))} /></Field>
            <Field label="หน่วย"><Text value={p.unit} onChange={(v) => setList(replaceAt(list, i, { ...p, unit: v }))} /></Field>
            <Field label="ไฮไลต์การ์ดนี้">
              <label className="row" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={p.highlight} onChange={(e) => setList(list.map((x, j) => ({ ...x, highlight: j === i ? e.target.checked : false })))} /> แนะนำ (ไฮไลต์ได้แพ็กเกจเดียว)
              </label>
            </Field>
          </div>
          <Field label="ฟีเจอร์" hint="หนึ่งบรรทัดต่อหนึ่งฟีเจอร์ คลิกออกจากช่องเพื่อบันทึก">
            <ListText multiline value={p.features} onCommit={(v) => setList(replaceAt(list, i, { ...p, features: v }))} />
          </Field>
        </div>
      ))}
      <AddButton disabled={list.length >= 4} label="เพิ่มแพ็กเกจ" onClick={() => setList([...list, { id: uid("p"), name: "แพ็กเกจใหม่", price: "ติดต่อ", unit: "", highlight: false, features: [] }])} />
    </div>
  );
}

function TeamPanel({ data, edit }: { data: Content; edit: Edit }) {
  const list = data.team;
  const setList = (next: Member[]) => edit((d) => ({ ...d, team: next }));
  const patch = (i: number, p: Partial<Member>) => setList(replaceAt(list, i, { ...list[i], ...p }));
  return (
    <>
      <div className="admin-card">
        <h3>สมาชิกทีม ({list.length}/30)</h3>
        <p className="admin-hint" style={{ margin: 0 }}>
          ติ๊ก “สมาชิกใหม่” เพื่อให้การ์ดขึ้นส่วนต้อนรับด้านบนของหน้าทีมงาน ถ้าไม่ติ๊กจะแสดงเฉพาะในรายการทีมปกติ
        </p>
      </div>
      {list.map((m, i) => (
        <div className="admin-card" key={m.id}>
          <div className="admin-item-head" style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--muted)", display: "flex", gap: 8, alignItems: "center" }}>
            สมาชิก {i + 1}
            {m.isNew && <span className="new-badge">NEW</span>}
            <ItemControls index={i} count={list.length} onUp={() => setList(moveItem(list, i, -1))} onDown={() => setList(moveItem(list, i, 1))} onRemove={() => setList(removeAt(list, i))} />
          </div>
          <div className="grid-2">
            <Field label="ชื่อ"><Text value={m.name} onChange={(v) => patch(i, { name: v })} /></Field>
            <Field label="ตำแหน่ง"><Text value={m.role} onChange={(v) => patch(i, { role: v })} /></Field>
            <Field label="วันที่เข้าร่วม"><Text type="date" value={m.joinedAt} onChange={(v) => patch(i, { joinedAt: v })} /></Field>
            <Field label="สีประจำตัว">
              <div className="row">
                <input type="color" value={m.color} onChange={(e) => patch(i, { color: e.target.value })} style={{ width: 44, height: 40, border: 0, background: "none", padding: 0 }} aria-label="เลือกสี" />
                <Text value={m.color} onChange={(v) => patch(i, { color: v })} />
              </div>
            </Field>
          </div>
          <label className="row" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={m.isNew} onChange={(e) => patch(i, { isNew: e.target.checked })} /> สมาชิกใหม่ (แสดงในส่วนต้อนรับ)
          </label>
          <Field label="ประวัติโดยย่อ"><Text multiline value={m.bio} onChange={(v) => patch(i, { bio: v })} /></Field>
          <Field label="ทักษะ" hint="คั่นด้วยคอมมา คลิกออกจากช่องเพื่อบันทึก">
            <ListText value={m.skills} onCommit={(v) => patch(i, { skills: v })} />
          </Field>

          <div style={{ display: "grid", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>เส้นทางการทำงาน (timeline)</span>
            {m.history.map((h, j) => (
              <div className="admin-item" key={j}>
                <div className="admin-item-head">
                  รายการ {j + 1}
                  <ItemControls
                    index={j}
                    count={m.history.length}
                    onUp={() => patch(i, { history: moveItem(m.history, j, -1) })}
                    onDown={() => patch(i, { history: moveItem(m.history, j, 1) })}
                    onRemove={() => patch(i, { history: removeAt(m.history, j) })}
                  />
                </div>
                <div className="grid-2">
                  <Field label="ปี"><Text value={h.year} onChange={(v) => patch(i, { history: replaceAt<HistoryItem>(m.history, j, { ...h, year: v }) })} /></Field>
                  <Field label="หัวข้อ"><Text value={h.title} onChange={(v) => patch(i, { history: replaceAt<HistoryItem>(m.history, j, { ...h, title: v }) })} /></Field>
                </div>
                <Field label="รายละเอียด"><Text multiline value={h.detail} onChange={(v) => patch(i, { history: replaceAt<HistoryItem>(m.history, j, { ...h, detail: v }) })} /></Field>
              </div>
            ))}
            <AddButton
              disabled={m.history.length >= 8}
              label="เพิ่มประวัติ"
              onClick={() => patch(i, { history: [...m.history, { year: "", title: "", detail: "" }] })}
            />
          </div>
        </div>
      ))}
      <AddButton
        disabled={list.length >= 30}
        label="เพิ่มสมาชิก"
        onClick={() =>
          setList([
            ...list,
            { id: uid("m"), name: "ชื่อสมาชิกใหม่", role: "ตำแหน่ง", bio: "", skills: [], color: "#0070f3", joinedAt: new Date().toISOString().slice(0, 10), isNew: true, history: [] },
          ])
        }
      />
    </>
  );
}

function ContactPanel({ data, edit }: { data: Content; edit: Edit }) {
  return (
    <div className="admin-card">
      <h3>ประเภทงานในฟอร์มติดต่อ</h3>
      <Field label="คั่นด้วยคอมมาหรือขึ้นบรรทัดใหม่" hint="คลิกออกจากช่องเพื่อบันทึก">
        <ListText value={data.contact.types} onCommit={(v) => edit((d) => ({ ...d, contact: { types: v } }))} multiline />
      </Field>
    </div>
  );
}
