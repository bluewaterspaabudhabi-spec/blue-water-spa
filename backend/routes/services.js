// backend/routes/services.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// simple file store
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "services.json");

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]", "utf8");
}
function readAll() {
  ensureStore();
  try {
    const arr = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveAll(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), "utf8");
}

// GET /api/services  -> always return an array
router.get("/", (req, res) => {
  res.json(readAll());
});

// POST /api/services
router.post("/", (req, res) => {
  const { name = "", price = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: "name_required" });
  const rows = readAll();
  const id = rows.length ? Math.max(...rows.map(r => Number(r.id) || 0)) + 1 : 1;
  const item = { id, name, price: Number(price) || 0 };
  rows.push(item);
  saveAll(rows);
  res.status(201).json(item);
});

// PUT /api/services/:id
router.put("/:id", (req, res) => {
  const id = String(req.params.id);
  const rows = readAll();
  const i = rows.findIndex(r => String(r.id) === id);
  if (i === -1) return res.status(404).json({ error: "not_found" });
  const { name, price } = req.body || {};
  rows[i] = {
    ...rows[i],
    ...(name != null ? { name } : {}),
    ...(price != null ? { price: Number(price) || 0 } : {}),
  };
  saveAll(rows);
  res.json(rows[i]);
});

// DELETE /api/services/:id
router.delete("/:id", (req, res) => {
  const id = String(req.params.id);
  const rows = readAll();
  const i = rows.findIndex(r => String(r.id) === id);
  if (i === -1) return res.status(404).json({ error: "not_found" });
  const [removed] = rows.splice(i, 1);
  saveAll(rows);
  res.json(removed);
});

module.exports = router;