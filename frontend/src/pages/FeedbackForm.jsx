// frontend/src/pages/FeedbackForm.jsx
import apiFetch from "../../utils/apiFetch";

import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function FeedbackForm() {
  // query params: ?appointmentId=&customerId=&therapistId=&serviceId=
  const params = new URLSearchParams(window.location.search);
  const appointmentId = params.get("appointmentId") || "";
  const customerId = params.get("customerId") || "";
  const therapistId = params.get("therapistId") || "";
  const serviceId = params.get("serviceId") || "";

  const [meta, setMeta] = useState(null);     // session/customer/service names
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // load names (best-effort, safe if endpoint not found)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!appointmentId) return;
        const r = await fetch(`${API}/feedback/for-appointment/${appointmentId}`);
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (!ignore) setMeta(j);
      } catch {
        // ignore: optional enrichment
      }
    })();
    return () => { ignore = true; };
  }, [appointmentId]);

  const title = useMemo(() => {
    const c = meta?.customerName ? ` for ${meta.customerName}` : "";
    const s = meta?.serviceName ? ` – ${meta.serviceName}` : "";
    return `Rate your experience${c}${s}`;
  }, [meta]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!appointmentId || !customerId) {
      setErr("Missing appointmentId or customerId.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: Number(appointmentId),
          customerId: Number(customerId),
          therapistId: therapistId ? Number(therapistId) : undefined,
          serviceId: serviceId ? Number(serviceId) : undefined,
          rating: clampRating(rating),
          comment: comment.trim(),
          source: "link",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setDone(true);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Centered>
        <Card>
          <h2 style={{ margin: "6px 0 10px" }}>Thank you!</h2>
          <p style={{ color: "#374151", marginTop: 0 }}>
            Your feedback has been recorded.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href="/" className="btn">Back to Home</a>
          </div>
        </Card>
        <Styles />
      </Centered>
    );
  }

  return (
    <Centered>
      <Card>
        <h2 style={{ margin: "6px 0 10px" }}>{title}</h2>

        {/* context line */}
        <p style={{ marginTop: 0, color: "#6b7280", fontSize: 14 }}>
          {meta ? (
            <>
              {meta.serviceName || "Service"} with{" "}
              {meta.therapistName || "Therapist"} • {fmtDate(meta.start)}
            </>
          ) : (
            "Please rate your session."
          )}
        </p>

        {err ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: 6,
              padding: "8px 10px",
              marginBottom: 10,
              fontSize: 13,
            }}
          >
            {err}
          </div>
        ) : null}

        {/* Stars */}
        <div style={{ margin: "8px 0 10px" }}>
          <Stars
            value={rating}
            hover={hover}
            onHover={setHover}
            onChange={setRating}
          />
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            {labelFor(Math.max(hover || rating, 1))}
          </div>
        </div>

        {/* Comment */}
        <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 13, color: "#374151" }}>
            Any comments (optional)
          </span>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what went well or what could be improved…"
            style={{
              padding: 10,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              outline: "none",
            }}
          />
        </label>

        {/* Hidden required params to help support */}
        <input type="hidden" value={appointmentId} />
        <input type="hidden" value={customerId} />

        <div style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={busy} onClick={onSubmit}>
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </Card>
      <Styles />
    </Centered>
  );
}

/* ==== small UI pieces ==== */

function Stars({ value, hover, onHover, onChange }) {
  const v = Math.max(1, Math.min(5, hover || value || 1));
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 28, cursor: "pointer" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onMouseEnter={() => onHover(n)}
          onMouseLeave={() => onHover(0)}
          onClick={() => onChange(n)}
          title={labelFor(n)}
          style={{ lineHeight: 1 }}
        >
          <span style={{ color: n <= v ? "#f59e0b" : "#d1d5db" }}>★</span>
        </span>
      ))}
    </div>
  );
}

function Centered({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f8fafc",
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        width: "min(560px, 95vw)",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 18,
        boxShadow: "0 10px 30px rgba(0,0,0,.06)",
      }}
    >
      {children}
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .btn { height:38px; padding:0 12px; border-radius:8px; border:1px solid #d1d5db; background:#fff; cursor:pointer; }
      .btn.primary { background:#2563eb; color:#fff; border-color:#2563eb; }
      .btn:disabled { opacity:.6; cursor:not-allowed; }
    `}</style>
  );
}

/* ==== helpers ==== */

function clampRating(v) {
  const n = Math.round(Number(v) || 0);
  return Math.max(1, Math.min(5, n));
}
function labelFor(n) {
  return (
    {
      1: "Very bad",
      2: "Bad",
      3: "Okay",
      4: "Good",
      5: "Excellent",
    }[n] || ""
  );
}
function fmtDate(v) {
  const t = Date.parse(v || 0);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : "-";
}