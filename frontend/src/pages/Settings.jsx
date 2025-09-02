// frontend/src/pages/Settings.jsx
import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// helper to call API with Authorization header when token exists
async function api(path, options = {}) {
  const token = localStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API}${path}`, { ...options, headers });
}

export default function Settings() {
  /* ---------------- Settings form state ---------------- */
  const [form, setForm] = useState({
    businessName: "",
    phone: "",
    email: "",
    whatsapp: "",
    facebook: "",
    instagram: "",
    website: "",
    address: "",
    logoUrl: "",
    defaultCurrency: "AED",
    defaultPrintMode: "thermal-narrow",
    defaultTaxRate: 0,
    invoiceFooter: "",
  });
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsErr, setSettingsErr] = useState("");

  const loadSettings = async () => {
    try {
      setSettingsErr("");
      setLoadingSettings(true);
      const r = await api("/settings");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setForm((f) => ({ ...f, ...(data || {}) }));
    } catch (e) {
      setSettingsErr(String(e));
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const save = async (e) => {
    e?.preventDefault?.();
    try {
      setSaving(true);
      const r = await api("/settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadSettings();
      alert("Saved.");
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Current user (role) ---------------- */
  const [me, setMe] = useState(null); // { id, name, email, role }
  const [meErr, setMeErr] = useState("");

  const loadMe = async () => {
    try {
      setMeErr("");
      const r = await api("/auth/me");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMe(await r.json());
    } catch (e) {
      setMe(null);
      setMeErr(String(e));
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  /* ---------------- Users list & actions ---------------- */
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersErr, setUsersErr] = useState("");

  const loadUsers = async () => {
    try {
      setUsersErr("");
      setUsersLoading(true);
      const r = await api("/auth/users");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setUsersErr(String(e));
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const addUser = async () => {
    const name = window.prompt("Name:");
    if (!name) return;
    const email = window.prompt("Email:");
    if (!email) return;
    const password = window.prompt("Password:");
    if (!password) return;
    const role = (window.prompt("Role (admin|supervisor|staff)", "staff") || "").toLowerCase();
    if (!["admin", "supervisor", "staff"].includes(role)) return alert("Invalid role");

    try {
      const r = await api("/auth/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadUsers();
    } catch (e) {
      alert(String(e));
    }
  };

  const editUser = async (u) => {
    const name = window.prompt("Name:", u.name || "") ?? u.name;
    const email = window.prompt("Email:", u.email || "") ?? u.email;
    const role = (window.prompt("Role (admin|supervisor|staff):", u.role || "staff") || u.role).toLowerCase();
    if (!["admin", "supervisor", "staff"].includes(role)) return alert("Invalid role");

    try {
      const r = await api(`/auth/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, email, role }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadUsers();
    } catch (e) {
      alert(String(e));
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user "${u.name || u.email}"?`)) return;
    try {
      const r = await api(`/auth/users/${u.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadUsers();
    } catch (e) {
      alert(String(e));
    }
  };

  const currencies = useMemo(
    () => ["AED", "SAR", "USD", "EUR", "EGP", "QAR", "KWD", "OMR", "BHD"],
    []
  );

  const isAdmin = me?.role === "admin";
  const isSupervisor = me?.role === "supervisor";
  const isStaff = me?.role === "staff";

  return (
    <div className="page">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Settings</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-secondary" onClick={loadSettings} disabled={loadingSettings}>
            Reload
          </button>
        </div>
      </header>

      {settingsErr && (
        <div className="card" style={{ color: "crimson", marginBottom: 12 }}>
          {settingsErr}
        </div>
      )}

      <form
        onSubmit={save}
        className="card"
        style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <div>
          <label>Business Name</label>
          <input name="businessName" value={form.businessName} onChange={onChange} placeholder="Your business name" />
        </div>
        <div>
          <label>Phone</label>
          <input name="phone" value={form.phone} onChange={onChange} placeholder="Phone" />
        </div>
        <div>
          <label>Email</label>
          <input name="email" value={form.email} onChange={onChange} placeholder="Email" />
        </div>

        <div>
          <label>WhatsApp</label>
          <input name="whatsapp" value={form.whatsapp} onChange={onChange} placeholder="WhatsApp" />
        </div>
        <div>
          <label>Facebook</label>
          <input name="facebook" value={form.facebook} onChange={onChange} placeholder="Facebook URL" />
        </div>
        <div>
          <label>Instagram</label>
          <input name="instagram" value={form.instagram} onChange={onChange} placeholder="Instagram URL" />
        </div>

        <div>
          <label>Website</label>
          <input name="website" value={form.website} onChange={onChange} placeholder="Website URL" />
        </div>
        <div>
          <label>Address</label>
          <input name="address" value={form.address} onChange={onChange} placeholder="Address" />
        </div>
        <div>
          <label>Logo URL</label>
          <input name="logoUrl" value={form.logoUrl} onChange={onChange} placeholder="https://…" />
        </div>

        <div>
          <label>Default currency</label>
          <select name="defaultCurrency" value={form.defaultCurrency} onChange={onChange}>
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Default print mode</label>
          <select name="defaultPrintMode" value={form.defaultPrintMode} onChange={onChange}>
            <option value="thermal-narrow">Thermal (narrow)</option>
            <option value="thermal-wide">Thermal (wide)</option>
            <option value="a4">A4</option>
          </select>
        </div>
        <div>
          <label>Default tax rate %</label>
          <input
            name="defaultTaxRate"
            type="number"
            step="0.01"
            value={form.defaultTaxRate}
            onChange={onChange}
            placeholder="0"
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>Invoice footer</label>
          <textarea name="invoiceFooter" value={form.invoiceFooter} onChange={onChange} placeholder="Optional" />
        </div>

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadSettings} disabled={loadingSettings}>
            Reload
          </button>
        </div>
      </form>

      {/* Users block:
          - admin: full (add/edit/delete)
          - supervisor: read-only (no action buttons)
          - staff: hidden
      */}
      {!isStaff && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Users</h2>
            {isAdmin && (
              <button className="btn btn-primary" onClick={addUser}>+ Add User</button>
            )}
          </div>

          {(usersErr || meErr) && (
            <div style={{ color: "crimson", marginTop: 10 }}>
              {usersErr || meErr}
            </div>
          )}

          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Name</th>
                <th>Email</th>
                <th style={{ width: 140 }}>Role</th>
                {isAdmin && <th style={{ width: 160 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4}>Loading…</td>
                </tr>
              ) : users.length ? (
                users.map((u, i) => (
                  <tr key={u.id || i}>
                    <td>{u.id || i + 1}</td>
                    <td>{u.name || "-"}</td>
                    <td>{u.email || "-"}</td>
                    <td style={{ textTransform: "capitalize" }}>{u.role || "-"}</td>
                    {isAdmin && (
                      <td style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => editUser(u)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => deleteUser(u)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} style={{ color: "#6b7280" }}>No users.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}