import React, { useState, useEffect } from "react";
import {
  Camera, Upload, Package, Check, AlertTriangle, X, Plus,
  ClipboardList, Search, Loader2, ScanLine, ArrowDownUp, Trash2, RotateCcw,
  Map as MapIcon, ChevronDown, User, History,
  LayoutDashboard, Boxes, Clock, Copy, Download
} from "lucide-react";

// ---------- Yum Thai brand palette ----------
const BRAND = {
  red: "#B4232A", redDark: "#8A171D",
  gold: "#D99A1C", goldSoft: "#EBBE5A", goldTint: "#F7ECCF",
  cream: "#FAF4E8", ink: "#3A2621", inkSoft: "#6E5B52",
  border: "#E7DCC7", borderStrong: "#D8C7A6",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "ui-sans-serif, system-ui, sans-serif";

// ---------- storage (offline-safe: falls back to in-memory) ----------
const KEY = "yumthai_inventory_v1";
const persist = {
  async load() {
    try {
      if (!window.storage) return null;
      const r = await window.storage.get(KEY);
      return r ? JSON.parse(r.value) : null;
    } catch (e) { return null; }
  },
  async save(inv) {
    try { if (window.storage) await window.storage.set(KEY, JSON.stringify(inv)); } catch (e) {}
  },
};

const keyFor = (n) => (n || "").trim().toLowerCase();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${m}/${day}/${y.slice(2)}`; };
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const daysUntil = (d) => { if (!d) return null; const t = new Date(); t.setHours(0, 0, 0, 0); const x = new Date(d + "T00:00:00"); return Math.round((x - t) / 86400000); };
const daysBetween = (d1, d2) => { const a = new Date(d1 + "T00:00:00"), b = new Date(d2 + "T00:00:00"); return Math.round((b - a) / 86400000); };
const EXPIRE_SOON = 3;
const expiryState = (it) => { const d = daysUntil(it.expiry); if (d == null) return null; if (d < 0) return "expired"; if (d <= EXPIRE_SOON) return "soon"; return "ok"; };
const forecastDays = (it) => {
  const counts = (it.history || []).filter((h) => h.mode === "count");
  if (counts.length < 2) return null;
  const a = counts[counts.length - 2], b = counts[counts.length - 1];
  const days = daysBetween(a.date, b.date), used = a.qty - b.qty;
  if (!(days > 0) || !(used > 0)) return null;
  const rate = used / days; if (!(rate > 0)) return null;
  return Math.max(0, Math.floor((Number(it.qty) || 0) / rate));
};

// confidence -> traffic light (functional; kept distinct from brand)
const STATUS = {
  high:    { c: "green",  dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Good" },
  medium:  { c: "yellow", dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 border-amber-200",       label: "Review" },
  low:     { c: "yellow", dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 border-amber-200",       label: "Review" },
  unknown: { c: "red",    dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 border-rose-200",          label: "Unknown" },
};
const statusOf = (conf) => STATUS[conf] || STATUS.unknown;

function Stat({ label, value, sub, accent, Icon }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#fff", border: `1px solid ${BRAND.border}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: accent || BRAND.inkSoft }} />}
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: BRAND.inkSoft }}>{label}</span>
      </div>
      <div className="text-2xl font-bold leading-none" style={{ color: accent || BRAND.ink }}>{value}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: BRAND.inkSoft }}>{sub}</div>}
    </div>
  );
}

