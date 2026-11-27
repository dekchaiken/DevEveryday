"use client";

// หลังบ้านคริสต์มาส: เมนูด้านข้างแบ่งเป็นหมวด ภาพรวม คำสั่งซื้อ Exclusive การ์ด ข้อมูล log คำต้องห้าม และตั้งค่า
// แจ้งเตือนคำสั่งใหม่และการชำระเงินเป็นกล่องข้อความมุมจอ (และส่งต่อผ่าน Webhook ถ้าตั้งค่าไว้)
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "./admin.css";

type Config = {
  enabled: boolean;
  payMode: "manual" | "gateway" | "paynoi";
  presetPrices: number[];
  customMin: number;
  customMax: number;
  decorPrice: number;
  messagePrice: number;
  blockedWords: string[];
};
type Order = { id: string; room: string; kind: string; amount: number; name: string; message: string; mode: string; status: string; createdAt: number; paidAt: number | null; providerRef: string };
type Dash = {
  config: Config;
  env: { storage: boolean; omise: boolean; promptpay: boolean; alerts: boolean; paynoi: boolean };
  totals: { online: number; ornaments: number; revenue: number; paidCount: number; awaitingCount: number; giantTaken: number; giantCapacity: number };
  rooms: { id: string; name: string; online: number; capacity: number; ornaments: number; giants: number; giant: { name: string; message: string; amount: number } | null }[];
  orders: Order[];
};
type Ornament = { id: string; room: string; name: string; wish: string; color: string; shape: string; createdAt: number };
type Decor = { id: string; room: string; slot: number; name: string; hat: string; scarf: string; body: string; createdAt: number; likes: number };
type ShowEvent = { id: string; room: string; kind: string; text: string; by: string; theme?: string; startAt: number };
type Giant = { room: string; spot: number; name: string; message: string; amount: number; paidAt: number; orderId: string; social: Record<string, string> | null };
type Card = { id: string; room: string; name: string; theme: string; createdAt: number; wish?: string; texts?: { text?: string }[] };
type Log = { id: string; at: number; type: string; room: string; actor: string; text: string };
type Flag = { kind: string; room: string; id: string; slot?: number; text: string };
type Toast = { id: number; tone: "gold" | "ok" | "bad"; text: string };
type Section = "overview" | "orders" | "giants" | "cards" | "data" | "log" | "filter" | "settings";

const NAV: { id: Section; label: string }[] = [
  { id: "overview", label: "ภาพรวม" },
  { id: "orders", label: "คำสั่งซื้อ" },
  { id: "giants", label: "Exclusive" },
  { id: "cards", label: "การ์ดอวยพร" },
  { id: "data", label: "ลูกบอล · ตุ๊กตา" },
  { id: "log", label: "Log" },
  { id: "filter", label: "คำต้องห้าม" },
  { id: "settings", label: "ตั้งค่า" },
];
const TITLE: Record<Section, string> = Object.fromEntries(NAV.map((n) => [n.id, n.label])) as Record<Section, string>;

