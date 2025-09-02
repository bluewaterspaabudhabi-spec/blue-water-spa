// backend/routes/customers.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'customers.json');

// ensure storage
function ensureStore() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  if (!fs.existsSync(FILE)) {
    try { fs.writeFileSync(FILE, '[]', 'utf8'); } catch {}
  }
}
ensureStore();

function readAll() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8') || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeAll(list) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write customers.json', e);
  }
}
function nextId(list) {
  return list.length ? Math.max(...list.map(c => Number(c.id) || 0)) + 1 : 1;
}
function clampRating(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n * 10) / 10)); // 1 decimal
}
function toMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

/** GET /api/customers (?q=&limit=) */
router.get('/', (req, res) => {
  let all = readAll().sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  );

  const { q, limit } = req.query;
  if (q) {
    const s = String(q).toLowerCase();
    all = all.filter(c =>
      String(c.name || '').toLowerCase().includes(s) ||
      String(c.phone || '').toLowerCase().includes(s) ||
      String(c.email || '').toLowerCase().includes(s) ||
      String(c.notes || '').toLowerCase().includes(s)
    );
  }
  if (limit) {
    const n = Number(limit) || 0;
    if (n > 0) all = all.slice(0, n);
  }
  res.json(all);
});

/** GET /api/customers/:id */
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const all = readAll();
  const one = all.find(c => Number(c.id) === id);
  if (!one) return res.status(404).json({ error: 'not found' });
  res.json(one);
});

/** POST /api/customers */
router.post('/', (req, res) => {
  const {
    name = '',
    phone = '',
    email = '',
    gender = '',
    notes = '',
    rating = 0,       // 0..5
    totalPaid = 0,    // number
  } = req.body || {};

  if (!String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const all = readAll();
  const id = nextId(all);
  const now = new Date().toISOString();

  const record = {
    id,
    name: String(name).trim(),
    phone: String(phone || '').trim(),
    email: String(email || '').trim(),
    gender: String(gender || '').trim(),
    notes: String(notes || '').trim(),
    rating: clampRating(rating),
    visitCount: 0,
    lastVisitAt: null,
    totalPaid: toMoney(totalPaid),
    createdAt: now,
    updatedAt: now,
  };

  all.push(record);
  writeAll(all);
  res.status(201).json(record);
});

/** PUT /api/customers/:id */
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const all = readAll();
  const idx = all.findIndex(c => Number(c.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });

  const cur = all[idx];
  const {
    name,
    phone,
    email,
    gender,
    notes,
    rating,
    visitCount,
    lastVisitAt,
    totalPaid,
  } = req.body || {};

  const updated = {
    ...cur,
    ...(name        !== undefined ? { name: String(name).trim() }                         : {}),
    ...(phone       !== undefined ? { phone: String(phone).trim() }                       : {}),
    ...(email       !== undefined ? { email: String(email).trim() }                       : {}),
    ...(gender      !== undefined ? { gender: String(gender).trim() }                     : {}),
    ...(notes       !== undefined ? { notes: String(notes).trim() }                       : {}),
    ...(rating      !== undefined ? { rating: clampRating(rating) }                       : {}),
    ...(visitCount  !== undefined ? { visitCount: Math.max(0, Number(visitCount) || 0) }  : {}),
    ...(lastVisitAt !== undefined ? { lastVisitAt: lastVisitAt || null }                  : {}),
    ...(totalPaid   !== undefined ? { totalPaid: toMoney(totalPaid) }                     : {}),
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updated;
  writeAll(all);
  res.json(updated);
});

/** DELETE /api/customers/:id */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const all = readAll();
  const next = all.filter(c => Number(c.id) !== id);
  if (next.length === all.length) return res.status(404).json({ error: 'not found' });
  writeAll(next);
  res.json({ ok: true });
});

/* -------------------- Stats & Top endpoints -------------------- */

/** GET /api/customers/stats/kpis
 * Returns KPIs: total, withPhone, avgRating, repeatCount, recentLastVisit30d
 * (kept unchanged for compatibility)
 */
router.get('/stats/kpis', (req, res) => {
  try {
    const all = readAll();
    const total = all.length;
    const withPhone = all.filter(c => String(c.phone || '').trim()).length;

    const ratings = all.map(c => Number(c.rating)).filter(n => Number.isFinite(n) && n > 0);
    const avgRating = ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : 0;

    const repeatCount = all.filter(c => (Number(c.visitCount) || 0) >= 2).length;

    const now = Date.now();
    const days30 = 30 * 24 * 60 * 60 * 1000;
    const recentLastVisit30d = all.filter(c => {
      const t = Date.parse(c.lastVisitAt || '');
      return Number.isFinite(t) && now - t <= days30;
    }).length;

    res.json({ total, withPhone, avgRating, repeatCount, recentLastVisit30d });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'stats_failed' });
  }
});

/** GET /api/customers/top?by=visits|recent|payments&limit=10
 * by=visits   -> sort by visitCount desc, then lastVisitAt desc
 * by=recent   -> sort by lastVisitAt desc
 * by=payments -> sort by totalPaid desc, then visitCount desc
 */
router.get('/top', (req, res) => {
  try {
    const by = String(req.query.by || 'visits').toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const all = readAll();

    const clone = all.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      rating: c.rating,
      visitCount: Number(c.visitCount) || 0,
      lastVisitAt: c.lastVisitAt || null,
      totalPaid: toMoney(c.totalPaid || 0),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    const byVisits = () =>
      clone.sort((a, b) => {
        if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
        const ta = Date.parse(a.lastVisitAt || 0);
        const tb = Date.parse(b.lastVisitAt || 0);
        return (tb || 0) - (ta || 0);
      });

    const byRecent = () =>
      clone.sort((a, b) => {
        const ta = Date.parse(a.lastVisitAt || 0);
        const tb = Date.parse(b.lastVisitAt || 0);
        return (tb || 0) - (ta || 0);
      });

    const byPayments = () =>
      clone.sort((a, b) => {
        if (b.totalPaid !== a.totalPaid) return b.totalPaid - a.totalPaid;
        return (b.visitCount || 0) - (a.visitCount || 0);
      });

    let sorted;
    switch (by) {
      case 'recent':
        sorted = byRecent();
        break;
      case 'payments':
        sorted = byPayments();
        break;
      case 'visits':
      default:
        sorted = byVisits();
        break;
    }

    res.json(sorted.slice(0, limit));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'top_failed' });
  }
});

module.exports = router;