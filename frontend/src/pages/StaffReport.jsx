// frontend/src/pages/StaffReport.jsx
import apiFetch from '../utils/apiFetch';

import { useEffect, useMemo, useState } from "react";

/**
 * Staff (Therapists) Report
 * - Filters: date range, therapist, service, mode, payment
 * - KPIs: sessions, gross, avg ticket, unique customers
 * - Per-therapist table: sessions, gross, avg, top service
 * - Detailed visits table
 * - Hourly heatmap (clean grid)
 * - Export CSV + Print
 *
 * Uses: /api/invoices, /api/staff, /api/services
 */

const API = "http://apiFetch(/api";

export default function StaffReport() {
  // filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [therapistId, setTherapistId] = useState("all");
  const [serviceId, setServiceId] = useState("all");
  const [mode, setMode] = useState("all");        // all | in | out
  const [payment, setPayment] = useState("all");  // all | dynamic

  // data
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // lookups
  useEffect(() => {
    (async () => {
      try {
        const [st, sv] = await Promise.all([
          fetch(`${API}/staff`).then(okJson),
          fetch(`${API}/services`).then(okJson),
        ]);
        setStaff(Array.isArray(st) ? st : []);
        setServices(Array.isArray(sv) ? sv : []);
      } catch {
        setStaff([]); setServices([]);
      }
    })();
  }, []);

  // load invoices (date-based)
  useEffect(() => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    setLoading(true);
    setErr("");
    fetch(`${API}/invoices?${qs.toString()}`)
      .then(okJson)
      .then((rows) => setInvoices(Array.isArray(rows) ? rows : []))
      .catch(() => setErr("Failed to load invoices"))
      .finally(() => setLoading(false));
  }, [from, to]);

  // maps
  const staffMap = useMemo(
    () => Object.fromEntries((staff || []).map((u) => [String(u.id), u])),
    [staff]
  );
  const serviceMap = useMemo(
    () => Object.fromEntries((services || []).map((s) => [String(s.id), s])),
    [services]
  );

  // flatten invoices -> visits (service-level rows)
  const visits = useMemo(() => {
    const list = [];
    for (const inv of invoices || []) {
      const createdAt = inv.createdAt || inv.date || inv.created_at;
      const base = {
        id: inv.id,
        createdAt,
        mode: inv.mode, // 'in' | 'out' | undefined
        room: inv.roomNumber || inv.room || "",
        area: inv.area || inv.locationArea || "",
        therapistId: normalizedTherapistId(inv),
        therapistName: inv.therapist || inv.staff || "",
        payment: inv.paymentMethod || "",
        total: normalizeTotal(inv),
        customerId: inv.customerId,
        customerName: inv.customerName || "",
        items: Array.isArray(inv.items) ? inv.items : [],
        currency: inv.currency || "AED",
        notes: inv.notes || "",
      };

      if (base.items.length) {
        for (const it of base.items) {
          list.push({
            ...base,
            serviceId: it.serviceId ?? it.id ?? it.code ?? null,
            serviceName: it.serviceName || it.service || "",
            qty: Number(it.qty) || 1,
            lineTotal:
              Number(it.total) ||
              (Number(it.qty) || 0) * (Number(it.price) || 0),
          });
        }
      } else {
        list.push({
          ...base,
          serviceId: null,
          serviceName: "",
          qty: 1,
          lineTotal: base.total,
        });
      }
    }
    return list;
  }, [invoices]);

  // dynamic payment options from data
  const paymentOptions = useMemo(() => {
    const set = new Set();
    for (const v of visits) {
      const m = String(v.payment || "").trim();
      if (m) set.add(m);
    }
    // stable order: Cash, Card, Transfer, then others
    const preferred = ["Cash", "Card", "Transfer"];
    const rest = [...set].filter((x) => !preferred.map((p)=>p.toLowerCase()).includes(x.toLowerCase()));
    return ["all", ...preferred.filter(p => [...set].some(x => x.toLowerCase() === p.toLowerCase())), ...rest];
  }, [visits]);

  // apply client-side filters
  const filtered = useMemo(() => {
    return visits.filter((v) => {
      if (therapistId !== "all" && String(v.therapistId) !== String(therapistId)) return false;
      if (serviceId !== "all" && String(v.serviceId) !== String(serviceId)) return false;

      if (mode !== "all") {
        const m = (v.mode || "").toLowerCase();
        if ((mode === "in" && m !== "in") || (mode === "out" && m !== "out")) return false;
      }
      if (payment !== "all") {
        if (String(v.payment || "").toLowerCase() !== String(payment).toLowerCase()) return false;
      }
      const t = Date.parse(v.createdAt || 0);
      if (from && Number.isFinite(Date.parse(from)) && t < Date.parse(from)) return false;
      if (to && Number.isFinite(Date.parse(to)) && t > Date.parse(to) + DAY_MS - 1) return false;
      return true;
    });
  }, [visits, therapistId, serviceId, mode, payment, from, to]);

  // currency
  const currency = filtered[0]?.currency || "AED";
  const nf = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency }),
    [currency]
  );

  // KPIs
  const kpis = useMemo(() => {
    const sessions = filtered.length;
    const gross = filtered.reduce((s, v) => s + Number(v.lineTotal || 0), 0);
    const avg = sessions ? gross / sessions : 0;
    const uniqueCustomers = new Set(filtered.map((v) => v.customerId || v.customerName || v.id)).size;
    return { sessions, gross, avg, uniqueCustomers };
  }, [filtered]);

  // per-therapist summary
  const perTherapist = useMemo(() => {
    const map = new Map();
    for (const v of filtered) {
      const key = String(v.therapistId || v.therapistName || "-");
      const cur = map.get(key) || {
        therapistId: v.therapistId,
        therapistName: v.therapistName || staffMap[String(v.therapistId)]?.name || "-",
        sessions: 0,
        gross: 0,
        serviceCount: new Map(), // serviceName -> count
      };
      cur.sessions += 1;
      cur.gross += Number(v.lineTotal || 0);
      const sName =
        v.serviceName ||
        serviceMap[String(v.serviceId)]?.name ||
        (v.serviceId ? `#${v.serviceId}` : "-");
      cur.serviceCount.set(sName, (cur.serviceCount.get(sName) || 0) + 1);
      map.set(key, cur);
    }
    return [...map.values()]
      .map((x) => ({
        ...x,
        avg: x.sessions ? x.gross / x.sessions : 0,
        topService: [...x.serviceCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
      }))
      .sort((a, b) => b.gross - a.gross);
  }, [filtered, staffMap, serviceMap]);

  // hourly heatmap
  const heat = useMemo(() => {
    const counts = Array(24).fill(0);
    for (const v of filtered) {
      const t = Date.parse(v.createdAt || 0);
      if (!Number.isFinite(t)) continue;
      counts[new Date(t).getHours()] += 1;
    }
    return { counts, max: Math.max(1, ...counts) };
  }, [filtered]);

  // export
  const exportCSV = () => {
    const headers = [
      "Invoice",
      "Date/Time",
      "Therapist",
      "Service",
      "Mode",
      "Payment",
      "Room/Area",
      "Qty",
      "Line Total",
      "Notes",
    ];
    const rows = filtered.map((v) => [
      v.id ?? "",
      new Date(Date.parse(v.createdAt || 0)).toLocaleString(),
      v.therapistName,
      v.serviceName,
      v.mode === "in" ? "In-Center" : v.mode === "out" ? "Out-Call" : "",
      v.payment || "",
      v.mode === "in" ? (v.room || "") : (v.area || ""),
      v.qty || 1,
      v.lineTotal || 0,
      (v.notes || "").replace(/\r?\n/g, " "),
    ]);
    downloadCSV([headers, ...rows], "staff-report.csv");
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Staff Report</h1>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()}>Print</button>
          <button onClick={exportCSV}>Export CSV</button>
        </div>
      </header>

      {/* Filters */}
      <div className="filters"
           style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(160px,1fr))", gap: 10, alignItems: "end", marginBottom: 14 }}>
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Therapist">
          <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
            <option value="all">All</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Service">
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="all">All</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">All</option>
            <option value="in">In-Center</option>
            <option value="out">Out-Call</option>
          </select>
        </Field>
        <Field label="Payment">
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            {paymentOptions.map((p) => (
              <option key={p} value={p.toLowerCase()}>{p === "all" ? "All" : p}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* KPIs */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KPI title="Sessions" value={kpis.sessions} />
        <KPI title="Gross" value={nf.format(kpis.gross)} />
        <KPI title="Avg ticket" value={nf.format(kpis.avg)} />
        <KPI title="Unique customers" value={kpis.uniqueCustomers} />
      </section>

      {/* Per-therapist summary */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Therapists summary</h3>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Therapist</th>
              <th style={{ width: 120 }} className="num">Sessions</th>
              <th style={{ width: 160 }} className="num">Gross</th>
              <th style={{ width: 160 }} className="num">Avg ticket</th>
              <th style={{ width: 220 }}>Top service</th>
            </tr>
          </thead>
          <tbody>
            {perTherapist.length ? (
              perTherapist.map((t, i) => (
                <tr key={t.therapistName + i}>
                  <td>{i + 1}</td>
                  <td>{t.therapistName}</td>
                  <td className="num">{t.sessions}</td>
                  <td className="num">{nf.format(t.gross)}</td>
                  <td className="num">{nf.format(t.avg)}</td>
                  <td>{t.topService}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} style={{ color: "#6b7280" }}>No data.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Hourly heatmap */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Hourly heatmap</h3>
        <Heatmap counts={heat.counts} max={heat.max} />
      </section>

      {/* Detailed visits */}
      <section className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Visits</h3>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th style={{ minWidth: 170 }}>Date & Time</th>
              <th style={{ width: 160 }}>Therapist</th>
              <th>Service</th>
              <th style={{ width: 110 }}>Mode</th>
              <th style={{ width: 120 }}>Payment</th>
              <th style={{ width: 120 }} className="num">Line total</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Loading…</td></tr>
            ) : err ? (
              <tr><td colSpan={8} style={{ color: "crimson" }}>{err}</td></tr>
            ) : filtered.length ? (
              filtered
                .slice()
                .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
                .map((v, i) => (
                  <tr key={v.id + ":" + i}>
                    <td>{i + 1}</td>
                    <td>{fmtDate(v.createdAt)}</td>
                    <td>{v.therapistName}</td>
                    <td>{v.serviceName || "-"}</td>
                    <td>{v.mode === "in" ? "In-Center" : v.mode === "out" ? "Out-Call" : "-"}</td>
                    <td>{v.payment || "-"}</td>
                    <td className="num">{nf.format(Number(v.lineTotal || 0))}</td>
                    <td>{v.notes || "-"}</td>
                  </tr>
                ))
            ) : (
              <tr><td colSpan={8} style={{ color: "#6b7280" }}>No visits.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Styles */}
      <style>{`
        .table { width:100%; border-collapse:collapse; }
        .table th, .table td { padding:8px 6px; border-bottom:1px solid #eee; text-align:left; }
        .table .num { text-align:right; }
        .kpi { border:1px solid #eee; border-radius:8px; padding:10px; }
        .kpi .title { font-size:12px; color:#666; margin-bottom:6px; }
        .kpi .value { font-weight:600; white-space:nowrap; }
        .heat { display:grid; grid-template-columns: repeat(24, 1fr); gap:4px; }
        .heat .cell { height:26px; border-radius:6px; background:#eef2ff; display:flex; align-items:center; justify-content:center; font-size:11px; color:#111827; }
        .heat .label { margin-top:6px; display:grid; grid-template-columns: repeat(24, 1fr); gap:4px; font-size:11px; color:#6b7280; }
        @media print {
          .no-print { display:none !important; }
          .filters select, .filters input { border:none; }
          .page { padding:0; }
        }
      `}</style>
    </div>
  );
}

/* ---------------- helpers & small components ---------------- */

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#666" }}>{label}</span>
      {children}
    </label>
  );
}

function KPI({ title, value }) {
  return (
    <div className="kpi">
      <div className="title">{title}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function Heatmap({ counts, max }) {
  const color = (n) => {
    if (!max) return "#eef2ff";
    const t = n / max; // 0..1
    const start = [239, 246, 255]; // #eff6ff
    const end = [30, 64, 175];     // #1e40af
    const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * t));
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  };
  return (
    <div>
      <div className="heat">
        {counts.map((n, h) => (
          <div key={h} className="cell" style={{ background: color(n) }} title={`${h}:00 • ${n} session(s)`}>
            {n ? n : ""}
          </div>
        ))}
      </div>
      <div className="label">
        {counts.map((_, h) => (
          <div key={h} style={{ textAlign: "center" }}>{String(h).padStart(2, "0")}</div>
        ))}
      </div>
    </div>
  );
}

function fmtDate(v) {
  const t = Date.parse(v || 0);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : "-";
}

function okJson(r) {
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function downloadCSV(rows, filename) {
  const csv = rows
    .map((arr) => arr.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeTotal(inv) {
  if (inv.total != null) return Number(inv.total) || 0;
  if (Array.isArray(inv.items)) {
    return inv.items.reduce(
      (s, it) => s + (Number(it.total) || (Number(it.qty) || 0) * (Number(it.price) || 0)),
      0
    );
  }
  return 0;
}

function normalizedTherapistId(inv) {
  if (inv.therapistId != null) return inv.therapistId;
  if (Array.isArray(inv.items)) {
    const id = inv.items.find((it) => it.therapistId != null)?.therapistId;
    if (id != null) return id;
  }
  return inv.staffId ?? inv.staff_id ?? null;
}