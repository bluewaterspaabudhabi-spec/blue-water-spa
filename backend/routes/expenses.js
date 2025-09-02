// backend/routes/expenses.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "expenses.json");

/* ------------ storage helpers ------------ */
function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]", "utf8");
}
function readAll() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8") || "[]");
  } catch {
    return [];
  }
}
function writeAll(list) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), "utf8");
}
function nextId(xs) {
  return xs.length ? Math.max(...xs.map((x) => Number(x.id) || 0)) + 1 : 1;
}
const nowIso = () => new Date().toISOString();

/* ------------ normalize one expense ------------ */
function normalizeExpense(input = {}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) return null;

  // allow various field aliases coming from CSV mapper (already normalized in FE)
  const e = {
    date: input.date || input.txnDate || input.transactionDate || "",
    vendor: (input.vendor || input.payee || input.supplier || "").trim(),
    description: (input.description || input.memo || "").trim(),
    method: (input.method || input.paymentMethod || "").trim(),
    invoice: (input.invoice || input.reference || "").trim(),
    amount,
  };

  // empty strings -> undefined to keep file tidy
  if (!e.date) delete e.date;
  if (!e.vendor) delete e.vendor;
  if (!e.description) delete e.description;
  if (!e.method) delete e.method;
  if (!e.invoice) delete e.invoice;

  return e;
}

/* ------------ routes ------------ */

// GET /api/expenses
router.get("/", (_req, res) => {
  const xs = readAll();
  xs.sort((a, b) => {
    const ta = Date.parse(a.date || a.createdAt || 0) || 0;
    const tb = Date.parse(b.date || b.createdAt || 0) || 0;
    return tb - ta; // newest first
  });
  res.json(xs);
});

// POST /api/expenses  (create one)
router.post("/", (req, res) => {
  const list = readAll();
  const base = normalizeExpense(req.body || {});
  if (!base) return res.status(400).json({ error: "invalid_amount" });

  const item = {
    id: nextId(list),
    ...base,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  list.push(item);
  writeAll(list);
  res.status(201).json(item);
});

// POST /api/expenses/bulk  (create many)
router.post("/bulk", (req, res) => {
  const list = readAll();
  const rows = Array.isArray(req.body?.items) ? req.body.items : [];
  const added = [];

  for (const raw of rows) {
    const base = normalizeExpense(raw);
    if (!base) continue;
    const item = {
      id: nextId(list.concat(added)),
      ...base,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    added.push(item);
  }

  if (!added.length) return res.status(400).json({ error: "no_valid_rows" });

  const out = list.concat(added);
  writeAll(out);
  res.json({ ok: true, added: added.length, total: out.length });
});

// DELETE /api/expenses/:id
router.delete("/:id", (req, res) => {
  const id = String(req.params.id);
  const list = readAll();
  const i = list.findIndex((x) => String(x.id) === id);
  if (i === -1) return res.status(404).json({ error: "expense_not_found" });
  const removed = list.splice(i, 1)[0];
  writeAll(list);
  res.json({ ok: true, removed });
});

module.exports = router;