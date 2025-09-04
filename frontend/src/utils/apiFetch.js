const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default async function apiFetch(path, opts = {}) {
  let p = path || "";
  const abs = /^https?:\/\//i.test(p);
  if (!abs) {
    if (!p.startsWith("/")) p = "/" + p;
    if (!p.startsWith("/api/")) p = "/api" + p;
    p = `${API}${p}`;
  }
  const token = localStorage.getItem("token");
  const headers = {
    ...(opts.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(p, { ...opts, headers });
}