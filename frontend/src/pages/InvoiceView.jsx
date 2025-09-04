// frontend/src/pages/InvoiceView.jsx
import apiFetch from "../utils/apiFetch";

import React from "react";
import { useParams, useSearchParams } from "react-router-dom";

export default function InvoiceView() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const [inv, setInv] = React.useState(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setError("");
        const res = await fetch(`http://apiFetch(/api/invoices/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) setInv(data);
      } catch {
        if (!ignore) setError("Failed to load invoice");
      }
    })();
    return () => { ignore = true; };
  }, [id]);

  // اطبع تلقائيًا لو ?print=1
  React.useEffect(() => {
    if (search.get("print") === "1" && inv) {
      setTimeout(() => window.print(), 100);
    }
  }, [search, inv]);

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!inv) return <p>Loading…</p>;

  const items = Array.isArray(inv.items) ? inv.items : [];
  const currency = inv.currency ?? "USD";

  return (
    <div className="invoice-view">
      <div className="invoice-header">
        <h2>Invoice #{inv.number ?? inv.id ?? inv._id}</h2>
        <div>
          <div><strong>Date:</strong> {inv.date ? new Date(inv.date).toLocaleString() : "-"}</div>
          <div><strong>Customer:</strong> {inv.customerName ?? "-"}</div>
        </div>
      </div>

      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Service</th>
            <th>Qty</th>
            <th>Price</th>
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{it.serviceName ?? it.service ?? "-"}</td>
              <td>{it.qty ?? 1}</td>
              <td>{it.price ?? 0} {currency}</td>
              <td style={{ textAlign: "right" }}>
                {(Number(it.qty ?? 1) * Number(it.price ?? 0)).toFixed(2)} {currency}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <div><strong>Subtotal:</strong> {inv.subtotal ?? 0} {currency}</div>
        <div><strong>Tax:</strong> {inv.tax ?? 0} {currency}</div>
        <div><strong>Extra:</strong> {inv.extra ?? 0} {currency}</div>
        <div style={{ fontSize: 18 }}>
          <strong>Grand Total:</strong> {inv.total ?? 0} {currency}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </div>

      {/* تنسيق طباعة بسيط */}
      <style>{`
        @media print {
          .btn { display: none; }
          a { text-decoration: none; color: black; }
          body { background: white; }
        }
        .invoice-header { display: flex; justify-content: space-between; align-items: start; gap: 24px; }
      `}</style>
    </div>
  );
}