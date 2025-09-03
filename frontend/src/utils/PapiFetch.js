const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default async function apiFetch(path, opts = {}) {
  let finalPath = path || "";

  // Check if path is an absolute URL
  const isAbsolute = /^https?:\/\//i.test(finalPath);

  if (!isAbsolute) {
    if (!finalPath.startsWith("/")) finalPath = "/" + finalPath;
    if (!finalPath.startsWith("/api/")) finalPath = "/api" + finalPath;
    finalPath = `${API}${finalPath}`;
  }

  const token = localStorage.getItem("token");
  const headers = {
    ...(opts.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(finalPath, { ...opts, headers });
  return res;
}
