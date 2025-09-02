const API = import.meta.env.VITE_API_URL || "http://localhost:3000";


export async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    ...(opts.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  return res;
}