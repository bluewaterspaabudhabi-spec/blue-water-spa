// frontend/src/pages/Appointments.jsx
import apiFetch from '../utils/apiFetch';
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function Appointments() {
  const nav = useNavigate();
  const location = useLocation();

  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // create modal
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // search inside modal
  const [custQuery, setCustQuery] = useState("");

  // inline new-customer modal
  const [openNewCustomer, setOpenNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

  // form state (supports guest booking)
  const [form, setForm] = useState({
    startAt: "", // keep as local string "YYYY-MM-DDTHH:mm"
    mode: "in",
    room: "",
    area: "",
    notes: "",

    customerId: "",
    guest: false,
    guestName: "",
    guestPhone: "",

    therapistId: "",
    serviceId: "",
  });

  // open create modal when coming from Dashboard (+ New Appointment)
  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    if (qp.get("new") === "1") setOpenNew(true);
  }, [location.search]);

  const custMap = useMemo(
    () => Object.fromEntries((customers || []).map((c) => [String(c.id), c])),
    [customers]
  );
  const svcMap = useMemo(
    () => Object.fromEntries((services || []).map((s) => [String(s.id), s])),
    [services]
  );
  const staffMap = useMemo(
    () => Object.fromEntries((staff || []).map((u) => [String(u.id), u])),
    [staff]
  );

  /* -------- load -------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ap, c, s, t] = await Promise.all([
          fetch(`${API}/appointments`).then(okJson).catch(() => []),
          fetch(`${API}/customers`).then(okJson).catch(() => []),
          fetch(`${API}/services`).then(okJson).catch(() => []),
          fetch(`${API}/staff`).then(okJson).catch(() => []),
        ]);
        setList(Array.isArray(ap) ? ap : []);
        setCustomers(Array.isArray(c) ? c : []);
        setServices(Array.isArray(s) ? s : []);
        setStaff(Array.isArray(t) ? t : []);
        setErr("");
      } catch (_e) {
        setErr("Failed to load appointments.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function reload() {
    try {
      const ap = await fetch(`${API}/appointments`).then(okJson);
      setList(Array.isArray(ap) ? ap : []);
    } catch {}
  }

  /* -------- create -------- */
  async function createAppt() {
    try {
      setErr("");
      setSaving(true);

      const payload = {
        startAt: form.startAt, // keep local string exactly as entered

        // customer data
        customerId: !form.guest && form.customerId ? num(form.customerId) : undefined,
        customerName: form.guest
          ? (form.guestName || "")
          : (custMap[form.customerId]?.name || ""),
        customerPhone: form.guest
          ? (form.guestPhone || "")
          : (custMap[form.customerId]?.phone || ""),

        therapistId: num(form.therapistId) || undefined,
        therapist: staffMap[form.therapistId]?.name || "",
        serviceId: num(form.serviceId) || undefined,
        serviceName: svcMap[form.serviceId]?.name || "",

        mode: form.mode,
        room: form.mode === "in" ? form.room : "",
        area: form.mode === "out" ? form.area : "",
        notes: form.notes || "",
        status: "Booked",
      };

      if (!payload.startAt) throw new Error("Date & time is required.");
      if (!payload.customerName) throw new Error("Customer (or guest name) is required.");
      if (!payload.serviceId && !payload.serviceName) throw new Error("Service is required.");

      const r = await fetch(`${API}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      // reset and close
      setOpenNew(false);
      setForm({
        startAt: "",
        mode: "in",
        room: "",
        area: "",
        notes: "",
        customerId: "",
        guest: false,
        guestName: "",
        guestPhone: "",
        therapistId: "",
        serviceId: "",
      });
      setCustQuery("");
      await reload();
    } catch (e) {
      setErr(e.message || "Failed to create appointment.");
    } finally {
      setSaving(false);
    }
  }

  /* -------- actions -------- */
  async function startAppt(a) {
    try {
      const r = await fetch(`${API}/appointments/${a.id}/start`, { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      alert("Start failed");
      console.error(e);
    }
  }

  async function pauseAppt(a) {
    try {
      const r = await fetch(`${API}/appointments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paused" }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      alert("Pause failed");
    }
  }

  async function completeAppt(a) {
    try {
      const r = await fetch(`${API}/appointments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      alert("Complete failed");
    }
  }

  async function cancelAppt(a) {
    try {
      const r = await fetch(`${API}/appointments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      alert("Cancel failed");
    }
  }

  async function deleteAppt(a) {
    if (!confirm("Delete this appointment?")) return;
    try {
      const r = await fetch(`${API}/appointments/${a.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      alert("Delete failed");
    }
  }

  function openInvoiceFromAppt(a) {
    const qs = new URLSearchParams();
    if (a.id) qs.set("appointmentId", a.id);
    if (a.customerId) qs.set("customerId", a.customerId);
    if (a.therapistId) qs.set("therapistId", a.therapistId);
    if (a.serviceId) qs.set("serviceId", a.serviceId);
    if (a.mode) qs.set("mode", String(a.mode).toLowerCase());
    if (a.room) qs.set("room", a.room);
    if (!a.room && a.area) qs.set("area", a.area);
    if (a.serviceName) qs.set("serviceName", a.serviceName);
    nav(`/invoices/new?${qs.toString()}`);
  }

  /* -------- filter customers (search) -------- */
  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 30);
    return customers.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [customers, custQuery]);

  /* -------- create customer inline -------- */
  async function createCustomerInline() {
    try {
      if (!newCustomer.name) throw new Error("Name is required.");
      const r = await fetch(`${API}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomer.name, phone: newCustomer.phone || "" }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const created = await r.json();
      setCustomers((xs) => [...xs, created]);
      setForm((f) => ({ ...f, customerId: String(created.id), guest: false, guestName: "", guestPhone: "" }));
      setOpenNewCustomer(false);
      setNewCustomer({ name: "", phone: "" });
    } catch (e) {
      alert(e.message || "Failed to create customer");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Appointments</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={reload}>Refresh</button>
          <button onClick={() => setOpenNew(true)}>+ New Appointment</button>
          <Link to="/dashboard"><button className="secondary">Back to Dashboard</button></Link>
        </div>
      </header>

      {err ? <div style={alertErr}>{err}</div> : null}

      <section className="card">
        <h3 style={{ margin: 0, fontSize: 16, marginBottom: 6 }}>Upcoming &amp; past appointments</h3>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th style={{ width: 200 }}>Date &amp; Time</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Therapist</th>
              <th style={{ width: 90 }}>Room</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 460 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Loading…</td></tr>
            ) : list.length ? (
              list.map((a, i) => (
                <tr key={a.id || i}>
                  <td>{i + 1}</td>
                  <td>{fmt(a.startAt || a.datetime || a.date || a.time)}</td>
                  <td>{a.customerName || custMap[String(a.customerId)]?.name || "-"}</td>
                  <td>{a.serviceName || svcMap[String(a.serviceId)]?.name || "-"}</td>
                  <td>{a.therapist || staffMap[String(a.therapistId)]?.name || "-"}</td>
                  <td>{a.room || a.area || "-"}</td>
                  <td>{a.status || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => startAppt(a)}>Start</button>
                      <button className="secondary" onClick={() => pauseAppt(a)}>Pause</button>
                      <button className="secondary" onClick={() => completeAppt(a)}>Complete</button>
                      <button onClick={() => openInvoiceFromAppt(a)}>Invoice</button>
                      <button className="secondary" onClick={() => cancelAppt(a)}>Cancel</button>
                      <button className="danger" onClick={() => deleteAppt(a)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} style={{ color: "#6b7280" }}>No appointments.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* New Appointment modal */}
      {openNew && (
        <Modal title="New appointment" onClose={() => setOpenNew(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={lbl}>
              <span>Date & time</span>
              <input
                type="datetime-local"
                value={toLocalInput(form.startAt)}
                onChange={(e) => setForm((f) => ({ ...f, startAt: fromLocalInput(e.target.value) }))}
              />
            </label>

            {/* customer chooser with search + guest + add new */}
            <div className="card" style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.guest}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        guest: e.target.checked,
                        customerId: e.target.checked ? "" : f.customerId,
                        guestName: e.target.checked ? f.guestName : "",
                        guestPhone: e.target.checked ? f.guestPhone : "",
                      }))
                    }
                  />
                  Book for unregistered customer (Guest)
                </label>
                {!form.guest && (
                  <>
                    <input
                      placeholder="Search by name or phone…"
                      value={custQuery}
                      onChange={(e) => setCustQuery(e.target.value)}
                      style={{ flex: 1, height: 34, padding: "0 10px", border: "1px solid #ddd", borderRadius: 6 }}
                    />
                    <button className="secondary" onClick={() => setOpenNewCustomer(true)}>Add new customer</button>
                  </>
                )}
              </div>

              {!form.guest ? (
                <>
                  <div style={{ maxHeight: 160, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
                    {filteredCustomers.length ? (
                      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {filteredCustomers.map((c) => (
                          <li key={c.id}>
                            <button
                              className={`rowbtn ${String(form.customerId) === String(c.id) ? "active" : ""}`}
                              onClick={() => setForm((f) => ({ ...f, customerId: String(c.id) }))}
                            >
                              <span>{c.name}</span>
                              <small style={{ color: "#6b7280" }}>{c.phone || "-"}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ padding: 10, color: "#6b7280" }}>No matches. Try another search.</div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                    Selected: {form.customerId ? (custMap[form.customerId]?.name || `#${form.customerId}`) : "—"}
                  </div>
                </>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={lbl}>
                    <span>Guest name</span>
                    <input
                      value={form.guestName}
                      onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                    />
                  </label>
                  <label style={lbl}>
                    <span>Guest phone</span>
                    <input
                      value={form.guestPhone}
                      onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>

            <label style={lbl}>
              <span>Therapist</span>
              <select
                value={form.therapistId}
                onChange={(e) => setForm((f) => ({ ...f, therapistId: e.target.value }))}
              >
                <option value="">— Select —</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>

            <label style={lbl}>
              <span>Service</span>
              <select
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
              >
                <option value="">— Select —</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            <label style={lbl}>
              <span>Mode</span>
              <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
                <option value="in">In-Center</option>
                <option value="out">Out-Call</option>
              </select>
            </label>

            {form.mode === "in" ? (
              <label style={lbl}>
                <span>Room #</span>
                <input
                  value={form.room}
                  onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                />
              </label>
            ) : (
              <label style={lbl}>
                <span>Area</span>
                <input
                  value={form.area}
                  onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                />
              </label>
            )}

            <label style={lbl}>
              <span>Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
              <button className="secondary" onClick={() => setOpenNew(false)}>Close</button>
              <button onClick={createAppt} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* New customer quick modal */}
      {openNewCustomer && (
        <Modal title="Add new customer" onClose={() => setOpenNewCustomer(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={lbl}>
              <span>Name</span>
              <input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((x) => ({ ...x, name: e.target.value }))}
              />
            </label>
            <label style={lbl}>
              <span>Phone</span>
              <input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer((x) => ({ ...x, phone: e.target.value }))}
              />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
              <button className="secondary" onClick={() => setOpenNewCustomer(false)}>Cancel</button>
              <button onClick={createCustomerInline}>Save customer</button>
            </div>
          </div>
        </Modal>
      )}

      <style>{styles}</style>
    </div>
  );
}

/* UI helpers */
function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", display: "grid", placeItems: "center", zIndex: 50 }}
    >
      <div className="card" style={{ width: 680, padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* utils */
function okJson(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v){ const t = Date.parse(v||0); return Number.isFinite(t) ? new Date(t).toLocaleString() : ""; }

/* date helpers: keep local "YYYY-MM-DDTHH:mm" with no timezone shift */
function toLocalInput(val){
  if(!val) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d)) return "";
  const pad = (n)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(local){
  return local || "";
}

/* styles */
const lbl = { display: "grid", gap: 6, fontSize: 13 };
const alertErr = {
  background:"#fee2e2", color:"#991b1b", border:"1px solid #fecaca",
  borderRadius:8, padding:"8px 10px", marginBottom:10, fontSize:13
};
const styles = `
  .table { width:100%; border-collapse:collapse; }
  .table th,.table td{ padding:8px 6px; border-bottom:1px solid #eee; text-align:left; }
  .card { border:1px solid #eee; border-radius:10px; padding:12px; background:#fff; }
  button { height:34px; border:none; border-radius:8px; padding:0 12px; background:#2563eb; color:#fff; cursor:pointer; }
  button.secondary { background:#eef2ff; color:#1e3a8a; }
  button.danger { background:#ef4444; }
  .rowbtn{ width:100%; background:#fff; border:none; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
  .rowbtn:hover{ background:#f3f4f6; }
  .rowbtn.active{ background:#e0e7ff; }
`;