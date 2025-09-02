// backend/utils/db.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      settings: {
        spaName: 'Blue Water Spa',
        phone: '0900-000000',
        email: 'info@domain.com',
        address: 'City, Country',
        currency: 'USD',
        taxRate: 0,
        paymentMethods: 'Cash, Card, Transfer',
        logo: ''
      },
      users: [{ id: 1, username: 'admin', password: '1234', role: 'manager' }],
      customers: [{ id: 1, name: 'tom', phone: '123', notes: '' }, { id: 2, name: 'jon', phone: '123', notes: '' }],
      invoices: [],
      expenses: [],
      services: [],
      sessions: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}
function readDB() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}
module.exports = { readDB, writeDB };