// backend/routes/sessions.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// ---- storage helpers ----
const DATA_DIR = path.join(__dirname, '..', 'data');
const SESS_FILE = path.join(DATA_DIR, 'sessions.json');

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SESS_FILE)) fs.writeFileSync(SESS_FILE, '[]', 'utf8');
}
function readSessions() {
  ensure();
  try { return JSON.parse(fs.readFileSync(SESS_FILE, 'utf8') || '[]'); }
  catch { return []; }
}
function writeSessions(list) {
  ensure();
  fs.writeFileSync(SESS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function norm(v){ return String(v || '').toLowerCase(); }
function nowIso(){ return new Date().toISOString(); }

// ---- routes ----

// GET /api/sessions  -> list all sessions
router.get('/', (_req, res) => {
  const xs = readSessions();
  // newest first
  xs.sort((a, b) => Date.parse(b.startAt || 0) - Date.parse(a.startAt || 0));
  res.json(xs);
});

// GET /api/sessions/:id -> get one session by id
router.get('/:id', (req, res) => {
  const id = String(req.params.id);
  const list = readSessions();
  const item = list.find(s => String(s.id) === id);
  if (!item) return res.status(404).json({ error: 'session_not_found' });
  res.json(item);
});

// PATCH /api/sessions/:id  -> generic patch
router.patch('/:id', (req, res) => {
  const id = String(req.params.id);
  const list = readSessions();
  const i = list.findIndex(s => String(s.id) === id);
  if (i === -1) return res.status(404).json({ error: 'session_not_found' });

  const cur = list[i];
  const next = { ...cur, ...req.body, updatedAt: nowIso() };
  list[i] = next;
  writeSessions(list);
  res.json(next);
});

// POST /api/sessions/:id/pause
router.post('/:id/pause', (req, res) => {
  const id = String(req.params.id);
  const list = readSessions();
  const i = list.findIndex(s => String(s.id) === id);
  if (i === -1) return res.status(404).json({ error: 'session_not_found' });

  const cur = list[i];
  const next = { ...cur, status: 'paused', updatedAt: nowIso() };
  list[i] = next;
  writeSessions(list);
  res.json(next);
});

// POST /api/sessions/:id/complete
router.post('/:id/complete', (req, res) => {
  const id = String(req.params.id);
  const list = readSessions();
  const i = list.findIndex(s => String(s.id) === id);
  if (i === -1) return res.status(404).json({ error: 'session_not_found' });

  const cur = list[i];
  const endAt = req.body?.endAt || nowIso();
  const next = { ...cur, status: 'completed', endAt, updatedAt: nowIso() };
  list[i] = next;
  writeSessions(list);

  // Optional: include a ready-to-use rating link in the response
  const origin = req.headers.origin || `http://localhost:${process.env.PORT || 5000}`;
  const rateLink = `${origin}/rate?appointmentId=${encodeURIComponent(cur.appointmentId ?? cur.id)}&customerId=${encodeURIComponent(cur.customerId ?? '')}&therapistId=${encodeURIComponent(cur.therapistId ?? '')}`;

  res.json({ ...next, rateLink });
});

// POST /api/sessions/:id/extend  { minutes }
router.post('/:id/extend', (req, res) => {
  const id = String(req.params.id);
  const minutes = Number(req.body?.minutes) || 10;
  const list = readSessions();
  const i = list.findIndex(s => String(s.id) === id);
  if (i === -1) return res.status(404).json({ error: 'session_not_found' });

  const cur = list[i];

  const startMs = Date.parse(cur.startAt || cur.startedAt || 0) || Date.now();
  const currentEndMs = Date.parse(cur.endAt || cur.endsAt || 0);
  const defaultMinutes =
    Number(cur.durationMinutes) ||
    Number(cur.duration) ||
    Number(cur.minutes) ||
    60;

  const endMs = Number.isFinite(currentEndMs)
    ? currentEndMs + minutes * 60 * 1000
    : startMs + (defaultMinutes + minutes) * 60 * 1000;

  const next = {
    ...cur,
    endAt: new Date(endMs).toISOString(),
    updatedAt: nowIso(),
  };
  list[i] = next;
  writeSessions(list);
  res.json(next);
});

// DELETE /api/sessions/:id
router.delete('/:id', (req, res) => {
  const id = String(req.params.id);
  const list = readSessions();
  const i = list.findIndex(s => String(s.id) === id);
  if (i === -1) return res.status(404).json({ error: 'session_not_found' });
  const removed = list.splice(i, 1)[0];
  writeSessions(list);
  res.json(removed);
});

module.exports = router;