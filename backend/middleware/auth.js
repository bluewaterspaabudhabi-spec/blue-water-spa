// backend/middleware/authz.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * Parse "Authorization: Bearer <token>" and attach req.user if valid.
 * If no/invalid token and requireAuth=true, respond 401.
 */
function authParser(requireAuth = true) {
  return (req, res, next) => {
    try {
      const hdr = String(req.headers.authorization || "");
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

      if (!token) {
        if (requireAuth) return res.status(401).json({ error: "missing_token" });
        req.user = null;
        return next();
      }

      const payload = jwt.verify(token, JWT_SECRET);
      // expected: { sub, email, role }
      req.user = {
        id: String(payload.sub),
        email: payload.email,
        role: payload.role || "staff",
      };
      return next();
    } catch (e) {
      if (requireAuth) return res.status(401).json({ error: "invalid_token" });
      req.user = null;
      return next();
    }
  };
}

/**
 * Ensure current user has one of allowed roles (e.g., ["admin"] or ["admin","supervisor"]).
 */
function requireRole(allowed = []) {
  const set = new Set(allowed.map(String));
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthenticated" });
    if (!set.has(String(req.user.role))) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

module.exports = {
  authParser,
  requireRole,
};