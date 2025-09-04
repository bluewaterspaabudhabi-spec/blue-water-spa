// frontend/src/pages/Expenses.jsx
import apiFetch from "../utils/apiFetch";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function Expenses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // new expense modal
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: "",
    vendor: "",
    description: "",
    amount: "",
    method: "",
    invoice: "",
  });

  // import (mapping) state
  const [mapOpen, setMapOpen] = useState(false);
  const [headers, setHeaders] = useState([]);      // string[]
  const [rows, setRows] = useState([]);            // any[][] (body only)
  const [mapping, setMapping] = useState(defaultMapping()); // indices

  // search / sort
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");

  const fileRef = useRef(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    try {
      setLoading(true);
      const xs = await fetch(`${API}/expenses`).then(okJson);
      setList(Array.isArray(xs) ? xs : []);
      setErr("");
    } catch (e) {
      console.error(e);
      setErr("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  }

  async function createExpense() {
    try {
      setSaving(true);
      setErr("");
      const payload = {
        date: form.date || undefined,
        vendor: (form.vendor || "").trim(),
        description: (form.description || "").trim(),
        amount: Number(form.amount),
        method: (form.method || "").trim(),
        invoice: (form.invoice || "").trim(),
      };
      if (!Number.isFinite(payload.amount)) throw new Error("Amount is required.");
      const r = await fetch(`${API}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      await reload();
      setOpenNew(false);
      setForm({ date: "", vendor: "", description: "", amount: "", method: "", invoice: "" });
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to create expense.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(x) {
    if (!confirm("Delete this expense?")) return;
    try {
      const r = await fetch(`${API}/expenses/${x.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      await reload();
    } catch (e) {
      alert("Delete failed.");
    }
  }

  /* ---------- CSV import (auto detect + manual mapping UI) ---------- */
  function onPickCSV(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const data = res.data || [];
          if (!data.length) return alert("Empty CSV.");

          // normalize as arrays
          let hdrs = [];
          let body = [];
          if (Array.isArray(data[0])) {
            hdrs = data[0].map((x) => String(x ?? ""));
            body = data.slice(1);
          } else if (data[0] && typeof data[0] === "object") {
            hdrs = Object.keys(data[0]);
            body = data.map((r) => hdrs.map((h) => r[h]));
          } else {
            return alert("Unrecognized CSV format.");
          }

          setHeaders(hdrs);
          setRows(body);
          setMapping(autoMapExpenseColumns(hdrs).mapping);
          setMapOpen(true);
        } catch (err) {
          console.error(err);
          alert("Failed to read CSV.");
        }
      },
      error: (err) => {
        console.error(err);
        alert("Failed to read CSV file.");
      },
    });
  }

  async function doImportWithMapping() {
    try {
      const items = rows.map((r) => mapExpenseRow(r, mapping)).filter(Boolean);
      if (!items.length) return alert("No valid rows found in the CSV.");

      const r = await fetch(`${API}/expenses/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);

      setMapOpen(false);
      setHeaders([]);
      setRows([]);
      setMapping(defaultMapping());

      await reload();
      alert(`Imported ${items.length} expense(s).`);
    } catch (e) {
      console.error(e);
      alert("Import failed.");
    }
  }

  /* ---------- derived: filter + sort ---------- */
  const visible = useMemo(() => {
    let xs = Array.isArray(list) ? [...list] : [];

    if (search.trim()) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (x) =>
          (x.vendor || "").toLowerCase().includes(q) ||
          (x.description || "").toLowerCase().includes(q) ||
          (x.method || "").toLowerCase().includes(q) ||
          (x.invoice || "").toLowerCase().includes(q)
      );
    }

    xs.sort((a, b) => {
      if (sortBy === "date-desc") return d(b) - d(a);
      if (sortBy === "date-asc") return d(a) - d(b);
      if (sortBy === "amount-desc") return (n(b.amount)) - (n(a.amount));
      if (sortBy === "amount-asc") return (n(a.amount)) - (n(b.amount));
      if (sortBy === "vendor") return s(a.vendor).localeCompare(s(b.vendor));
      if (sortBy === "method") return s(a.method).localeCompare(s(b.method));
      return 0;
    });

    return xs;

    function d(x){ return Date.parse(x.date || x.createdAt || 0) || 0; }
    function n(x){ const v = Number(x); return Number.isFinite(v) ? v : 0; }
    function s(x){ return String(x || ""); }
  }, [list, search, sortBy]);

  const total = useMemo(() => {
    return (visible || []).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  }, [visible]);

  /* ---------- render ---------- */
  return (
    <div style={{ padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Expenses</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="secondary" onClick={reload}>Refresh</button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onPickCSV} />
          <button onClick={() => setOpenNew(true)}>+ New Expense</button>
          <Link to="/dashboard"><button className="secondary">Back to Dashboard</button></Link>
        </div>
      </header>

      {err ? <div style={alertErr}>{err}</div> : null}

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 8, alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>All expenses</h3>
          <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
            <input
              placeholder="Search vendor, description, invoice, method…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 320, padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6 }}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ height: 34 }}>
              <option value="date-desc">Date (Newest first)</option>
              <option value="date-asc">Date (Oldest first)</option>
              <option value="amount-desc">Amount (High → Low)</option>
              <option value="amount-asc">Amount (Low → High)</option>
              <option value="vendor">Vendor (A → Z)</option>
              <option value="method">Method (A → Z)</option>
            </select>
            <div style={{ fontWeight: 600, minWidth: 150, textAlign: "right" }}>Total: {formatMoney(total)}</div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th style={{ width: 140 }}>Date</th>
              <th>Vendor</th>
              <th>Description</th>
              <th style={{ width: 140 }}>Amount</th>
              <th style={{ width: 140 }}>Method</th>
              <th style={{ width: 160 }}>Invoice</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Loading…</td></tr>
            ) : (visible || []).length ? (
              visible.map((x, i) => (
                <tr key={x.id || i}>
                  <td>{i + 1}</td>
                  <td>{fmtDate(x.date || x.createdAt)}</td>
                  <td>{x.vendor || "-"}</td>
                  <td>{x.description || "-"}</td>
                  <td>{formatMoney(Number(x.amount) || 0)}</td>
                  <td>{x.method || "-"}</td>
                  <td>{x.invoice || "-"}</td>
                  <td>
                    <button className="danger" onClick={() => deleteExpense(x)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} style={{ color: "#6b7280" }}>No expenses.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* New expense modal */}
      {openNew && (
        <Modal title="New expense" onClose={() => setOpenNew(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={lbl}>
              <span>Date</span>
              <input type="date" value={toDateInput(form.date)} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </label>
            <label style={lbl}>
              <span>Vendor</span>
              <input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
            </label>
            <label style={lbl}>
              <span>Description</span>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label style={lbl}>
              <span>Amount</span>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </label>
            <label style={lbl}>
              <span>Method</span>
              <input value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} />
            </label>
            <label style={lbl}>
              <span>Invoice</span>
              <input value={form.invoice} onChange={(e) => setForm((f) => ({ ...f, invoice: e.target.value }))} />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
              <button className="secondary" onClick={() => setOpenNew(false)}>Cancel</button>
              <button onClick={createExpense} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mapping modal */}
      {mapOpen && (
        <Modal title="Map CSV Columns" onClose={() => setMapOpen(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, color: "#374151" }}>
              Select which CSV column corresponds to each field. A preview of the first 5 rows is shown below.
            </p>

            <MappingRow
              label="Date"
              headers={headers}
              value={mapping.date}
              onChange={(i) => setMapping((m) => ({ ...m, date: i }))}
            />
            <MappingRow
              label="Vendor"
              headers={headers}
              value={mapping.vendor}
              onChange={(i) => setMapping((m) => ({ ...m, vendor: i }))}
            />
            <MappingRow
              label="Description"
              headers={headers}
              value={mapping.description}
              onChange={(i) => setMapping((m) => ({ ...m, description: i }))}
            />
            <MappingRow
              label="Amount"
              headers={headers}
              value={mapping.amount}
              onChange={(i) => setMapping((m) => ({ ...m, amount: i }))}
            />
            <MappingRow
              label="Method"
              headers={headers}
              value={mapping.method}
              onChange={(i) => setMapping((m) => ({ ...m, method: i }))}
            />
            <MappingRow
              label="Invoice"
              headers={headers}
              value={mapping.invoice}
              onChange={(i) => setMapping((m) => ({ ...m, invoice: i }))}
            />
            <MappingRow
              label="Debit (optional)"
              headers={headers}
              value={mapping.debit}
              onChange={(i) => setMapping((m) => ({ ...m, debit: i }))}
            />
            <MappingRow
              label="Credit (optional)"
              headers={headers}
              value={mapping.credit}
              onChange={(i) => setMapping((m) => ({ ...m, credit: i }))}
            />

            <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    {headers.map((h, i) => <th key={i}>{h || `Column ${i + 1}`}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {headers.map((_, j) => <td key={j}>{String(r[j] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="secondary" onClick={() => setMapOpen(false)}>Cancel</button>
              <button onClick={doImportWithMapping}>Import</button>
            </div>
          </div>
        </Modal>
      )}

      <style>{styles}</style>
    </div>
  );
}

/* ---------- tiny components ---------- */
function MappingRow({ label, headers, value, onChange }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "180px 1fr", alignItems: "center", gap: 8 }}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={-1}>— Not mapped —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
        ))}
      </select>
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", display: "grid", placeItems: "center", zIndex: 50 }}>
      <div className="card" style={{ width: 860, padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- utils ---------- */
function okJson(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
function fmtDate(v){ const t = Date.parse(v || 0); return Number.isFinite(t) ? new Date(t).toLocaleDateString() : "-"; }
function toDateInput(v){
  if(!v) return "";
  const d = new Date(v); if (isNaN(d)) return "";
  const pad = (n)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function formatMoney(n){ try{ return new Intl.NumberFormat(undefined,{style:"currency",currency:"USD"}).format(n); } catch{ return Number(n).toFixed(2); } }

/* ---------- mapping helpers ---------- */
function defaultMapping(){ return { date:-1, vendor:-1, description:-1, amount:-1, method:-1, invoice:-1, debit:-1, credit:-1 }; }
function normalizeHeader(h){
  return String(h||"").toLowerCase().replace(/[\s._-]+/g,"").replace(/[()]/g,"").trim();
}
function autoMapExpenseColumns(headers){
  const norm = headers.map(normalizeHeader);
  const syn = {
    date: ["date","transactiondate","transdate","day","posteddate","entrydate","expensedate"],
    vendor: ["vendor","payee","supplier","merchant","seller","party","counterparty"],
    description: ["description","details","memo","note","item","purpose","desc"],
    amount: ["amount","total","value","amt","expense","cost","netamount"],
    method: ["method","paymentmethod","paidby","channel","paymenttype","mode","paymethod","card"],
    invoice: ["invoice","invoiceno","invoicenumber","bill","billno","ref","reference","receipt","receiptno"],
    debit: ["debit","withdrawal","dr"],
    credit:["credit","deposit","cr"],
  };
  const findIdx=(keys)=>{
    for(const k of keys){ const i=norm.indexOf(k); if(i!==-1) return i; }
    for(const k of keys){ const i=norm.findIndex(h=>h.includes(k)); if(i!==-1) return i; }
    return -1;
  };
  return {
    mapping:{
      date:   findIdx(syn.date),
      vendor: findIdx(syn.vendor),
      description: findIdx(syn.description),
      amount: findIdx(syn.amount),
      method: findIdx(syn.method),
      invoice: findIdx(syn.invoice),
      debit: findIdx(syn.debit),
      credit: findIdx(syn.credit),
    }
  };
}
function parseMoney(x){
  if (x==null) return 0;
  let s=String(x).trim();
  if(!s) return 0;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[^\d.-]/g,"");
  const n = Number(s);
  return neg ? -Math.abs(n) : (Number.isFinite(n)?n:0);
}
function parseDateFlex(x){
  if(!x) return "";
  let t = Date.parse(x);
  if(!Number.isFinite(t)){
    const m = String(x).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(m){
      const dd=Number(m[1]), mm=Number(m[2])-1, yy=Number(m[3])<100?2000+Number(m[3]):Number(m[3]);
      t = Date.UTC(yy,mm,dd);
    }
  }
  if(!Number.isFinite(t)) return "";
  return new Date(t).toISOString();
}
function mapExpenseRow(row, mapping){
  const get = (i)=> (i>=0 ? row[i] : "");
  let amount = parseMoney(get(mapping.amount));
  if(!amount && (mapping.debit !== -1 || mapping.credit !== -1)){
    const debit = parseMoney(get(mapping.debit));
    const credit= parseMoney(get(mapping.credit));
    amount = debit - credit; // debit positive, credit negative
  }
  const obj = {
    date: parseDateFlex(get(mapping.date)) || "",
    vendor: String(get(mapping.vendor) || "").trim(),
    description: String(get(mapping.description) || "").trim(),
    amount: amount || 0,
    method: String(get(mapping.method) || "").trim(),
    invoice: String(get(mapping.invoice) || "").trim(),
  };
  // require a date and a non-zero amount for validity
  if (!obj.date || !Number.isFinite(obj.amount) || obj.amount === 0) return null;
  return obj;
}

/* ---------- styles ---------- */
const lbl = { display: "grid", gap: 6, fontSize: 13 };
const alertErr = {
  background:"#fee2e2", color:"#991b1b", border:"1px solid #fecaca",
  borderRadius:8, padding:"8px 10px", marginBottom:10, fontSize:13
};
const styles = `
  .table { width: 100%; border-collapse: collapse; }
  .table th, .table td { padding: 8px 6px; border-bottom: 1px solid #eee; text-align: left; }
  .card { border: 1px solid #eee; border-radius: 10px; padding: 12px; background: #fff; }
  button { height: 34px; border: none; border-radius: 8px; padding: 0 12px; background: #2563eb; color: #fff; cursor: pointer; }
  button.secondary { background: #eef2ff; color: #1e3a8a; }
  button.danger { background: #ef4444; }
`;