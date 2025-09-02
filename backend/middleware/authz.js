// backend/middleware/authz.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * Verify bearer token.
 * - Attaches req.user = { id, email, role }
 */
function requireAuth(req, res, next) {
  try {
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "missing_token" });

    const payload = jwt.verify(token, JWT_SECRET);
    // normalize user object on request
    req.user = {
      id: String(payload.sub),
      email: payload.email,
      role: String(payload.role || "").toLowerCase(),
    };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

/**
 * Role-based guard.
 * Usage: router.get('/path', requireRole(['admin','supervisor']), handler)
 * - Ensures user is authenticated AND role is in allowed list
 */
function requireRole(allowed) {
  const allowedSet = new Set((allowed || []).map((r) => String(r).toLowerCase()));
  return (req, res, next) => {
    // First, ensure authenticated
    requireAuth(req, res, (err) => {
      if (err) return; // requireAuth already responded
      const role = String(req.user?.role || "").toLowerCase();
      if (!allowedSet.size || allowedSet.has(role)) return next();
      return res.status(403).json({ error: "forbidden" });
    });
  };
}

module.exports = { requireAuth, requireRole };