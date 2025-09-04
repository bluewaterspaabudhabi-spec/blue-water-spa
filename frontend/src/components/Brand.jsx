// frontend/src/components/Brand.jsx
import { useEffect, useState } from "react";
import apiFetch from "../utils/apiFetch";
export default function Brand() {
  const [s, setS] = useState(null);

  useEffect(() => {
    apiFetch('/settings')
      .then(r => (r.ok ? r.json() : {}))
      .then(setS)
      .catch(() => setS({}));
  }, []);

  const name = s?.businessName || "Blue";
  const logo = s?.logoUrl || "/logo.png";

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, fontWeight:700 }}>
      <img src={logo} alt="logo" style={{ width:24, height:24, objectFit:"contain" }} />
      <span>{name}</span>
    </div>
  );
}