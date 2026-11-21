'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { config } = require('./config.js');
const {
  getClientIp,
  checkRateLimit,
  recordFailedLoginAttempt,
  isLoginLocked,
  clearLoginFailures,
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
} = require('./security.js');
const {
  notifyRsvpConfirmed,
  notifyNewWish,
  notifyAdminTest
} = require('./telegram-notifier.js');

const SUBMISSIONS_DIR = path.join(__dirname, '..', 'data', 'submissions');
const WISHES_FILE = path.join(SUBMISSIONS_DIR, 'wishes.json');
const RSVPS_FILE = path.join(SUBMISSIONS_DIR, 'rsvps.json');
const ALL_FILE = path.join(SUBMISSIONS_DIR, 'all-submissions.json');

const DEFAULT_WISHES = [];
const MAX_JSON_BODY_BYTES = 32 * 1024; // 32 KB
const MAX_WISHES_STORED = 5000;
const MAX_RSVPS_STORED = 5000;

let writeQueue = Promise.resolve();

function enqueueWrite(task) {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
}

function formatVNTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return `${map.hour}:${map.minute}:${map.second} ${map.day}/${map.month}/${map.year}`;
}

function sanitizeText(value, maxLen) {
  // Remove NUL and non-printable control chars (preserve newline and tab)
  return String(value ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function computeRsvpSummary(rsvps) {
  const yesList = rsvps.filter((r) => r.attending === 'yes');
  const noList = rsvps.filter((r) => r.attending !== 'yes');
  const totalGuests = yesList.reduce((sum, r) => sum + (Number(r.guests) || 1), 0);
  return {
    totalResponses: rsvps.length,
    attendingResponses: yesList.length,
    declinedResponses: noList.length,
    totalAttendingGuests: totalGuests,
    updatedAt: new Date().toISOString()
  };
}

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const tmpFile = path.join(
    dir,
    `.${path.basename(filePath)}.tmp.${process.pid}.${crypto.randomBytes(6).toString('hex')}`
  );
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpFile, content, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpFile, filePath);
}

function ensureStorageFiles() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) {
    fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(WISHES_FILE)) {
    atomicWriteJson(WISHES_FILE, DEFAULT_WISHES);
  }
  if (!fs.existsSync(RSVPS_FILE)) {
    atomicWriteJson(RSVPS_FILE, {
      summary: computeRsvpSummary([]),
      items: []
    });
  }
  if (!fs.existsSync(ALL_FILE)) {
    syncAllSubmissionsFile();
  }
}

function readWishes() {
  ensureStorageFiles();
  try {
    const raw = fs.readFileSync(WISHES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
  } catch (_) {}
  return [...DEFAULT_WISHES];
}

function readRsvps() {
  ensureStorageFiles();
  try {
    const raw = fs.readFileSync(RSVPS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
  } catch (_) {}
  return [];
}

function syncAllSubmissionsFile(wishesOpt, rsvpsOpt) {
  try {
    const wishes = wishesOpt || readWishes();
    const rsvps = rsvpsOpt || readRsvps();
    const summary = computeRsvpSummary(rsvps);

    const combined = {
      updatedAt: new Date().toISOString(),
      rsvpSummary: summary,
      totalWishes: Array.isArray(wishes) ? wishes.length : 0,
      rsvps,
      wishes: Array.isArray(wishes) ? wishes : DEFAULT_WISHES
    };
    atomicWriteJson(ALL_FILE, combined);
  } catch (_) {}
}

function writeWishes(wishes) {
  ensureStorageFiles();
  const trimmed = wishes.slice(0, MAX_WISHES_STORED);
  atomicWriteJson(WISHES_FILE, trimmed);
  syncAllSubmissionsFile(trimmed, null);
  return trimmed;
}

function writeRsvps(rsvps) {
  ensureStorageFiles();
  const trimmed = rsvps.slice(0, MAX_RSVPS_STORED);
  const payload = {
    summary: computeRsvpSummary(trimmed),
    items: trimmed
  };
  atomicWriteJson(RSVPS_FILE, payload);
  syncAllSubmissionsFile(null, trimmed);
  return payload.summary;
}

function parseJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const ct = String(req.headers['content-type'] || '').toLowerCase();
    if (!ct.includes('application/json')) {
      const err = new Error('UNSUPPORTED_MEDIA_TYPE');
      err.statusCode = 415;
      return reject(err);
    }

    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        req.destroy();
        const err = new Error('REQUEST_TIMEOUT');
        err.statusCode = 408;
        reject(err);
      }
    }, 10000);

    req.on('data', (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        settled = true;
        clearTimeout(timer);
        req.destroy();
        const err = new Error('PAYLOAD_TOO_LARGE');
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (chunks.length === 0) return resolve({});
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          const err = new Error('INVALID_JSON_OBJECT');
          err.statusCode = 400;
          return reject(err);
        }
        resolve(parsed);
      } catch (_) {
        const err = new Error('INVALID_JSON');
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const err = new Error('BODY_READ_ERROR');
      err.statusCode = 400;
      reject(err);
    });
  });
}

