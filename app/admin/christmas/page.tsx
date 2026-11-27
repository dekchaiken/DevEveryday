"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./admin.css";

// หน้าจัดการระบบคริสต์มาส: ภาพรวม ข้อมูล log การกรองคำ และการชำระเงิน (เฉพาะแอดมิน)
type Config = {
  enabled: boolean;
  payMode: "manual" | "gateway";
  presetPrices: number[];
  customMin: number;
  customMax: number;
  decorPrice: number;
  messagePrice: number;
  blockedWords: string[];
};
type Dash = {
  config: Config;
  env: { storage: boolean; omise: boolean; promptpay: boolean };
  totals: { online: number; ornaments: number; revenue: number; paidCount: number; awaitingCount: number; giantTaken: number; giantCapacity: number };
  rooms: { id: string; name: string; online: number; capacity: number; ornaments: number; giant: { name: string; message: string; amount: number } | null }[];
  orders: { id: string; room: string; kind: string; amount: number; name: string; message: string; mode: string; status: string; createdAt: number; paidAt: number | null; providerRef: string }[];
};
type Ornament = { id: string; room: string; name: string; wish: string; color: string; shape: string; createdAt: number };
type Decor = { id: string; room: string; slot: number; name: string; hat: string; scarf: string; body: string; createdAt: number; likes: number };
type Event = { id: string; room: string; kind: string; text: string; by: string; theme?: string; startAt: number };
type Log = { id: string; at: number; type: string; room: string; actor: string; text: string };
type Flag = { kind: string; room: string; id: string; slot?: number; text: string };

const STATUS_TH: Record<string, string> = { awaiting_payment: "รอชำระ", paid: "จ่ายแล้ว", cancelled: "ยกเลิก" };
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
};
const ROOM_NAME: Record<string, string> = { bangkok: "กรุงเทพฯ", chiangmai: "เชียงใหม่", khonkaen: "ขอนแก่น", phuket: "ภูเก็ต" };

const fmt = (t: number) => new Date(t).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" });
const roomLabel = (id: string) => ROOM_NAME[id] ?? id;

type Tab = "overview" | "data" | "giants" | "log" | "filter" | "payment";
type GiantRow = { room: string; spot: number; name: string; message: string; amount: number; paidAt: number; orderId: string; social: Record<string, string> | null };

