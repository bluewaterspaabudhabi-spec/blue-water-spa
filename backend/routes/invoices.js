// backend/routes/invoices.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

/* ---------------- file storage ---------------- */
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE_INVOICES   = path.join(DATA_DIR, "invoices.json");
const FILE_APPTS      = path.join(DATA_DIR, "appointments.json");
const FILE_CUSTOMERS  = path.join(DATA_DIR, "customers.json");
const FILE_SERVICES   = path.join(DATA_DIR, "services.json");
const FILE_STAFF      = path.join(DATA_DIR, "staff.json");

function ensureStore() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  for (const f of [FILE_INVOICES, FILE_APPTS, FILE_CUSTOMERS, FILE_SERVICES, FILE_STAFF]) {
    if (!fs.existsSync(f)) {
      try { fs.writeFileSync(f, "[]", "utf8"); } catch {}
    }
  }
}
function readJson(file) {
  ensureStore();
  try {
    const raw = fs.readFileSync(file, "utf8");
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function writeJson(file, list) {
  try { fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf8"); } catch {}
}

let invoices = readJson(FILE_INVOICES);
let seq = invoices.length ? Math.max(...invoices.map(r => Number(r.id) || 0)) + 1 : 1;

/* ---------------- helpers ---------------- */
const currencyDefault = "AED";
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clampPayment = (s) => {
  const v = String(s || "").toLowerCase();
  if (!v) return "";
  // allow any string but normalize common ones
  if (["cash","card","transfer","credit","debit"].includes(v)) return v;
  return s;
};
const clampMode = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "in" || v === "out") return v;
  return "";
};

function normalizeItem(x = {}) {
  // expect: { serviceId?, serviceName?, qty, price, total, therapistId? }
  const qty = Math.max(1, toNum(x.qty, 1));
  const price = Math.max(0, toNum(x.price, 0));
  const total = x.total != null ? toNum(x.total, qty * price) : qty * price;
  return {
    serviceId: x.serviceId ?? x.id ?? x.code ?? null,
    serviceName: x.serviceName || x.service || "",
    qty,
    price,
    total,
    therapistId: x.therapistId != null ? Number(x.therapistId) : (x.staffId ?? x.staff_id ?? null),
  };
}

function computeTotals(items = [], discount = 0, taxRate = 0) {
  const subtotal = items.reduce((s, it) => s + toNum(it.total, (toNum(it.qty,1) * toNum(it.price,0))), 0);
  const disc = Math.max(0, toNum(discount, 0));
  const taxR = Math.max(0, toNum(taxRate, 0));
  const taxedBase = Math.max(0, subtotal - disc);
  const tax = +(taxedBase * (taxR / 100)).toFixed(2);
  const total = +(taxedBase + tax).toFixed(2);
  return {
    subtotal: +subtotal.toFixed(2),
    discount: +disc.toFixed(2),
    taxRate: +taxR.toFixed(2),
    tax,
    total,
  };
}

function enrichLookups() {
  const services = readJson(FILE_SERVICES);
  const staff = readJson(FILE_STAFF);
  const customers = readJson(FILE_CUSTOMERS);
  return {
    svcById: Object.fromEntries(services.map(s => [String(s.id), s])),
    staffById: Object.fromEntries(staff.map(u => [String(u.id), u])),
    custById: Object.fromEntries(customers.map(c => [String(c.id), c])),
  };
}

/* ---------------- queries / filters ---------------- */
function filterInvoices(list, q) {
  let arr = list.slice();
  const {
    from, to, customerId, therapistId, mode, payment,
    appointmentId, q: search,
  } = q || {};

  if (from) {
    const t = Date.parse(from);
    if (Number.isFinite(t)) arr = arr.filter(x => Date.parse(x.createdAt || x.date || 0) >= t);
  }
  if (to) {
    const t = Date.parse(to);
    if (Number.isFinite(t)) arr = arr.filter(x => Date.parse(x.createdAt || x.date || 0) <= t + 24*60*60*1000 - 1);
  }
  if (customerId) arr = arr.filter(x => String(x.customerId) === String(customerId));
  if (therapistId) {
    // match at invoice level or lines
    arr = arr.filter(inv => {
      if (String(inv.therapistId || "") === String(therapistId)) return true;
      if (Array.isArray(inv.items)) {
        return inv.items.some(it => String(it.therapistId || "") === String(therapistId));
      }
      return false;
    });
  }
  if (mode) {
    const m = String(mode).toLowerCase();
    if (m === "in" || m === "out") {
      arr = arr.filter(x => String(x.mode || "").toLowerCase() === m);
    }
  }
  if (payment) {
    arr = arr.filter(x => String(x.paymentMethod || "").toLowerCase() === String(payment).toLowerCase());
  }
  if (appointmentId) arr = arr.filter(x => String(x.appointmentId || "") === String(appointmentId));
  if (search) {
    const s = String(search).toLowerCase();
    arr = arr.filter(inv =>
      String(inv.customerName || "").toLowerCase().includes(s) ||
      String(inv.id || "").toLowerCase().includes(s) ||
      String(inv.notes || "").toLowerCase().includes(s) ||
      String(inv.paymentMethod || "").toLowerCase().includes(s)
    );
  }

  // newest first
  arr.sort((a,b) => Date.parse(b.createdAt || b.date || 0) - Date.parse(a.createdAt || a.date || 0));
  return arr;
}

/* ---------------- GET /api/invoices ---------------- */
router.get("/", (req, res) => {
  const out = filterInvoices(invoices, req.query);
  res.json(out);
});

/* ---------------- GET /api/invoices/:id ---------------- */
router.get("/:id", (req, res) => {
  const one = invoices.find(x => String(x.id) === String(req.params.id));
  if (!one) return res.status(404).json({ error: "not_found" });
  res.json(one);
});

/* ---------------- POST /api/invoices ----------------
   Create an invoice. Supports optional appointmentId to link.
   Body example:
   {
     customerId, customerName?, mode?, paymentMethod?, roomNumber?, area?,
     items: [{serviceId, serviceName, qty, price, total, therapistId}, ...],
     discount?, taxRate?, currency?, notes?, appointmentId?
   }
-----------------------------------------------------*/
router.post("/", (req, res) => {
  try {
    const {
      customerId,
      customerName,
      mode,
      paymentMethod,
      roomNumber,
      room,            // accept legacy field
      area,
      locationArea,    // accept legacy field
      items = [],
      discount = 0,
      taxRate = 0,
      currency,
      notes = "",
      appointmentId,
      therapistId,     // optional invoice-level therapist
      therapist,       // legacy name
    } = req.body || {};

    const { custById, svcById } = enrichLookups();

    if (!customerId && !customerName) {
      return res.status(400).json({ error: "customerId or customerName is required" });
    }

    // normalize items
    const normItems = Array.isArray(items) ? items.map(normalizeItem) : [];

    // if serviceId provided but no name, fill from services.json
    for (const it of normItems) {
      if (!it.serviceName && it.serviceId != null) {
        const svc = svcById[String(it.serviceId)];
        if (svc?.name) it.serviceName = svc.name;
      }
    }

    // totals
    const totals = computeTotals(normItems, discount, taxRate);

    // basic prefill from lookups
    const cust = customerId != null ? custById[String(customerId)] : null;

    // build record
    const id = seq++;
    const now = new Date().toISOString();
    const record = {
      id,
      createdAt: now,
      updatedAt: now,

      customerId: customerId != null ? Number(customerId) : null,
      customerName: customerName || cust?.name || "",
      mode: clampMode(mode),
      paymentMethod: clampPayment(paymentMethod),
      roomNumber: roomNumber || room || "",
      area: area || locationArea || "",

      therapistId: therapistId != null ? Number(therapistId) : null,
      therapist: therapist || "",

      items: normItems,
      discount: totals.discount,
      taxRate: totals.taxRate,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      currency: currency || currencyDefault,
      notes: String(notes || "").trim(),

      appointmentId: appointmentId != null ? Number(appointmentId) : null,
    };

    invoices.push(record);
    writeJson(FILE_INVOICES, invoices);

    // if linked to appointment, keep the link in appointments.json (non-breaking)
    if (record.appointmentId) {
      try {
        const appts = readJson(FILE_APPTS);
        const i = appts.findIndex(a => String(a.id) === String(record.appointmentId));
        if (i !== -1) {
          const a = appts[i];
          appts[i] = { ...a, invoiceId: record.id, updatedAt: new Date().toISOString() };
          writeJson(FILE_APPTS, appts);
        }
      } catch {}
    }

    res.status(201).json(record);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "create_failed" });
  }
});

