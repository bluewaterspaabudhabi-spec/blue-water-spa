// frontend/src/pages/Customers.jsx
import { useEffect, useState, useMemo, useRef } from "react";

const API = "http://apiFetch(/api/customers";

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // add form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  // inline edit
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ name: "", phone: "", notes: "", rating: 0 });

  // search
  const [q, setQ] = useState("");

  // filters & sorting
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  // + paymentsDesc (new)
  const [sortKey, setSortKey] = useState("createdDesc"); // createdDesc | nameAsc | visitsDesc | ratingDesc | lastVisitDesc | paymentsDesc

  // import state
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  // mapping modal state (kept as-is for now)
  const [mapOpen, setMapOpen] = useState(false);
  const [mapHeaders, setMapHeaders] = useState([]);
  const [mapSample, setMapSample] = useState([]);
  const [mapRows, setMapRows] = useState([]);
  const [mapping, setMapping] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "",
    notes: "",
    rating: "",
  });

  useEffect(() => { reloadAll(); }, []);

  async function reloadAll() {
    let ignore = false;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!ignore) setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
    return () => { ignore = true; };
  }

  async function handleAdd(e) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      rating: 0,
    };
    if (!payload.name) return alert("Name is required.");
    try {
      setErr("");
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      setRows((r) => [...r, created]);
      setName(""); setPhone(""); setNotes("");
    } catch (e) {
      setErr(String(e));
      alert("Failed to add customer.");
    }
  }

  function startEdit(row) {
    setEditId(row.id);
    setEdit({
      name: row.name || "",
      phone: row.phone || "",
      notes: row.notes || "",
      rating: Number.isFinite(row.rating) ? row.rating : 0,
    });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ name: "", phone: "", notes: "", rating: 0 });
  }
  async function saveEdit(id) {
    const payload = {
      name: edit.name.trim(),
      phone: edit.phone.trim(),
      notes: edit.notes.trim(),
      rating: clampRating(edit.rating),
    };
    if (!payload.name) return alert("Name is required.");
    try {
      setErr("");
      const res = await fetch(`${API}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setRows((r) => r.map((x) => (x.id === id ? updated : x)));
      cancelEdit();
    } catch (e) {
      setErr(String(e));
      alert("Failed to update customer.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this customer?")) return;
    try {
      setErr("");
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((r) => r.filter((x) => x.id !== id));
      if (editId === id) cancelEdit();
    } catch (e) {
      setErr(String(e));
      alert("Failed to delete customer.");
    }
  }

  /* ---------- derived: search + filters + sort ---------- */
  const viewRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = rows.slice();

    // search
    if (s) {
      list = list.filter((r) =>
        String(r.name || "").toLowerCase().includes(s) ||
        String(r.phone || "").toLowerCase().includes(s) ||
        String(r.notes || "").toLowerCase().includes(s)
      );
    }

    // filters
    if (hasPhoneOnly) {
      list = list.filter((r) => String(r.phone || "").trim().length > 0);
    }
    if (Number(minRating) > 0) {
      list = list.filter((r) => Number(r.rating || 0) >= Number(minRating));
    }

    // sort
    const money = (v) => Number(v || 0);
    const by = {
      nameAsc: (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
      visitsDesc: (a, b) => (Number(b.visitCount || 0) - Number(a.visitCount || 0)),
      ratingDesc: (a, b) => (Number(b.rating || 0) - Number(a.rating || 0)),
      lastVisitDesc: (a, b) => new Date(b.lastVisitAt || 0) - new Date(a.lastVisitAt || 0),
      createdDesc: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      // NEW: payments
      paymentsDesc: (a, b) => money(b.totalPaid) - money(a.totalPaid),
    };
    (by[sortKey] ? list.sort(by[sortKey]) : list.sort(by.createdDesc));

    return list;
  }, [rows, q, hasPhoneOnly, minRating, sortKey]);

  /* ---------- Export CSV (respects filters/sort) ---------- */
  function handleExportCSV() {
    const headers = [
      "id","name","phone","email","gender","notes",
      "rating","visitCount","lastVisitAt","totalPaid","createdAt","updatedAt"
    ];
    const escape = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of viewRows) {
      const row = [
        r.id, r.name, r.phone, r.email, r.gender, r.notes,
        r.rating ?? 0, r.visitCount ?? 0, r.lastVisitAt ?? "",
        r.totalPaid ?? 0, r.createdAt ?? "", r.updatedAt ?? ""
      ].map(escape);
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------- Import CSV (unchanged logic) ---------- */
  function triggerImport() {
    if (fileRef.current) fileRef.current.click();
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const text = await file.text();
      const rowsCsv = parseCSV(text);
      if (!rowsCsv.length) { alert("Empty CSV."); return; }

      const header = (rowsCsv[0] || []).map((h) => normalizeHeader(h));
      const required = ["name", "phone", "email", "gender", "notes", "rating"];
      const knownCount = header.filter((h) => required.includes(h)).length;

      if (knownCount >= 3) {
        await importWithHeader(header, rowsCsv.slice(1));
      } else {
        openMappingModal(rowsCsv);
      }
    } catch (e2) {
      console.error(e2);
      alert("Failed to read file.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function importWithHeader(header, dataRows) {
    let ok = 0, fail = 0;
    for (const r of dataRows) {
      const get = (key) => {
        const i = header.indexOf(key);
        return i >= 0 ? String(r[i] || "").trim() : "";
      };
      const payload = {
        name: get("name"),
        phone: get("phone"),
        email: get("email"),
        gender: get("gender"),
        notes: get("notes"),
        rating: clampRating(get("rating")),
        // if CSV has totalPaid column, backend will accept it; otherwise 0
        totalPaid: toMoneySafe(get("totalpaid")),
      };
      if (!payload.name) { fail++; continue; }
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setRows((list) => [...list, created]);
        ok++;
      } catch {
        fail++;
      }
    }
    alert(`Imported: ${ok}${fail ? `, Failed: ${fail}` : ""}`);
  }

  function openMappingModal(rowsCsv) {
    const rawHeader = (rowsCsv[0] || []).map((h) => String(h ?? ""));
    const normHeader = rawHeader.map(normalizeHeader);
    const data = rowsCsv.slice(1);
    setMapHeaders(rawHeader);
    setMapSample(data.slice(0, 5));
    setMapRows(data);
    setMapping({
      name: "",
      phone: "",
      email: "",
      gender: "",
      notes: "",
      rating: "",
    });
    setMapOpen(true);
  }

  async function confirmMappingImport() {
    const norm = mapHeadersNorm();
    if (!norm.includes("name")) {
      alert("Please map a column to Name.");
      return;
    }
    await importWithHeader(norm, mapRows);
    setMapOpen(false);
    setMapHeaders([]); setMapSample([]); setMapRows([]);
  }

  function mapHeadersNorm() {
    const norm = mapHeaders.map(() => "");
    const rawLower = mapHeaders.map((h) => normalizeHeader(h));
    const keys = Object.keys(mapping);
    for (const key of keys) {
      const sel = mapping[key];
      if (!sel) continue;
      const idx = mapHeaders.findIndex((h) => h === sel);
      if (idx >= 0) norm[idx] = key;
      else {
        const i2 = rawLower.findIndex((h) => h === normalizeHeader(sel));
        if (i2 >= 0) norm[i2] = key;
      }
    }
    return norm;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 12px" }}>Customers</h1>

      {/* Top bar: search + filters + actions */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name/phone/notes…"
          style={inp}
        />

        {/* Filters */}
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={hasPhoneOnly} onChange={(e) => setHasPhoneOnly(e.target.checked)} />
          Has phone
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Min rating
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} style={sel}>
            {[0,1,2,3,4,5].map((n)=> <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Sort by
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={sel}>
            <option value="createdDesc">Created (newest)</option>
            <option value="nameAsc">Name (A–Z)</option>
            <option value="visitsDesc">Visits (high→low)</option>
            <option value="ratingDesc">Rating (high→low)</option>
            <option value="lastVisitDesc">Last visit (newest)</option>
            {/* NEW: Payments */}
            <option value="paymentsDesc">Payments (high→low)</option>
          </select>
        </label>

        {err ? <span style={{ color: "crimson" }}>{err}</span> : null}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn" onClick={handleExportCSV}>Download CSV</button>
          <button className="btn" onClick={triggerImport} disabled={importing}>
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
        </div>
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 2fr auto", gap: 8, marginBottom: 14 }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" style={inp} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={inp} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" style={inp} />
        <button type="submit" className="btn">+ Add</button>
      </form>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Name</th>
              <th style={th}>Phone</th>
              <th style={th}>Notes</th>
              <th style={{ ...th, width: 90, textAlign: "center" }}>Visits</th>
              <th style={{ ...th, width: 160 }}>Last Visit</th>
              <th style={{ ...th, width: 120, textAlign: "center" }}>Rating</th>
              {/* NEW: Total Paid */}
              <th style={{ ...th, width: 120, textAlign: "right" }}>Total Paid</th>
              <th style={{ ...th, width: 200, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={td}>Loading…</td></tr>
            ) : viewRows.length === 0 ? (
              <tr><td colSpan={9} style={td}>No customers.</td></tr>
            ) : (
              viewRows.map((row, i) => {
                const isEditing = editId === row.id;
                return (
                  <tr key={row.id}>
                    <td style={tdCenter}>{i + 1}</td>

                    {/* Name */}
                    <td style={td}>
                      {isEditing ? (
                        <input
                          value={edit.name}
                          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                          style={inp}
                          autoFocus
                        />
                      ) : (
                        row.name || "-"
                      )}
                    </td>

                    {/* Phone */}
                    <td style={td}>
                      {isEditing ? (
                        <input
                          value={edit.phone}
                          onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                          style={inp}
                        />
                      ) : (
                        row.phone || "-"
                      )}
                    </td>

                    {/* Notes */}
                    <td style={td}>
                      {isEditing ? (
                        <input
                          value={edit.notes}
                          onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                          style={inp}
                        />
                      ) : (
                        row.notes || "-"
                      )}
                    </td>

                    {/* Visits (read-only) */}
                    <td style={{ ...tdCenter, fontWeight: 600 }}>
                      {Number(row.visitCount || 0)}
                    </td>

                    {/* Last Visit (read-only) */}
                    <td style={td}>
                      {row.lastVisitAt ? new Date(row.lastVisitAt).toLocaleString() : "—"}
                    </td>

                    {/* Rating (editable) */}
                    <td style={tdCenter}>
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={1}
                          value={edit.rating}
                          onChange={(e) =>
                            setEdit({ ...edit, rating: clampRating(e.target.value) })
                          }
                          style={{ ...inp, width: 70, textAlign: "center" }}
                          title="0 to 5"
                        />
                      ) : (
                        renderStars(Number.isFinite(row.rating) ? row.rating : 0)
                      )}
                    </td>

                    {/* NEW: Total Paid (read-only) */}
                    <td style={{ ...tdRight, fontWeight: 600 }}>
                      {formatMoney(row.totalPaid)}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdRight, whiteSpace: "nowrap" }}>
                      {isEditing ? (
                        <>
                          <button className="btn" onClick={() => saveEdit(row.id)} style={{ marginRight: 6 }}>
                            Save
                          </button>
                          <button className="btn" onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn" onClick={() => startEdit(row)} style={{ marginRight: 6 }}>
                            Edit
                          </button>
                          <button className="btn" onClick={() => handleDelete(row.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mapping Modal (unchanged UI) */}
      {mapOpen && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ marginTop: 0 }}>Map CSV Columns</h3>
            <p style={{ marginTop: 6, color: "#6b7280" }}>
              Select which CSV column corresponds to each field.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, marginBottom: 12 }}>
              {["name","phone","email","gender","notes","rating"].map((key) => (
                <FragmentRow key={key} label={key}>
                  <select
                    value={mapping[key] || ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                    style={sel}
                  >
                    <option value="">— Not mapped —</option>
                    {mapHeaders.map((h, i) => (
                      <option key={i} value={h}>{h || `(column ${i+1})`}</option>
                    ))}
                  </select>
                </FragmentRow>
              ))}
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview (first 5 rows):</div>
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {mapHeaders.map((h, i) => (
                        <th key={i} style={th}>{h || `(column ${i+1})`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapSample.length ? mapSample.map((r, i) => (
                      <tr key={i}>
                        {mapHeaders.map((_, j) => (
                          <td key={j} style={td}>{r[j]}</td>
                        ))}
                      </tr>
                    )) : (
                      <tr><td style={td}>No rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setMapOpen(false)}>Cancel</button>
              <button className="btn" onClick={confirmMappingImport} style={{ background: "#2563eb", color: "#fff" }}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* small subcomponent for label/value rows in modal */
function FragmentRow({ label, children }) {
  return (
    <>
      <div style={{ paddingTop: 8, color: "#374151", textTransform: "capitalize" }}>{label}</div>
      <div>{children}</div>
    </>
  );
}

/* helpers */
function clampRating(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}
function renderStars(n) {
  const full = "★".repeat(Math.max(0, Math.min(5, n)));
  const empty = "☆".repeat(5 - full.length);
  return (
    <span style={{ fontSize: 16, letterSpacing: 1 }}>
      <span style={{ color: "#f59e0b" }}>{full}</span>
      <span style={{ color: "#d1d5db" }}>{empty}</span>
      <span style={{ marginLeft: 6, color: "#6b7280", fontSize: 12 }}>({n})</span>
    </span>
  );
}
function toMoneySafe(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}
function formatMoney(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

// tiny CSV parser with quotes support
function parseCSV(text) {
  const out = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
      else if (ch === "\r") { /* ignore */ }
      else cur += ch;
    }
  }
  row.push(cur);
  out.push(row);
  if (out.length && out[out.length - 1].every((c) => c === "")) out.pop();
  return out;
}

// header normalization & basic guess
function normalizeHeader(h) {
  const s = String(h || "").trim().toLowerCase();
  return s.replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}
function guess(headersNorm, keys) {
  for (const k of keys) {
    if (headersNorm.includes(k)) return true;
  }
  return false;
}

/* tiny inline styles */
const th = { textAlign: "left", borderBottom: "1px solid #eee", padding: "10px 8px", fontWeight: 600 };
const td = { borderBottom: "1px solid #f4f4f4", padding: "10px 8px" };
const tdCenter = { ...td, textAlign: "center" };
const tdRight = { ...td, textAlign: "right" };
const inp = { width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, outline: "none" };
const sel = { padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, outline: "none" };

// modal styles
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modal = {
  width: "min(900px, 92vw)",
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 15px 40px rgba(0,0,0,.18)",
};