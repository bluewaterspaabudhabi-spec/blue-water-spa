// frontend/src/pages/Services.jsx
import apiFetch from "../utils/apiFetch";

import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function Services() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    name: "",
    price: 0,
    durationMin: 60,
    active: true,
  });

  // -------- load list --------
  const load = async () => {
    try {
      setErr("");
      setLoading(true);
      const r = await fetch(`${API}/services`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // -------- add service --------
  const save = async (e) => {
    e.preventDefault();
    try {
      setErr("");
      const payload = {
        name: String(form.name || "").trim(),
        price: Number(form.price) || 0,
        durationMin: Number(form.durationMin) || 0,
        active: Boolean(form.active),
      };
      const r = await fetch(`${API}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setForm({ name: "", price: 0, durationMin: 60, active: true });
      await load();
    } catch (e) {
      setErr(String(e));
    }
  };

  // -------- delete service --------
  const del = async (id) => {
    if (!id) return;
    try {
      setErr("");
      const r = await fetch(`${API}/services/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div className="page">
      <h2>Services</h2>

      {err && (
        <div className="card" style={{ color: "crimson", marginBottom: 12 }}>
          {err}
        </div>
      )}

      <form
        onSubmit={save}
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 160px auto",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          min="0"
          step="0.01"
        />
        <input
          type="number"
          placeholder="Duration (min)"
          value={form.durationMin}
          onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
          min="0"
        />
        <button className="btn btn-primary">Add</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>#</th>
            <th>Name</th>
            <th style={{ width: 140 }}>Price</th>
            <th style={{ width: 140 }}>Duration</th>
            <th style={{ width: 120 }} />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5}>Loading…</td>
            </tr>
          ) : rows.length ? (
            rows.map((r, i) => (
              <tr key={r.id ?? i}>
                <td>{r.id ?? i + 1}</td>
                <td>{r.name}</td>
                <td>{Number(r.price).toFixed(2)}</td>
                <td>{r.durationMin} min</td>
                <td>
                  <button className="btn btn-danger" onClick={() => del(r.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ color: "#6b7280" }}>
                No services.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}