/* ---------------- PATCH /api/invoices/:id ----------------
   Update invoice fields, re-compute totals if items/discount/taxRate changed
----------------------------------------------------------*/
router.patch("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const i = invoices.findIndex(x => String(x.id) === String(id));
    if (i === -1) return res.status(404).json({ error: "not_found" });

    const cur = invoices[i];
    const body = req.body || {};
    let next = { ...cur };

    // updatable fields
    if (body.customerId !== undefined) next.customerId = body.customerId != null ? Number(body.customerId) : null;
    if (body.customerName !== undefined) next.customerName = String(body.customerName || "");
    if (body.mode !== undefined) next.mode = clampMode(body.mode);
    if (body.paymentMethod !== undefined) next.paymentMethod = clampPayment(body.paymentMethod);
    if (body.roomNumber !== undefined) next.roomNumber = String(body.roomNumber || "");
    if (body.room !== undefined) next.roomNumber = String(body.room || ""); // legacy
    if (body.area !== undefined) next.area = String(body.area || "");
    if (body.locationArea !== undefined) next.area = String(body.locationArea || ""); // legacy
    if (body.therapistId !== undefined) next.therapistId = body.therapistId != null ? Number(body.therapistId) : null;
    if (body.therapist !== undefined) next.therapist = String(body.therapist || "");
    if (body.currency !== undefined) next.currency = String(body.currency || currencyDefault);
    if (body.notes !== undefined) next.notes = String(body.notes || "");
    if (body.appointmentId !== undefined) next.appointmentId = body.appointmentId != null ? Number(body.appointmentId) : null;

    // items / totals
    let itemsChanged = false;
    if (Array.isArray(body.items)) {
      next.items = body.items.map(normalizeItem);
      itemsChanged = true;
    }
    if (body.discount !== undefined) { next.discount = toNum(body.discount, next.discount || 0); itemsChanged = true; }
    if (body.taxRate !== undefined)  { next.taxRate  = toNum(body.taxRate, next.taxRate || 0);   itemsChanged = true; }

    if (itemsChanged) {
      const totals = computeTotals(next.items || [], next.discount || 0, next.taxRate || 0);
      next.subtotal = totals.subtotal;
      next.tax = totals.tax;
      next.total = totals.total;
      next.discount = totals.discount;
      next.taxRate = totals.taxRate;
    }

    next.updatedAt = new Date().toISOString();
    invoices[i] = next;
    writeJson(FILE_INVOICES, invoices);

    res.json(next);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "update_failed" });
  }
});

