// backend/routes/auth.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { requireRole } = require("../middleware/authz"); // role guard

const router = express.Router();

// --------- simple file storage ----------
const DATA_DIR = path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureStore() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  if (!fs.existsSync(USERS_FILE)) {
    try { fs.writeFileSync(USERS_FILE, "[]", "utf8"); } catch {}
  }
}
function readUsers() {
  ensureStore();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveUsers(list) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {}
}
function nextId(list) {
  return list.length ? Math.max(...list.map(u => Number(u.id) || 0)) + 1 : 1;
}

// --------- JWT helpers ----------
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES = "7d";

function signUser(u) {
  const payload = { sub: u.id, email: u.email, role: u.role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// --------- role helper ----------
const ALLOWED_ROLES = new Set(["admin", "supervisor", "staff"]);
function clampRole(r) {
  const v = String(r || "").toLowerCase().trim();
  return ALLOWED_ROLES.has(v) ? v : "staff";
}

// --------- seed admin if empty (first-run convenience) ----------
(function seedIfEmpty() {
  const users = readUsers();
  if (!users.length) {
    const admin = {
      id: 1,
      name: "Admin",
      email: "admin@example.com",
      passwordHash: bcrypt.hashSync("password", 10),
      role: "admin",
    };
    const supervisor = {
      id: 2,
      name: "Supervisor",
      email: "supervisor@example.com",
      passwordHash: bcrypt.hashSync("password", 10),
      role: "supervisor",
    };
    saveUsers([admin, supervisor]);
    // eslint-disable-next-line no-console
    console.log("[auth] seeded default users: admin@example.com / supervisor@example.com (password: password)");
  }
})();

/* ================= Auth (public) ================ */

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    let { name, email, password, role = "staff" } = req.body || {};
    name = String(name || "").trim();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password are required" });
    }

    const users = readUsers();
    const exists = users.find(u => String(u.email).toLowerCase() === email);
    if (exists) return res.status(409).json({ error: "email_already_used" });

    const hash = await bcrypt.hash(password, 10);
    const id = nextId(users);
    const user = { id, name, email, passwordHash: hash, role: clampRole(role) };

    users.push(user);
    saveUsers(users);

    const token = signUser(user);
    res.status(201).json({ id, name, email, role: user.role, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "register_failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const users = readUsers();
    const user = users.find(u => String(u.email).toLowerCase() === email);
    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const token = signUser(user);
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "login_failed" });
  }
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  try {
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "missing_token" });

    const payload = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
    const user = users.find(u => String(u.id) === String(payload.sub));
    if (!user) return res.status(404).json({ error: "user_not_found" });

    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (e) {
    return res.status(401).json({ error: "invalid_token" });
  }
});

/* ============ Users management (RBAC) ============ */

// GET /api/auth/users  (admin + supervisor)
router.get("/users", requireRole(["admin", "supervisor"]), (req, res) => {
  const users = readUsers().map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role
  }));
  res.json(users);
});

// POST /api/auth/users  (admin only)
router.post("/users", requireRole(["admin"]), async (req, res) => {
  try {
    let { name, email, password, role } = req.body || {};
    name = String(name || "").trim();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");
    role = clampRole(role);

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password, role are required" });
    }
    const users = readUsers();
    const exists = users.find(u => String(u.email).toLowerCase() === email);
    if (exists) return res.status(409).json({ error: "email_already_used" });

    const hash = await bcrypt.hash(password, 10);
    const id = nextId(users);
    const user = { id, name, email, passwordHash: hash, role };
    users.push(user);
    saveUsers(users);
    res.status(201).json({ id, name, email, role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "create_failed" });
  }
});

// PATCH /api/auth/users/:id  (admin only)
router.patch("/users/:id", requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    let { name, email, role, password } = req.body || {};
    if (email != null) email = String(email).trim().toLowerCase();

    const users = readUsers();
    const i = users.findIndex(u => String(u.id) === String(id));
    if (i === -1) return res.status(404).json({ error: "not_found" });

    if (typeof name !== "undefined") users[i].name = String(name || "").trim();
    if (typeof email !== "undefined") users[i].email = email || users[i].email;
    if (typeof role !== "undefined") users[i].role = clampRole(role);
    if (typeof password === "string" && password.length > 0) {
      users[i].passwordHash = await bcrypt.hash(password, 10);
    }

    saveUsers(users);
    const { passwordHash, ...safe } = users[i];
    res.json(safe);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "update_failed" });
  }
});

// DELETE /api/auth/users/:id  (admin only)
router.delete("/users/:id", requireRole(["admin"]), (req, res) => {
  try {
    const { id } = req.params;
    const users = readUsers();
    const i = users.findIndex(u => String(u.id) === String(id));
    if (i === -1) return res.status(404).json({ error: "not_found" });
    const [removed] = users.splice(i, 1);
    saveUsers(users);
    const { passwordHash, ...safe } = removed;
    res.json({ ok: true, deleted: safe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "delete_failed" });
  }
});

module.exports = router;