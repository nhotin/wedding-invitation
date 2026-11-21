'use strict';

const crypto = require('crypto');
const { config } = require('./config.js');

const SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_IDLE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_SESSIONS = 200;

const COOKIE_ADMIN_HTTPS = '__Host-wedding_admin';
const COOKIE_ADMIN_HTTP = 'wedding_admin';
const COOKIE_CSRF_HTTPS = '__Host-wedding_csrf';
const COOKIE_CSRF_HTTP = 'wedding_csrf';

// In-memory session store (cleared on restart; bounded to prevent memory exhaustion)
const sessions = new Map();

// Sliding-window rate limiter store: key -> array of timestamps
const rateBuckets = new Map();

const CLEANUP_INTERVAL = setInterval(() => {
  const now = Date.now();
  for (const [sid, sess] of sessions.entries()) {
    if (now >= sess.expiresAt || now - sess.lastActivityAt >= SESSION_IDLE_TTL_MS) {
      sessions.delete(sid);
    }
  }
  for (const [key, entry] of rateBuckets.entries()) {
    if (now >= entry.pruneAfter) {
      rateBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (typeof CLEANUP_INTERVAL.unref === 'function') {
  CLEANUP_INTERVAL.unref();
}

function isLoopbackAddress(addr) {
  if (!addr) return false;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function getClientIp(req) {
  const remoteAddr = req.socket?.remoteAddress || '';
  if (isLoopbackAddress(remoteAddr)) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
      return cfIp.trim().slice(0, 64);
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim().slice(0, 64);
    }
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      return xff.split(',')[0].trim().slice(0, 64);
    }
  }
  return remoteAddr || 'unknown';
}

function isHttpsRequest(req) {
  const remoteAddr = req.socket?.remoteAddress || '';
  if (req.socket?.encrypted) return true;
  if (isLoopbackAddress(remoteAddr)) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    if (proto === 'https') return true;
  }
  return false;
}

function checkRateLimit(bucketName, ip, maxRequests, windowMs) {
  const now = Date.now();
  const key = `${bucketName}:${ip}`;
  let entry = rateBuckets.get(key);
  if (!entry) {
    entry = { timestamps: [], pruneAfter: now + windowMs };
    rateBuckets.set(key, entry);
  }
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  entry.pruneAfter = now + windowMs;

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  entry.timestamps.push(now);
  return { allowed: true, retryAfterSec: 0 };
}

function recordFailedLoginAttempt(ip, maxFailures = 5, windowMs = 15 * 60 * 1000) {
  return checkRateLimit('admin_login_fail', ip, maxFailures, windowMs);
}

function isLoginLocked(ip, maxFailures = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const key = `admin_login_fail:${ip}`;
  const entry = rateBuckets.get(key);
  if (!entry) return { locked: false, retryAfterSec: 0 };
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= maxFailures) {
    const oldest = entry.timestamps[0];
    return { locked: true, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  return { locked: false, retryAfterSec: 0 };
}

function clearLoginFailures(ip) {
  rateBuckets.delete(`admin_login_fail:${ip}`);
}

function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyAdminPassword(password) {
  if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
    return false;
  }
  const stored = config.adminPasswordHash;
  if (!stored || !stored.startsWith('scrypt$')) {
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const derivedBuf = crypto.scryptSync(password, salt, expectedBuf.length, { N: 16384, r: 8, p: 1 });
    if (derivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch (_) {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = Object.create(null);
  if (typeof header !== 'string' || !header) return out;
  const pairs = header.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
      out[key] = val;
    }
  }
  return out;
}

function buildCookieHeader(name, value, { secure, maxAgeSec, httpOnly = true, sameSite = 'Strict' }) {
  const parts = [`${name}=${value}`, 'Path=/'];
  if (typeof maxAgeSec === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`);
  }
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join('; ');
}

function getAdminCookieName(req) {
  return isHttpsRequest(req) ? COOKIE_ADMIN_HTTPS : COOKIE_ADMIN_HTTP;
}

function getCsrfCookieName(req) {
  return isHttpsRequest(req) ? COOKIE_CSRF_HTTPS : COOKIE_CSRF_HTTP;
}

function createAdminSession(req) {
  const now = Date.now();
  // Evict oldest session if cap reached
  if (sessions.size >= MAX_SESSIONS) {
    const firstKey = sessions.keys().next().value;
    if (firstKey) sessions.delete(firstKey);
  }

  const sid = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const session = {
    sid,
    csrfToken,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + SESSION_ABSOLUTE_TTL_MS
  };
  sessions.set(sid, session);

  const secure = isHttpsRequest(req);
  const cookies = [
    buildCookieHeader(getAdminCookieName(req), sid, {
      secure,
      maxAgeSec: Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000),
      httpOnly: true,
      sameSite: 'Strict'
    }),
    buildCookieHeader(getCsrfCookieName(req), csrfToken, {
      secure,
      maxAgeSec: Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000),
      httpOnly: true,
      sameSite: 'Strict'
    })
  ];

  return { session, cookies };
}

function getValidAdminSession(req) {
  const cookies = parseCookies(req);
  const secure = isHttpsRequest(req);
  const sid = secure ? cookies[COOKIE_ADMIN_HTTPS] : (cookies[COOKIE_ADMIN_HTTP] || cookies[COOKIE_ADMIN_HTTPS]);
  if (!sid || typeof sid !== 'string') return null;

  const session = sessions.get(sid);
  if (!session) return null;

  const now = Date.now();
  if (now >= session.expiresAt || now - session.lastActivityAt >= SESSION_IDLE_TTL_MS) {
    sessions.delete(sid);
    return null;
  }

  session.lastActivityAt = now;
  return session;
}

function destroyAdminSession(req) {
  const session = getValidAdminSession(req);
  if (session) {
    sessions.delete(session.sid);
  }
  const secure = isHttpsRequest(req);
  const clearCookies = [
    buildCookieHeader(COOKIE_ADMIN_HTTP, '', { secure: false, maxAgeSec: 0, httpOnly: true, sameSite: 'Strict' }),
    buildCookieHeader(COOKIE_CSRF_HTTP, '', { secure: false, maxAgeSec: 0, httpOnly: true, sameSite: 'Strict' })
  ];
  if (secure) {
    clearCookies.push(
      buildCookieHeader(COOKIE_ADMIN_HTTPS, '', { secure: true, maxAgeSec: 0, httpOnly: true, sameSite: 'Strict' }),
      buildCookieHeader(COOKIE_CSRF_HTTPS, '', { secure: true, maxAgeSec: 0, httpOnly: true, sameSite: 'Strict' })
    );
  }
  return clearCookies;
}

function issuePreLoginCsrf(req) {
  const cookies = parseCookies(req);
  const cookieName = getCsrfCookieName(req);
  const existing = cookies[cookieName];
  if (existing && /^[A-Za-z0-9_-]{32,64}$/.test(existing)) {
    return { csrfToken: existing, setCookie: null };
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const setCookie = buildCookieHeader(cookieName, token, {
    secure: isHttpsRequest(req),
    maxAgeSec: 3600,
    httpOnly: true,
    sameSite: 'Strict'
  });
  return { csrfToken: token, setCookie };
}

function verifyPreLoginCsrf(req) {
  const cookies = parseCookies(req);
  const cookieToken = cookies[getCsrfCookieName(req)];
  const headerToken = req.headers['x-csrf-token'];
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;
  if (cookieToken.length < 32 || headerToken.length < 32) return false;
  return timingSafeStringEqual(cookieToken, headerToken);
}

function verifySessionCsrf(req, session) {
  if (!session) return false;
  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || headerToken.length < 32) return false;
  return timingSafeStringEqual(session.csrfToken, headerToken);
}

function verifyAdminApiToken(req) {
  if (!config.adminApiToken) return false;
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (timingSafeStringEqual(token, config.adminApiToken)) {
      return true;
    }
  }
  const xAdmin = req.headers['x-admin-token'];
  if (typeof xAdmin === 'string' && timingSafeStringEqual(xAdmin.trim(), config.adminApiToken)) {
    return true;
  }
  return false;
}

function isAdminAuthorized(req) {
  if (getValidAdminSession(req)) return { ok: true, method: 'session' };
  if (verifyAdminApiToken(req)) return { ok: true, method: 'token' };
  return { ok: false, method: null };
}

function isOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) {
    // Non-browser clients (e.g. curl with Bearer token) or same-origin requests without Origin header.
    // Check Sec-Fetch-Site if present (browsers send this on fetch/XHR).
    const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return false;
    }
    return true;
  }
  const normalized = String(origin).trim().replace(/\/+$/, '');
  if (config.allowedOrigins.has(normalized)) return true;

  // Also allow exact host match when accessed via reverse proxy
  const host = String(req.headers.host || '').trim();
  if (host) {
    const scheme = isHttpsRequest(req) ? 'https' : 'http';
    if (normalized === `${scheme}://${host}`) return true;
  }
  return false;
}

function buildSecurityHeaders(req, { isAdminPage = false } = {}) {
  // TODO(security): Public wedding invitation page (index.html) uses inline style="..." attributes
  // from the original Song Hy Xanh template, requiring style-src 'unsafe-inline'. Script execution
  // strictly enforces script-src 'self' with zero inline scripts or eval. The /admin page uses
  // strictly external CSS & JS without any 'unsafe-inline'.
  const csp = isAdminPage
    ? "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self'; connect-src 'self'; frame-src https://maps.google.com https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

  const headers = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };

  if (isHttpsRequest(req)) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  if (isAdminPage) {
    headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
    headers['Cache-Control'] = 'no-store';
  }
  return headers;
}

module.exports = {
  getClientIp,
  isHttpsRequest,
  checkRateLimit,
  recordFailedLoginAttempt,
  isLoginLocked,
  clearLoginFailures,
  hashPassword,
  verifyAdminPassword,
  createAdminSession,
  getValidAdminSession,
  destroyAdminSession,
  issuePreLoginCsrf,
  verifyPreLoginCsrf,
  verifySessionCsrf,
  verifyAdminApiToken,
  isAdminAuthorized,
  isOriginAllowed,
  buildSecurityHeaders
};
