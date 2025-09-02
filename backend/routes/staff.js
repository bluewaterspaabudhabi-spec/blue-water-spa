// backend/routes/staff.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'staff.json');

// ensure data dir + file
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');

function readAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8') || '[]'); }
  catch { return []; }
}
function writeAll(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

// GET /api/staff
router.get('/', (req, res) => {
  res.json(readAll());
});

// POST /api/staff
router.post('/', (req, res) => {
  const { name = '', role = '', phone = '', notes = '' } = req.body || {};
  if (!name.trim()) return res.status(400).json({ error: 'name is required' });

  const all = readAll();
  const id = all.length ? Math.max(...all.map(s => Number(s.id) || 0)) + 1 : 1;
  const staff = { id, name: name.trim(), role: role.trim(), phone: phone.trim(), notes: notes.trim(), createdAt: new Date().toISOString() };
  all.push(staff);
  writeAll(all);
  res.status(201).json(staff);
});

// PUT /api/staff/:id
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const all = readAll();
  const idx = all.findIndex(s => Number(s.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });

  const { name, role, phone, notes } = req.body || {};
  all[idx] = {
    ...all[idx],
    ...(name  !== undefined ? { name:  String(name).trim() }  : {}),
    ...(role  !== undefined ? { role:  String(role).trim() }  : {}),
    ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
    ...(notes !== undefined ? { notes: String(notes).trim() } : {}),
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  res.json(all[idx]);
});

// DELETE /api/staff/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const all = readAll();
  const next = all.filter(s => Number(s.id) !== id);
  if (next.length === all.length) return res.status(404).json({ error: 'not found' });
  writeAll(next);
  res.json({ ok: true });
});

module.exports = router;