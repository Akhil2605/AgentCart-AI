const db = require('../database/db');

/**
 * Lightweight in-memory sliding window rate limiter
 * Protects auth, checkout, and refund endpoints from brute force and denial of service.
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 30;
  const message = options.message || 'Too many requests. Please try again later.';
  const hits = new Map();

  // Periodic cleanup every 2 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, 2 * 60 * 1000).unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const timestamps = hits.get(ip) || [];
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({
        success: false,
        error: message
      });
    }

    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://www.paypal.com https://*.paypal.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://*.paypal.com; " +
    "connect-src 'self' blob: https://api-m.sandbox.paypal.com https://*.paypal.com https://generativelanguage.googleapis.com;"
  );
  next();
}

/**
 * Admin role-based authentication middleware
 */
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  let token = null;

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin authentication token is required.'
    });
  }

  const session = db.validateAdminSession(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin session expired or invalid. Please log in again.'
    });
  }

  req.admin = session;
  next();
}

module.exports = {
  createRateLimiter,
  securityHeaders,
  requireAdminAuth
};