export default function YumThaiInventory() {
  const [inv, setInv] = useState({ items: {}, sessions: [] });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [mode, setMode] = useState("count");
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [imgQuality, setImgQuality] = useState(null);
  const [lastSummary, setLastSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const [mapInput, setMapInput] = useState("");
  const [userMenu, setUserMenu] = useState(false);
  const [newUser, setNewUser] = useState("");
  useEffect(() => { persist.load().then((d) => { if (d) setInv(d); setLoaded(true); if (!(d && d.currentUser)) setUserMenu(true); }); }, []);
  const commit = (next) => { setInv(next); persist.save(next); };
  function requireUser() { if (!inv.currentUser) { setUserMenu(true); return false; } return true; }

  // ---------- users & activity log ----------
  const users = inv.users || [];
  const currentUser = inv.currentUser || null;
  function stamp(next, action) {
    const entry = { ts: Date.now(), user: (next.currentUser ?? inv.currentUser) || "Unknown", action };
    return { ...next, log: [entry, ...(next.log || inv.log || [])].slice(0, 150) };
  }
  function selectUser(name) { commit(stamp({ ...inv, currentUser: name }, `${name} signed in`)); setUserMenu(false); }
  function addUser(name) {
    const nm = (name || "").trim(); if (!nm) return;
    const exists = users.some((u) => u.toLowerCase() === nm.toLowerCase());
    commit(stamp({ ...inv, users: exists ? users : [...users, nm], currentUser: nm }, exists ? `${nm} signed in` : `Added user ${nm}`));
    setNewUser(""); setUserMenu(false);
  }

  // ---------- map / floor plan ----------
  const invRef = React.useRef(inv); useEffect(() => { invRef.current = inv; }, [inv]);
  const floorRef = React.useRef(null); const dragId = React.useRef(null);
  const pins = inv.map?.pins || [];
  const placedKeys = new Set(pins.map((p) => p.key).filter(Boolean));
  const unplaced = Object.values(inv.items).filter((it) => !placedKeys.has(keyFor(it.name)));

  // ---------- reorder thresholds ----------
  function setThreshold(k, field, value) {
    if (!requireUser()) return;
    const it = inv.items[k]; if (!it) return;
    const v = value === "" ? null : Math.max(0, Number(value) || 0);
    commit(stamp({ ...inv, items: { ...inv.items, [k]: { ...it, [field]: v } } }, `Set ${field} for ${it.name}`));
  }
  const reorders = Object.entries(inv.items).map(([k, it]) => {
    const mn = num(it.min); if (mn == null || it.qty > mn) return null;
    const mx = num(it.max);
    return { k, name: it.name, qty: it.qty, unit: it.unit, order: mx != null ? Math.max(mx - it.qty, 0) : null };
  }).filter(Boolean);

  // ---------- dashboard analytics ----------
  const totalItems = Object.keys(inv.items).length;
  const totalUnits = Object.values(inv.items).reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const statusCounts = Object.values(inv.items).reduce((a, it) => { const s = it.status || "yellow"; a[s] = (a[s] || 0) + 1; return a; }, {});
  const lastCountDate = Object.values(inv.items).reduce((m, it) => (it.lastDate && (!m || it.lastDate > m)) ? it.lastDate : m, null);
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })();
  const expiring = Object.entries(inv.items).map(([k, it]) => { const st = expiryState(it); return (st === "expired" || st === "soon") ? { k, name: it.name, state: st, days: daysUntil(it.expiry) } : null; }).filter(Boolean);

  function setExpiry(k, value) { if (!requireUser()) return; const it = inv.items[k]; if (!it) return; commit(stamp({ ...inv, items: { ...inv.items, [k]: { ...it, expiry: value || null } } }, `Set expiry for ${it.name}`)); }
  function copyOrders() {
    if (!reorders.length) return;
    const text = `Yum Thai reorder — ${new Date().toLocaleDateString()}\n` + reorders.map((r) => `- ${r.name}: ${r.order != null ? `${r.order} ${r.unit}` : "(set a max)"}`).join("\n");
    try { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => window.prompt("Copy this order list:", text)); }
    catch (e) { window.prompt("Copy this order list:", text); }
  }
  function exportCSV() {
    const rows = [["Item", "Unit", "Qty", "Min", "Max", "Expiry", "Last counted", "Status"]];
    Object.values(inv.items).forEach((it) => rows.push([it.name, it.unit, it.qty, it.min ?? "", it.max ?? "", it.expiry ?? "", it.lastDate ?? "", it.status ?? ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    try { const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `yum-thai-inventory-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(url); }
    catch (e) { window.prompt("Copy CSV:", csv); }
  }
  function addPin(name) {
    if (!requireUser()) return;
    const nm = (name || "").trim(); if (!nm) return;
    const k = keyFor(nm); const linked = inv.items[k] ? k : null;
    const pin = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: inv.items[k]?.name || nm, x: 0.5, y: 0.5, key: linked };
    commit(stamp({ ...inv, map: { pins: [...pins, pin] } }, `Placed "${pin.name}" on map`));
  }
  function removePin(id) { if (!requireUser()) return; const p = pins.find((x) => x.id === id); commit(stamp({ ...inv, map: { pins: pins.filter((x) => x.id !== id) } }, `Removed "${p?.name || "item"}" from map`)); }
  function onPinDown(e, id) { if (!requireUser()) return; dragId.current = id; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} }
  function onPinMove(e) {
    if (!dragId.current || !floorRef.current) return;
    const rect = floorRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
    x = Math.max(0.04, Math.min(0.96, x)); y = Math.max(0.04, Math.min(0.96, y));
    setInv((prev) => ({ ...prev, map: { pins: (prev.map?.pins || []).map((p) => p.id === dragId.current ? { ...p, x, y } : p) } }));
  }
  function onPinUp() {
    const id = dragId.current; if (!id) return; dragId.current = null;
    const cur = invRef.current; const p = (cur.map?.pins || []).find((x) => x.id === id);
    const entry = { ts: Date.now(), user: cur.currentUser || "Unknown", action: `Moved "${p?.name || "item"}" on map` };
    const next = { ...cur, log: [entry, ...(cur.log || [])].slice(0, 150) };
    setInv(next); persist.save(next);
  }

  function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setImage({ dataUrl, base64: dataUrl.split(",")[1], media: f.type || "image/jpeg" });
      setResults(null); setError(""); setImgQuality(null);
    };
    reader.readAsDataURL(f);
  }

  async function analyze() {
    if (!requireUser()) return;
    if (!image) return;
    setAnalyzing(true); setError(""); setResults(null);
    const prompt = `You are an inventory vision assistant. Analyze this photo of a storage area (garage shelf, rack, or bin). Identify distinct inventory item TYPES visible and estimate the quantity of each.

Return ONLY valid JSON, no markdown, no code fences, no preamble, exactly this shape:
{"image_quality":"good|partial|unreadable","items":[{"name":"string","quantity":number,"unit":"string","confidence":"high|medium|low|unknown","note":"string"}]}

Rules:
- image_quality: "good" = clear and countable; "partial" = some areas occluded/blurry; "unreadable" = too dark/blurry/empty to assess.
- confidence per item: "high" = clearly visible and countable; "medium" = partly occluded or ambiguous count; "low" = barely visible; "unknown" = an object is visible but you cannot identify what it is.
- If nothing is identifiable or the area is empty, return "items":[] with the appropriate image_quality.
- Never invent items you cannot see. Prefer honest low/unknown confidence over guessing.
- "quantity" is your best count estimate; "note" briefly explains occlusion or reduced confidence.`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: image.media, data: image.base64 } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });
      const data = await resp.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setImgQuality(parsed.image_quality);
      const rows = (parsed.items || []).map((it) => ({
        name: it.name || "Unknown item",
        quantity: Number.isFinite(it.quantity) ? it.quantity : 0,
        unit: it.unit || "units",
        confidence: it.confidence || "unknown",
        note: it.note || "",
        edited: Number.isFinite(it.quantity) ? it.quantity : 0,
        reviewed: (it.confidence === "high"),
      }));
      setResults(rows);
    } catch (e) {
      setError("Couldn't analyze the image. Try again, or check the connection. (" + (e.message || "error") + ")");
    } finally { setAnalyzing(false); }
  }

  const globalRed = imgQuality === "unreadable" || (results && results.length === 0);

  function confirmScan() {
    if (!requireUser()) return;
    if (!results) return;
    const next = { ...inv, items: { ...inv.items }, sessions: [...inv.sessions] };
    const date = todayStr();
    const summary = { date, mode, consumed: 0, added: 0, lines: [] };

    results.forEach((r) => {
      const k = keyFor(r.name);
      const qty = Number(r.edited) || 0;
      const existing = next.items[k];
      const st = statusOf(r.confidence).c;

      if (mode === "add") {
        const base = existing ? existing.qty : 0;
        const newQty = base + qty;
        summary.added += qty;
        summary.lines.push({ name: r.name, delta: +qty, qty: newQty });
        next.items[k] = {
          ...existing,
          name: existing?.name || r.name, unit: r.unit || existing?.unit || "units",
          qty: newQty, lastDate: date, status: r.reviewed ? "green" : st,
          history: [...(existing?.history || []), { date, mode: "add", delta: +qty, qty: newQty }],
        };
      } else {
        const prev = existing ? existing.qty : null;
        const change = prev == null ? qty : prev - qty;
        if (prev != null && change > 0) summary.consumed += change;
        summary.lines.push({
          name: r.name, prev, qty,
          used: prev == null ? null : change,
          flag: prev != null && change < 0 ? "increased" : (prev == null ? "new" : null),
        });
        next.items[k] = {
          ...existing,
          name: existing?.name || r.name, unit: r.unit || existing?.unit || "units",
          qty, lastDate: date, status: r.reviewed ? "green" : st,
          history: [...(existing?.history || []), { date, mode: "count", delta: prev == null ? +qty : -(change), qty }],
        };
      }
    });

    next.sessions.unshift(summary);
    const act = mode === "add" ? `Added stock (+${summary.added})` : `Counted — ${summary.consumed} used`;
    commit(stamp(next, act));
    setLastSummary(summary);
    setResults(null); setImage(null); setImgQuality(null);
    setTab("inventory");
  }

  function resetScan() { setResults(null); setImage(null); setError(""); setImgQuality(null); }
  function deleteItem(k) { if (!requireUser()) return; const nm = inv.items[k]?.name || "item"; const next = { ...inv, items: { ...inv.items } }; delete next.items[k]; commit(stamp(next, `Deleted "${nm}"`)); }

  const itemList = Object.entries(inv.items)
    .filter(([, v]) => v.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="min-h-screen" style={{ background: BRAND.cream, color: BRAND.ink, fontFamily: SANS }}>
      {/* header */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND.red}, ${BRAND.redDark})`, borderBottom: `3px solid ${BRAND.gold}` }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: BRAND.gold }}>
            <Package className="w-6 h-6" style={{ color: BRAND.redDark }} />
          </div>
          <div className="flex-1">
            <div className="text-white text-lg leading-none" style={{ fontFamily: SERIF, fontWeight: 700, letterSpacing: ".3px" }}>Yum Thai</div>
            <div className="text-[11px] uppercase tracking-widest mt-1" style={{ color: BRAND.goldSoft }}>Inventory · photo estimate</div>
          </div>
          <button onClick={() => setUserMenu(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm shrink-0"
            style={{ background: currentUser ? "rgba(255,255,255,.15)" : BRAND.gold, color: currentUser ? "#fff" : BRAND.ink }}>
            <User className="w-4 h-4" />
            <span className="max-w-[84px] truncate">{currentUser || "Set user"}</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        {tab === "home" && (
          <>
            <div className="mb-5">
              <h1 className="leading-tight" style={{ fontFamily: SERIF, fontSize: "26px", fontWeight: 700, color: BRAND.ink }}>
                {greeting}{currentUser ? `, ${currentUser}` : ""}
              </h1>
              <p className="text-sm" style={{ color: BRAND.inkSoft }}>
                {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · stockroom overview
              </p>
            </div>

            {!currentUser && (
              <button onClick={() => setUserMenu(true)} className="w-full mb-4 rounded-2xl p-4 flex items-center gap-3 text-left"
                style={{ background: BRAND.gold, color: BRAND.ink }}>
                <User className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Set your name to begin</div>
                  <div className="text-xs" style={{ color: BRAND.redDark }}>Changes are locked until we know who's making them.</div>
                </div>
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <Stat label="Items" value={totalItems} Icon={Package} />
              <Stat label="Units in stock" value={totalUnits} Icon={Boxes} />
              <Stat label="To reorder" value={reorders.length} accent={reorders.length ? BRAND.red : null} Icon={AlertTriangle} />
              <Stat label="Last count" value={fmtDate(lastCountDate)} Icon={Clock} />
            </div>

            {/* stock health */}
            {totalItems > 0 && (
              <div className="rounded-2xl p-4 mb-3" style={{ background: "#fff", border: `1px solid ${BRAND.border}` }}>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.inkSoft }}>Stock health</div>
                <div className="flex h-2.5 rounded-full overflow-hidden mb-2" style={{ background: BRAND.border }}>
                  <div style={{ width: `${((statusCounts.green || 0) / totalItems) * 100}%`, background: "#10B981" }} />
                  <div style={{ width: `${((statusCounts.yellow || 0) / totalItems) * 100}%`, background: "#F59E0B" }} />
                  <div style={{ width: `${((statusCounts.red || 0) / totalItems) * 100}%`, background: "#F43F5E" }} />
                </div>
                <div className="flex gap-4 text-[11px]" style={{ color: BRAND.inkSoft }}>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{statusCounts.green || 0} good</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{statusCounts.yellow || 0} review</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{statusCounts.red || 0} attention</span>
                </div>
              </div>
            )}

            {/* reorder spotlight */}
            {reorders.length > 0 ? (
              <button onClick={() => setTab("inventory")} className="w-full text-left rounded-2xl p-4 mb-4" style={{ background: "#FDF2F2", border: "1px solid #F3B4B4" }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: BRAND.red }} />
                  <span className="text-sm font-semibold" style={{ color: BRAND.red }}>Time to reorder — {reorders.length} item{reorders.length > 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-1">
                  {reorders.slice(0, 3).map((r) => (
                    <div key={r.k} className="text-sm flex items-center justify-between">
                      <span style={{ color: BRAND.ink }}>{r.name}</span>
                      <span className="font-semibold" style={{ color: BRAND.red }}>{r.order != null ? `order ${r.order} ${r.unit}` : "set a Max"}</span>
                    </div>
                  ))}
                  {reorders.length > 3 && <div className="text-xs pt-0.5" style={{ color: BRAND.inkSoft }}>+{reorders.length - 3} more →</div>}
                </div>
              </button>
            ) : totalItems > 0 ? (
              <div className="rounded-2xl p-4 mb-4 flex items-center gap-2" style={{ background: "#ECF7F1", border: "1px solid #B7E0CC" }}>
                <Check className="w-4 h-4" style={{ color: "#0F9D6E" }} />
                <span className="text-sm font-medium" style={{ color: "#0F7A57" }}>All stocked up — nothing below its minimum.</span>
              </div>
            ) : null}

            {expiring.length > 0 && (
              <button onClick={() => setTab("inventory")} className="w-full text-left rounded-2xl p-4 mb-4" style={{ background: "#FFF7EC", border: "1px solid #F0D9A8" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" style={{ color: "#B8860B" }} />
                  <span className="text-sm font-semibold" style={{ color: "#8A6400" }}>Check dates — {expiring.length} item{expiring.length > 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-1">
                  {expiring.slice(0, 3).map((e) => (
                    <div key={e.k} className="text-sm flex items-center justify-between">
                      <span style={{ color: BRAND.ink }}>{e.name}</span>
                      <span className="font-semibold" style={{ color: e.state === "expired" ? BRAND.red : "#B8860B" }}>
                        {e.state === "expired" ? `expired ${-e.days}d ago` : `${e.days}d left`}
                      </span>
                    </div>
                  ))}
                  {expiring.length > 3 && <div className="text-xs pt-0.5" style={{ color: BRAND.inkSoft }}>+{expiring.length - 3} more →</div>}
                </div>
              </button>
            )}

            {/* quick actions */}
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.inkSoft }}>Quick actions</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[["scan", "Scan", ScanLine, "Count a shelf", true], ["inventory", "Stock", Boxes, "View items", false], ["map", "Map", MapIcon, "Find things", false]].map(([id, lbl, Icon, desc, hero]) => (
                <button key={id} onClick={() => setTab(id)} className="rounded-2xl p-4 flex flex-col items-center text-center gap-2"
                  style={hero ? { background: BRAND.red } : { background: "#fff", border: `1px solid ${BRAND.border}` }}>
                  <span className="w-11 h-11 rounded-full grid place-items-center" style={{ background: hero ? "rgba(255,255,255,.18)" : BRAND.goldTint }}>
                    <Icon className="w-5 h-5" style={{ color: hero ? "#fff" : BRAND.red }} />
                  </span>
                  <span className="text-sm font-semibold" style={{ color: hero ? "#fff" : BRAND.ink }}>{lbl}</span>
                  <span className="text-[10px] leading-tight" style={{ color: hero ? "rgba(255,255,255,.8)" : BRAND.inkSoft }}>{desc}</span>
                </button>
              ))}
            </div>

            {/* recent activity */}
            {(inv.log || []).length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "#fff", border: `1px solid ${BRAND.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: BRAND.inkSoft }}>Recent activity</span>
                  <button onClick={() => setTab("activity")} className="text-[11px] font-medium" style={{ color: BRAND.red }}>See all</button>
                </div>
                <div className="space-y-2">
                  {(inv.log || []).slice(0, 4).map((e, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full grid place-items-center shrink-0 text-[10px] font-bold" style={{ background: BRAND.goldTint, color: BRAND.redDark }}>
                        {(e.user || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-[13px] flex-1 min-w-0 truncate" style={{ color: BRAND.ink }}><b>{e.user}</b> · {e.action}</span>
                      <span className="text-[10px] shrink-0" style={{ color: BRAND.inkSoft }}>{new Date(e.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {tab === "scan" && (
          <>
            {/* mode toggle */}
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex rounded-xl p-1" style={{ background: "#EFE4CE" }}>
                {[["count", "Count", ArrowDownUp], ["add", "Add stock", Plus]].map(([id, lbl, Icon]) => (
                  <button key={id} onClick={() => setMode(id)}
                    className="px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition"
                    style={mode === id
                      ? { background: "#fff", color: BRAND.red, boxShadow: "0 1px 3px rgba(0,0,0,.12)" }
                      : { background: "transparent", color: BRAND.inkSoft }}>
                    <Icon className="w-4 h-4" /> {lbl}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-tight" style={{ color: BRAND.inkSoft }}>
                {mode === "count"
                  ? "Counts current stock and compares to the last count to show what was used."
                  : "Adds what you photograph on top of existing stock (restock / received)."}
              </p>
            </div>

            {/* capture */}
            {!results && (
              <div className="rounded-2xl p-5" style={{ background: "#fff", border: `1px solid ${BRAND.border}` }}>
                {!image ? (
                  <label className="block cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
                    <div className="rounded-xl py-12 grid place-items-center text-center transition"
                      style={{ border: `2px dashed ${BRAND.borderStrong}` }}>
                      <div className="w-14 h-14 rounded-full grid place-items-center mb-3" style={{ background: BRAND.goldTint }}>
                        <Camera className="w-7 h-7" style={{ color: BRAND.gold }} />
                      </div>
                      <div className="font-medium" style={{ color: BRAND.ink }}>Take or upload a photo</div>
                      <div className="text-xs mt-1 flex items-center gap-1" style={{ color: BRAND.inkSoft }}>
                        <Upload className="w-3 h-3" /> shelf, rack, or bin
                      </div>
                    </div>
                  </label>
                ) : (
                  <div>
                    <img src={image.dataUrl} alt="capture" className="w-full max-h-72 object-contain rounded-xl" style={{ background: "#F3EAD8" }} />
                    <div className="flex gap-2 mt-4">
                      <button onClick={analyze} disabled={analyzing}
                        className="flex-1 rounded-xl py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-60 text-white"
                        style={{ background: BRAND.red }}>
                        {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><ScanLine className="w-4 h-4" /> Analyze photo</>}
                      </button>
                      <button onClick={resetScan} className="px-4 rounded-xl" style={{ border: `1px solid ${BRAND.borderStrong}`, color: BRAND.inkSoft }}>
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {error && <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
              </div>
            )}

            {/* results */}
            {results && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${BRAND.border}` }}>
                {globalRed ? (
                  <div className="bg-rose-50 border-b border-rose-200 px-5 py-3 flex items-center gap-2 text-rose-700">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm font-medium">No inventory detected or image unclear — retake the photo.</span>
                  </div>
                ) : imgQuality === "partial" ? (
                  <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm font-medium">Partial view — some items may be hidden. Review the yellow rows.</span>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 flex items-center gap-2 text-emerald-700">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-medium">Clear image. Confirm counts below.</span>
                  </div>
                )}

                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold uppercase tracking-wide" style={{ color: BRAND.inkSoft }}>
                      {mode === "add" ? "Adding to stock" : "Estimated count"} · {fmtDate(todayStr())}
                    </div>
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: BRAND.inkSoft }}>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Good</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Review</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />Unknown</span>
                    </div>
                  </div>

                  {results.length === 0 && (
                    <div className="text-center py-6 text-sm" style={{ color: BRAND.inkSoft }}>Nothing detected in this image.</div>
                  )}

                  {results.map((r, i) => {
                    const st = statusOf(r.confidence);
                    const existing = inv.items[keyFor(r.name)];
                    return (
                      <div key={i} className={`rounded-xl border p-3 flex items-start gap-3 ${r.reviewed ? "" : st.chip}`}
                        style={r.reviewed ? { background: "#fff", borderColor: BRAND.border } : {}}>
                        <span className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${st.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" style={{ color: BRAND.ink }}>{r.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.chip}`}>{st.label}</span>
                            {mode === "count" && existing && (<span className="text-[11px]" style={{ color: BRAND.inkSoft }}>was {existing.qty}</span>)}
                            {mode === "count" && !existing && (<span className="text-[11px] text-emerald-600">new item</span>)}
                          </div>
                          {r.note && <div className="text-xs mt-0.5" style={{ color: BRAND.inkSoft }}>{r.note}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input type="number" value={r.edited} min="0"
                            onChange={(e) => setResults(results.map((x, j) => j === i ? { ...x, edited: e.target.value, reviewed: true } : x))}
                            className="w-16 text-center rounded-lg py-1.5 text-sm font-semibold"
                            style={{ border: `1px solid ${BRAND.borderStrong}` }} />
                          <span className="text-xs w-10" style={{ color: BRAND.inkSoft }}>{r.unit}</span>
                          <button title="Mark reviewed"
                            onClick={() => setResults(results.map((x, j) => j === i ? { ...x, reviewed: !x.reviewed } : x))}
                            className="w-8 h-8 rounded-lg grid place-items-center"
                            style={r.reviewed ? { background: "#059669", color: "#fff" } : { background: "#EFE4CE", color: BRAND.inkSoft }}>
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 px-5 pb-5">
                  <button onClick={confirmScan} disabled={results.length === 0}
                    className="flex-1 rounded-xl py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: BRAND.gold, color: BRAND.ink }}>
                    <Check className="w-4 h-4" /> {mode === "add" ? "Add to inventory" : "Save count"}
                  </button>
                  <button onClick={resetScan} className="px-4 rounded-xl" style={{ border: `1px solid ${BRAND.borderStrong}`, color: BRAND.inkSoft }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "inventory" && (
          <>
            {reorders.length > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: "#FDF2F2", border: "1px solid #F3B4B4" }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: BRAND.red }} />
                  <span className="text-sm font-semibold flex-1" style={{ color: BRAND.red }}>
                    Reorder needed — {reorders.length} item{reorders.length > 1 ? "s" : ""}
                  </span>
                  <button onClick={copyOrders} className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: BRAND.red, color: "#fff" }}>
                    <Copy className="w-3 h-3" />{copied ? "Copied!" : "Copy list"}
                  </button>
                </div>
                <div className="space-y-1">
                  {reorders.map((r) => (
                    <div key={r.k} className="text-sm flex items-center justify-between gap-3">
                      <span style={{ color: BRAND.ink }}>{r.name} <span style={{ color: BRAND.inkSoft }}>· have {r.qty} {r.unit}</span></span>
                      <span className="font-semibold whitespace-nowrap" style={{ color: BRAND.red }}>
                        {r.order != null ? `order ${r.order} ${r.unit}` : "set a Max →"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lastSummary && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: "#fff", border: `1px solid ${BRAND.border}` }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: BRAND.inkSoft }}>
                  Last {lastSummary.mode === "add" ? "restock" : "count"} · {fmtDate(lastSummary.date)}
                </div>
                {lastSummary.mode === "add"
                  ? <div className="text-sm" style={{ color: BRAND.ink }}>Added <b>{lastSummary.added}</b> units across {lastSummary.lines.length} item(s).</div>
                  : <div className="text-sm" style={{ color: BRAND.ink }}>Consumed <b className="text-rose-600">{lastSummary.consumed}</b> units since the previous count.</div>}
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: BRAND.inkSoft }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an item…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm" style={{ background: "#fff", border: `1px solid ${BRAND.borderStrong}` }} />
              </div>
              <button onClick={exportCSV} title="Export CSV backup" className="px-3 py-2.5 rounded-xl flex items-center gap-1.5 text-sm font-medium shrink-0" style={{ background: "#fff", border: `1px solid ${BRAND.borderStrong}`, color: BRAND.inkSoft }}>
                <Download className="w-4 h-4" /><span className="hidden sm:inline">CSV</span>
              </button>
            </div>

            {!loaded ? (
              <div className="text-center py-12" style={{ color: BRAND.inkSoft }}><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            ) : itemList.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: BRAND.inkSoft }}>
                {Object.keys(inv.items).length === 0 ? "No inventory yet. Scan a shelf to start." : "No items match your search."}
              </div>
            ) : (
              <div className="space-y-2">
                {itemList.map(([k, it]) => {
                  const last = it.history[it.history.length - 1];
                  const prev = it.history[it.history.length - 2];
                  const used = last && prev && last.mode === "count" ? prev.qty - last.qty : null;
                  const dot = it.status === "green" ? "bg-emerald-500" : it.status === "red" ? "bg-rose-500" : "bg-amber-500";
                  const mn = num(it.min), mx = num(it.max);
                  const need = mn != null && it.qty <= mn;
                  const order = mx != null ? Math.max(mx - it.qty, 0) : null;
                  const exp = expiryState(it);
                  const fc = forecastDays(it);
                  return (
                    <div key={k} className="rounded-xl p-4" style={{ background: "#fff", border: `1px solid ${(need || exp === "expired") ? "#F0A9A9" : BRAND.border}` }}>
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" style={{ color: BRAND.ink }}>{it.name}</div>
                          <div className="text-xs" style={{ color: BRAND.inkSoft }}>
                            Last counted {fmtDate(it.lastDate)}
                            {used != null && used > 0 && <span className="text-rose-500"> · used {used} {it.unit} since prior</span>}
                            {used != null && used < 0 && <span className="text-emerald-600"> · +{-used} since prior</span>}
                            {fc != null && <span> · ~{fc}d left</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold leading-none" style={{ color: BRAND.red }}>{it.qty}</div>
                          <div className="text-[10px] uppercase" style={{ color: BRAND.inkSoft }}>{it.unit}</div>
                        </div>
                        <button onClick={() => deleteItem(k)} className="p-1" style={{ color: BRAND.borderStrong }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${BRAND.border}` }}>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: BRAND.inkSoft }}>
                          Min
                          <input type="number" min="0" value={it.min ?? ""} placeholder="—"
                            onChange={(e) => setThreshold(k, "min", e.target.value)}
                            className="w-14 text-center rounded-lg py-1 text-sm font-semibold" style={{ border: `1px solid ${BRAND.borderStrong}`, color: BRAND.ink }} />
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: BRAND.inkSoft }}>
                          Max
                          <input type="number" min="0" value={it.max ?? ""} placeholder="—"
                            onChange={(e) => setThreshold(k, "max", e.target.value)}
                            className="w-14 text-center rounded-lg py-1 text-sm font-semibold" style={{ border: `1px solid ${BRAND.borderStrong}`, color: BRAND.ink }} />
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: BRAND.inkSoft }}>
                          Exp
                          <input type="date" value={it.expiry || ""}
                            onChange={(e) => setExpiry(k, e.target.value)}
                            className="rounded-lg py-1 px-1.5 text-xs" style={{ border: `1px solid ${BRAND.borderStrong}`, color: BRAND.ink }} />
                        </label>
                        <div className="flex-1" />
                        {(exp === "expired" || exp === "soon") && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: exp === "expired" ? "#FDE7E7" : "#FCF0D6", color: exp === "expired" ? BRAND.red : "#8A6400" }}>
                            <Clock className="w-3 h-3" />{exp === "expired" ? "Expired" : `${daysUntil(it.expiry)}d left`}
                          </span>
                        )}
                        {need && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "#FDE7E7", color: BRAND.red }}>
                            <AlertTriangle className="w-3 h-3" />
                            {order != null ? `Order ${order} ${it.unit}` : "Reorder"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {tab === "map" && (
          <>
            <div className="mb-3 space-y-2">
              <div className="relative">
                <select value="" onChange={(e) => { if (e.target.value) addPin(e.target.value); }}
                  disabled={unplaced.length === 0}
                  className="w-full appearance-none px-3 py-2.5 pr-9 rounded-xl text-sm font-medium"
                  style={{ background: "#fff", border: `1px solid ${BRAND.borderStrong}`, color: unplaced.length ? BRAND.ink : BRAND.inkSoft }}>
                  <option value="">
                    {Object.keys(inv.items).length === 0
                      ? "No inventory yet — scan first"
                      : (unplaced.length ? "Add from inventory…" : "All items placed")}
                  </option>
                  {unplaced.map((it, i) => (
                    <option key={i} value={it.name}>{it.name}{Number.isFinite(it.qty) ? ` — ${it.qty} ${it.unit}` : ""}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: BRAND.inkSoft }} />
              </div>
              <div className="flex items-center gap-2">
                <input value={mapInput} onChange={(e) => setMapInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addPin(mapInput); setMapInput(""); } }}
                  placeholder="…or type a custom item"
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: "#fff", border: `1px solid ${BRAND.borderStrong}` }} />
                <button onClick={() => { addPin(mapInput); setMapInput(""); }}
                  className="px-4 py-2.5 rounded-xl font-medium flex items-center gap-1"
                  style={{ background: BRAND.gold, color: BRAND.ink }}>
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: BRAND.inkSoft }}>
              Drag each label to where it's stored. This is the view others see when you ask them to grab something.
            </p>

            <div ref={floorRef} className="relative w-full select-none"
              style={{ aspectRatio: "4 / 5", background: "#F1E7D3", border: "3px solid #7A6A5E", borderRadius: "8px", touchAction: "none" }}>

              {/* Door — top wall */}
              <div className="absolute" style={{ top: "-3px", left: "16%", width: "70px", height: "6px", background: "#F1E7D3", borderLeft: "3px solid #7A6A5E", borderRight: "3px solid #7A6A5E" }} />
              <div className="absolute text-[9px] font-semibold uppercase tracking-wider" style={{ top: "8px", left: "16%", color: "#8A7A6C" }}>Door</div>

              {/* Garage door — bottom wall */}
              <div className="absolute" style={{ bottom: "0", left: "12%", right: "12%", height: "13px", borderRadius: "2px",
                background: "repeating-linear-gradient(90deg,#D8C7A6,#D8C7A6 12px,#BFAC88 12px,#BFAC88 14px)" }} />
              <div className="absolute text-[9px] font-semibold uppercase tracking-wider" style={{ bottom: "18px", left: 0, right: 0, textAlign: "center", color: "#8A7A6C" }}>Garage Door</div>

              {/* Fridge — left wall, middle */}
              <div className="absolute grid place-items-center text-center" style={{ left: "2%", top: "41%", width: "17%", height: "18%", background: "#DCEAF2", border: "1px solid #A9C6D6", borderRadius: "4px" }}>
                <span className="text-[9px] font-semibold uppercase" style={{ color: "#3E6070" }}>Fridge</span>
              </div>

              {/* Freezer — right wall, top */}
              <div className="absolute grid place-items-center text-center" style={{ right: "2%", top: "6%", width: "17%", height: "18%", background: "#D3E6F0", border: "1px solid #A9C6D6", borderRadius: "4px" }}>
                <span className="text-[9px] font-semibold uppercase" style={{ color: "#3E6070" }}>Freezer</span>
              </div>

              {/* Item pins */}
              {pins.map((p) => {
                const it = p.key ? inv.items[p.key] : null;
                const dot = it ? (it.status === "green" ? "#10B981" : it.status === "red" ? "#F43F5E" : "#F59E0B") : "#B0A18C";
                return (
                  <div key={p.id}
                    onPointerDown={(e) => onPinDown(e, p.id)} onPointerMove={onPinMove} onPointerUp={onPinUp}
                    className="absolute flex items-center gap-1.5 px-2 py-1 rounded-full shadow"
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: "translate(-50%,-50%)",
                      background: "#fff", border: `1.5px solid ${BRAND.red}`, cursor: "grab", touchAction: "none", zIndex: 10, whiteSpace: "nowrap" }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
                    <span className="text-[11px] font-medium" style={{ color: BRAND.ink }}>{p.name}</span>
                    {it && <span className="text-[10px]" style={{ color: BRAND.inkSoft }}>·{it.qty}</span>}
                    <button onClick={(e) => { e.stopPropagation(); removePin(p.id); }} onPointerDown={(e) => e.stopPropagation()} style={{ color: BRAND.borderStrong }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {pins.length === 0 && (
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <span className="text-xs" style={{ color: BRAND.inkSoft }}>Add an item above, then drag it here.</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: BRAND.inkSoft }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "#DCEAF2", border: "1px solid #A9C6D6" }} />Cold storage</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: BRAND.red }} />Item · drag to move</span>
            </div>
          </>
        )}
        {tab === "activity" && (
          <>
            <div className="flex items-center justify-between mb-3 gap-3">
              <div>
                <h2 className="text-base font-semibold" style={{ fontFamily: SERIF, color: BRAND.ink }}>Activity log</h2>
                <p className="text-xs" style={{ color: BRAND.inkSoft }}>Who changed what, most recent first.</p>
              </div>
              <button onClick={() => setUserMenu(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm shrink-0"
                style={{ background: "#F3EAD8", color: BRAND.ink }}>
                <User className="w-4 h-4" />{currentUser || "Set user"}
              </button>
            </div>
            {(inv.log || []).length === 0 ? (
              <div className="text-center text-sm py-12" style={{ color: BRAND.inkSoft }}>No activity yet.</div>
            ) : (
              <div className="space-y-1.5">
                {(inv.log || []).map((e, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ background: "#fff", border: `1px solid ${BRAND.border}` }}>
                    <span className="w-7 h-7 rounded-full grid place-items-center shrink-0 text-[11px] font-bold" style={{ background: BRAND.goldTint, color: BRAND.redDark }}>
                      {(e.user || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ color: BRAND.ink }}><b>{e.user}</b> · {e.action}</div>
                      <div className="text-[11px]" style={{ color: BRAND.inkSoft }}>
                        {new Date(e.ts).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] mt-4 text-center" style={{ color: BRAND.inkSoft }}>
              Names are honor-based and stored on this device. Verified per-user login comes with the shared online version.
            </p>
          </>
        )}
      </div>

      {userMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(58,38,33,.55)" }} onClick={() => setUserMenu(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-5 h-5" style={{ color: BRAND.red }} />
              <h3 className="font-semibold text-lg" style={{ fontFamily: SERIF, color: BRAND.ink }}>Who's using this?</h3>
            </div>
            <p className="text-xs mb-3" style={{ color: BRAND.inkSoft }}>Pick your name so counts and changes are logged to you.</p>
            <div className="space-y-1.5 mb-3 max-h-56 overflow-y-auto">
              {users.length === 0 && <div className="text-sm text-center py-3" style={{ color: BRAND.inkSoft }}>No users yet — add one below.</div>}
              {users.map((u) => (
                <button key={u} onClick={() => selectUser(u)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: u === currentUser ? "#FDF2F2" : "#F7F1E6", color: BRAND.ink, border: `1px solid ${u === currentUser ? BRAND.red : "transparent"}` }}>
                  <span className="flex items-center gap-2"><User className="w-4 h-4" style={{ color: BRAND.inkSoft }} />{u}</span>
                  {u === currentUser ? <Check className="w-4 h-4" style={{ color: BRAND.red }} /> : <span className="text-xs" style={{ color: BRAND.inkSoft }}>switch</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={newUser} onChange={(e) => setNewUser(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addUser(newUser); }}
                placeholder="Add a name" className="flex-1 px-3 py-2.5 rounded-xl text-sm" style={{ border: `1px solid ${BRAND.borderStrong}` }} />
              <button onClick={() => addUser(newUser)} className="px-4 py-2.5 rounded-xl font-medium" style={{ background: BRAND.gold, color: BRAND.ink }}>Add</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pb-28 text-center">
        <p className="text-[11px] leading-relaxed" style={{ color: BRAND.inkSoft }}>
          Prototype. Vision estimates are drafts — always confirm the colored rows. Green = trusted, yellow = review, red = unclear/unknown.
        </p>
      </div>

      {/* bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40" style={{ background: "#fff", borderTop: `1px solid ${BRAND.border}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-3xl mx-auto flex">
          {[["home", "Home", LayoutDashboard], ["scan", "Scan", ScanLine], ["inventory", "Stock", Boxes], ["map", "Map", MapIcon], ["activity", "Log", History]].map(([id, lbl, Icon]) => {
            const on = tab === id;
            const badge = id === "inventory" && reorders.length > 0;
            return (
              <button key={id} onClick={() => setTab(id)} className="flex-1 py-2 flex flex-col items-center gap-1 relative">
                <span className="w-11 h-7 grid place-items-center rounded-full relative" style={{ background: on ? BRAND.goldTint : "transparent" }}>
                  <Icon className="w-5 h-5" style={{ color: on ? BRAND.red : BRAND.inkSoft }} />
                  {badge && <span className="absolute -top-0.5 right-1.5 w-4 h-4 rounded-full grid place-items-center text-[9px] font-bold text-white" style={{ background: BRAND.red }}>{reorders.length}</span>}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: on ? BRAND.red : BRAND.inkSoft }}>{lbl}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
