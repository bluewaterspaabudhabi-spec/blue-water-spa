// backend/routes/users.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// settings.json هو المصدر الرسمي للمستخدمين
const dataDir = path.join(__dirname, "..", "data");
const settingsFile = path.join(dataDir, "settings.json");

// تأكد من وجود المجلد/الملف
function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(settingsFile)) {
    const defaultSettings = {
      spaName: "Blue Water Spa",
      logo: "",
      phone: "0900-000000",
      email: "info@domain.com",
      address: "City, Country",
      currency: "USD",
      taxRate: 0,
      paymentMethods: ["Cash", "Card", "Transfer"],
      users: [
        { username: "admin", password: "1234", role: "manager" },
        { username: "staff", password: "1234", role: "staff" },
      ],
    };
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2));
  }
}

function readSettings() {
  ensureStore();
  const raw = fs.readFileSync(settingsFile, "utf8") || "{}";
  return JSON.parse(raw);
}

function writeSettings(obj) {
  fs.writeFileSync(settingsFile, JSON.stringify(obj, null, 2));
}

// GET /api/users -> قائمة المستخدمين
router.get("/", (req, res) => {
  try {
    const s = readSettings();
    res.json(s.users || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_read_users" });
  }
});

// POST /api/users -> إضافة مستخدم
router.post("/", (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password || !role) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const s = readSettings();
    s.users = Array.isArray(s.users) ? s.users : [];

    if (s.users.find(u => u.username === username)) {
      return res.status(409).json({ error: "username_exists" });
    }

    s.users.push({ username, password, role });
    writeSettings(s);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_add_user" });
  }
});

// PUT /api/users/:username -> تعديل مستخدم
router.put("/:username", (req, res) => {
  try {
    const current = req.params.username;
    const { username, password, role } = req.body || {};
    const s = readSettings();
    s.users = Array.isArray(s.users) ? s.users : [];

    const idx = s.users.findIndex(u => u.username === current);
    if (idx === -1) return res.status(404).json({ error: "user_not_found" });

    // منع تكرار اسم مستخدم جديد
    if (username && username !== current && s.users.find(u => u.username === username)) {
      return res.status(409).json({ error: "username_exists" });
    }

    s.users[idx] = {
      username: username || s.users[idx].username,
      password: password || s.users[idx].password,
      role: role || s.users[idx].role,
    };

    writeSettings(s);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_update_user" });
  }
});

// DELETE /api/users/:username -> حذف مستخدم
router.delete("/:username", (req, res) => {
  try {
    const uname = req.params.username;
    const s = readSettings();
    s.users = Array.isArray(s.users) ? s.users : [];

    const before = s.users.length;
    s.users = s.users.filter(u => u.username !== uname);

    if (s.users.length === before) {
      return res.status(404).json({ error: "user_not_found" });
    }

    writeSettings(s);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_delete_user" });
  }
});

module.exports = router;