// frontend/src/pages/RateKiosk.jsx
import apiFetch from "..../utils/apiFetch.js.js.js";

import { useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function RateKiosk() {
  // read query params (session/customer/etc.)
  const qp = new URLSearchParams(location.search);
  const initial = useMemo(
    () => ({
      sessionId: num(qp.get("sessionId")),
      appointmentId: num(qp.get("appointmentId")),
      customerId: num(qp.get("customerId")),
      therapistId: num(qp.get("therapistId")),
      room: qp.get("room") || "",
      svc: qp.get("serviceName") || qp.get("service") || "",
      custName: qp.get("customerName") || "",
    }),
    [location.search]
  );

  // 3-aspect ratings
  const [serviceRating, setServiceRating] = useState(0);
  const [roomRating, setRoomRating] = useState(0);
  const [receptionRating, setReceptionRating] = useState(0);
  const [comment, setComment] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const ready = serviceRating || roomRating || receptionRating;

  async function submit() {
    try {
      setSubmitting(true);
      const payload = {
        sessionId: initial.sessionId,
        appointmentId: initial.appointmentId,
        customerId: initial.customerId,
        therapistId: initial.therapistId,
        serviceRating,
        roomRating,
        receptionRating,
        comment,
        source: "kiosk",
      };
      const r = await fetch(`${API}/feedback/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // show thank you screen and do NOT re-open the form
      setDone(true);

      // optional: after 8s clear the form (stays on thank you)
      setTimeout(() => {
        setServiceRating(0);
        setRoomRating(0);
        setReceptionRating(0);
        setComment("");
      }, 8000);
    } catch (e) {
      console.error(e);
      alert("Failed to submit. Please call the receptionist.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Center>
        <div className="card" style={{ width: 520, padding: 20, textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Thank you!</h2>
          <p>Your feedback has been recorded.</p>
          <p style={{ color: "#6b7280" }}>
            You may hand the device back to the receptionist.
          </p>
        </div>
        <Styles />
      </Center>
    );
  }

  return (
    <Center>
      <div className="card" style={{ width: 520, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Please rate your session</h2>
        <div style={{ color: "#6b7280", marginBottom: 10 }}>
          {initial.custName ? <b>{initial.custName}</b> : null}
          {initial.custName ? " · " : null}
          {initial.svc ? `Service: ${initial.svc}` : ""}
          {initial.room ? ` · Room: ${initial.room}` : ""}
        </div>

        <StarRow label="Therapist / Service" value={serviceRating} onChange={setServiceRating} />
        <StarRow label="Room" value={roomRating} onChange={setRoomRating} />
        <StarRow label="Reception" value={receptionRating} onChange={setReceptionRating} />

        <textarea
          rows={3}
          placeholder="Optional comment…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ width: "100%", marginTop: 10, marginBottom: 10 }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="secondary"
            onClick={() => {
              setServiceRating(0);
              setRoomRating(0);
              setReceptionRating(0);
              setComment("");
            }}
            disabled={submitting}
          >
            Clear
          </button>
          <button onClick={submit} disabled={!ready || submitting}>
            {submitting ? "Sending…" : "Submit rating"}
          </button>
        </div>
      </div>
      <Styles />
    </Center>
  );
}

function StarRow({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
      <div style={{ width: 160, color: "#111827" }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className="secondary"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: n <= (value || 0) ? "#ffd166" : "#eef2ff",
              color: "#111",
              fontSize: 18,
            }}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function Center({ children }) {
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

function Styles() {
  return (
    <style>{`
      .card { border:1px solid #eee; border-radius:10px; background:#fff; }
      .secondary { background:#eef2ff; color:#1e3a8a; }
      button { height:38px; border:none; border-radius:8px; padding:0 14px; background:#2563eb; color:#fff; cursor:pointer; }
      button.secondary { background:#eef2ff; color:#1e3a8a; }
      textarea { border:1px solid #e5e7eb; border-radius:8px; padding:8px; outline:none; }
      textarea:focus { border-color:#2563eb; }
    `}</style>
  );
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}