// backend/server.js
const express = require('express');
const cors = require('cors');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// routes
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/invoices',     require('./routes/invoices'));
app.use('/api/expenses',     require('./routes/expenses'));
app.use('/api/services',     require('./routes/services'));
app.use('/api/staff',        require('./routes/staff'));
app.use('/api/sessions',     require('./routes/sessions'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/feedback',     require('./routes/feedback'));
app.use('/api/feedback', require('./routes/feedback'));
// 404 for unknown /api
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});