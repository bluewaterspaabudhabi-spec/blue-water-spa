// frontend/src/pages/Invoices.jsx
import apiFetch from "../../utils/apiFetch";

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

/**
 * Invoices List
 * - Filters: date range, customer text, appointmentId, payment method
 * - Actions: open, print, create new
 * - CSV export
 * - Compatible with binding to appointments (dashboard "Invoice"/"Print" buttons)
 */
export default function Invoices() {
  const nav = useNavigate();

  // filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState(""); // search in customer name/phone or therapist or notes
  const [appointmentId, setAppointmentId] = useState("");
  const [payment, setPayment] = useState("all"); // all/cash/card/transfer...

  // data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, appointmentId]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (appointmentId) qs.set("appointmentId", String(appointmentId).trim());

      const r = await fetch(`${API}/invoices?${qs.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // derived/filtered
  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (payment !== "all") {
          const p = String(r.paymentMethod || "").toLowerCase();
          if (p !== payment.toLowerCase()) return false;
        }
        if (s) {
          const bag = [
            r.customerName,
            r.customerPhone,
            r.therapist,
            r.notes,
            r.roomNumber,
            r.area,
          ]
            .map((v) => String(v || "").toLowerCase())
            .join(" • ");
          if (!bag.includes(s)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          Date.parse(b.createdAt || b.date || 0) -
          Date.parse(a.createdAt || a.date || 0)
      );
  }, [rows, q, payment]);

  const currency = view[0]?.currency || "AED";
  const nf = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency }),
    [currency]
  );

  const totalOf = (inv) => {
    if (inv.total != null) return Number(inv.total) || 0;
    if (Array.isArray(inv.items)) {
      return inv.items.reduce(
        (s, it) =>
          s +
          (Number(it.total) ||
            (Number(it.qty) || 0) * (Number(it.price) || 0)),
        0
      );
    }
    return 0;
  };

  const exportCSV = () => {
    const headers = [
      "Invoice",
      "Date/Time",
      "AppointmentId",
      "Customer",
      "Therapist",
      "Mode",
      "Room/Area",
      "Payment",
      "Total",
      "Notes",
    ];
    const rowsCsv = view.map((r) => [
      r.id ?? "",
      new Date(Date.parse(r.createdAt || r.date || 0)).toLocaleString(),
      r.appointmentId ?? "",
      r.customerName || r.customerId || "",
      r.therapist || r.therapistId || "",
      r.mode === "in" ? "In-Center" : r.mode === "out" ? "Out-Call" : "",
      r.mode === "in" ? (r.roomNumber || r.room || "") : (r.area || r.locationArea || ""),
      r.paymentMethod || "",
      totalOf(r),
      String(r.notes || "").replace(/\r?\n/g, " "),
    ]);

    const csv = [headers, ...rowsCsv]
      .map((arr) =>
        arr.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openInvoice = (id, { print = false } = {}) => {
    const suffix = print ? "?print=1" : "";
    window.open(`/invoices/${id}${suffix}`, "_blank");
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      {/* header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Invoices</h1>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <Link to="/invoices/new">
            <button>+ New Invoice</button>
          </Link>
          <button onClick={exportCSV}>Export CSV</button>
        </div>
      </header>

      {/* filters */}
      <div
        className="filters"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(160px, 1fr)) minmax(220px, 2fr)",
          gap: 10,
          alignItems: "end",
          marginBottom: 12,
        }}
      >
        <Field label="From">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Appointment #">
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 123"
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
          />
        </Field>
        <Field label="Payment">
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            <option value="all">All</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
          </select>
        </Field>
        <Field label="Search">
          <input
            placeholder="Customer/phone/therapist/notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Reload"}
          </button>
        </div>
      </div>

      {/* table */}
      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>#</th>
              <th style={{ minWidth: 170 }}>Date & Time</th>
              <th style={{ width: 110 }}>Appt</th>
              <th>Customer</th>
              <th style={{ width: 160 }}>Therapist</th>
              <th style={{ width: 110 }}>Mode</th>
              <th style={{ width: 120 }}>Payment</th>
              <th className="num" style={{ width: 140 }}>
                Total
              </th>
              <th style={{ width: 240 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>Loading…</td>
              </tr>
            ) : err ? (
              <tr>
                <td colSpan={9} style={{ color: "crimson" }}>
                  {err}
                </td>
              </tr>
            ) : view.length ? (
              view.map((r, i) => {
                const when = new Date(
                  Date.parse(r.createdAt || r.date || 0)
                ).toLocaleString();
                const mode =
                  r.mode === "in" ? "In-Center" : r.mode === "out" ? "Out-Call" : "-";
                const total = totalOf(r);
                return (
                  <tr key={r.id || i}>
                    <td>{r.id}</td>
                    <td>{when}</td>
                    <td>{r.appointmentId ?? "-"}</td>
                    <td>{r.customerName || r.customerId || "-"}</td>
                    <td>{r.therapist || r.therapistId || "-"}</td>
                    <td>{mode}</td>
                    <td>{r.paymentMethod || "-"}</td>
                    <td className="num">{nf.format(total)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="secondary"
                          onClick={() => openInvoice(r.id, { print: false })}
                        >
                          Open
                        </button>
                        <button
                          className="secondary"
                          onClick={() => openInvoice(r.id, { print: true })}
                        >
                          Print
                        </button>
                        <Link to="/invoices/new">
                          <button>New</button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} style={{ color: "#6b7280" }}>
                  No invoices.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* styles */}
      <style>{`
        .table { width:100%; border-collapse:collapse; }
        .table th, .table td { padding:8px 6px; border-bottom:1px solid #eee; text-align:left; }
        .table .num { text-align:right; }
        .card { border:1px solid #eee; border-radius:8px; padding:12px; }
        .no-print { display:inline-flex; }
        @media print {
          .no-print, .filters, a[href] { display:none !important; }
          .page { padding:0; }
          .card { border:none; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#666" }}>{label}</span>
      {children}
    </label>
  );
}