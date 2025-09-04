import apiFetch from "../utils/apiFetch";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function InvoiceDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const [sp] = useSearchParams();
  const autoPrint = sp.get("print") === "1";

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setErr("");
    fetch(`${API}/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!ignore) setInv(data);
      })
      .catch((e) => !ignore && setErr(e.message || String(e)))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, [id]);

  // auto print once invoice is loaded
  useEffect(() => {
    if (autoPrint && inv && inv.id) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [autoPrint, inv]);

  const currency = inv?.currency || "AED";
  const nf = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency }),
    [currency]
  );

  const total = useMemo(() => {
    if (!inv) return 0;
    if (inv.total != null) return Number(inv.total) || 0;
    if (Array.isArray(inv.items)) {
      return inv.items.reduce((s, it) => {
        const line =
          Number(it.total) ||
          (Number(it.qty) || 0) * (Number(it.price) || 0);
        return s + line;
      }, 0);
    }
    return 0;
  }, [inv]);

  return (
    <div className="page" style={{ padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Invoice #{id}</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            {inv?.createdAt ? new Date(inv.createdAt).toLocaleString() : "-"}
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()}>Print</button>
          <Link to="/invoices"><button className="secondary">Back to Invoices</button></Link>
        </div>
      </header>

      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div style={{ color: "crimson" }}>{err}</div>
      ) : !inv ? (
        <div>Not found.</div>
      ) : (
        <>
          {/* Header info */}
          <section className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              <div>
                <div style={lbl}>Customer</div>
                <div style={val}>{inv.customerName || inv.customerId || "-"}</div>
              </div>
              <div>
                <div style={lbl}>Therapist</div>
                <div style={val}>{inv.therapist || inv.therapistId || "-"}</div>
              </div>
              <div>
                <div style={lbl}>Mode</div>
                <div style={val}>
                  {inv.mode === "in" ? "In-Center" : inv.mode === "out" ? "Out-Call" : "-"}
                </div>
              </div>
              <div>
                <div style={lbl}>Room / Area</div>
                <div style={val}>
                  {inv.mode === "in" ? (inv.roomNumber || inv.room || "-") : (inv.area || inv.locationArea || "-")}
                </div>
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Items</h3>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Service</th>
                  <th className="num" style={{ width: 90 }}>Qty</th>
                  <th className="num" style={{ width: 120 }}>Price</th>
                  <th className="num" style={{ width: 140 }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(inv.items) && inv.items.length ? (
                  inv.items.map((it, i) => {
                    const qty = Number(it.qty) || 1;
                    const price = Number(it.price) || 0;
                    const line = Number(it.total) || qty * price;
                    return (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{it.serviceName || it.service || "-"}</td>
                        <td className="num">{qty}</td>
                        <td className="num">{nf.format(price)}</td>
                        <td className="num">{nf.format(line)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ color: "#6b7280" }}>No items.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="num" style={{ fontWeight: 600 }}>Total</td>
                  <td className="num" style={{ fontWeight: 700 }}>{nf.format(total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Notes */}
          <section className="card">
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Notes</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>{inv.notes || "-"}</div>
          </section>

          {/* Styles */}
          <style>{`
            .table { width:100%; border-collapse:collapse; }
            .table th, .table td { padding:8px 6px; border-bottom:1px solid #eee; text-align:left; }
            .table .num { text-align:right; }
            .card { border:1px solid #eee; border-radius:8px; padding:12px; }
            .no-print { display:inline-flex; }
            @media print {
              .no-print { display: none !important; }
              .page { padding: 0 !important; }
              .card { border: none; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

const lbl = { fontSize: 12, color: "#6b7280", marginBottom: 4 };
const val = { fontWeight: 600 };