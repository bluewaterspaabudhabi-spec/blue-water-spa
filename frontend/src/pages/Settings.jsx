// frontend/src/pages/Settings.jsx
import React, { useEffect, useState } from "react";
import apiFetch from "../utils/apiFetch";

export default function Settings() {
  const [settings, setSettings] = useState({
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
    defaultPrintMode: "Thermal (narrow)",
    defaultTaxRate: 0,
    invoiceFooter: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        setError("");
        const res = await apiFetch("/settings", { method: "GET" });
        if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      } catch (err) {
        console.error(err);
        setError("Error: HTTP 404 settings");
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    try {
      setLoading(true);
      setError("");
      const res = await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`Failed to save settings (${res.status})`);
      alert("✅ Settings saved successfully!");
    } catch (err) {
      console.error(err);
      setError("Error: Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <div className="settings-page" style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2>Settings</h2>
      {error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}

      <div className="form" style={{ display: "grid", gap: 10 }}>
        <input
          type="text"
          name="businessName"
          placeholder="Business Name"
          value={settings.businessName}
          onChange={handleChange}
        />
        <input
          type="text"
          name="phone"
          placeholder="Phone"
          value={settings.phone}
          onChange={handleChange}
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={settings.email}
          onChange={handleChange}
        />
        <input
          type="text"
          name="whatsapp"
          placeholder="WhatsApp"
          value={settings.whatsapp}
          onChange={handleChange}
        />
        <input
          type="text"
          name="facebook"
          placeholder="Facebook"
          value={settings.facebook}
          onChange={handleChange}
        />
        <input
          type="text"
          name="instagram"
          placeholder="Instagram"
          value={settings.instagram}
          onChange={handleChange}
        />
        <input
          type="text"
          name="website"
          placeholder="Website"
          value={settings.website}
          onChange={handleChange}
        />
        <input
          type="text"
          name="address"
          placeholder="Address"
          value={settings.address}
          onChange={handleChange}
        />
        <input
          type="text"
          name="logoUrl"
          placeholder="Logo URL"
          value={settings.logoUrl}
          onChange={handleChange}
        />

        <label style={{ marginTop: 10, fontWeight: 600 }}>Default currency</label>
        <select
          name="defaultCurrency"
          value={settings.defaultCurrency}
          onChange={handleChange}
        >
          <option value="AED">AED</option>
          <option value="USD">USD</option>
          <option value="SAR">SAR</option>
        </select>

        <label style={{ marginTop: 10, fontWeight: 600 }}>Default print mode</label>
        <select
          name="defaultPrintMode"
          value={settings.defaultPrintMode}
          onChange={handleChange}
        >
          <option value="Thermal (narrow)">Thermal (narrow)</option>
          <option value="Thermal (wide)">Thermal (wide)</option>
          <option value="A4">A4</option>
        </select>

        <input
          type="number"
          name="defaultTaxRate"
          placeholder="Default Tax Rate %"
          value={settings.defaultTaxRate}
          onChange={handleChange}
          min="0"
          step="0.01"
        />

        <textarea
          name="invoiceFooter"
          placeholder="Invoice footer"
          value={settings.invoiceFooter}
          onChange={handleChange}
          rows={4}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: "#eee" }}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}