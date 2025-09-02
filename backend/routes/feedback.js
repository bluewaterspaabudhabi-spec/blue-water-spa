// backend/routes/feedback.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'feedback.json');

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}
function readAll() {
  ensure();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8') || '[]'); }
  catch { return []; }
}
function writeAll(list) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}
function nextId(list) {
  return list.length ? Math.max(...list.map(x => Number(x.id) || 0)) + 1 : 1;
}
function nowIso(){ return new Date().toISOString(); }
function clamp1to5(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}
function sourceFrom(body) {
  const s = String(body?.source || '').toLowerCase();
  // desk: تم إدخاله من لوحة التحكم، kiosk: شاشة/QR، link: رابط عام
  return ['kiosk','link','desk'].includes(s) ? s : 'desk';
}

/* -------- GET كل الـ feedback -------- */
router.get('/', (_req, res) => {
  res.json(readAll());
});

/* -------- POST /api/feedback/general --------
   تقييم عام (مش مرتبط بجلسة معيّنة)
*/
router.post('/general', (req, res) => {
  const list = readAll();

  const fb = {
    id: nextId(list),
    type: 'general',
    // نحتفظ بحقل rating للموافقة مع القديم
    rating: clamp1to5(req.body?.rating),
    overallRating: clamp1to5(req.body?.rating),
    serviceRating: clamp1to5(req.body?.serviceRating),
    roomRating: clamp1to5(req.body?.roomRating),
    receptionRating: clamp1to5(req.body?.receptionRating),
    comment: req.body?.comment ?? '',
    source: sourceFrom(req.body),
    createdAt: nowIso(),
  };

  list.push(fb);
  writeAll(list);
  res.status(201).json(fb);
});

/* -------- POST /api/feedback/session --------
   تقييم جلسة معيّنة (من الداش/الكيشك/الرابط)
*/
router.post('/session', (req, res) => {
  const list = readAll();

  const fb = {
    id: nextId(list),
    type: 'session',
    sessionId: req.body?.sessionId ?? null,
    appointmentId: req.body?.appointmentId ?? null,
    customerId: req.body?.customerId ?? null,
    therapistId: req.body?.therapistId ?? null,
    serviceId: req.body?.serviceId ?? null,

    // نحتفظ بـ rating (قديم) ونضيف overallRating
    rating: clamp1to5(req.body?.rating),
    overallRating: clamp1to5(req.body?.rating),

    // الجديد: تقييمات مفصّلة
    serviceRating: clamp1to5(req.body?.serviceRating),
    roomRating: clamp1to5(req.body?.roomRating),
    receptionRating: clamp1to5(req.body?.receptionRating),

    comment: req.body?.comment ?? '',
    source: sourceFrom(req.body), // 'desk' | 'kiosk' | 'link'
    createdAt: nowIso(),
  };

  list.push(fb);
  writeAll(list);
  res.status(201).json(fb);
});

module.exports = router;