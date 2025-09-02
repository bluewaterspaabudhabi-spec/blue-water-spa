// backend/routes/appointments.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_DIR   = path.join(__dirname, '..', 'data');
const APPT_FILE  = path.join(DATA_DIR, 'appointments.json');
const SESS_FILE  = path.join(DATA_DIR, 'sessions.json');
const SVC_FILE   = path.join(DATA_DIR, 'services.json'); // <- NEW (for duration)

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(APPT_FILE)) fs.writeFileSync(APPT_FILE, '[]', 'utf8');
  if (!fs.existsSync(SESS_FILE)) fs.writeFileSync(SESS_FILE, '[]', 'utf8');
  if (!fs.existsSync(SVC_FILE))  fs.writeFileSync(SVC_FILE,  '[]', 'utf8');
}
function readAppointments() {
  ensure();
  try { return JSON.parse(fs.readFileSync(APPT_FILE, 'utf8') || '[]'); }
  catch { return []; }
}
function writeAppointments(list) {
  ensure();
  fs.writeFileSync(APPT_FILE, JSON.stringify(list, null, 2), 'utf8');
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
function readServices() {
  ensure();
  try { return JSON.parse(fs.readFileSync(SVC_FILE, 'utf8') || '[]'); }
  catch { return []; }
}
function nextId(list) {
  return list.length ? Math.max(...list.map(x => Number(x.id) || 0)) + 1 : 1;
}
const nowIso = () => new Date().toISOString();
const norm   = (v) => String(v || '').toLowerCase();

/* -------- GET /api/appointments -------- */
router.get('/', (_req, res) => {
  const list = readAppointments();
  list.sort((a, b) => {
    const ta = Date.parse(a.startAt || a.datetime || a.date || a.time || 0) || 0;
    const tb = Date.parse(b.startAt || b.datetime || b.date || b.time || 0) || 0;
    return ta - tb;
  });
  res.json(list);
});

/* -------- POST /api/appointments -------- */
router.post('/', (req, res) => {
  const appts = readAppointments();
  const {
    startAt, datetime, date, time,
    customerId, customerName,
    therapistId, therapist,
    serviceId, serviceName,
    room, area, mode,
    notes, status
  } = req.body || {};

  const when = startAt || datetime || date || time || nowIso();

  const appt = {
    id: nextId(appts),
    startAt: when,
    customerId: customerId ?? null,
    customerName: customerName || '',
    therapistId: therapistId ?? null,
    therapist: therapist || '',
    serviceId: serviceId ?? null,
    serviceName: serviceName || '',
    room: room || '',
    area: area || '',
    mode: mode || (room ? 'in' : area ? 'out' : ''),
    status: status || 'Booked',
    notes: notes || '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  appts.push(appt);
  writeAppointments(appts);
  res.status(201).json(appt);
});

/* -------- PATCH /api/appointments/:id -------- */
router.patch('/:id', (req, res) => {
  const id = String(req.params.id);
  const appts = readAppointments();
  const i = appts.findIndex(a => String(a.id) === id);
  if (i === -1) return res.status(404).json({ error: 'appointment_not_found' });

  const allowed = [
    'startAt','customerId','customerName','therapistId','therapist',
    'serviceId','serviceName','room','area','mode','status','notes','endAt'
  ];

  const next = { ...appts[i] };
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, k)) {
      next[k] = req.body[k];
    }
  }
  next.updatedAt = nowIso();

  appts[i] = next;
  writeAppointments(appts);
  res.json(next);
});

/* -------- DELETE /api/appointments/:id -------- */
router.delete('/:id', (req, res) => {
  const id = String(req.params.id);
  const appts = readAppointments();
  const i = appts.findIndex(a => String(a.id) === id);
  if (i === -1) return res.status(404).json({ error: 'appointment_not_found' });

  const removed = appts.splice(i, 1)[0];
  writeAppointments(appts);
  res.json({ ok: true, removed });
});

/* -------- POST /api/appointments/:id/start -------- */
router.post('/:id/start', (_req, res) => {
  const id = String(_req.params.id);
  const appts = readAppointments();
  const idx = appts.findIndex(a => String(a.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'appointment_not_found' });

  const a = appts[idx];
  const sessions = readSessions();

  // reuse existing running session if any
  const existing = sessions.find(s =>
    String(s.appointmentId) === String(a.id) &&
    !['completed', 'complete', 'cancelled', 'canceled', 'deleted'].includes(norm(s.status))
  );
  if (existing) {
    if (norm(a.status) !== 'in-progress') {
      appts[idx] = { ...a, status: 'In-Progress', updatedAt: nowIso() };
      writeAppointments(appts);
    }
    return res.json(existing);
  }

  // figure duration (minutes) from service if available; else 60
  let minutes = 60;
  const svcs = readServices();
  if (a.serviceId) {
    const svc = svcs.find(x => String(x.id) === String(a.serviceId));
    const m = Number(svc?.durationMinutes ?? svc?.minutes);
    if (Number.isFinite(m) && m > 0) minutes = m;
  }

  const startedAt = nowIso();
  const endAt = new Date(Date.parse(startedAt) + minutes * 60 * 1000).toISOString();

  const session = {
    id: nextId(sessions),
    appointmentId: a.id,
    customerId: a.customerId ?? null,
    customerName: a.customerName || '',
    therapistId: a.therapistId ?? null,
    therapist: a.therapist || '',
    serviceId: a.serviceId ?? null,
    serviceName: a.serviceName || '',
    room: a.room || '',
    area: a.area || '',
    mode: a.mode || (a.room ? 'in' : a.area ? 'out' : ''),
    status: 'running',
    startAt: startedAt,
    endAt,                    // <- set default endAt
    durationMinutes: minutes, // <- helpful for UI
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  sessions.push(session);
  writeSessions(sessions);

  appts[idx] = { ...a, status: 'In-Progress', updatedAt: nowIso() };
  writeAppointments(appts);

  res.status(201).json(session);
});

module.exports = router;