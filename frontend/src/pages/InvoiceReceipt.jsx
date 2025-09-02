import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function InvoiceReceipt() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`http://localhost:5000/api/invoices/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setInvoice)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const currency = invoice?.currency || "AED";
  const fmt = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }),
    [currency]
  );

  if (loading) return <div className="receipt wrap">Loading…</div>;
  if (error) return <div className="receipt wrap">Failed to load: {error}</div>;
  if (!invoice) return <div className="receipt wrap">Not found.</div>;

  const items = invoice.items || [];
  const subtotal = invoice.subtotal ?? items.reduce((s, it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    return s + (Number(it.total) || qty * price);
  }, 0);
  const taxRate = Number(invoice.taxRate ?? 0);
  const tax = invoice.tax ?? (subtotal * taxRate) / 100;
  const extra = Number(invoice.extra ?? 0);
  const discount = Number(invoice.discount ?? 0);
  const grand = invoice.total ?? Math.max(0, subtotal + tax + extra - discount);

  return (
    <div className="receipt wrap">
      {/* Header */}
      <div className="r-center r-strong">Blue Water Spa</div>
      <div className="r-center">Invoice #{invoice.number || invoice.id}</div>
      <div className="r-center">{invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : ""}</div>
      <div className="r-sep" />

      {/* Customer (optional) */}
      {invoice.customerName ? (
        <>
          <div>Customer: {invoice.customerName}</div>
          <div className="r-sep" />
        </>
      ) : null}

      {/* Items */}
      <div className="r-row r-strong">
        <span>Item</span>
        <span>Qty</span>
        <span>Price</span>
        <span>Total</span>
      </div>
      {items.length ? items.map((it, i) => {
        const name = it.serviceName || it.service || `#${i+1}`;
        const qty = Number(it.qty) || 0;
        const price = Number(it.price) || 0;
        const total = Number(it.total ?? qty * price) || 0;
        return (
          <div className="r-row" key={i}>
            <span className="r-item">{name}</span>
            <span className="r-n">{qty}</span>
            <span className="r-n">{fmt.format(price)}</span>
            <span className="r-n">{fmt.format(total)}</span>
          </div>
        );
      }) : <div>No items.</div>}
      <div className="r-sep" />

      {/* Totals */}
      <div className="r-row"><span>Subtotal</span><span className="r-n">{fmt.format(subtotal)}</span></div>
      <div className="r-row"><span>Tax ({taxRate}%)</span><span className="r-n">{fmt.format(tax)}</span></div>
      {extra ? <div className="r-row"><span>Extra</span><span className="r-n">{fmt.format(extra)}</span></div> : null}
      {discount ? <div className="r-row"><span>Discount</span><span className="r-n">-{fmt.format(discount)}</span></div> : null}
      <div className="r-row r-strong r-total">
        <span>Grand Total</span><span className="r-n">{fmt.format(grand)}</span>
      </div>

      {/* Footer */}
      {invoice.notes ? (
        <>
          <div className="r-sep" />
          <div className="r-notes">{invoice.notes}</div>
        </>
      ) : null}

      {/* Controls (hidden on print) */}
      <div className="r-actions no-print">
        <Link to="/invoices"><button>Back</button></Link>
        <button onClick={() => window.print()}>Print</button>
      </div>
    </div>
  );
}