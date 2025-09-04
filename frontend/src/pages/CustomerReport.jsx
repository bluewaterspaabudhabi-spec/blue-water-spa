// frontend/src/pages/CustomerReport.jsx
import apiFetch from '../utils/apiFetch';
import { useEffect, useMemo, useState, useRef } from "react";

/**
 * Customer Report
 * - Filters: customer (search by name/phone), date range
 * - Summary: visits, total paid, average ticket, first/last visit
 * - Therapists breakdown
 * - Visits table
 * - Export CSV + Print
 */
export default function CustomerReport() {
  // filters
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // data
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ------ customer search (autocomplete) ------
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [custSuggestions, setCustSuggestions] = useState([]);
  const [custLoading, setCustLoading] = useState(false);
  const pickerRef = useRef(null);

  // close suggestions on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(e.target)) setCustOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // preload some customers once
  useEffect(() => {
    apiFetch('/customers?limit=20')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => (Array.isArray(rows) ? rows : []))
      .then((rows) => {
        setCustomers(rows);
        setCustSuggestions(rows);
      })
      .catch(() => {
        setCustomers([]);
        setCustSuggestions([]);
      });
  }, []);

  // fetch suggestions when typing
  useEffect(() => {
    let stop = false;
    const t = setTimeout(async () => {
      const q = custQuery.trim();
      setCustLoading(true);
      try {
        const url = q
          ? `http://apiFetch(/api/customers?q=${encodeURIComponent(q)}&limit=10`
          : `http://apiFetch(/api/customers?limit=10`;
        const r = await fetch(url);
        const data = (await r.json()) || [];
        if (!stop) setCustSuggestions(Array.isArray(data) ? data : []);
      } catch {
        if (!stop) setCustSuggestions([]);
      } finally {
        if (!stop) setCustLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      stop = true;
    };
  }, [custQuery]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(customerId)),
    [customers, customerId]
  );

  // load invoices when filters change
  useEffect(() => {
    if (!customerId) {
      setInvoices([]);
      return;
    }
    setLoading(true);
    setErr("");

    const qs = new URLSearchParams();
    qs.set("customerId", customerId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    fetch(`http://apiFetch(/api/invoices?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((rows) => (Array.isArray(rows) ? rows : []))
      .then(setInvoices)
      .catch(() => setErr("Failed to load"))
      .finally(() => setLoading(false));
  }, [customerId, from, to]);

  // final filtered list (client-side date guard)
  const filtered = useMemo(() => {
    const fromTs = from ? Date.parse(from) : null;
    const toTs = to ? Date.parse(to) + 24 * 60 * 60 * 1000 - 1 : null; // inclusive
    return (invoices || []).filter((inv) => {
      const t = Date.parse(inv.createdAt || inv.date || inv.created_at || 0);
      if (Number.isFinite(fromTs) && t < fromTs) return false;
      if (Number.isFinite(toTs) && t > toTs) return false;
      // match by id or by customerName (fallback)
      if (String(inv.customerId) === String(customerId)) return true;
      if (selectedCustomer && inv.customerName === selectedCustomer.name) return true;
      return false;
    });
  }, [invoices, customerId, selectedCustomer, from, to]);

  // currency + formatter
  const currency = filtered[0]?.currency || "AED";
  const fmt = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency }),
    [currency]
  );

  // aggregates
  const agg = useMemo(() => {
    if (!filtered.length) {
      return {
        visits: 0,
        gross: 0,
        avg: 0,
        first: null,
        last: null,
        byTherapist: [],
      };
    }
    const visits = filtered.length;
    const gross = filtered.reduce((s, r) => {
      if (r.total != null) return s + Number(r.total);
      if (Array.isArray(r.items)) {
        const sum = r.items.reduce(
          (si, it) =>
            si +
            (Number(it.total) ||
              (Number(it.qty) || 0) * (Number(it.price) || 0)),
          0
        );
        return s + sum;
      }
      return s;
    }, 0);

    const times = filtered
      .map((r) => Date.parse(r.createdAt || r.date || r.created_at || 0))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
    const first = times.length ? new Date(times[0]) : null;
    const last = times.length ? new Date(times[times.length - 1]) : null;

    const map = new Map();
    filtered.forEach((r) => {
      const name = r.therapist || r.staff || "-";
      map.set(name, (map.get(name) || 0) + 1);
    });
    const byTherapist = [...map.entries()].map(([name, count]) => ({
      name,
      count,
    }));

    return { visits, gross, avg: visits ? gross / visits : 0, first, last, byTherapist };
  }, [filtered]);

  // CSV export
  const exportCSV = () => {
    const headers = [
      "Invoice #",
      "Date/Time",
      "Mode",
      "Room/Area",
      "Therapist",
      "Payment",
      "Items",
      "Total",
      "Notes",
    ];
    const rows = filtered
      .slice()
      .sort((a, b) => Date.parse(a.createdAt || a.date || 0) - Date.parse(b.createdAt || b.date || 0))
      .map((r) => {
        const when = new Date(Date.parse(r.createdAt || r.date || 0)).toLocaleString();
        const mode = r.mode === "in" ? "In-Center" : r.mode === "out" ? "Out-Call" : "";
        const roomArea =
          r.mode === "in"
            ? (r.roomNumber || r.room || "")
            : (r.area || r.locationArea || "");
        const itemsText = Array.isArray(r.items)
          ? r.items.map((it) => `${it.serviceName || it.service || "-"} x${it.qty || 1}`).join("; ")
          : "";
        const total =
          r.total != null
            ? Number(r.total)
            : Array.isArray(r.items)
            ? r.items.reduce(
                (s, it) =>
                  s +
                  (Number(it.total) ||
                    (Number(it.qty) || 0) * (Number(it.price) || 0)),
                0
              )
            : 0;
        return [
          r.id ?? "",
          when,
          mode,
          roomArea,
          r.therapist || r.staff || "",
          r.paymentMethod || "",
          itemsText,
          total,
          (r.notes || "").replace(/\r?\n/g, " "),
        ];
      });

    const csv = [headers, ...rows]
      .map((arr) => arr.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = selectedCustomer
      ? `customer-${selectedCustomer.name}-report.csv`
      : "customer-report.csv";
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // UI helpers
  const selectedDisplay = selectedCustomer
    ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ""}`
    : "";

  const pickCustomer = (c) => {
    setCustomerId(String(c.id));
    // persist in local list so selected name renders
    setCustomers((prev) => {
      const has = prev.some((x) => String(x.id) === String(c.id));
      return has ? prev : [c, ...prev];
    });
    setCustQuery("");
    setCustOpen(false);
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Customer Report</h1>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()}>Print</button>
          <button onClick={exportCSV}>Export CSV</button>
        </div>
      </header>

      {/* Filters */}
      <div
        className="filters"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(280px, 1fr) 160px 160px",
          alignItems: "end",
          marginBottom: 14,
        }}
      >
        <div ref={pickerRef} style={{ position: "relative" }}>
          <label style={lbl}>Customer</label>
          <input
            value={custOpen ? custQuery : selectedDisplay}
            onChange={(e) => { setCustQuery(e.target.value); setCustOpen(true); }}
            onFocus={() => setCustOpen(true)}
            placeholder="Search by name or phone…"
            style={{ minWidth: 280, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}
          />
          {/* keep a hidden select for print fallback */}
          <select
            className="print-only"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="">— select —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ""}
              </option>
            ))}
          </select>

          {custOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 20,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 12px 28px rgba(0,0,0,.08)",
                marginTop: 6,
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {custLoading ? (
                <div style={dropMuted}>Loading…</div>
              ) : custSuggestions.length ? (
                custSuggestions.map((c) => (
                  <div
                    key={c.id}
                    style={dropItem}
                    onMouseDown={() => pickCustomer(c)}
                  >
                    <div style={{ fontWeight: 600 }}>{c.name || "-"}</div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {c.phone || "—"}
                      {Number(c.visitCount || 0) ? ` · visits: ${c.visitCount}` : ""}
                    </div>
                  </div>
                ))
              ) : (
                <div style={dropMuted}>No matches</div>
              )}
            </div>
          )}
        </div>

        <div>
          <label style={lbl}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="print-only" style={{ marginLeft: 8 }}>
            {from || "-"}
          </span>
        </div>

        <div>
          <label style={lbl}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <span className="print-only" style={{ marginLeft: 8 }}>
            {to || "-"}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <section
        className="report-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Summary title="Customer" value={selectedCustomer?.name || "-"} />
        <Summary title="Visits" value={agg.visits} />
        <Summary title="Total paid" value={fmt.format(agg.gross)} />
        <Summary title="Avg ticket" value={fmt.format(agg.avg)} />
        <Summary title="First visit" value={agg.first ? agg.first.toLocaleString() : "-"} />
        <Summary title="Last visit" value={agg.last ? agg.last.toLocaleString() : "-"} />
      </section>

      {/* Therapists breakdown */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Therapists</h3>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Name</th>
              <th className="num" style={{ width: 120 }}>Visits</th>
            </tr>
          </thead>
          <tbody>
            {agg.byTherapist.length ? (
              agg.byTherapist.map((t, i) => (
                <tr key={t.name + i}>
                  <td>{i + 1}</td>
                  <td>{t.name}</td>
                  <td className="num">{t.count}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={3}>No data.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Visits table */}
      <section>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Visits</h3>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th style={{ minWidth: 170 }}>Date & Time</th>
              <th style={{ width: 110 }}>Mode</th>
              <th style={{ width: 120 }}>Room / Area</th>
              <th style={{ width: 160 }}>Therapist</th>
              <th style={{ width: 120 }}>Payment</th>
              <th>Items</th>
              <th className="num" style={{ width: 140 }}>Total</th>
              <th style={{ minWidth: 120 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>Loading…</td></tr>
            ) : err ? (
              <tr><td colSpan={9} style={{ color: "crimson" }}>{err}</td></tr>
            ) : filtered.length ? (
              filtered
                .slice()
                .sort(
                  (a, b) =>
                    Date.parse(b.createdAt || b.date || 0) -
                    Date.parse(a.createdAt || a.date || 0)
                )
                .map((r, i) => {
                  const when = new Date(Date.parse(r.createdAt || r.date || 0)).toLocaleString();
                  const mode = r.mode === "in" ? "In-Center" : r.mode === "out" ? "Out-Call" : "-";
                  const roomArea =
                    r.mode === "in" ? (r.roomNumber || r.room || "-")
                    : (r.area || r.locationArea || "-");
                  const itemsText = Array.isArray(r.items)
                    ? r.items
                        .map((it) => `${it.serviceName || it.service || "-"}${it.qty ? ` x${it.qty}` : ""}`)
                        .join(", ")
                    : "-";
                  const total =
                    r.total != null
                      ? Number(r.total)
                      : Array.isArray(r.items)
                      ? r.items.reduce(
                          (s, it) =>
                            s +
                            (Number(it.total) ||
                              (Number(it.qty) || 0) * (Number(it.price) || 0)),
                          0
                        )
                      : 0;
                  return (
                    <tr key={r.id || i}>
                      <td>{i + 1}</td>
                      <td>{when}</td>
                      <td>{mode}</td>
                      <td>{roomArea}</td>
                      <td>{r.therapist || r.staff || "-"}</td>
                      <td>{r.paymentMethod || "-"}</td>
                      <td>{itemsText}</td>
                      <td className="num">{fmt.format(total)}</td>
                      <td>{r.notes || "-"}</td>
                    </tr>
                  );
                })
            ) : (
              <tr><td colSpan={9}>No visits.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Local styles */}
      <style>{`
        .table { width:100%; border-collapse:collapse; }
        .table th, .table td { padding:8px 6px; border-bottom:1px solid #eee; text-align:left; }
        .table .num { text-align:right; }
        .summary-card { border:1px solid #eee; border-radius:8px; padding:10px; }
        .summary-title { font-size:12px; color:#666; margin-bottom:6px; }
        .summary-value { font-weight:600; white-space:nowrap; }
        .print-only { display:none; }
        @media print {
          .no-print { display:none !important; }
          .print-only { display:inline !important; }
          .filters input, .filters select { display:none !important; }
          .page { padding:0 !important; }
        }
      `}</style>
    </div>
  );
}

/* ---- small helpers ---- */
function Summary({ title, value }) {
  return (
    <div className="summary-card">
      <div className="summary-title">{title}</div>
      <div className="summary-value">{value}</div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, color: "#666", marginBottom: 4 };

const dropItem = { padding: "9px 10px", cursor: "pointer" };
const dropMuted = { padding: "9px 10px", color: "#6b7280" };