// backend/routes/settings.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// paths
const dataDir = path.join(__dirname, "..", "data");
const filePath = path.join(dataDir, "settings.json");

// default settings (first-time boot)
const DEFAULT_SETTINGS = {
  spaName: "Blue Water Spa",
  logo: "",                  // URL or base64 (optional)
  phone: "0900-000000",
  email: "info@bluewater.com",
  address: "Khartoum, Sudan",
  currency: "USD",
  taxRate: 10,               // %
  paymentMethods: ["Cash", "Card", "Transfer"],
  users: [
    { username: "admin", password: "1234", role: "manager" },
    { username: "staff", password: "1234", role: "staff" }
  ]
};

// ensure data dir & file exist
function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
  }
}

function readSettings() {
  ensureStore();
  const raw = fs.readFileSync(filePath, "utf8") || "{}";
  try { return JSON.parse(raw); } catch { return { ...DEFAULT_SETTINGS }; }
}

function writeSettings(obj) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

// GET /api/settings
router.get("/", (_req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// PUT /api/settings  (replace/merge simple)
router.put("/", (req, res) => {
  const current = readSettings();
  const body = req.body || {};

  // simple validation
  if (body.taxRate !== undefined) {
    const n = Number(body.taxRate);
    if (Number.isNaN(n) || n < 0) return res.status(400).json({ ok:false, message:"taxRate must be >= 0" });
  }
  if (body.currency !== undefined && typeof body.currency !== "string") {
    return res.status(400).json({ ok:false, message:"currency must be string" });
  }

  const next = {
    ...current,
    ...body,
    // arrays: if provided, replace entirely
    paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods : current.paymentMethods,
    users: Array.isArray(body.users) ? body.users : current.users
  };

  writeSettings(next);
  res.json(next);
});

module.exports = router;