const STATUS_TH: Record<string, string> = { awaiting_payment: "รอชำระ", paid: "จ่ายแล้ว", cancelled: "ยกเลิก" };
const KIND_TH: Record<string, string> = { giant: "Exclusive", support: "สนับสนุนทีม", decor: "ตุ๊กตา Exclusive", message: "ข้อความขึ้นจอ" };
const LOG_TH: Record<string, string> = {
  ornament: "แขวนลูกบอล",
  decor: "วางตุ๊กตา",
  like: "ถูกใจ",
  order: "สั่งสนับสนุน",
  paid: "ชำระแล้ว",
  event: "ส่งเหตุการณ์",
  config: "ตั้งค่า",
  moderation: "ลบ/ล้าง",
  blocked: "ถูกกรอง",
  card: "การ์ด",
};
const ROOM_NAME: Record<string, string> = { bangkok: "กรุงเทพฯ", chiangmai: "เชียงใหม่", khonkaen: "ขอนแก่น", phuket: "ภูเก็ต" };
const roomLabel = (id: string) => ROOM_NAME[id] ?? id;
const fmt = (t: number) => new Date(t).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" });
const ago = (t: number) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s} วิ`;
  if (s < 3600) return `${Math.floor(s / 60)} นาที`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.`;
  return `${Math.floor(s / 86400)} วัน`;
};
const toggleIn = (set: Set<string>, k: string) => {
  const n = new Set(set);
  if (n.has(k)) n.delete(k);
  else n.add(k);
  return n;
};
const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
function downloadCsv(name: string, rows: unknown[][]) {
  const body = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminConsole() {
  const [section, setSection] = useState<Section>("overview");
  const [dash, setDash] = useState<Dash | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((tone: Toast["tone"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-4), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/christmas/dashboard", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!res.ok) return;
    const d = (await res.json()) as Dash;
    if (seen.current) {
      for (const o of d.orders) {
        if (o.status === "awaiting_payment" && !seen.current.has(o.id)) {
          toast("gold", `มีคำสั่งใหม่ ${KIND_TH[o.kind] ?? o.kind} ฿${o.amount} · ${o.name} (${roomLabel(o.room)})`);
        }
      }
    }
    seen.current = new Set(d.orders.map((o) => o.id));
    setDash(d);
  }, [toast]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  // สั่งลบหรือล้างแบบชุด แล้วสรุปผลเป็นกล่องข้อความ
  const moderate = useCallback(
    async (items: object[]) => {
      setBusy(true);
      const res = await fetch("/api/admin/christmas/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const data = (await res.json().catch(() => ({}))) as { results?: { ok: boolean; note: string }[]; error?: string };
      setBusy(false);
      if (!res.ok) toast("bad", data.error ?? "ทำรายการไม่สำเร็จ");
      else {
        const ok = (data.results ?? []).filter((r) => r.ok).length;
        toast("ok", `สำเร็จ ${ok} จาก ${items.length} รายการ`);
      }
      load();
      return res.ok;
    },
    [load, toast],
  );

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const awaiting = dash?.orders.filter((o) => o.status === "awaiting_payment").length ?? 0;

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <span className="adm-dot" aria-hidden />
          <div>
            <b>หลังบ้านคริสต์มาส</b>
            <small>DevEveryday</small>
          </div>
        </div>
        <nav className="adm-nav" aria-label="เมนูหลังบ้าน">
          {NAV.map((n) => (
            <button key={n.id} type="button" className={section === n.id ? "is-on" : ""} aria-current={section === n.id ? "page" : undefined} onClick={() => setSection(n.id)}>
              <span>{n.label}</span>
              {n.id === "orders" && awaiting > 0 && <em className="adm-badge">{awaiting}</em>}
            </button>
          ))}
        </nav>
        <button type="button" className="adm-logout" onClick={logout}>
          ออกจากระบบ
        </button>
      </aside>

      <main className="adm-main">
        <header className="adm-top">
          <div>
            <p className="adm-kicker">ต้นคริสต์มาสกรุงเทพฯ และห้องอื่น</p>
            <h1>{TITLE[section]}</h1>
          </div>
          <div className="adm-status">
            {dash && (
              <>
                <Pill ok={dash.env.storage} label="ฐานข้อมูล" />
                <Pill ok={dash.config.enabled} label={dash.config.enabled ? "เปิดรับ" : "ปิดรับ"} />
                <Pill ok={dash.env.alerts} label="แจ้งเตือน" />
              </>
            )}
            {busy && <span className="adm-busy">กำลังทำรายการ…</span>}
          </div>
        </header>

        {!dash && <p className="adm-empty">กำลังโหลดข้อมูล…</p>}
        {dash && section === "overview" && <Overview dash={dash} go={setSection} moderate={moderate} reload={load} toast={toast} />}
        {dash && section === "orders" && <Orders dash={dash} reload={load} toast={toast} />}
        {dash && section === "giants" && <GiantsSection dash={dash} reload={load} toast={toast} />}
        {dash && section === "cards" && <CardsSection dash={dash} reload={load} toast={toast} />}
        {dash && section === "data" && <DataSection dash={dash} moderate={moderate} />}
        {section === "log" && <LogSection toast={toast} />}
        {dash && section === "filter" && <FilterSection dash={dash} moderate={moderate} reload={load} toast={toast} />}
        {dash && section === "settings" && <Settings dash={dash} reload={load} toast={toast} />}
      </main>

      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`adm-pill ${ok ? "ok" : "warn"}`}>{label}</span>;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "gold" | "ok" | "warn" }) {
  return (
    <div className={`adm-stat ${tone ?? ""}`}>
      <small>{label}</small>
      <b>{value}</b>
      {hint && <span>{hint}</span>}
    </div>
  );
}

// ---------- ภาพรวม ----------
function Overview({
  dash,
  go,
  moderate,
  reload,
  toast,
}: {
  dash: Dash;
  go: (s: Section) => void;
  moderate: (items: object[]) => Promise<boolean>;
  reload: () => void;
  toast: (t: Toast["tone"], s: string) => void;
}) {
  const t = dash.totals;
  const awaiting = dash.orders.filter((o) => o.status === "awaiting_payment");
  async function confirmOrder(id: string) {
    const res = await fetch(`/api/admin/christmas/orders/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) });
    const data = (await res.json()) as { error?: string };
    toast(res.ok ? "ok" : "bad", res.ok ? "ยืนยันการโอนแล้ว" : data.error ?? "ยืนยันไม่สำเร็จ");
    reload();
  }
  return (
    <>
      <section className="adm-stats">
        <Stat label="ออนไลน์ทุกห้อง" value={`${t.online}`} hint={`${dash.rooms.length} ห้อง`} />
        <Stat label="ลูกบอลที่แขวน" value={`${t.ornaments}`} />
        <Stat label="ยอดจ่ายแล้ว" value={`฿${t.revenue.toLocaleString("th-TH")}`} hint={`${t.paidCount} รายการ`} tone="gold" />
        <Stat label="รอชำระ" value={`${t.awaitingCount}`} tone={t.awaitingCount > 0 ? "warn" : undefined} hint="ดูที่คำสั่งซื้อ" />
        <Stat label="Exclusive จองแล้ว" value={`${t.giantTaken} / ${t.giantCapacity}`} hint="ทุกห้องรวมกัน" />
      </section>

      <section className="adm-card">
        <header className="adm-card-head">
          <h2>รอยืนยันการโอน</h2>
          <button type="button" className="adm-link" onClick={() => go("orders")}>
            ดูทั้งหมด
          </button>
        </header>
        {awaiting.length === 0 ? (
          <p className="adm-empty">ไม่มีรายการที่รอยืนยัน</p>
        ) : (
          <ul className="adm-list">
            {awaiting.slice(0, 8).map((o) => (
              <li key={o.id}>
                <div>
                  <b>฿{o.amount}</b> <span className="adm-muted">{KIND_TH[o.kind] ?? o.kind} · {o.name}</span>
                  <small>{roomLabel(o.room)} · เมื่อ {ago(o.createdAt)} ที่แล้ว</small>
                </div>
                {o.mode === "manual" ? (
                  <button type="button" className="adm-btn primary" onClick={() => confirmOrder(o.id)}>
                    ยืนยันการโอน
                  </button>
                ) : (
                  <span className="adm-muted">Omise ยืนยันอัตโนมัติ</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="adm-card">
        <header className="adm-card-head">
          <h2>ห้อง</h2>
        </header>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ออนไลน์</th>
                <th>ลูกบอล</th>
                <th>Exclusive</th>
                <th>Exclusive ปัจจุบัน</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dash.rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <div className="adm-bar">
                      <span style={{ width: `${Math.min(100, (r.online / r.capacity) * 100)}%` }} />
                    </div>
                    <small>
                      {r.online} / {r.capacity} คน
                    </small>
                  </td>
                  <td>{r.ornaments}</td>
                  <td>{r.giants}</td>
                  <td>{r.giant ? `${r.giant.name} · ฿${r.giant.amount}` : "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="adm-btn danger"
                      onClick={() => {
                        if (confirm(`ล้างลูกบอล คิวเหตุการณ์ และตุ๊กตาหิมะทั้งหมดของห้อง${r.name}? ทำย้อนกลับไม่ได้`)) moderate([{ action: "clear_room", room: r.id }]);
                      }}
                    >
                      ล้างห้องนี้
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ---------- คำสั่งซื้อ: กรอง เลือกหลายรายการ ยืนยันพร้อมกัน ----------
function Orders({ dash, reload, toast }: { dash: Dash; reload: () => void; toast: (t: Toast["tone"], s: string) => void }) {
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [room, setRoom] = useState("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return dash.orders.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (kind === "all" || o.kind === kind) &&
        (room === "all" || o.room === room) &&
        (!needle || `${o.name} ${o.message} ${o.id}`.toLowerCase().includes(needle)),
    );
  }, [dash.orders, status, kind, room, q]);

  const confirmable = (o: Order) => o.status === "awaiting_payment" && o.mode === "manual";

  async function confirmOne(id: string) {
    const res = await fetch(`/api/admin/christmas/orders/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) });
    const data = (await res.json()) as { error?: string };
    toast(res.ok ? "ok" : "bad", res.ok ? "ยืนยันการโอนแล้ว" : data.error ?? "ยืนยันไม่สำเร็จ");
    reload();
  }

  async function confirmPicked() {
    const ids = rows.filter((o) => picked.has(o.id) && confirmable(o)).map((o) => o.id);
    if (ids.length === 0) return toast("bad", "เลือกรายการที่รอโอนแบบ manual ก่อน");
    if (!confirm(`ยืนยันการโอน ${ids.length} รายการ?`)) return;
    setWorking(true);
    let ok = 0;
    for (const id of ids) {
      const res = await fetch(`/api/admin/christmas/orders/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) });
      if (res.ok) ok++;
    }
    setWorking(false);
    setPicked(new Set());
    toast(ok === ids.length ? "ok" : "bad", `ยืนยันสำเร็จ ${ok} จาก ${ids.length} รายการ`);
    reload();
  }

  const allShown = rows.length > 0 && rows.every((o) => picked.has(o.id));

  return (
    <>
      <section className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-seg" role="group" aria-label="สถานะ">
            {[
              ["all", "ทั้งหมด"],
              ["awaiting_payment", "รอชำระ"],
              ["paid", "จ่ายแล้ว"],
            ].map(([v, l]) => (
              <button key={v} type="button" className={status === v ? "is-on" : ""} onClick={() => setStatus(v)}>
                {l}
              </button>
            ))}
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="ประเภท">
            <option value="all">ทุกประเภท</option>
            {Object.entries(KIND_TH).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
            <option value="all">ทุกห้อง</option>
            {dash.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ ข้อความ หรือรหัส" aria-label="ค้นหา" />
          <a className="adm-btn" href="/api/admin/christmas/orders/export">
            ส่งออก CSV
          </a>
        </div>

        {picked.size > 0 && (
          <div className="adm-bulk">
            <span>เลือกแล้ว {picked.size} รายการ</span>
            <button type="button" className="adm-btn primary" onClick={confirmPicked} disabled={working}>
              {working ? "กำลังยืนยัน…" : "ยืนยันการโอนที่เลือก"}
            </button>
            <button type="button" className="adm-btn" onClick={() => setPicked(new Set())}>
              ยกเลิกการเลือก
            </button>
          </div>
        )}

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="เลือกทั้งหมด"
                    checked={allShown}
                    onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((o) => o.id)) : new Set())}
                  />
                </th>
                <th>เวลา</th>
                <th>ห้อง</th>
                <th>ประเภท</th>
                <th>ผู้สั่ง</th>
                <th>ยอด</th>
                <th>โหมด</th>
                <th>สถานะ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <input type="checkbox" aria-label={`เลือก ${o.name}`} checked={picked.has(o.id)} onChange={() => setPicked((p) => toggleIn(p, o.id))} disabled={!confirmable(o)} />
                  </td>
                  <td title={fmt(o.createdAt)}>{ago(o.createdAt)} ที่แล้ว</td>
                  <td>{roomLabel(o.room)}</td>
                  <td>{KIND_TH[o.kind] ?? o.kind}</td>
                  <td>
                    {o.name}
                    {o.message && <small className="adm-block">{o.message}</small>}
                    {o.mode === "paynoi" && o.providerRef && <small className="adm-block adm-mono">paynoi: {o.providerRef}</small>}
                  </td>
                  <td>฿{o.amount}</td>
                  <td>{o.mode === "manual" ? "โอนเอง" : o.mode === "paynoi" ? "paynoi" : "Omise"}</td>
                  <td>
                    <span className={`adm-tag ${o.status}`}>{STATUS_TH[o.status] ?? o.status}</span>
                  </td>
                  <td>{confirmable(o) && <button type="button" className="adm-btn primary sm" onClick={() => confirmOne(o.id)}>ยืนยัน</button>}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="adm-empty">
                    ไม่พบรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ---------- Exclusive: ดู ค้นหา และถอดออกทีละหลายรายการ ----------
function GiantsSection({ dash, reload, toast }: { dash: Dash; reload: () => void; toast: (t: Toast["tone"], s: string) => void }) {
  const [room, setRoom] = useState("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Giant[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const key = (g: Giant) => `${g.room}|${g.spot}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/christmas/giants?room=${room}`, { cache: "no-store" });
    if (res.ok) setRows(((await res.json()) as { giants: Giant[] }).giants);
  }, [room]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((g) => !needle || `${g.name} ${g.message}`.toLowerCase().includes(needle));
  }, [rows, q]);

  async function removeMany(list: Giant[]) {
    if (list.length === 0) return;
    if (!confirm(`ถอด ${list.length} ตุ๊กตายักษ์ออกจากจุด? ทำย้อนกลับไม่ได้`)) return;
    let ok = 0;
    for (const g of list) {
      const res = await fetch("/api/admin/christmas/giants", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: g.room, spot: g.spot }) });
      if (res.ok) ok++;
    }
    toast(ok === list.length ? "ok" : "bad", `ถอดสำเร็จ ${ok} จาก ${list.length} รายการ`);
    setPicked(new Set());
    load();
    reload();
  }

  return (
    <section className="adm-card">
      <p className="adm-hint">
        จองแล้ว {dash.totals.giantTaken} จาก {dash.totals.giantCapacity} จุด (ทุกห้อง)
      </p>
      <div className="adm-toolbar">
        <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
          <option value="all">ทุกห้อง</option>
          {dash.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือข้อความ" aria-label="ค้นหา" />
      </div>
      {picked.size > 0 && (
        <div className="adm-bulk">
          <span>เลือกแล้ว {picked.size}</span>
          <button type="button" className="adm-btn danger" onClick={() => removeMany((rows ?? []).filter((g) => picked.has(key(g))))}>
            ถอดที่เลือก
          </button>
        </div>
      )}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th />
              <th>ห้อง</th>
              <th>จุด</th>
              <th>ชื่อ</th>
              <th>ข้อความ</th>
              <th>ยอด</th>
              <th>จ่ายเมื่อ</th>
              <th>ลิงก์</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <tr key={key(g)}>
                <td>
                  <input type="checkbox" aria-label={`เลือกจุด ${g.spot + 1}`} checked={picked.has(key(g))} onChange={() => setPicked((p) => toggleIn(p, key(g)))} />
                </td>
                <td>{roomLabel(g.room)}</td>
                <td>{g.spot + 1}</td>
                <td>{g.name}</td>
                <td>{g.message || "—"}</td>
                <td>฿{g.amount}</td>
                <td>{fmt(g.paidAt)}</td>
                <td>{g.social ? Object.values(g.social).filter(Boolean).length : 0}</td>
                <td>
                  <button type="button" className="adm-btn danger sm" onClick={() => removeMany([g])}>
                    ถอด
                  </button>
                </td>
              </tr>
            ))}
            {rows && shown.length === 0 && (
              <tr>
                <td colSpan={9} className="adm-empty">
                  ยังไม่มี Exclusive ในห้องนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- การ์ดอวยพร: แบ่งหน้า ค้นหาในหน้า ลบทีละหลายใบ ----------
function CardsSection({ dash, reload, toast }: { dash: Dash; reload: () => void; toast: (t: Toast["tone"], s: string) => void }) {
  const [room, setRoom] = useState(dash.rooms[0]?.id ?? "bangkok");
  const [page, setPage] = useState(1);
  const [size] = useState(30);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/christmas/cards?room=${room}&page=${page}&size=${size}`, { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as { cards: Card[]; total: number };
    setCards(d.cards);
    setTotal(d.total);
  }, [room, page, size]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
    setPicked(new Set());
  }, [room]);

  const pages = Math.max(1, Math.ceil(total / size));
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (cards ?? []).filter((c) => !needle || `${c.name} ${c.wish ?? ""} ${(c.texts ?? []).map((t) => t.text ?? "").join(" ")}`.toLowerCase().includes(needle));
  }, [cards, q]);

  async function removeMany(list: Card[]) {
    if (list.length === 0) return;
    if (!confirm(`ลบการ์ด ${list.length} ใบ? ทำย้อนกลับไม่ได้`)) return;
    const res = await fetch("/api/admin/christmas/cards", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: list.map((c) => ({ room: c.room, id: c.id })) }),
    });
    const data = (await res.json()) as { results?: { ok: boolean }[] };
    const ok = (data.results ?? []).filter((r) => r.ok).length;
    toast(res.ok && ok === list.length ? "ok" : "bad", `ลบการ์ดสำเร็จ ${ok} จาก ${list.length} ใบ`);
    setPicked(new Set());
    load();
    reload();
  }

  return (
    <section className="adm-card">
      <div className="adm-toolbar">
        <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
          {dash.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาในหน้านี้" aria-label="ค้นหาการ์ด" />
        <div className="adm-pager">
          <button type="button" className="adm-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </button>
          <span>
            หน้า {page} / {pages} · {total} ใบ
          </span>
          <button type="button" className="adm-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            ถัดไป
          </button>
        </div>
      </div>
      {picked.size > 0 && (
        <div className="adm-bulk">
          <span>เลือกแล้ว {picked.size} ใบ</span>
          <button type="button" className="adm-btn danger" onClick={() => removeMany((cards ?? []).filter((c) => picked.has(c.id)))}>
            ลบที่เลือก
          </button>
          <button type="button" className="adm-btn" onClick={() => setPicked(new Set())}>
            ยกเลิกการเลือก
          </button>
        </div>
      )}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" aria-label="เลือกทั้งหน้า" checked={shown.length > 0 && shown.every((c) => picked.has(c.id))} onChange={(e) => setPicked(e.target.checked ? new Set(shown.map((c) => c.id)) : new Set())} />
              </th>
              <th>เวลา</th>
              <th>ผู้ส่ง</th>
              <th>ข้อความ</th>
              <th>ธีม</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td>
                  <input type="checkbox" aria-label={`เลือกการ์ดของ ${c.name}`} checked={picked.has(c.id)} onChange={() => setPicked((p) => toggleIn(p, c.id))} />
                </td>
                <td title={fmt(c.createdAt)}>{ago(c.createdAt)} ที่แล้ว</td>
                <td>{c.name || "ไม่ระบุชื่อ"}</td>
                <td className="adm-block-cell">{(c.texts ?? []).map((t) => t.text).filter(Boolean).join(" · ") || c.wish || "—"}</td>
                <td>{c.theme}</td>
                <td>
                  <button type="button" className="adm-btn danger sm" onClick={() => removeMany([c])}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {cards && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-empty">
                  ไม่มีการ์ดในหน้านี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- ข้อมูล: ลูกบอล ตุ๊กตา เหตุการณ์ ลบทีละหลายรายการ ----------
type DataKind = "ornament" | "decor" | "event" | "order";
function DataSection({ dash, moderate }: { dash: Dash; moderate: (items: object[]) => Promise<boolean> }) {
  const [kind, setKind] = useState<DataKind>("ornament");
  const [room, setRoom] = useState("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ ornaments: Ornament[]; decor: Decor[]; events: ShowEvent[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/christmas/items?room=${room}`, { cache: "no-store" });
    if (res.ok) setItems((await res.json()) as { ornaments: Ornament[]; decor: Decor[]; events: ShowEvent[] });
  }, [room]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => setPicked(new Set()), [kind, room]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const m = (s: string) => !needle || s.toLowerCase().includes(needle);
    if (kind === "ornament") return (items?.ornaments ?? []).filter((o) => m(`${o.name} ${o.wish}`));
    if (kind === "decor") return (items?.decor ?? []).filter((d) => m(d.name));
    if (kind === "event") return (items?.events ?? []).filter((e) => m(`${e.by} ${e.text}`));
    return [];
  }, [kind, items, q]);

  const keyOf = (r: { id: string; room: string }) => `${r.room}|${r.id}`;

  async function deletePicked() {
    const selected = rows.filter((r) => picked.has(keyOf(r as { id: string; room: string })));
    if (selected.length === 0) return;
    if (!confirm(`ลบ ${selected.length} รายการที่เลือก? ทำย้อนกลับไม่ได้`)) return;
    const actions = selected.map((r) => {
      const x = r as { room: string; id: string; slot?: number };
      if (kind === "ornament") return { action: "delete_ornament", room: x.room, id: x.id };
      if (kind === "decor") return { action: "delete_decor", room: x.room, slot: x.slot };
      return { action: "delete_event", room: x.room, id: x.id };
    });
    await moderate(actions);
    setPicked(new Set());
    load();
  }

  const selectableKinds: { id: DataKind; label: string }[] = [
    { id: "ornament", label: `ลูกบอล (${items?.ornaments.length ?? 0})` },
    { id: "decor", label: `ตุ๊กตา (${items?.decor.length ?? 0})` },
    { id: "event", label: `เหตุการณ์ (${items?.events.length ?? 0})` },
  ];

  return (
    <section className="adm-card">
      <div className="adm-toolbar">
        <div className="adm-seg" role="tablist">
          {selectableKinds.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? "is-on" : ""} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
          <option value="all">ทุกห้อง</option>
          {dash.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา" aria-label="ค้นหา" />
      </div>
      {picked.size > 0 && (
        <div className="adm-bulk">
          <span>เลือกแล้ว {picked.size}</span>
          <button type="button" className="adm-btn danger" onClick={deletePicked}>
            ลบที่เลือก
          </button>
          <button type="button" className="adm-btn" onClick={() => setPicked(new Set())}>
            ยกเลิกการเลือก
          </button>
        </div>
      )}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="เลือกทั้งหมด"
                  checked={rows.length > 0 && rows.every((r) => picked.has(keyOf(r as { id: string; room: string })))}
                  onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => keyOf(r as { id: string; room: string }))) : new Set())}
                />
              </th>
              <th>ห้อง</th>
              <th>{kind === "event" ? "ประเภท" : "ชื่อ"}</th>
              <th>{kind === "decor" ? "สี" : kind === "event" ? "ข้อความ" : "คำอวยพร"}</th>
              <th>เวลา</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const x = r as Ornament & Decor & ShowEvent;
              const k = keyOf(x);
              return (
                <tr key={k}>
                  <td>
                    <input type="checkbox" checked={picked.has(k)} onChange={() => setPicked((p) => toggleIn(p, k))} aria-label="เลือกรายการ" />
                  </td>
                  <td>{roomLabel(x.room)}</td>
                  <td>{kind === "event" ? x.kind : x.name || x.by}</td>
                  <td className="adm-block-cell">{kind === "decor" ? `${x.body} / ${x.hat}` : kind === "event" ? x.text : x.wish || "—"}</td>
                  <td>{fmt(kind === "event" ? x.startAt : x.createdAt)}</td>
                  <td>
                    <button type="button" className="adm-btn danger sm" onClick={() => moderate([{ action: kind === "ornament" ? "delete_ornament" : kind === "decor" ? "delete_decor" : "delete_event", room: x.room, id: x.id, slot: x.slot }])}>
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-empty">
                  ไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Log: กรองได้ละเอียด ส่งออกเฉพาะที่กรองแล้ว ล้างทั้งหมดได้ในคำสั่งเดียว ----------
function LogSection({ toast }: { toast: (t: Toast["tone"], s: string) => void }) {
  const [type, setType] = useState("all");
  const [room, setRoom] = useState("all");
  const [actor, setActor] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(300);
  const [logs, setLogs] = useState<Log[] | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ type, room, actor, q, limit: String(limit) });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const res = await fetch(`/api/admin/christmas/logs?${p}`, { cache: "no-store" });
    if (res.ok) setLogs(((await res.json()) as { logs: Log[] }).logs);
  }, [type, room, actor, q, from, to, limit]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function clearAll() {
    if (!confirm("ล้าง log ทั้งหมด? (ระบบจะบันทึกว่ามีการล้าง)")) return;
    const res = await fetch("/api/admin/christmas/logs", { method: "DELETE" });
    toast(res.ok ? "ok" : "bad", res.ok ? "ล้าง log แล้ว" : "ล้าง log ไม่สำเร็จ");
    load();
  }

  function exportShown() {
    const rows = [["เวลา", "ประเภท", "ห้อง", "ผู้ดำเนินการ", "รายละเอียด"], ...(logs ?? []).map((l) => [new Date(l.at).toISOString(), LOG_TH[l.type] ?? l.type, roomLabel(l.room), l.actor, l.text])];
    downloadCsv(`logs-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <section className="adm-card">
      <div className="adm-filters">
        <div className="adm-chips" role="group" aria-label="ประเภท">
          {[["all", "ทั้งหมด"], ...Object.entries(LOG_TH)].map(([v, l]) => (
            <button key={v} type="button" className={type === v ? "is-on" : ""} onClick={() => setType(v)}>
              {l}
            </button>
          ))}
        </div>
        <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
          <option value="all">ทุกห้อง</option>
          {Object.entries(ROOM_NAME).map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาในรายละเอียด" aria-label="ค้นหาใน log" />
        <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="ผู้ดำเนินการ เช่น admin" aria-label="ผู้ดำเนินการ" />
        <label className="adm-date">
          จาก <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="adm-date">
          ถึง <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="จำนวนแถว">
          {[100, 300, 1000].map((n) => (
            <option key={n} value={n}>
              {n} แถว
            </option>
          ))}
        </select>
      </div>
      <div className="adm-toolbar">
        <span className="adm-muted">พบ {logs?.length ?? 0} รายการ</span>
        <button type="button" className="adm-btn" onClick={exportShown} disabled={!logs?.length}>
          ส่งออกที่กรองแล้ว (CSV)
        </button>
        <button type="button" className="adm-btn danger" onClick={clearAll}>
          ล้าง log ทั้งหมด
        </button>
        <button type="button" className="adm-btn" onClick={() => { setType("all"); setRoom("all"); setActor(""); setQ(""); setFrom(""); setTo(""); }}>
          ล้างตัวกรอง
        </button>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ประเภท</th>
              <th>ห้อง</th>
              <th>ผู้ดำเนินการ</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id}>
                <td className="adm-nowrap">{fmt(l.at)}</td>
                <td>
                  <span className={`adm-tag log-${l.type}`}>{LOG_TH[l.type] ?? l.type}</span>
                </td>
                <td>{roomLabel(l.room)}</td>
                <td>{l.actor}</td>
                <td className="adm-block-cell">{l.text}</td>
              </tr>
            ))}
            {logs && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="adm-empty">
                  ไม่พบ log ตามตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- คำต้องห้าม: จัดรายการคำ ตรวจหาข้อมูลที่ตรง แล้วลบทีละหลายรายการ ----------
function FilterSection({
  dash,
  moderate,
  reload,
  toast,
}: {
  dash: Dash;
  moderate: (items: object[]) => Promise<boolean>;
  reload: () => void;
  toast: (t: Toast["tone"], s: string) => void;
}) {
  const [words, setWords] = useState<string[]>(dash.config.blockedWords);
  const [draft, setDraft] = useState("");
  const [flagged, setFlagged] = useState<{ flagged: Flag[]; orders: { id: string; room: string; status: string; text: string }[]; blockedWords: number } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function addWords() {
    const add = draft.split(/[,\n]/).map((w) => w.trim()).filter(Boolean);
    setWords((w) => [...new Set([...w, ...add])].slice(0, 200));
    setDraft("");
  }
  async function save() {
    const res = await fetch("/api/admin/christmas/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dash.config, blockedWords: words }),
    });
    toast(res.ok ? "ok" : "bad", res.ok ? "บันทึกคำต้องห้ามแล้ว" : "บันทึกไม่สำเร็จ");
    reload();
  }
  async function scan() {
    const res = await fetch("/api/admin/christmas/scan", { cache: "no-store" });
    setFlagged((await res.json()) as typeof flagged);
    setPicked(new Set());
  }
  const k = (f: Flag) => `${f.room}|${f.kind}|${f.id}`;

  async function deleteFlagged(list: Flag[]) {
    if (list.length === 0) return;
    if (!confirm(`ลบ ${list.length} รายการที่ตรงคำต้องห้าม? ทำย้อนกลับไม่ได้`)) return;
    await moderate(list.map((f) => (f.kind === "ornament" ? { action: "delete_ornament", room: f.room, id: f.id } : f.kind === "decor" ? { action: "delete_decor", room: f.room, slot: f.slot } : { action: "delete_event", room: f.room, id: f.id })));
    scan();
  }

  return (
    <>
      <section className="adm-card">
        <header className="adm-card-head">
          <h2>คำต้องห้ามที่กำหนดเอง</h2>
          <span className="adm-muted">ใช้ร่วมกับรายการพื้นฐาน</span>
        </header>
        <div className="adm-chips">
          {words.length === 0 && <span className="adm-muted">ยังไม่มีคำที่กำหนดเอง</span>}
          {words.map((w) => (
            <button key={w} type="button" className="chip-x" onClick={() => setWords((x) => x.filter((y) => y !== w))} aria-label={`เอา ${w} ออก`}>
              {w} ×
            </button>
          ))}
        </div>
        <div className="adm-toolbar">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWords())} placeholder="พิมพ์คำแล้วกด Enter (คั่นด้วยจุลภาคได้)" aria-label="คำต้องห้าม" />
          <button type="button" className="adm-btn" onClick={addWords}>
            เพิ่ม
          </button>
          <button type="button" className="adm-btn primary" onClick={save}>
            บันทึกคำต้องห้าม
          </button>
        </div>
      </section>

      <section className="adm-card">
        <header className="adm-card-head">
          <h2>ตรวจหาข้อมูลที่ตรงคำต้องห้าม</h2>
          <button type="button" className="adm-btn primary" onClick={scan}>
            ตรวจเลย
          </button>
        </header>
        {!flagged && <p className="adm-empty">กดตรวจเพื่อดูรายการ</p>}
        {flagged && (
          <>
            <p className="adm-hint">
              พบ {flagged.flagged.length} รายการในลูกบอล ตุ๊กตา และเหตุการณ์ · ออเดอร์ที่ตรง {flagged.orders.length} (แสดงเพื่อตรวจเท่านั้น ลบไม่ได้จากหน้านี้)
            </p>
            {picked.size > 0 && (
              <div className="adm-bulk">
                <span>เลือกแล้ว {picked.size}</span>
                <button type="button" className="adm-btn danger" onClick={() => deleteFlagged(flagged.flagged.filter((f) => picked.has(k(f))))}>
                  ลบที่เลือก
                </button>
                <button type="button" className="adm-btn danger" onClick={() => deleteFlagged(flagged.flagged)}>
                  ลบทั้งหมดที่พบ
                </button>
              </div>
            )}
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th />
                    <th>ประเภท</th>
                    <th>ห้อง</th>
                    <th>ข้อความ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {flagged.flagged.map((f) => (
                    <tr key={k(f)}>
                      <td>
                        <input type="checkbox" checked={picked.has(k(f))} onChange={() => setPicked((p) => toggleIn(p, k(f)))} aria-label="เลือกรายการ" />
                      </td>
                      <td>{f.kind === "ornament" ? "ลูกบอล" : f.kind === "decor" ? "ตุ๊กตา" : "เหตุการณ์"}</td>
                      <td>{roomLabel(f.room)}</td>
                      <td className="adm-block-cell">{f.text}</td>
                      <td>
                        <button type="button" className="adm-btn danger sm" onClick={() => deleteFlagged([f])}>
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                  {flagged.flagged.length === 0 && (
                    <tr>
                      <td colSpan={5} className="adm-empty">
                        ไม่พบรายการที่ตรงคำต้องห้าม
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

// ---------- ตั้งค่า: การชำระเงิน ราคา การแจ้งเตือน และการเชื่อมต่อ ----------
function Settings({ dash, reload, toast }: { dash: Dash; reload: () => void; toast: (t: Toast["tone"], s: string) => void }) {
  const [form, setForm] = useState<Config>(dash.config);
  const [presets, setPresets] = useState(dash.config.presetPrices.join(","));
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<{ configured: boolean; ok: boolean; note: string } | null>(null);
  const [testNote, setTestNote] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/christmas/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        presetPrices: presets.split(",").map((x) => Number(x.trim())).filter((x) => x > 0),
        customMin: Number(form.customMin),
        customMax: Number(form.customMax),
      }),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    toast(res.ok ? "ok" : "bad", res.ok ? "บันทึกการตั้งค่าแล้ว" : data.error ?? "บันทึกไม่สำเร็จ");
    if (res.ok) reload();
  }
  async function runCheck() {
    const res = await fetch("/api/admin/christmas/payment-check", { cache: "no-store" });
    setCheck((await res.json()) as typeof check);
  }
  async function testAlert() {
    const res = await fetch("/api/admin/christmas/notify-test", { method: "POST" });
    const data = (await res.json()) as { note: string; ok: boolean };
    setTestNote(data.note);
    toast(data.ok ? "ok" : "bad", data.note);
  }
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setForm({ ...form, [k]: v });

  return (
    <>
      <section className="adm-card">
        <header className="adm-card-head">
          <h2>การเชื่อมต่อ</h2>
        </header>
        <div className="adm-conn">
          <div>
            <Pill ok={dash.env.storage} label="ฐานข้อมูลถาวร (Upstash)" />
            <small>{dash.env.storage ? "เชื่อมต่อแล้ว" : "ใช้หน่วยความจำชั่วคราว ข้อมูลหายเมื่อรีสตาร์ต"}</small>
          </div>
          <div>
            <Pill ok={dash.env.promptpay} label="PromptPay" />
            <small>{dash.env.promptpay ? "มีเลขบัญชีแล้ว" : "ยังไม่ตั้ง XMAS_PROMPTPAY_ID"}</small>
          </div>
          <div>
            <Pill ok={dash.env.omise} label="Omise" />
            <small>{dash.env.omise ? "มีคีย์แล้ว (ใช้เมื่อโหมด gateway)" : "ยังไม่ตั้ง OMISE_SECRET_KEY"}</small>
          </div>
          <div>
            <Pill ok={dash.env.paynoi} label="paynoi (KBank)" />
            <small>{dash.env.paynoi ? "มีคีย์และเลขพร้อมเพย์แล้ว" : "ยังไม่ตั้ง PAYNOI_API_KEY / PAYNOI_ACCOUNT"}</small>
          </div>
          <div>
            <Pill ok={dash.env.alerts} label="แจ้งเตือน Webhook" />
            <small>{dash.env.alerts ? "ส่งแจ้งเตือนคำสั่งใหม่และการชำระแล้ว" : "ยังไม่ตั้ง XMAS_ALERT_WEBHOOK_URL"}</small>
          </div>
        </div>
        <div className="adm-toolbar">
          <button type="button" className="adm-btn" onClick={runCheck}>
            ทดสอบการเชื่อม Omise
          </button>
          <button type="button" className="adm-btn" onClick={testAlert}>
            ส่งข้อความทดสอบ Webhook
          </button>
          {check && <span className={check.ok ? "adm-ok" : "adm-bad"}>{check.note}</span>}
          {testNote && !check && <span className="adm-muted">{testNote}</span>}
        </div>
      </section>

      <section className="adm-card">
        <header className="adm-card-head">
          <h2>ตั้งค่าการสนับสนุน</h2>
        </header>
        <form onSubmit={save} className="adm-form">
          <label className="adm-check">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> เปิดรับการสนับสนุน
          </label>
          <label>
            <span>วิธีชำระ</span>
            <select value={form.payMode} onChange={(e) => set("payMode", e.target.value as Config["payMode"])}>
              <option value="manual">โอน PromptPay แล้วแอดมินยืนยันเอง</option>
              <option value="gateway">Omise ยืนยันอัตโนมัติ</option>
              <option value="paynoi">paynoi ตรวจการโอนเข้า KBank อัตโนมัติ</option>
            </select>
          </label>
          <label>
            <span>ราคาปุ่มเลือกเร็ว (คั่นด้วยจุลภาค)</span>
            <input value={presets} onChange={(e) => setPresets(e.target.value)} />
          </label>
          <div className="adm-row">
            <label>
              <span>ยอดต่ำสุดที่กรอกเอง</span>
              <input type="number" value={form.customMin} onChange={(e) => set("customMin", Number(e.target.value))} />
            </label>
            <label>
              <span>ยอดสูงสุดที่กรอกเอง</span>
              <input type="number" value={form.customMax} onChange={(e) => set("customMax", Number(e.target.value))} />
            </label>
          </div>
          <div className="adm-row">
            <label>
              <span>ราคาตุ๊กตา Exclusive ต่อตัว (฿)</span>
              <input type="number" value={form.decorPrice} onChange={(e) => set("decorPrice", Number(e.target.value))} />
            </label>
            <label>
              <span>ราคาข้อความขึ้นจอ (฿)</span>
              <input type="number" value={form.messagePrice} onChange={(e) => set("messagePrice", Number(e.target.value))} />
            </label>
          </div>
          <button className="adm-btn primary" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
          </button>
        </form>
      </section>
    </>
  );
}
