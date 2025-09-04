import apiFetch from "../utils/apiFetch";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function Dashboard() {
  const nav = useNavigate();

  // lookups
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  // data
  const [sessions, setSessions] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // multi-aspect rating
  const [ratingModal, setRatingModal] = useState({
    open: false,
    session: null,
    serviceRating: 0,
    roomRating: 0,
    receptionRating: 0,
    comment: "",
  });

  // QR modal
  const [rateModal, setRateModal] = useState({ open: false, url: "" });

  // maps
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

  /* ---------- load ---------- */
  useEffect(() => { reloadAll(); }, []);
  async function reloadAll() {
    try {
      setLoading(true);
      const [c, s, t, sess] = await Promise.all([
        fetch(`${API}/customers`).then(okJson).catch(() => []),
        fetch(`${API}/services`).then(okJson).catch(() => []),
        fetch(`${API}/staff`).then(okJson).catch(() => []),
        fetch(`${API}/sessions`).then(okJson).catch(() => []),
      ]);
      setCustomers(Array.isArray(c) ? c : []);
      setServices(Array.isArray(s) ? s : []);
      setStaff(Array.isArray(t) ? t : []);
      setSessions(Array.isArray(sess) ? sess : []);
      setErr("");
    } catch (e) {
      console.error(e);
      setErr("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // poll every 30s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const xs = await fetch(`${API}/sessions`).then(okJson);
        setSessions(Array.isArray(xs) ? xs : []);
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, []);

  /* ---------- derived ---------- */
  const live = useMemo(() => {
    const list = (sessions || []).filter((s) => {
      const st = norm(s.status || s.state);
      if (["completed", "complete", "cancelled", "canceled", "deleted"].includes(st)) return false;
      const start = Date.parse(s.startAt || s.startedAt || s.start || "");
      return Number.isFinite(start) ? Date.now() - start < 6 * 60 * 60 * 1000 : true;
    });
    list.sort((a, b) => byTimeLeft(a) - byTimeLeft(b));
    return list;
  }, [sessions]);

  /* ---------- actions ---------- */
  async function patchSessionGeneric(id, patch) {
    const base = `${API}/sessions/${id}`;
    try {
      let r;
      if (patch.action === "complete") {
        r = await fetch(`${base}/complete`, { method: "POST", headers: { "Content-Type": "application/json" } });
      } else if (patch.action === "pause") {
        r = await fetch(`${base}/pause`, { method: "POST" });
      } else if (patch.action === "extend") {
        r = await fetch(`${base}/extend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: patch.minutes || 10 }),
        });
      } else {
        r = await fetch(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const updated = await r.json().catch(() => null);
      if (updated) setSessions((xs) => xs.map((s) => (String(s.id) === String(id) ? updated : s)));
      return true;
    } catch (e) {
      console.error("patchSession failed:", e);
      alert("Action failed");
      return false;
    }
  }
  const extend10 = (s) => patchSessionGeneric(s.id, { action: "extend", minutes: 10 });
  const pauseSession = (s) => patchSessionGeneric(s.id, { action: "pause" });
  const completeSession = (s) => patchSessionGeneric(s.id, { action: "complete" });

  async function startSessionFromAppt(apptId) {
    try {
      const r = await fetch(`${API}/appointments/${apptId}/start`, { method: "POST" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const xs = await fetch(`${API}/sessions`).then(okJson);
      setSessions(Array.isArray(xs) ? xs : []);
    } catch (e) {
      console.error(e);
      alert("Start failed");
    }
  }

  function openInvoiceForSession(s) {
    const qs = new URLSearchParams();
    if (s.id) qs.set("appointmentId", s.id);
    if (s.customerId) qs.set("customerId", s.customerId);
    if (s.therapistId) qs.set("therapistId", s.therapistId);
    const sid = s.serviceId || s.service_id;
    if (sid) qs.set("serviceId", sid);
    const svcName = s.serviceName || s.service || s.service_name;
    if (svcName) qs.set("serviceName", String(svcName));
    const room = s.room || s.roomNumber || "";
    const area = s.area || s.locationArea || "";
    let mode = s.mode || s.type || "";
    mode = String(mode || (room ? "in" : area ? "out" : "")).toLowerCase();
    if (mode === "in" || mode === "out") qs.set("mode", mode);
    if (room) qs.set("room", room);
    if (!room && area) qs.set("area", area);
    nav(`/invoices/new?${qs.toString()}`);
  }

  // rating modal
  function openRateModal(s) {
    setRatingModal({
      open: true,
      session: s,
      serviceRating: 0,
      roomRating: 0,
      receptionRating: 0,
      comment: "",
    });
  }
  function closeRateModal() {
    setRatingModal({
      open: false,
      session: null,
      serviceRating: 0,
      roomRating: 0,
      receptionRating: 0,
      comment: "",
    });
  }
  async function submitRating() {
    try {
      const s = ratingModal.session || {};
      const payload = {
        sessionId: Number(s.id) || null,
        appointmentId: Number(s.appointmentId) || null,
        customerId: Number(s.customerId) || null,
        therapistId: Number(s.therapistId || s.staffId) || null,
        serviceRating: Number(ratingModal.serviceRating) || 0,
        roomRating: Number(ratingModal.roomRating) || 0,
        receptionRating: Number(ratingModal.receptionRating) || 0,
        comment: ratingModal.comment || "",
      };
      const r = await fetch(`${API}/feedback/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      await r.json().catch(() => ({}));
      alert("Thanks! feedback saved.");
      closeRateModal();
    } catch (e) {
      console.error(e);
      alert("Failed to submit rating");
    }
  }

  // QR helpers (inside component to access setRateModal)
  function buildRateUrl(s) {
    const origin = window.location.origin;
    const qp = new URLSearchParams();
    if (s.appointmentId) qp.set("appointmentId", s.appointmentId);
    if (s.customerId) qp.set("customerId", s.customerId);
    if (s.therapistId) qp.set("therapistId", s.therapistId);
    if (s.room) qp.set("room", s.room);
    if (s.serviceName) qp.set("serviceName", s.serviceName);
    return `${origin}/rate?${qp.toString()}`;
  }
  function openQrForSession(s) {
    const url = buildRateUrl(s);
    setRateModal({ open: true, url });
  }
  function closeQr() {
    setRateModal({ open: false, url: "" });
  }

  /* ---------- render ---------- */
  return (
    <div style={{ padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Welcome</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={reloadAll}>Refresh</button>
          {/* open modal in appointments via ?new=1 */}
          <button onClick={() => nav("/appointments?new=1")}>+ New Appointment</button>
          <Link to="/invoices/new"><button className="secondary">+ New Invoice</button></Link>
          <Link to="/appointments"><button className="secondary">View Appointments</button></Link>
          <Link to="/customers"><button className="secondary">Add Customer</button></Link>
        </div>
      </header>

      {err ? <div style={alertErr}>{err}</div> : null}

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Live Sessions</h3>
          <small style={{ color: "#6b7280" }}>Auto refresh 30s</small>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th style={{ width: 100 }}>Room</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Therapist</th>
              <th style={{ width: 160 }}>Start</th>
              <th style={{ width: 160 }}>End</th>
              <th style={{ width: 220 }}>Time Left / Progress</th>
              <th style={{ width: 420 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>Loading…</td></tr>
            ) : live.length ? (
              live.map((s, i) => {
                const cid = String(s.customerId || "");
                const tid = String(s.therapistId || s.staffId || "");
                const sid = String(s.serviceId || "");

                const startMs = Date.parse(s.startAt || s.startedAt || s.start || "");
                const endMs =
                  Number.isFinite(Date.parse(s.endAt || s.endsAt || "")) ?
                    Date.parse(s.endAt || s.endsAt || "") :
                    (Number.isFinite(startMs) ? startMs + (guessMinutes(s) || 60) * 60000 : NaN);

                const startTxt = Number.isFinite(startMs) ? new Date(startMs).toLocaleString() : "-";
                const endTxt = Number.isFinite(endMs) ? new Date(endMs).toLocaleString() : "-";

                const tl = timeLeftPct({ ...s, startAt: new Date(startMs || Date.now()).toISOString(), endAt: Number.isFinite(endMs) ? new Date(endMs).toISOString() : undefined });
                const canStart = s.appointmentId && (norm(s.status) !== "running");

                return (
                  <tr key={s.id || i}>
                    <td>{i + 1}</td>
                    <td>{s.room || s.roomNumber || "-"}</td>
                    <td>{s.customerName || custMap[cid]?.name || "-"}</td>
                    <td>{s.serviceName || svcMap[sid]?.name || s.service || "-"}</td>
                    <td>{s.therapist || staffMap[tid]?.name || "-"}</td>
                    <td>{startTxt}</td>
                    <td>{endTxt}</td>
                    <td><ProgressBar pct={tl.pct} text={tl.leftText} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canStart && <button onClick={() => startSessionFromAppt(s.appointmentId)}>Start</button>}
                        <button className="secondary" onClick={() => window.print()}>Print</button>
                        <button className="secondary" onClick={() => extend10(s)}>+10m</button>
                        <button className="secondary" onClick={() => pauseSession(s)}>Pause</button>
                        <button className="secondary" onClick={() => completeSession(s)}>Complete</button>
                        <button onClick={() => openInvoiceForSession(s)}>Invoice</button>
                        <button onClick={() => openRateModal(s)}>Rate</button>
                        <button className="secondary" onClick={() => openQrForSession(s)}>QR</button>
                        <a href={buildRateUrl(s)} target="_blank" rel="noreferrer">
                          <button className="secondary">Open link</button>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={9} style={{ color: "#6b7280" }}>No live sessions.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Rating Modal */}
      {ratingModal.open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", display: "grid", placeItems: "center", zIndex: 50 }}
          onClick={closeRateModal}
        >
          <div className="card" style={{ width: 420, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Rate session</h3>
              <button className="secondary" onClick={closeRateModal}>Close</button>
            </div>

            <StarRow label="Service" value={ratingModal.serviceRating} onChange={(v) => setRatingModal(m => ({ ...m, serviceRating: v }))} />
            <StarRow label="Room" value={ratingModal.roomRating} onChange={(v) => setRatingModal(m => ({ ...m, roomRating: v }))} />
            <StarRow label="Reception" value={ratingModal.receptionRating} onChange={(v) => setRatingModal(m => ({ ...m, receptionRating: v }))} />

            <textarea
              rows={3}
              placeholder="Optional comment…"
              value={ratingModal.comment}
              onChange={(e) => setRatingModal(m => ({ ...m, comment: e.target.value }))}
              style={{ width: "100%", marginTop: 10, marginBottom: 10 }}
            />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="secondary" onClick={closeRateModal}>Cancel</button>
              <button
                onClick={submitRating}
                disabled={!(ratingModal.serviceRating || ratingModal.roomRating || ratingModal.receptionRating)}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {rateModal.open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", display: "grid", placeItems: "center", zIndex: 50 }}
          onClick={closeQr}
        >
          <div className="card" style={{ width: 380, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Customer Rating Link</h3>
              <button className="secondary" onClick={closeQr}>Close</button>
            </div>
            <div style={{ display: "grid", placeItems: "center", gap: 8 }}>
              <img
                alt="QR"
                width={220}
                height={220}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(rateModal.url)}`}
              />
              <div style={{ fontSize: 12, wordBreak: "break-all", color: "#374151" }}>{rateModal.url}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="secondary" onClick={() => copyToClipboard(rateModal.url)}>Copy link</button>
                <a href={rateModal.url} target="_blank" rel="noreferrer"><button>Open link</button></a>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

/* components */
function StarRow({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
      <div style={{ width: 90, color: "#111827" }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className="secondary"
            style={{ width: 36, height: 36, borderRadius: 8, background: n <= (value || 0) ? "#ffd166" : "#eef2ff", color: "#111" }}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
function ProgressBar({ pct, text }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div style={{ position: "relative", height: 10, background: "#eef2ff", borderRadius: 10, overflow: "hidden" }} title={text}>
      <div style={{ position: "absolute", inset: 0, width: `${v}%`, background: "#3b82f6" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#111827" }}>
        {text}
      </div>
    </div>
  );
}

/* helpers */
function okJson(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
function norm(v){ return String(v || "").toLowerCase().replace(/\s|_/g, "-"); }
function guessMinutes(s){
  return Number(s.durationMinutes) || Number(s.duration) || Number(s.minutes) || Number(s.estimatedMinutes) || 60;
}
function timeLeftPct(s){
  const now = Date.now();
  const start = Date.parse(s.startAt || s.startedAt || s.start || "");
  const endRaw = Number.isFinite(Date.parse(s.endAt || s.endsAt || "")) ? Date.parse(s.endAt || s.endsAt) :
                 (Number.isFinite(start) ? start + (guessMinutes(s) || 60) * 60000 : NaN);
  if (!Number.isFinite(start) || !Number.isFinite(endRaw)) return { leftMs: 0, pct: 0, leftText: "0m" };
  const total = Math.max(1, endRaw - start);
  const leftMs = Math.max(0, endRaw - now);
  const pct = Math.max(0, Math.min(100, Math.round(((now - start) / total) * 100)));
  const leftText = `${Math.ceil(leftMs / 60000)}m`;
  return { leftMs, pct, leftText };
}
function byTimeLeft(s){ return timeLeftPct(s).leftMs; }
async function copyToClipboard(text){ try{ await navigator.clipboard.writeText(text); alert("Copied!"); } catch{ alert("Copy failed"); } }

/* styles */
const alertErr = { background:"#fee2e2", color:"#991b1b", border:"1px solid #fecaca", borderRadius:8, padding:"8px 10px", marginBottom:10, fontSize:13 };
const styles = `
  .table { width:100%; border-collapse:collapse; }
  .table th, .table td { padding:8px 6px; border-bottom:1px solid #eee; text-align:left; }
  .card { border:1px solid #eee; border-radius:10px; padding:12px; background:#fff; }
  .secondary { background:#eef2ff; color:#1e3a8a; }
  button { height:34px; border:none; border-radius:8px; padding:0 12px; background:#2563eb; color:#fff; cursor:pointer; }
  button.secondary { background:#eef2ff; color:#1e3a8a; }
`;