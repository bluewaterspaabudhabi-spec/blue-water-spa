import { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function Customers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ name: "", phone: "", notes: "" });

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const res = await fetch(`${API}/api/customers`);
      if (!res.ok) throw new Error("load failed");
      setList(await res.json());
    } catch (e) {
      setErr("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addCustomer() {
    try {
      const res = await fetch(`${API}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm({ name: "", phone: "", notes: "" });
      await load();
    } catch {
      alert("Failed to add customer");
    }
  }

  async function saveEdit(id) {
    try {
      const res = await fetch(`${API}/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      await load();
    } catch {
      alert("Failed to update customer");
    }
  }

  async function del(id) {
    if (!confirm("Delete this customer?")) return;
    try {
      const res = await fetch(`${API}/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      alert("Failed to delete customer");
    }
  }

  return (
    <div className="page">
      <h1>Customers</h1>

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button onClick={addCustomer}>+ Add</button>
      </div>

      {err && <p style={{ color: "red" }}>{err}</p>}
      {loading ? <p>Loading...</p> : (
        <table className="table">
          <thead>
            <tr><th>#</th><th>Name</th><th>Phone</th><th>Notes</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {list.map((c, idx) => (
              <tr key={c.id}>
                <td>{idx + 1}</td>
                <td>
                  {editingId === c.id ? (
                    <input value={edit.name} onChange={(e)=>setEdit({...edit, name:e.target.value})}/>
                  ) : c.name}
                </td>
                <td>
                  {editingId === c.id ? (
                    <input value={edit.phone} onChange={(e)=>setEdit({...edit, phone:e.target.value})}/>
                  ) : c.phone}
                </td>
                <td>
                  {editingId === c.id ? (
                    <input value={edit.notes} onChange={(e)=>setEdit({...edit, notes:e.target.value})}/>
                  ) : c.notes}
                </td>
                <td>
                  {editingId === c.id ? (
                    <>
                      <button onClick={() => saveEdit(c.id)}>Save</button>
                      <button onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(c.id); setEdit({ name: c.name, phone: c.phone, notes: c.notes }); }}>Edit</button>
                      <button className="danger" onClick={() => del(c.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5}>No customers yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}