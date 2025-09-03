// frontend/src/pages/Staff.jsx
import apiFetch from "../../utils/apiFetch";

import { useEffect, useState } from "react";

const API = "http://apiFetch(/api/staff";

export default function Staff() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // new row form
  const [form, setForm] = useState({ name: "", role: "", phone: "", notes: "" });

  // edit state: id being edited + draft values
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ name: "", role: "", phone: "", notes: "" });

  const load = () => {
    setLoading(true);
    fetch(API)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(() => setErr("Failed to load staff"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCreate = (e) => {
    e.preventDefault();
    setMsg(""); setErr("");
    const body = JSON.stringify(form);
    fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(() => { setForm({ name: "", role: "", phone: "", notes: "" }); load(); setMsg("Saved"); })
      .catch(() => setErr("Save failed (POST /api/staff)."));
  };

  const startEdit = (row) => {
    setEditId(row.id);
    setDraft({ name: row.name || "", role: row.role || "", phone: row.phone || "", notes: row.notes || "" });
    setMsg(""); setErr("");
  };

  const cancelEdit = () => { setEditId(null); setDraft({ name: "", role: "", phone: "", notes: "" }); };

  const onUpdate = (id) => {
    setMsg(""); setErr("");
    fetch(`${API}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(() => { cancelEdit(); load(); setMsg("Updated"); })
      .catch((status) => {
        if (String(status) === "404") setErr("PUT /api/staff/:id not found on backend.");
        else setErr("Update failed.");
      });
  };

  const onDelete = (id) => {
    if (!confirm("Delete this staff member?")) return;
    setMsg(""); setErr("");
    fetch(`${API}/${id}`, { method: "DELETE" })
      .then(r => (r.ok ? r.text() : Promise.reject(r.status)))
      .then(() => { load(); setMsg("Deleted"); })
      .catch((status) => {
        if (String(status) === "404") setErr("DELETE /api/staff/:id not found on backend.");
        else setErr("Delete failed.");
      });
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>Staff</h1>

      <form onSubmit={onCreate} className="no-print" style={{ display: "grid", gridTemplateColumns: "220px 180px 180px 1fr auto", gap: 8, alignItems: "end", marginBottom: 12 }}>
        <div>
          <label className="lbl">Name *</label>
          <input required value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g. Anna" />
        </div>
        <div>
          <label className="lbl">Role *</label>
          <input required value={form.role} onChange={e=>setForm({...form, role:e.target.value})} placeholder="e.g. Therapist" />
        </div>
        <div>
          <label className="lbl">Phone</label>
          <input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="e.g. 0500000000" />
        </div>
        <div>
          <label className="lbl">Notes</label>
          <input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Optional" />
        </div>
        <button type="submit">Add</button>
      </form>

      {msg && <div style={{ color: "green", marginBottom: 8 }}>{msg}</div>}
      {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}

      <table className="table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th style={{width:60}}>#</th>
            <th>Name</th>
            <th style={{width:180}}>Role</th>
            <th style={{width:160}}>Phone</th>
            <th>Notes</th>
            <th className="no-print" style={{width:160}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6}>Loading…</td></tr>
          ) : rows.length ? (
            rows.map((r, i) => (
              <tr key={r.id || i}>
                <td>{i+1}</td>
                <td>
                  {editId===r.id
                    ? <input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} />
                    : r.name || "-"}
                </td>
                <td>
                  {editId===r.id
                    ? <input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} />
                    : r.role || "-"}
                </td>
                <td>
                  {editId===r.id
                    ? <input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} />
                    : r.phone || "-"}
                </td>
                <td>
                  {editId===r.id
                    ? <input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} />
                    : r.notes || "-"}
                </td>
                <td className="no-print">
                  {editId===r.id ? (
                    <>
                      <button onClick={()=>onUpdate(r.id)}>Save</button>{" "}
                      <button type="button" onClick={cancelEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>startEdit(r)}>Edit</button>{" "}
                      <button onClick={()=>onDelete(r.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={6}>No staff.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}