function sendJson(req, res, statusCode, data, extraHeaders = {}) {
  const payload = JSON.stringify(data);
  const headers = {
    ...buildSecurityHeaders(req, { isAdminPage: false }),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders
  };
  res.writeHead(statusCode, headers);
  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(payload);
  }
}

function requireAdminMutationAuth(req, res) {
  if (!isOriginAllowed(req)) {
    sendJson(req, res, 403, { ok: false, error: 'Origin không hợp lệ.' });
    return false;
  }
  const session = getValidAdminSession(req);
  if (session) {
    if (!verifySessionCsrf(req, session)) {
      sendJson(req, res, 403, { ok: false, error: 'CSRF token không hợp lệ. Vui lòng tải lại trang.' });
      return false;
    }
    return true;
  }
  if (verifyAdminApiToken(req)) {
    return true;
  }
  sendJson(req, res, 401, { ok: false, error: 'Chưa đăng nhập quản trị.' });
  return false;
}

async function handleApiRequest(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (_) {
    sendJson(req, res, 400, { ok: false, error: 'Đường dẫn không hợp lệ.' });
    return true;
  }

  if (!urlPath.startsWith('/api/')) return false;

  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    sendJson(req, res, 405, { ok: false, error: 'Method Not Allowed' }, { Allow: 'GET, HEAD, POST' });
    return true;
  }

  ensureStorageFiles();
  const clientIp = getClientIp(req);

  // GET /api/health
  if (urlPath === '/api/health' && (method === 'GET' || method === 'HEAD')) {
    sendJson(req, res, 200, { ok: true, status: 'healthy' });
    return true;
  }

  // =========================================================================
  // PUBLIC GUEST ENDPOINTS
  // TODO(security): Public wedding guestbook & RSVP submission endpoints are
  // intentionally accessible without user accounts for invited wedding guests;
  // protected via strict input validation, origin checks, payload caps, and
  // per-IP rate limiting (both in Nginx and Node.js).
  // =========================================================================

  // GET /api/wishes
  if (urlPath === '/api/wishes' && (method === 'GET' || method === 'HEAD')) {
    const rl = checkRateLimit('public_read', clientIp, 120, 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    const wishes = readWishes();
    sendJson(req, res, 200, { ok: true, total: wishes.length, wishes });
    return true;
  }

  // POST /api/wishes
  if (urlPath === '/api/wishes' && method === 'POST') {
    if (!isOriginAllowed(req)) {
      sendJson(req, res, 403, { ok: false, error: 'Yêu cầu không hợp lệ.' });
      return true;
    }
    const rl = checkRateLimit('guest_submit', clientIp, 10, 10 * 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Bạn gửi quá nhiều yêu cầu, vui lòng chờ vài phút.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const name = sanitizeText(body.name, 120);
      const message = sanitizeText(body.message, 2000);
      if (!name || !message) {
        sendJson(req, res, 400, { ok: false, error: 'Vui lòng nhập đầy đủ tên và lời chúc.' });
        return true;
      }

      const now = new Date();
      const item = {
        id: `wish_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`,
        name,
        message,
        time: formatVNTime(now),
        createdAt: now.toISOString()
      };

      const wishes = await enqueueWrite(() => {
        const current = readWishes();
        current.unshift(item);
        return writeWishes(current);
      });

      // Notify Telegram in parallel (non-blocking)
      notifyNewWish(item, wishes.length).catch(() => {});

      sendJson(req, res, 201, { ok: true, item, total: wishes.length, wishes });
    } catch (err) {
      const status = err.statusCode || 400;
      const msg = status === 413
        ? 'Nội dung gửi lên quá lớn.'
        : status === 415
          ? 'Định dạng dữ liệu phải là JSON.'
          : 'Dữ liệu gửi lên không hợp lệ.';
      sendJson(req, res, status, { ok: false, error: msg });
    }
    return true;
  }

  // POST /api/rsvps
  if (urlPath === '/api/rsvps' && method === 'POST') {
    if (!isOriginAllowed(req)) {
      sendJson(req, res, 403, { ok: false, error: 'Yêu cầu không hợp lệ.' });
      return true;
    }
    const rl = checkRateLimit('guest_submit', clientIp, 10, 10 * 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Bạn gửi quá nhiều yêu cầu, vui lòng chờ vài phút.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    try {
      const body = await parseJsonBody(req);
      const name = sanitizeText(body.name, 120);
      if (!name) {
        sendJson(req, res, 400, { ok: false, error: 'Vui lòng nhập tên của bạn.' });
        return true;
      }

      const attending = body.attending === 'no' ? 'no' : 'yes';
      const parsedGuests = parseInt(body.guests, 10);
      const guests = attending === 'yes' ? Math.max(1, Math.min(20, Number.isFinite(parsedGuests) ? parsedGuests : 1)) : 0;
      const note = sanitizeText(body.note, 1000);
      const now = new Date();

      const item = {
        id: `rsvp_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`,
        name,
        attending,
        attendingLabel: attending === 'yes' ? 'Có, mình sẽ tham dự' : 'Rất tiếc, mình không thể tham dự',
        guests,
        note,
        time: formatVNTime(now),
        createdAt: now.toISOString()
      };

      const summary = await enqueueWrite(() => {
        const current = readRsvps();
        current.unshift(item);
        return writeRsvps(current);
      });

      // Notify Telegram in parallel (only when attending === 'yes' unless configured otherwise)
      notifyRsvpConfirmed(item, summary).catch(() => {});

      // Security: return only the submitter's own item, never expose other guests' RSVP list
      sendJson(req, res, 201, { ok: true, item });
    } catch (err) {
      const status = err.statusCode || 400;
      const msg = status === 413
        ? 'Nội dung gửi lên quá lớn.'
        : status === 415
          ? 'Định dạng dữ liệu phải là JSON.'
          : 'Dữ liệu gửi lên không hợp lệ.';
      sendJson(req, res, status, { ok: false, error: msg });
    }
    return true;
  }

  // =========================================================================
  // ADMIN AUTH & SESSION ENDPOINTS
  // =========================================================================

  // GET /api/admin/session
  if (urlPath === '/api/admin/session' && (method === 'GET' || method === 'HEAD')) {
    const rl = checkRateLimit('admin_session', clientIp, 60, 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Quá nhiều yêu cầu.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    const session = getValidAdminSession(req);
    if (session) {
      sendJson(req, res, 200, {
        ok: true,
        authenticated: true,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
        telegramConfigured: Boolean(config.telegramBotToken && config.telegramChatId)
      });
      return true;
    }

    const { csrfToken, setCookie } = issuePreLoginCsrf(req);
    const extra = setCookie ? { 'Set-Cookie': setCookie } : {};
    sendJson(req, res, 200, {
      ok: true,
      authenticated: false,
      csrfToken
    }, extra);
    return true;
  }

  // POST /api/admin/login
  if (urlPath === '/api/admin/login' && method === 'POST') {
    if (!isOriginAllowed(req)) {
      sendJson(req, res, 403, { ok: false, error: 'Origin không hợp lệ.' });
      return true;
    }
    if (!verifyPreLoginCsrf(req)) {
      sendJson(req, res, 403, { ok: false, error: 'Phiên bảo mật hết hạn, vui lòng tải lại trang.' });
      return true;
    }

    const lock = isLoginLocked(clientIp);
    if (lock.locked) {
      sendJson(
        req,
        res,
        429,
        { ok: false, error: `Nhập sai quá nhiều lần. Vui lòng thử lại sau ${lock.retryAfterSec} giây.` },
        { 'Retry-After': String(lock.retryAfterSec) }
      );
      return true;
    }

    try {
      const body = await parseJsonBody(req, 4096);
      const password = typeof body.password === 'string' ? body.password : '';

      if (!config.adminPasswordHash) {
        sendJson(req, res, 503, { ok: false, error: 'Chưa cấu hình mật khẩu quản trị trên máy chủ.' });
        return true;
      }

      if (!verifyAdminPassword(password)) {
        recordFailedLoginAttempt(clientIp);
        sendJson(req, res, 401, { ok: false, error: 'Mật khẩu không chính xác.' });
        return true;
      }

      clearLoginFailures(clientIp);
      const { session, cookies } = createAdminSession(req);
      sendJson(
        req,
        res,
        200,
        {
          ok: true,
          authenticated: true,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
          telegramConfigured: Boolean(config.telegramBotToken && config.telegramChatId)
        },
        { 'Set-Cookie': cookies }
      );
    } catch (err) {
      sendJson(req, res, err.statusCode || 400, { ok: false, error: 'Yêu cầu đăng nhập không hợp lệ.' });
    }
    return true;
  }

  // POST /api/admin/logout
  if (urlPath === '/api/admin/logout' && method === 'POST') {
    if (!isOriginAllowed(req)) {
      sendJson(req, res, 403, { ok: false, error: 'Origin không hợp lệ.' });
      return true;
    }
    const session = getValidAdminSession(req);
    if (session && !verifySessionCsrf(req, session)) {
      sendJson(req, res, 403, { ok: false, error: 'CSRF token không hợp lệ.' });
      return true;
    }
    const clearCookies = destroyAdminSession(req);
    sendJson(req, res, 200, { ok: true }, { 'Set-Cookie': clearCookies });
    return true;
  }

  // =========================================================================
  // PROTECTED ADMIN DATA ENDPOINTS
  // =========================================================================

  // GET /api/rsvps (Protected)
  if (urlPath === '/api/rsvps' && (method === 'GET' || method === 'HEAD')) {
    const rl = checkRateLimit('admin_api', clientIp, 60, 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Quá nhiều yêu cầu.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    const auth = isAdminAuthorized(req);
    if (!auth.ok) {
      sendJson(req, res, 401, { ok: false, error: 'Vui lòng đăng nhập quản trị để xem danh sách RSVP.' });
      return true;
    }
    const rsvps = readRsvps();
    const summary = computeRsvpSummary(rsvps);
    sendJson(req, res, 200, { ok: true, summary, rsvps });
    return true;
  }

  // GET /api/submissions (Protected)
  if (urlPath === '/api/submissions' && (method === 'GET' || method === 'HEAD')) {
    const rl = checkRateLimit('admin_api', clientIp, 60, 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Quá nhiều yêu cầu.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    const auth = isAdminAuthorized(req);
    if (!auth.ok) {
      sendJson(req, res, 401, { ok: false, error: 'Vui lòng đăng nhập quản trị để xem dữ liệu tổng hợp.' });
      return true;
    }
    const wishes = readWishes();
    const rsvps = readRsvps();
    const rsvpSummary = computeRsvpSummary(rsvps);
    sendJson(req, res, 200, {
      ok: true,
      rsvpSummary,
      totalWishes: wishes.length,
      rsvps,
      wishes
    });
    return true;
  }

  // POST /api/admin/rsvps/delete (Protected + CSRF)
  if (urlPath === '/api/admin/rsvps/delete' && method === 'POST') {
    const rl = checkRateLimit('admin_api', clientIp, 60, 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Quá nhiều yêu cầu.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    if (!requireAdminMutationAuth(req, res)) return true;

    try {
      const body = await parseJsonBody(req, 4096);
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!/^rsvp_[A-Za-z0-9_]{4,64}$/.test(id)) {
        sendJson(req, res, 400, { ok: false, error: 'ID không hợp lệ.' });
        return true;
      }

      const result = await enqueueWrite(() => {
        const current = readRsvps();
        const filtered = current.filter((item) => item.id !== id);
        if (filtered.length === current.length) {
          return { found: false, rsvps: current, summary: computeRsvpSummary(current) };
        }
        const summary = writeRsvps(filtered);
        return { found: true, rsvps: filtered, summary };
      });

      if (!result.found) {
        sendJson(req, res, 404, { ok: false, error: 'Không tìm thấy bản ghi RSVP.' });
        return true;
      }
      sendJson(req, res, 200, { ok: true, summary: result.summary, rsvps: result.rsvps });
    } catch (err) {
      sendJson(req, res, err.statusCode || 400, { ok: false, error: 'Yêu cầu không hợp lệ.' });
    }
    return true;
  }

  // POST /api/admin/wishes/delete (Protected + CSRF)
  if (urlPath === '/api/admin/wishes/delete' && method === 'POST') {
    const rl = checkRateLimit('admin_api', clientIp, 60, 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Quá nhiều yêu cầu.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    if (!requireAdminMutationAuth(req, res)) return true;

    try {
      const body = await parseJsonBody(req, 4096);
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!/^wish_[A-Za-z0-9_]{4,64}$/.test(id)) {
        sendJson(req, res, 400, { ok: false, error: 'ID không hợp lệ.' });
        return true;
      }

      const result = await enqueueWrite(() => {
        const current = readWishes();
        const filtered = current.filter((item) => item.id !== id);
        if (filtered.length === current.length) {
          return { found: false, wishes: current };
        }
        const saved = writeWishes(filtered);
        return { found: true, wishes: saved };
      });

      if (!result.found) {
        sendJson(req, res, 404, { ok: false, error: 'Không tìm thấy lời chúc.' });
        return true;
      }
      sendJson(req, res, 200, { ok: true, total: result.wishes.length, wishes: result.wishes });
    } catch (err) {
      sendJson(req, res, err.statusCode || 400, { ok: false, error: 'Yêu cầu không hợp lệ.' });
    }
    return true;
  }

  // POST /api/admin/test-telegram (Protected + CSRF)
  if (urlPath === '/api/admin/test-telegram' && method === 'POST') {
    if (!requireAdminMutationAuth(req, res)) return true;
    const rl = checkRateLimit('admin_tg_test', clientIp, 3, 5 * 60 * 1000);
    if (!rl.allowed) {
      sendJson(req, res, 429, { ok: false, error: 'Vui lòng chờ vài phút trước khi gửi thử lại.' }, { 'Retry-After': String(rl.retryAfterSec) });
      return true;
    }
    const result = await notifyAdminTest();
    if (!result.ok) {
      sendJson(req, res, 502, { ok: false, error: 'Không thể gửi tin nhắn Telegram. Hãy kiểm tra cấu hình bot.' });
      return true;
    }
    sendJson(req, res, 200, { ok: true, message: 'Đã gửi tin nhắn kiểm tra tới Telegram!' });
    return true;
  }

  sendJson(req, res, 404, { ok: false, error: 'API endpoint not found' });
  return true;
}

ensureStorageFiles();

module.exports = {
  handleApiRequest,
  ensureStorageFiles,
  SUBMISSIONS_DIR,
  WISHES_FILE,
  RSVPS_FILE,
  ALL_FILE
};
