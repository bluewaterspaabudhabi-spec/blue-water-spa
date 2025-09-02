// backend/routes/reports.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const dataDir = path.join(__dirname, "..", "data");
const invoicesFile = path.join(dataDir, "invoices.json");
const customersFile = path.join(dataDir, "customers.json");

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8") || "[]");
  } catch {
    return [];
  }
}

// GET /api/reports/customers
router.get("/customers", (req, res) => {
  const invoices = readJSON(invoicesFile);
  const customers = readJSON(customersFile);

  // map customer id to stats
  const stats = {};
  invoices.forEach((inv) => {
    const id = inv.customerId || null;
    if (!id) return;
    if (!stats[id]) {
      stats[id] = { visits: 0, total: 0, lastVisit: null };
    }
    stats[id].visits += 1;
    stats[id].total += Number(inv.total || 0);
    const d = new Date(inv.date || inv.createdAt || Date.now());
    if (!stats[id].lastVisit || new Date(stats[id].lastVisit) < d) {
      stats[id].lastVisit = d.toISOString();
    }
  });

  // combine with customer names
  const result = customers.map((c) => ({
    id: c.id,
    name: c.name,
    visits: stats[c.id]?.visits || 0,
    total: stats[c.id]?.total || 0,
    lastVisit: stats[c.id]?.lastVisit || null,
    avg: (stats[c.id]?.visits || 0) > 0 ? (stats[c.id].total / stats[c.id].visits) : 0,
  }));

  res.json(result);
});

module.exports = router;