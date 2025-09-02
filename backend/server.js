const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middlewares
app.use(cors());
app.use(express.json());

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ✅ API Routes
app.use("/appointments", require("./routes/appointments"));
app.use("/customers", require("./routes/customers"));
app.use("/expenses", require("./routes/expenses"));
app.use("/feedback", require("./routes/feedback"));
app.use("/invoices", require("./routes/invoices"));
app.use("/services", require("./routes/services"));
app.use("/sessions", require("./routes/sessions"));
app.use("/staff", require("./routes/staff"));
app.use("/users", require("./routes/users"));
app.use("/auth", require("./routes/auth"));

// ✅ Default fallback
app.get("/", (req, res) => {
  res.send("Backend API is running 🚀");
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
