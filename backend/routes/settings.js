// backend/routes/settings.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {
      businessName: '',
      logoUrl: '',
      phone: '',
      address: '',
      email: '',
      website: '',
      whatsapp: '',
      instagram: '',
      facebook: '',
      defaultCurrency: 'AED',
      defaultTaxRate: 0,
      defaultPrintMode: 'thermal',
      invoiceFooter: '',
      updatedAt: new Date().toISOString(),
    };
  }
}
function writeSettings(obj) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2), 'utf8');
}

router.get('/', (_req, res) => res.json(readSettings()));

router.patch('/', express.json(), (req, res) => {
  const cur = readSettings();
  const inb = req.body || {};
  const next = {
    ...cur,
    businessName:     String(inb.businessName ?? cur.businessName ?? ''),
    logoUrl:          String(inb.logoUrl ?? cur.logoUrl ?? ''),
    phone:            String(inb.phone ?? cur.phone ?? ''),
    address:          String(inb.address ?? cur.address ?? ''),
    email:            String(inb.email ?? cur.email ?? ''),
    website:          String(inb.website ?? cur.website ?? ''),
    whatsapp:         String(inb.whatsapp ?? cur.whatsapp ?? ''),
    instagram:        String(inb.instagram ?? cur.instagram ?? ''),
    facebook:         String(inb.facebook ?? cur.facebook ?? ''),
    defaultCurrency:  String(inb.defaultCurrency ?? cur.defaultCurrency ?? 'AED'),
    defaultTaxRate:   Number(inb.defaultTaxRate ?? cur.defaultTaxRate ?? 0),
    defaultPrintMode: (String(inb.defaultPrintMode ?? cur.defaultPrintMode ?? 'thermal')).toLowerCase()==='a4'?'a4':'thermal',
    invoiceFooter:    String(inb.invoiceFooter ?? cur.invoiceFooter ?? ''),
    updatedAt: new Date().toISOString(),
  };
  try {
    writeSettings(next);
    res.json(next);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;