/* ---------------- DELETE /api/invoices/:id ---------------- */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const i = invoices.findIndex(x => String(x.id) === String(id));
    if (i === -1) return res.status(404).json({ error: "not_found" });
    const [deleted] = invoices.splice(i, 1);
    writeJson(FILE_INVOICES, invoices);

    // remove link from appointment if present
    if (deleted?.appointmentId) {
      try {
        const appts = readJson(FILE_APPTS);
        const j = appts.findIndex(a => String(a.id) === String(deleted.appointmentId));
        if (j !== -1 && String(appts[j].invoiceId || "") === String(deleted.id)) {
          const a = appts[j];
          delete a.invoiceId;
          a.updatedAt = new Date().toISOString();
          appts[j] = a;
          writeJson(FILE_APPTS, appts);
        }
      } catch {}
    }

    res.json({ ok: true, deleted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "delete_failed" });
  }
});

/* -------------- Utility: create skeleton from appointment --------------
   POST /api/invoices/from-appointment
   body: { appointmentId }
   - Creates a minimal invoice prefilled from appointment (no items),
     to be edited in frontend. Safe to call multiple times? No — one per appt.
-------------------------------------------------------------------------*/
router.post("/from-appointment", (req, res) => {
  try {
    const { appointmentId } = req.body || {};
    if (!appointmentId) return res.status(400).json({ error: "appointmentId is required" });

    const appts = readJson(FILE_APPTS);
    const a = appts.find(x => String(x.id) === String(appointmentId));
    if (!a) return res.status(404).json({ error: "appointment_not_found" });

    // if already has invoice, return it
    const existing = invoices.find(inv => String(inv.appointmentId || "") === String(appointmentId));
    if (existing) return res.status(200).json(existing);

    const { custById, staffById, svcById } = enrichLookups();
    const cust = custById[String(a.customerId)];
    const staff = staffById[String(a.therapistId)];
    const svc = svcById[String(a.serviceId)];

    const id = seq++;
    const now = new Date().toISOString();

    const record = {
      id,
      createdAt: now,
      updatedAt: now,
      appointmentId: Number(appointmentId),

      customerId: a.customerId != null ? Number(a.customerId) : null,
      customerName: a.customerName || cust?.name || "",

      mode: "in", // default for appointments
      roomNumber: a.room || a.roomNumber || "",
      area: "",

      therapistId: a.therapistId != null ? Number(a.therapistId) : null,
      therapist: a.therapist || staff?.name || "",

      items: svc?.name ? [{
        serviceId: a.serviceId,
        serviceName: svc.name,
        qty: 1,
        price: toNum(svc.price, 0),
        total: toNum(svc.price, 0),
        therapistId: a.therapistId != null ? Number(a.therapistId) : null,
      }] : [],

      discount: 0,
      taxRate: 0,
      ...computeTotals([], 0, 0),
      currency: currencyDefault,
      notes: String(a.notes || ""),
      paymentMethod: "",
    };

    invoices.push(record);
    writeJson(FILE_INVOICES, invoices);

    // store link on appointment
    const i = appts.findIndex(x => String(x.id) === String(appointmentId));
    if (i !== -1) {
      appts[i] = { ...a, invoiceId: record.id, updatedAt: now };
      writeJson(FILE_APPTS, appts);
    }

    res.status(201).json(record);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "from_appointment_failed" });
  }
});

module.exports = router;