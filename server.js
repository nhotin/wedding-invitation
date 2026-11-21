'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { config } = require('./backend/config.js');
const { buildSecurityHeaders } = require('./backend/security.js');
const { handleApiRequest } = require('./backend/submissions-api.js');

const ROOT = fs.realpathSync(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Strict allowlist of top-level public files
const EXACT_FILES = new Map([
  ['/', { rel: 'index.html', cache: 'no-cache', isAdminPage: false }],
  ['/index.html', { rel: 'index.html', cache: 'no-cache', isAdminPage: false }],
  ['/admin', { rel: 'admin.html', cache: 'no-store', isAdminPage: true }],
  ['/admin/', { rel: 'admin.html', cache: 'no-store', isAdminPage: true }],
  ['/styles.css', { rel: 'styles.css', cache: 'public, max-age=3600', isAdminPage: false }],
  ['/app.js', { rel: 'app.js', cache: 'public, max-age=3600', isAdminPage: false }],
  ['/admin.css', { rel: 'admin.css', cache: 'no-cache', isAdminPage: false }],
  ['/admin.js', { rel: 'admin.js', cache: 'no-cache', isAdminPage: false }],
  ['/favicon.ico', { rel: path.join('public', 'favicon.ico'), cache: 'public, max-age=86400', isAdminPage: false }],
  ['/favicon.png', { rel: path.join('public', 'favicon.png'), cache: 'public, max-age=86400', isAdminPage: false }],
  ['/apple-touch-icon.png', { rel: path.join('public', 'apple-touch-icon.png'), cache: 'public, max-age=86400', isAdminPage: false }]
]);

// Strict allowlist of public asset directories (never expose source code, .git, backend, or data/submissions)
const ALLOWED_PREFIXES = [
  {
    prefix: '/assets/',
    roots: [path.join(ROOT, 'assets'), path.join(ROOT, 'public', 'assets')],
    cache: 'public, max-age=86400'
  },
  {
    prefix: '/images/',
    roots: [path.join(ROOT, 'images'), path.join(ROOT, 'public', 'images')],
    cache: 'public, max-age=86400'
  },
  {
    prefix: '/fonts/',
    roots: [path.join(ROOT, 'public', 'fonts')],
    cache: 'public, max-age=604800'
  },
  {
    prefix: '/data/images/',
    roots: [path.join(ROOT, 'data', 'images')],
    cache: 'public, max-age=86400'
  },
  {
    prefix: '/data/audio/',
    roots: [path.join(ROOT, 'data', 'audio')],
    cache: 'public, max-age=86400'
  }
];

function resolveWithinRoot(baseDir, subPath) {
  if (!fs.existsSync(baseDir)) return null;
  // Reject NUL bytes, backslashes, or any hidden dotfile/dotdir segments
  if (subPath.includes('\0') || subPath.includes('\\')) return null;
  const segments = subPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || seg.startsWith('.')) return null;
  }

  const realBase = fs.realpathSync(baseDir);
  const candidate = path.resolve(realBase, ...segments);
  if (!candidate.startsWith(realBase + path.sep)) return null;

  try {
    const realCandidate = fs.realpathSync(candidate);
    if (!realCandidate.startsWith(realBase + path.sep)) return null;
    const ext = path.extname(realCandidate).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(MIME_TYPES, ext)) return null;
    return realCandidate;
  } catch (_) {
    return null;
  }
}

function resolvePublicFile(urlPath) {
  if (EXACT_FILES.has(urlPath)) {
    const entry = EXACT_FILES.get(urlPath);
    const fullPath = path.resolve(ROOT, entry.rel);
    if (!fullPath.startsWith(ROOT + path.sep)) return null;
    try {
      const realPath = fs.realpathSync(fullPath);
      if (!realPath.startsWith(ROOT + path.sep)) return null;
      return { filePath: realPath, cache: entry.cache, isAdminPage: entry.isAdminPage };
    } catch (_) {
      return null;
    }
  }

  for (const rule of ALLOWED_PREFIXES) {
    if (!urlPath.startsWith(rule.prefix)) continue;
    const subPath = urlPath.slice(rule.prefix.length);
    for (const baseDir of rule.roots) {
      const resolved = resolveWithinRoot(baseDir, subPath);
      if (resolved) {
        return { filePath: resolved, cache: rule.cache, isAdminPage: false };
      }
    }
    return null;
  }

  return null;
}

function parseByteRange(rangeHeader, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) return null;
  const startStr = match[1];
  const endStr = match[2];
  if (!startStr && !endStr) return null;

  let start;
  let end;
  if (startStr === '') {
    const suffixLength = parseInt(endStr, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr ? parseInt(endStr, 10) : fileSize - 1;
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return null;
  }
  end = Math.min(end, fileSize - 1);
  return { start, end };
}

function sendPlainError(req, res, statusCode, message, extraHeaders = {}) {
  const body = `${message}\n`;
  const headers = {
    ...buildSecurityHeaders(req, { isAdminPage: false }),
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders
  };
  res.writeHead(statusCode, headers);
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

const server = http.createServer(async (req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    sendPlainError(req, res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD, POST' });
    return;
  }

  try {
    const handled = await handleApiRequest(req, res);
    if (handled) return;
  } catch (err) {
    console.error('[server] API error:', err.code || 'INTERNAL_ERROR');
    const body = JSON.stringify({ ok: false, error: 'Internal Server Error' });
    res.writeHead(500, {
      ...buildSecurityHeaders(req, { isAdminPage: false }),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body)
    });
    res.end(method === 'HEAD' ? '' : body);
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    sendPlainError(req, res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (_) {
    sendPlainError(req, res, 400, 'Bad Request');
    return;
  }

  const resolved = resolvePublicFile(urlPath);
  if (!resolved) {
    sendPlainError(req, res, 404, 'Not Found');
    return;
  }

  fs.stat(resolved.filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      sendPlainError(req, res, 404, 'Not Found');
      return;
    }

    const ext = path.extname(resolved.filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const baseHeaders = {
      ...buildSecurityHeaders(req, { isAdminPage: resolved.isAdminPage }),
      'Content-Type': contentType,
      'Cache-Control': resolved.cache,
      'Accept-Ranges': 'bytes'
    };

    // Support safe HTTP Range requests for smooth MP3 audio playback
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parsed = parseByteRange(rangeHeader, stat.size);
      if (!parsed) {
        sendPlainError(req, res, 416, 'Range Not Satisfiable', {
          'Content-Range': `bytes */${stat.size}`
        });
        return;
      }
      const { start, end } = parsed;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': chunkSize
      });
      if (method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(resolved.filePath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) sendPlainError(req, res, 500, 'Internal Server Error');
        else res.destroy();
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      ...baseHeaders,
      'Content-Length': stat.size
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(resolved.filePath);
    stream.on('error', () => {
      if (!res.headersSent) sendPlainError(req, res, 500, 'Internal Server Error');
      else res.destroy();
    });
    stream.pipe(res);
  });
});

server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 65000;

server.listen(config.port, config.host, () => {
  console.log(`Wedding invitation server running at http://${config.host}:${config.port}`);
});

function shutdown(signal) {
  console.log(`[server] Received ${signal}, shutting down cleanly...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