export default function ChristmasAdmin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/christmas/dashboard", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      setDash((await res.json()) as Dash);
      setError("");
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  function flash(ok: boolean, text: string) {
    setNote({ ok, text });
    setTimeout(() => setNote(null), 3500);
  }

  // ส่งคำสั่งลบหรือล้างไปยัง API กลาง แล้วรีโหลดข้อมูล
  async function moderate(items: object[]) {
    const res = await fetch("/api/admin/christmas/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    flash(res.ok && data.ok !== false, res.ok ? "ดำเนินการแล้ว" : data.error ?? "ไม่สำเร็จ");
    load();
    return res.ok;
  }

  return (
    <main className="adm">
      <header className="adm-head">
        <div>
          <p className="adm-kicker">ต้นคริสต์มาสร่วมกัน</p>
          <h1>หลังบ้านคริสต์มาส</h1>
        </div>
        <div className="adm-head-right">
          <span className={`adm-live ${error ? "is-off" : ""}`}>{error || "อัปเดตทุก 10 วินาที"}</span>
          <a className="adm-link" href="/Christmas" target="_blank" rel="noreferrer">
            เปิดหน้าเว็บ
          </a>
        </div>
      </header>

      <nav className="adm-tabs" role="tablist">
        {(
          [
            ["overview", "ภาพรวม"],
            ["data", "ข้อมูล"],
            ["giants", "Exclusive"],
            ["log", "Log"],
            ["filter", "คำต้องห้าม"],
            ["payment", "การชำระเงิน"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {note && <div className={`adm-note ${note.ok ? "ok" : "err"}`}>{note.text}</div>}

      {tab === "overview" && <Overview dash={dash} moderate={moderate} />}
      {tab === "data" && <DataTab dash={dash} moderate={moderate} reload={load} flash={flash} />}
      {tab === "giants" && <GiantsTab dash={dash} reload={load} flash={flash} />}
      {tab === "log" && <LogTab />}
      {tab === "filter" && <FilterTab dash={dash} reload={load} flash={flash} moderate={moderate} />}
      {tab === "payment" && <PaymentTab dash={dash} reload={load} flash={flash} />}
    </main>
  );
}

// ---------- ภาพรวม ----------
function Overview({ dash, moderate }: { dash: Dash | null; moderate: (items: object[]) => Promise<boolean> }) {
  if (!dash) return <p className="adm-empty">กำลังโหลด…</p>;
  const t = dash.totals;
  return (
    <>
      <section className="adm-stats">
        <Stat label="ออนไลน์ทั้งหมด" value={`${t.online}`} hint={`${dash.rooms.length} ห้อง`} />
        <Stat label="ลูกบอลที่แขวน" value={`${t.ornaments}`} />
        <Stat label="ยอดสนับสนุนที่จ่ายแล้ว" value={`฿${t.revenue.toLocaleString("th-TH")}`} hint={`${t.paidCount} รายการ`} />
        <Stat label="รอชำระ" value={`${t.awaitingCount}`} />
        <Stat label="Exclusive จองแล้ว" value={`${t.giantTaken} / ${t.giantCapacity}`} hint="ทุกห้องรวมกัน" />
      </section>

      <section className="adm-card">
        <h2>สถานะระบบ</h2>
        <div className="adm-pills">
          <Pill ok={dash.env.storage} label="ฐานข้อมูลถาวร (Upstash)" warn="ใช้หน่วยความจำชั่วคราว ข้อมูลจะหายเมื่อรีสตาร์ต" />
          <Pill ok={dash.config.enabled} label="เปิดรับสนับสนุน" warn="ปิดรับสนับสนุนอยู่" />
          <Pill ok={dash.env.promptpay} label="PromptPay" warn="ยังไม่ตั้ง XMAS_PROMPTPAY_ID" />
          <Pill ok={dash.env.omise} label="Omise" warn="ยังไม่ตั้ง OMISE_SECRET_KEY" />
        </div>
      </section>

      <section className="adm-card">
        <h2>ห้อง</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ออนไลน์</th>
                <th>ลูกบอล</th>
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
                  <td>{r.giant ? `${r.giant.name} · ฿${r.giant.amount}` : "—"}</td>
                  <td>
                    <button
                      className="adm-btn danger"
                      onClick={() => {
                        if (confirm(`ล้างลูกบอล คิวเหตุการณ์ และตุ๊กตาหิมะทั้งหมดของห้อง${r.name}? ทำย้อนกลับไม่ได้`))
                          moderate([{ action: "clear_room", room: r.id }]);
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="adm-stat">
      <small>{label}</small>
      <b>{value}</b>
      {hint && <em>{hint}</em>}
    </div>
  );
}

function Pill({ ok, label, warn }: { ok: boolean; label: string; warn: string }) {
  return (
    <span className={`adm-pill ${ok ? "ok" : "warn"}`} title={ok ? "พร้อมใช้งาน" : warn}>
      <i /> {label}
      {!ok && <small> · {warn}</small>}
    </span>
  );
}

// ---------- ข้อมูล: ลูกบอล ตุ๊กตาหิมะ เหตุการณ์ คำสั่งสนับสนุน ----------
type DataKind = "ornament" | "decor" | "event" | "order";

function DataTab({
  dash,
  moderate,
  reload,
  flash,
}: {
  dash: Dash | null;
  moderate: (items: object[]) => Promise<boolean>;
  reload: () => void;
  flash: (ok: boolean, text: string) => void;
}) {
  const [kind, setKind] = useState<DataKind>("ornament");
  const [room, setRoom] = useState("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ ornaments: Ornament[]; decor: Decor[]; events: Event[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const loadItems = useCallback(async () => {
    const res = await fetch(`/api/admin/christmas/items?room=${room}`, { cache: "no-store" });
    if (res.ok) setItems((await res.json()) as { ornaments: Ornament[]; decor: Decor[]; events: Event[] });
  }, [room]);

  useEffect(() => {
    loadItems();
    const id = setInterval(loadItems, 10000);
    return () => clearInterval(id);
  }, [loadItems]);

  useEffect(() => setPicked(new Set()), [kind, room]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (s: string) => !needle || s.toLowerCase().includes(needle);
    if (kind === "ornament") return (items?.ornaments ?? []).filter((o) => match(`${o.name} ${o.wish}`));
    if (kind === "decor") return (items?.decor ?? []).filter((d) => match(d.name));
    if (kind === "event") return (items?.events ?? []).filter((e) => match(`${e.by} ${e.text}`));
    return (dash?.orders ?? []).filter((o) => (room === "all" || o.room === room) && match(`${o.name} ${o.message}`));
  }, [kind, items, dash, q, room]);

  function keyOf(r: { id: string; room?: string }) {
    return `${r.room ?? ""}|${r.id}`;
  }
  function toggle(k: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  async function deletePicked() {
    if (!confirm(`ลบ ${picked.size} รายการที่เลือก? ทำย้อนกลับไม่ได้`)) return;
    const selected = rows.filter((r) => picked.has(keyOf(r as { id: string; room?: string })));
    const actions = selected.map((r) => {
      const x = r as { room: string; id: string; slot?: number };
      if (kind === "ornament") return { action: "delete_ornament", room: x.room, id: x.id };
      if (kind === "decor") return { action: "delete_decor", room: x.room, slot: x.slot };
      return { action: "delete_event", room: x.room, id: x.id };
    });
    if (actions.length) {
      await moderate(actions);
      setPicked(new Set());
      loadItems();
    }
  }

  async function confirmOrder(id: string) {
    const res = await fetch(`/api/admin/christmas/orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    const data = (await res.json()) as { error?: string };
    flash(res.ok, res.ok ? "ยืนยันการชำระเงินแล้ว" : data.error ?? "ยืนยันไม่สำเร็จ");
    reload();
  }

  const deletable = kind !== "order";
  return (
    <section className="adm-card">
      <div className="adm-toolbar">
        <div className="adm-seg" role="tablist">
          {(
            [
              ["ornament", "ลูกบอล"],
              ["decor", "ตุ๊กตาหิมะ"],
              ["event", "เหตุการณ์บนท้องฟ้า"],
              ["order", "คำสั่งสนับสนุน"],
            ] as [DataKind, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={kind === id} className={kind === id ? "is-on" : ""} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
          <option value="all">ทุกห้อง</option>
          {(dash?.rooms ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input className="adm-search" placeholder="ค้นหาชื่อหรือข้อความ" value={q} onChange={(e) => setQ(e.target.value)} />
        {deletable && (
          <button className="adm-btn danger" disabled={picked.size === 0} onClick={deletePicked}>
            ลบที่เลือก ({picked.size})
          </button>
        )}
      </div>

      <p className="adm-hint">
        แสดง {rows.length} รายการ{deletable ? " · เลือกแถวด้วยช่องติ๊กแล้วกดลบ" : " · คำสั่งสนับสนุนเป็นข้อมูลการเงิน ยืนยันได้แต่ไม่ลบจากหน้านี้"}
      </p>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              {deletable && <th />}
              <th>เวลา</th>
              <th>ห้อง</th>
              {kind === "order" ? (
                <>
                  <th>ประเภท</th>
                  <th>ยอด</th>
                  <th>ชื่อ / ข้อความ</th>
                  <th>สถานะ</th>
                  <th />
                </>
              ) : (
                <>
                  <th>ชื่อ</th>
                  <th>รายละเอียด</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {kind === "order" &&
              rows.map((o) => {
                const order = o as Dash["orders"][number];
                return (
                  <tr key={order.id}>
                    <td>{fmt(order.createdAt)}</td>
                    <td>{roomLabel(order.room)}</td>
                    <td>{order.kind === "giant" ? "Exclusive" : "สนับสนุนทีม"}</td>
                    <td>฿{order.amount}</td>
                    <td>
                      <b>{order.name}</b>
                      <br />
                      <small>{order.message || "—"}</small>
                    </td>
                    <td>
                      <span className={`adm-status ${order.status}`}>{STATUS_TH[order.status] ?? order.status}</span>
                    </td>
                    <td>
                      {order.status === "awaiting_payment" && order.mode === "manual" && (
                        <button className="adm-btn" onClick={() => confirmOrder(order.id)}>
                          ยืนยันรับเงิน
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            {kind === "ornament" &&
              (rows as Ornament[]).map((o) => (
                <tr key={`${o.room}${o.id}`}>
                  {deletable && (
                    <td>
                      <input type="checkbox" checked={picked.has(keyOf(o))} onChange={() => toggle(keyOf(o))} aria-label="เลือก" />
                    </td>
                  )}
                  <td>{fmt(o.createdAt)}</td>
                  <td>{roomLabel(o.room)}</td>
                  <td>
                    <b>{o.name}</b>
                  </td>
                  <td>
                    {o.wish || "—"} <small className="adm-muted">· {o.shape}/{o.color}</small>
                  </td>
                </tr>
              ))}
            {kind === "decor" &&
              (rows as Decor[]).map((d) => (
                <tr key={`${d.room}${d.id}`}>
                  {deletable && (
                    <td>
                      <input type="checkbox" checked={picked.has(keyOf({ id: d.id, room: d.room }))} onChange={() => toggle(keyOf({ id: d.id, room: d.room }))} aria-label="เลือก" />
                    </td>
                  )}
                  <td>{fmt(d.createdAt)}</td>
                  <td>{roomLabel(d.room)}</td>
                  <td>
                    <b>{d.name}</b>
                  </td>
                  <td>
                    ช่อง {d.slot + 1} <small className="adm-muted">· ถูกใจ {d.likes}</small>
                  </td>
                </tr>
              ))}
            {kind === "event" &&
              (rows as Event[]).map((e) => (
                <tr key={`${e.room}${e.id}`}>
                  {deletable && (
                    <td>
                      <input type="checkbox" checked={picked.has(keyOf({ id: e.id, room: e.room }))} onChange={() => toggle(keyOf({ id: e.id, room: e.room }))} aria-label="เลือก" />
                    </td>
                  )}
                  <td>{fmt(e.startAt)}</td>
                  <td>{roomLabel(e.room)}</td>
                  <td>
                    <b>{e.by}</b>
                  </td>
                  <td>
                    {e.text || "(พลุ)"} <small className="adm-muted">· {e.kind}{e.theme ? `/${e.theme}` : ""}</small>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="adm-empty">ยังไม่มีรายการ</p>}
      </div>
    </section>
  );
}

// ---------- Log ----------
function LogTab() {
  const [type, setType] = useState("all");
  const [room, setRoom] = useState("all");
  const [q, setQ] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/christmas/logs?type=${type}&room=${room}&limit=500`, { cache: "no-store" });
    if (res.ok) setLogs(((await res.json()) as { logs: Log[] }).logs);
  }, [type, room]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? logs.filter((l) => `${l.text} ${l.actor}`.toLowerCase().includes(needle)) : logs;
  }, [logs, q]);

  async function clearAll() {
    if (!confirm("ล้าง log ทั้งหมด? ทำย้อนกลับไม่ได้")) return;
    await fetch("/api/admin/christmas/logs", { method: "DELETE" });
    load();
  }

  return (
    <section className="adm-card">
      <div className="adm-toolbar">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="ประเภท">
          <option value="all">ทุกประเภท</option>
          {Object.entries(LOG_TH).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
          <option value="all">ทุกห้อง</option>
          {Object.entries(ROOM_NAME).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input className="adm-search" placeholder="ค้นหาใน log" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="adm-btn danger" onClick={clearAll}>
          ล้าง log
        </button>
      </div>
      <p className="adm-hint">แสดง {rows.length} รายการล่าสุด · อัปเดตทุก 5 วินาที · IP ถูกตัดให้เหลือเฉพาะส่วนต้น</p>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ประเภท</th>
              <th>ห้อง</th>
              <th>ผู้ทำ</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{fmt(l.at)}</td>
                <td>
                  <span className={`adm-tag t-${l.type}`}>{LOG_TH[l.type] ?? l.type}</span>
                </td>
                <td>{l.room === "all" ? "ทุกห้อง" : roomLabel(l.room)}</td>
                <td>
                  <code>{l.actor}</code>
                </td>
                <td>{l.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="adm-empty">ยังไม่มี log</p>}
      </div>
    </section>
  );
}

// ---------- คำต้องห้าม: กำหนดเพิ่ม และตรวจหาข้อมูลที่ตรงคำ ----------
function FilterTab({
  dash,
  reload,
  flash,
  moderate,
}: {
  dash: Dash | null;
  reload: () => void;
  flash: (ok: boolean, text: string) => void;
  moderate: (items: object[]) => Promise<boolean>;
}) {
  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [flags, setFlags] = useState<{ flagged: Flag[]; orders: { id: string; room: string; status: string; text: string }[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dash) setWords(dash.config.blockedWords ?? []);
  }, [dash]);

  function addWords() {
    const add = input
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter(Boolean);
    setWords((w) => [...new Set([...w, ...add])]);
    setInput("");
  }

  async function save() {
    if (!dash) return;
    setSaving(true);
    const res = await fetch("/api/admin/christmas/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dash.config, blockedWords: words }),
    });
    setSaving(false);
    flash(res.ok, res.ok ? "บันทึกคำต้องห้ามแล้ว" : "บันทึกไม่สำเร็จ");
    reload();
  }

  async function scan() {
    const res = await fetch("/api/admin/christmas/scan", { cache: "no-store" });
    if (res.ok) setFlags((await res.json()) as typeof flags);
  }

  async function deleteFlagged() {
    if (!flags || flags.flagged.length === 0) return;
    if (!confirm(`ลบ ${flags.flagged.length} รายการที่ตรงคำต้องห้าม? ทำย้อนกลับไม่ได้`)) return;
    const items = flags.flagged.map((f) => {
      if (f.kind === "ornament") return { action: "delete_ornament", room: f.room, id: f.id };
      if (f.kind === "decor") return { action: "delete_decor", room: f.room, slot: f.slot };
      return { action: "delete_event", room: f.room, id: f.id };
    });
    await moderate(items);
    scan();
  }

  if (!dash) return <p className="adm-empty">กำลังโหลด…</p>;
  return (
    <>
      <section className="adm-card">
        <h2>คำต้องห้ามที่กำหนดเอง</h2>
        <p className="adm-hint">ระบบมีรายการพื้นฐานอยู่แล้ว คำที่เพิ่มด้านล่างจะถูกกรองเพิ่มทั้งการแขวนคำอวยพร การวางตุ๊กตา และข้อความสนับสนุน</p>
        <div className="adm-chips">
          {words.length === 0 && <span className="adm-muted">ยังไม่มีคำที่เพิ่มเอง</span>}
          {words.map((w) => (
            <span key={w} className="adm-chip">
              {w}
              <button aria-label={`เอา ${w} ออก`} onClick={() => setWords((arr) => arr.filter((x) => x !== w))}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="adm-row">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="พิมพ์คำแล้วคั่นด้วยเครื่องหมายจุลภาค" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWords())} />
          <button className="adm-btn" onClick={addWords} disabled={!input.trim()}>
            เพิ่ม
          </button>
          <button className="adm-btn primary" onClick={save} disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกรายการ"}
          </button>
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-toolbar">
          <h2>ตรวจหาข้อมูลที่ตรงคำต้องห้าม</h2>
          <button className="adm-btn" onClick={scan}>
            ตรวจเดี๋ยวนี้
          </button>
          {flags && flags.flagged.length > 0 && (
            <button className="adm-btn danger" onClick={deleteFlagged}>
              ลบทั้งหมดที่พบ ({flags.flagged.length})
            </button>
          )}
        </div>
        {flags === null && <p className="adm-hint">กดตรวจเดี๋ยวนี้เพื่อค้นหาข้อมูลในทุกห้อง</p>}
        {flags && (
          <>
            <p className="adm-hint">
              พบ {flags.flagged.length} รายการในลูกบอล ตุ๊กตา และเหตุการณ์ · คำสั่งสนับสนุนที่ตรงคำ {flags.orders.length} รายการ (ดูได้ที่แท็บข้อมูล)
            </p>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>ประเภท</th>
                    <th>ห้อง</th>
                    <th>ข้อความ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {flags.flagged.map((f) => (
                    <tr key={`${f.kind}${f.id}`}>
                      <td>{f.kind === "ornament" ? "ลูกบอล" : f.kind === "decor" ? "ตุ๊กตา" : "เหตุการณ์"}</td>
                      <td>{roomLabel(f.room)}</td>
                      <td>{f.text}</td>
                      <td>
                        <button
                          className="adm-btn danger small"
                          onClick={() => {
                            const item =
                              f.kind === "ornament"
                                ? { action: "delete_ornament", room: f.room, id: f.id }
                                : f.kind === "decor"
                                  ? { action: "delete_decor", room: f.room, slot: f.slot }
                                  : { action: "delete_event", room: f.room, id: f.id };
                            moderate([item]).then(scan);
                          }}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {flags.flagged.length === 0 && <p className="adm-empty">ไม่พบข้อมูลที่ตรงคำต้องห้าม</p>}
            </div>
          </>
        )}
      </section>
    </>
  );
}

// ---------- การชำระเงิน: ตั้งค่าโหมด ยอด และตรวจการเชื่อมต่อ ----------
function PaymentTab({ dash, reload, flash }: { dash: Dash | null; reload: () => void; flash: (ok: boolean, text: string) => void }) {
  const [form, setForm] = useState<Config | null>(null);
  const [presets, setPresets] = useState("");
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<{ configured: boolean; ok: boolean; note: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (dash && !form) {
      setForm(dash.config);
      setPresets(dash.config.presetPrices.join(","));
    }
  }, [dash, form]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
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
    flash(res.ok, res.ok ? "บันทึกการตั้งค่าแล้ว" : data.error ?? "บันทึกไม่สำเร็จ");
    if (res.ok) reload();
  }

  async function runCheck() {
    setChecking(true);
    const res = await fetch("/api/admin/christmas/payment-check", { cache: "no-store" });
    setCheck((await res.json()) as typeof check);
    setChecking(false);
  }

  if (!form || !dash) return <p className="adm-empty">กำลังโหลด…</p>;
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setForm({ ...form, [k]: v });
  return (
    <>
      <section className="adm-card">
        <h2>ส่งออกรายการสั่งซื้อ</h2>
        <p className="adm-hint">ไฟล์ CSV ของรายการสั่งซื้อทั้งหมด (สูงสุด 2,000 รายการ) ไม่รวมอีเมลหรือเบอร์ของผู้ซื้อ เปิดด้วย Excel ได้</p>
        <a className="adm-btn" href="/api/admin/christmas/orders/export">
          ดาวน์โหลด CSV
        </a>
      </section>

      <section className="adm-card">
        <h2>ตั้งค่าการสนับสนุน</h2>
        <form onSubmit={save} className="adm-form">
          <label className="adm-check">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> เปิดรับการสนับสนุน
          </label>
          <label>
            โหมดชำระเงิน
            <select value={form.payMode} onChange={(e) => set("payMode", e.target.value as "manual" | "gateway")}>
              <option value="manual">PromptPay QR (แอดมินยืนยันเอง)</option>
              <option value="gateway">Omise (ยืนยันอัตโนมัติ)</option>
            </select>
          </label>
          <label>
            ราคาปุ่มเลือกเร็ว (คั่นด้วยคอมมา)
            <input value={presets} onChange={(e) => setPresets(e.target.value)} />
          </label>
          <div className="adm-row">
            <label>
              ยอดขั้นต่ำ (฿)
              <input inputMode="numeric" value={String(form.customMin)} onChange={(e) => set("customMin", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </label>
            <label>
              ยอดสูงสุด (฿)
              <input inputMode="numeric" value={String(form.customMax)} onChange={(e) => set("customMax", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </label>
          </div>
          <label>
            ราคาตุ๊กตาหิมะ Exclusive (฿) จ่ายทุกครั้งที่วาง 1 ตัว
            <input inputMode="numeric" value={String(form.decorPrice)} onChange={(e) => set("decorPrice", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </label>
          <label>
            ราคาข้อความอวยพรขึ้นจอ (฿)
            <input inputMode="numeric" value={String(form.messagePrice)} onChange={(e) => set("messagePrice", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </label>
          <button className="adm-btn primary" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
          </button>
        </form>
      </section>

      <section className="adm-card">
        <h2>การเชื่อมต่อ</h2>
        <p className="adm-hint">
          คีย์ลับของ Omise และหมายเลข PromptPay เก็บเป็นตัวแปรสภาพแวดล้อมบน Vercel ไม่ควรพิมพ์ลงหน้าเว็บ เพราะหน้านี้เข้าถึงผ่านเบราว์เซอร์และอาจถูกบันทึกไว้ในประวัติ
        </p>
        <ol className="adm-steps">
          <li>
            Vercel → โปรเจกต์ → Settings → Environment Variables เพิ่ม <code>OMISE_SECRET_KEY</code> (ค่าเริ่มด้วย skey_) และ <code>XMAS_PROMPTPAY_ID</code> / <code>XMAS_PROMPTPAY_NAME</code> / <code>XMAS_PROMPTPAY_CITY</code>
          </li>
          <li>
            ตั้ง Webhook ใน Omise Dashboard เป็น <code>https://dev-everyday-kappa.vercel.app/api/christmas/webhook/omise</code>
          </li>
          <li>Deploy ใหม่ 1 ครั้ง แล้วกลับมากดตรวจการเชื่อมต่อด้านล่าง</li>
        </ol>
        <div className="adm-pills">
          <Pill ok={dash.env.omise} label="OMISE_SECRET_KEY" warn="ยังไม่ตั้งค่า" />
          <Pill ok={dash.env.promptpay} label="XMAS_PROMPTPAY_ID" warn="ยังไม่ตั้งค่า" />
          <Pill ok={dash.env.storage} label="Upstash Redis" warn="ยังไม่ตั้งค่า" />
        </div>
        <div className="adm-row">
          <button className="adm-btn" onClick={runCheck} disabled={checking || !dash.env.omise}>
            {checking ? "กำลังตรวจ…" : "ตรวจการเชื่อมต่อ Omise"}
          </button>
          {check && <span className={`adm-status ${check.ok ? "paid" : "awaiting_payment"}`}>{check.note}</span>}
        </div>
        <p className="adm-hint">Stripe ยังไม่ได้เชื่อมในระบบนี้ ถ้าต้องการใช้ Stripe ต้องเพิ่มการเชื่อมต่อใหม่ก่อน</p>
      </section>
    </>
  );
}

// ---------- Exclusive: ดูตุ๊กตายักษ์ทุกจุด ค้นหา และถอดออกเมื่อจำเป็น ----------
function GiantsTab({ dash, reload, flash }: { dash: Dash | null; reload: () => void; flash: (ok: boolean, text: string) => void }) {
  const [room, setRoom] = useState("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<GiantRow[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/christmas/giants?room=${room}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setRows(((await res.json()) as { giants: GiantRow[] }).giants);
      setError("");
    } catch {
      setError("โหลดรายการ Exclusive ไม่สำเร็จ");
    }
  }, [room]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !needle || `${r.name} ${r.message}`.toLowerCase().includes(needle));
  }, [rows, q]);

  async function remove(r: GiantRow) {
    if (!confirm(`ถอด "${r.name}" ออกจากจุด ${r.spot + 1} ของ${roomLabel(r.room)}? ทำย้อนกลับไม่ได้ (ผู้ซื้อจะไม่ได้รับเงินคืนจากหน้านี้)`)) return;
    const res = await fetch("/api/admin/christmas/giants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: r.room, spot: r.spot }),
    });
    const data = (await res.json()) as { error?: string };
    flash(res.ok, res.ok ? "ถอดตุ๊กตายักษ์แล้ว" : data.error ?? "ถอดไม่สำเร็จ");
    load();
    reload();
  }

  return (
    <>
      <section className="adm-card">
        <h2>Exclusive ที่จองแล้ว</h2>
        <p className="adm-hint">
          จองแล้ว {dash?.totals.giantTaken ?? "—"} จาก {dash?.totals.giantCapacity ?? "—"} จุด (ทุกห้อง) จุดที่ว่างและจุดที่กำลังมีคนจองค้างอยู่จะถูกใช้ตามลำดับเมื่อมีการสั่งซื้อ
        </p>
        <div className="adm-filters">
          <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="ห้อง">
            <option value="all">ทุกห้อง</option>
            {(dash?.rooms ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือข้อความ" aria-label="ค้นหา" />
        </div>
        {error && <p className="adm-empty">{error}</p>}
        {rows === null && !error && <p className="adm-empty">กำลังโหลด…</p>}
        {rows && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>จุด</th>
                  <th>ชื่อ</th>
                  <th>ข้อความ</th>
                  <th>ยอด</th>
                  <th>เวลาจ่าย</th>
                  <th>ลิงก์</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={`${r.room}-${r.spot}`}>
                    <td>{roomLabel(r.room)}</td>
                    <td>{r.spot + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.message || "—"}</td>
                    <td>฿{r.amount}</td>
                    <td>{fmt(r.paidAt)}</td>
                    <td>{r.social ? Object.values(r.social).filter(Boolean).length : 0}</td>
                    <td>
                      <button className="adm-btn danger" onClick={() => remove(r)}>
                        ถอดออก
                      </button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={8} className="adm-empty">
                      ยังไม่มี Exclusive ในห้องนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
