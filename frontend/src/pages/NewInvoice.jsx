import { useEffect, useMemo, useState } from "react";
import apiFetch from "..../utils/apiFetch.js.js.js";

import { useNavigate, useSearchParams, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function NewInvoice() {
  const nav = useNavigate();
  const [search] = useSearchParams();

  // lookups
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  // loading/errors
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // form state
  const [appointmentId, setAppointmentId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [mode, setMode] = useState("in"); // 'in' | 'out'
  const [room, setRoom] = useState("");
  const [area, setArea] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [printAfter, setPrintAfter] = useState(true);

  const [items, setItems] = useState([]);

  // maps
  const custMap  = useMemo(() => Object.fromEntries((customers||[]).map(c => [String(c.id), c])), [customers]);
  const svcMap   = useMemo(() => Object.fromEntries((services||[]).map(s => [String(s.id), s])), [services]);
  const staffMap = useMemo(() => Object.fromEntries((staff||[]).map(u => [String(u.id), u])), [staff]);

  // load lookups
  useEffect(() => {
    (async () => {
      try {
        const [c, s, t] = await Promise.all([
          fetch(`${API}/customers`).then(okJson),
          fetch(`${API}/services`).then(okJson),
          fetch(`${API}/staff`).then(okJson),
        ]);
        setCustomers(Array.isArray(c) ? c : []);
        setServices(Array.isArray(s) ? s : []);
        setStaff(Array.isArray(t) ? t : []);
      } catch {
        setCustomers([]); setServices([]); setStaff([]);
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, []);

  // prefill from query params
  useEffect(() => {
    if (loadingLookups) return;

    const apptId = search.get("appointmentId") || "";
    const custId = search.get("customerId") || "";
    const therId = search.get("therapistId") || "";
    const svcId  = search.get("serviceId") || "";
    const svcNameQ = search.get("serviceName") || "";
    const rm     = search.get("room") || "";
    const areaQ  = search.get("area") || "";
    const modeQ  = (search.get("mode") || "").toLowerCase();

    if (apptId) setAppointmentId(apptId);
    if (custId && custMap[custId]) setCustomerId(custId);
    if (therId && staffMap[therId]) setTherapistId(therId);

    if (rm) setRoom(rm);
    if (areaQ) setArea(areaQ);
    if (modeQ === "in" || modeQ === "out") setMode(modeQ);
    else if (rm && !areaQ) setMode("in");
    else if (areaQ && !rm) setMode("out");

    const addItemsFromQuery = () => {
      // priority: serviceId
      if (svcId && svcMap[svcId]) {
        const svc = svcMap[svcId];
        const price = toNumber(svc.price);
        setItems([{
          serviceId: svcId,
          serviceName: svc.name || "",
          qty: 1, price, total: price,
        }]);
        return;
      }

      // else: serviceName
      if (svcNameQ) {
        const match = services.find(s => String(s.name || "").toLowerCase() === svcNameQ.toLowerCase());
        if (match) {
          const price = toNumber(match.price);
          setItems([{
            serviceId: match.id,
            serviceName: match.name || "",
            qty: 1, price, total: price,
          }]);
          return;
        }
        // unknown name → add raw line with 0 price
        setItems([{ serviceId: "", serviceName: svcNameQ, qty: 1, price: 0, total: 0 }]);
        return;
      }

      // default empty line
      setItems([{ serviceId: "", serviceName: "", qty: 1, price: 0, total: 0 }]);
    };

    if (!items.length) addItemsFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingLookups]);

  // totals
  const gross = useMemo(() => items.reduce((s, it) => s + toNumber(it.total), 0), [items]);
  const nf = useMemo(() => new Intl.NumberFormat(undefined, { style: "currency", currency }), [currency]);

  // items handlers
  function addItem() {
    setItems((list) => [...list, { serviceId: "", serviceName: "", qty: 1, price: 0, total: 0 }]);
  }
  function removeItem(i) { setItems((list) => list.filter((_, idx) => idx !== i)); }
  function changeItem(i, patch) {
    setItems((list) => {
      const next = list.slice();
      const cur = { ...next[i], ...patch };
      const qty = toNumber(cur.qty) || 0;
      const price = toNumber(cur.price) || 0;
      cur.total = round2(qty * price);

      if (patch.serviceId !== undefined) {
        const svc = svcMap[String(cur.serviceId)];
        if (svc) {
          cur.serviceName = svc.name || cur.serviceName || "";
          if (!("price" in patch)) {
            const p = toNumber(svc.price);
            cur.price = Number.isFinite(p) ? p : cur.price;
            cur.total = round2((Number.isFinite(p) ? p : cur.price) * (qty || 1));
          }
        }
      }
      next[i] = cur;
      return next;
    });
  }

  async function saveInvoice({ withPrint = false } = {}) {
    try {
      setErr("");

      if (!customerId) return setErr("Customer is required.");
      if (!items.length || !items.some((it) => toNumber(it.total) > 0)) {
        return setErr("Please add at least one service with valid total.");
      }

      const payload = {
        appointmentId: appointmentId ? Number(appointmentId) : undefined,
        customerId: Number(customerId),
        customerName: custMap[String(customerId)]?.name || "",
        therapistId: therapistId ? Number(therapistId) : undefined,
        therapist: therapistId ? (staffMap[String(therapistId)]?.name || "") : "",
        mode,
        roomNumber: mode === "in" ? (room || "") : undefined,
        area: mode === "out" ? (area || "") : undefined,
        paymentMethod,
        currency,
        items: items.map((it) => ({
          serviceId: it.serviceId ? Number(it.serviceId) : undefined,
          serviceName: svcMap[String(it.serviceId)]?.name || it.serviceName || "",
          qty: toNumber(it.qty) || 1,
          price: toNumber(it.price) || 0,
          total: toNumber(it.total) || (toNumber(it.qty) || 0) * (toNumber(it.price) || 0),
        })),
        total: gross || items.reduce((s, it) => s + (toNumber(it.total) || (toNumber(it.qty) || 0) * (toNumber(it.price) || 0)), 0),
        notes,
      };

      setSaving(true);
      const r = await fetch(`${API}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const created = await r.json();

      const shouldPrint = withPrint || printAfter;
      const suffix = shouldPrint ? "?print=1" : "";
      nav(`/invoices/${created.id}${suffix}`, { replace: true });
    } catch (e) {
      setErr(e.message || "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  const fromSessionBanner =
    appointmentId || customerId || therapistId || room || area ? (
      <div style={banner}>
        <strong>Prefilled:</strong>
        <span>{customerId ? (custMap[String(customerId)]?.name || `#${customerId}`) : "-"}</span>
        <span>•</span>
        <span>{therapistId ? (staffMap[String(therapistId)]?.name || `#${therapistId}`) : "-"}</span>
        <span>•</span>
        <span>{mode === "in" ? (room ? `Room ${room}` : "-") : (area ? `Area ${area}` : "-")}</span>
        {appointmentId ? <span>• Appt #{appointmentId}</span> : null}
      </div>
    ) : null;

  return (
    <div style={{ padding: 16 }}>
      <header style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "end" }}>
        <div>
          <h1 style={{ margin: 0 }}>New Invoice</h1>
          {fromSessionBanner}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151" }}>
            <input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} />
            Print after save
          </label>
          <Link to="/invoices"><button className="secondary">Back</button></Link>
          <button onClick={() => saveInvoice({ withPrint: false })} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => saveInvoice({ withPrint: true })} disabled={saving}>{saving ? "Saving…" : "Save & Print"}</button>
        </div>
      </header>

      {err ? <div style={alertErr}>{err}</div> : null}

      {/* Top info */}
      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(160px,1fr))", gap: 10 }}>
          <Field label="Customer">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— Select —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
              ))}
            </select>
          </Field>

          <Field label="Therapist">
            <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
              <option value="">— Select —</option>
              {staff.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </Field>

          <Field label="Mode">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="in">In-Center</option>
              <option value="out">Out-Call</option>
            </select>
          </Field>

          {mode === "in" ? (
            <Field label="Room">
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room #" />
            </Field>
          ) : (
            <Field label="Area">
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area/Location" />
            </Field>
          )}

          <Field label="Payment">
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">— Select —</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Transfer</option>
            </select>
          </Field>

          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="AED">AED</option>
              <option value="SAR">SAR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Items */}
      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Items</h3>
          <button className="secondary" onClick={addItem}>+ Add item</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Service</th>
                <th style={{ width: 100 }} className="num">Qty</th>
                <th style={{ width: 140 }} className="num">Price</th>
                <th style={{ width: 160 }} className="num">Line total</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const svc = svcMap[String(it.serviceId)] || null;
                return (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <select
                        value={it.serviceId || ""}
                        onChange={(e) => changeItem(i, { serviceId: e.target.value })}
                        style={{ minWidth: 240 }}
                      >
                        <option value="">— Select —</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.price ? `(${nf.format(toNumber(s.price))})` : ""}
                          </option>
                        ))}
                      </select>
                      {/* عرض الاسم الحر لو ما في serviceId */}
                      {!it.serviceId && it.serviceName ? (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Item: {it.serviceName}</div>
                      ) : null}
                    </td>
                    <td className="num">
                      <input type="number" min={1} step={1} value={it.qty}
                        onChange={(e) => changeItem(i, { qty: clampInt(e.target.value, 1) })} style={{ width: 90, textAlign: "right" }} />
                    </td>
                    <td className="num">
                      <input type="number" min={0} step="0.01" value={it.price}
                        onChange={(e) => changeItem(i, { price: toNumber(e.target.value) })}
                        style={{ width: 120, textAlign: "right" }}
                        title={svc?.price ? `Default: ${nf.format(toNumber(svc.price))}` : ""} />
                    </td>
                    <td className="num">{nf.format(toNumber(it.total) || 0)}</td>
                    <td className="num"><button className="secondary" onClick={() => removeItem(i)}>Remove</button></td>
                  </tr>
                );
              })}
              {!items.length ? (<tr><td colSpan={6} style={{ color: "#6b7280" }}>No items.</td></tr>) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes & totals */}
      <section className="card" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Notes</div>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…" style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: 8, outline: "none" }} />
        </div>
        <div>
          <div style={{ display: "grid", gap: 6 }}>
            <RowKV k="Subtotal" v={nf.format(gross)} />
            <RowKV k="Discount" v={nf.format(0)} />
            <RowKV k="Total" v={<strong>{nf.format(gross)}</strong>} />
          </div>
        </div>
      </section>

      <style>{`
        .table { width:100%; border-collapse:collapse; }
        .table th, .table td { padding:8px 6px; border-bottom:1px solid #eee; text-align:left; }
        .table .num { text-align:right; }
        .card { border:1px solid #eee; border-radius:10px; padding:12px; background:#fff; }
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
function RowKV({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span style={{ color: "#6b7280" }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
function okJson(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
function toNumber(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function clampInt(v, min = 1){ const n = Math.round(Number(v)); if (!Number.isFinite(n)) return min; return Math.max(min, n); }

const banner = { display: "flex", gap: 8, alignItems: "center", color: "#374151", fontSize: 13, marginTop: 6 };
const alertErr = {
  background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca",
  borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 13,
};