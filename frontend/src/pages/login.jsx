// frontend/src/pages/Login.jsx
import apiFetch from "../utils/apiFetch";

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://apiFetch(/api";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@example.com"); // you can clear defaults
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await r.json();
      } catch {
        data = null;
      }

      if (!r.ok) {
        const msg =
          (data && (data.message || data.error)) || `HTTP ${r.status}`;
        throw new Error(msg);
      }

      // expected: { id, name, email, role, token }
      const token = data?.token || "";
      const user = {
        id: data?.id,
        name: data?.name,
        email: data?.email,
        role: data?.role, // "admin" | "supervisor" | "staff" | etc.
      };

      localStorage.setItem("authToken", token);
      localStorage.setItem("authUser", JSON.stringify(user));

      // navigate after login (keep as settings to avoid breaking flows)
nav("/dashboard", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={onSubmit} style={styles.card}>
        <h2 style={{ margin: 0, marginBottom: 10 }}>Sign in</h2>
        {err ? <div style={styles.err}>{err}</div> : null}

        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button disabled={loading} style={styles.primaryBtn}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          API: <code>{API}</code>
        </div>

        <div style={{ marginTop: 14 }}>
          <Link to="/" style={{ fontSize: 13 }}>← Back</Link>
        </div>
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f8fafc",
    padding: 16,
  },
  card: {
    width: 360,
    display: "grid",
    gap: 8,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 18,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
  },
  label: { fontSize: 13, color: "#374151" },
  input: {
    height: 36,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "0 10px",
    outline: "none",
  },
  primaryBtn: {
    marginTop: 6,
    height: 38,
    border: "none",
    borderRadius: 6,
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  err: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
  },
};