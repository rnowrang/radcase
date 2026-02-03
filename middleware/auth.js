const jwt = require('jsonwebtoken');

// JWT Secret - require environment variable in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  }
  console.warn('WARNING: JWT_SECRET not set. Using insecure default for development only.');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'radcase-dev-secret-DO-NOT-USE-IN-PRODUCTION';

// Auth middleware - extracts user from token, doesn't block if missing
function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    try {
      const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      // Invalid token, continue as guest
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

// Require auth middleware - blocks if not authenticated
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAuth,
  EFFECTIVE_JWT_SECRET
};
