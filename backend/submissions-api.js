const fs = require('fs');
const path = require('path');

const SUBMISSIONS_DIR = path.join(__dirname, '..', 'data', 'submissions');
const WISHES_FILE = path.join(SUBMISSIONS_DIR, 'wishes.json');
const RSVPS_FILE = path.join(SUBMISSIONS_DIR, 'rsvps.json');
const ALL_FILE = path.join(SUBMISSIONS_DIR, 'all-submissions.json');

const DEFAULT_WISHES = [
  {
    id: 'wish_seed_1',
    name: 'Gia đình cô Lan',
    message: 'Chúc hai cháu Nho Tín & Hồng Ngân trăm năm hạnh phúc, sớm sinh quý tử!',
    time: '09:30:12 22/11/2026',
    createdAt: '2026-11-22T09:30:12+07:00'
  },
  {
    id: 'wish_seed_2',
    name: 'Hội bạn thân',
    message: 'Hy vọng tổ ấm nhỏ của Nho Tín và Hồng Ngân sẽ luôn rộn rã tiếng cười và hạnh phúc viên mãn.',
    time: '14:18:45 22/11/2026',
    createdAt: '2026-11-22T14:18:45+07:00'
  },
  {
    id: 'wish_seed_3',
    name: 'Anh chị đồng nghiệp',
    message: 'Mong hai bạn xây dựng một mái ấm tràn đầy tiếng cười và niềm vui.',
    time: '19:05:20 22/11/2026',
    createdAt: '2026-11-22T19:05:20+07:00'
  }
];

function formatVNTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
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

function ensureStorageFiles() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) {
    fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(WISHES_FILE)) {
    fs.writeFileSync(WISHES_FILE, JSON.stringify(DEFAULT_WISHES, null, 2), 'utf8');
  }
  if (!fs.existsSync(RSVPS_FILE)) {
    const initialRsvpData = {
      summary: computeRsvpSummary([]),
      items: []
    };
    fs.writeFileSync(RSVPS_FILE, JSON.stringify(initialRsvpData, null, 2), 'utf8');
  }
  syncAllSubmissionsFile();
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
    const wishes = wishesOpt || (fs.existsSync(WISHES_FILE) ? JSON.parse(fs.readFileSync(WISHES_FILE, 'utf8')) : DEFAULT_WISHES);
    const rsvpsRaw = rsvpsOpt || (fs.existsSync(RSVPS_FILE) ? JSON.parse(fs.readFileSync(RSVPS_FILE, 'utf8')) : []);
    const rsvps = Array.isArray(rsvpsRaw) ? rsvpsRaw : (rsvpsRaw.items || []);
    const summary = computeRsvpSummary(rsvps);

    const combined = {
      updatedAt: new Date().toISOString(),
      rsvpSummary: summary,
      totalWishes: Array.isArray(wishes) ? wishes.length : 0,
      rsvps,
      wishes: Array.isArray(wishes) ? wishes : DEFAULT_WISHES
    };
    fs.writeFileSync(ALL_FILE, JSON.stringify(combined, null, 2), 'utf8');
  } catch (_) {}
}

function writeWishes(wishes) {
  ensureStorageFiles();
  fs.writeFileSync(WISHES_FILE, JSON.stringify(wishes, null, 2), 'utf8');
  syncAllSubmissionsFile(wishes, null);
}

function writeRsvps(rsvps) {
  ensureStorageFiles();
  const payload = {
    summary: computeRsvpSummary(rsvps),
    items: rsvps
  };
  fs.writeFileSync(RSVPS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  syncAllSubmissionsFile(null, rsvps);
  return payload.summary;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

async function handleApiRequest(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (!urlPath.startsWith('/api/')) return false;

  ensureStorageFiles();

  // GET /api/wishes
  if (urlPath === '/api/wishes' && req.method === 'GET') {
    const wishes = readWishes();
    sendJson(res, 200, { ok: true, total: wishes.length, wishes });
    return true;
  }

  // POST /api/wishes
  if (urlPath === '/api/wishes' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const name = String(body.name || '').trim().slice(0, 500);
      const message = String(body.message || '').trim().slice(0, 10000);
      if (!name || !message) {
        sendJson(res, 400, { ok: false, error: 'Vui lòng nhập đầy đủ tên và lời chúc.' });
        return true;
      }

      const now = new Date();
      const item = {
        id: `wish_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        message,
        time: body.time ? String(body.time) : formatVNTime(now),
        createdAt: now.toISOString()
      };

      const wishes = readWishes();
      wishes.unshift(item);
      writeWishes(wishes);

      sendJson(res, 201, { ok: true, item, total: wishes.length, wishes });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    return true;
  }

  // GET /api/rsvps
  if (urlPath === '/api/rsvps' && req.method === 'GET') {
    const rsvps = readRsvps();
    const summary = computeRsvpSummary(rsvps);
    sendJson(res, 200, { ok: true, summary, rsvps });
    return true;
  }

  // POST /api/rsvps
  if (urlPath === '/api/rsvps' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const name = String(body.name || '').trim().slice(0, 500);
      if (!name) {
        sendJson(res, 400, { ok: false, error: 'Vui lòng nhập tên của bạn.' });
        return true;
      }

      const attending = body.attending === 'no' ? 'no' : 'yes';
      const guests = attending === 'yes' ? Math.max(1, Math.min(20, parseInt(body.guests, 10) || 1)) : 0;
      const note = String(body.note || '').trim().slice(0, 5000);
      const now = new Date();

      const item = {
        id: `rsvp_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        attending,
        attendingLabel: attending === 'yes' ? 'Có, mình sẽ tham dự' : 'Rất tiếc, mình không thể tham dự',
        guests,
        note,
        time: formatVNTime(now),
        createdAt: now.toISOString()
      };

      const rsvps = readRsvps();
      rsvps.unshift(item);
      const summary = writeRsvps(rsvps);

      sendJson(res, 201, { ok: true, item, summary, rsvps });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    return true;
  }

  // GET /api/submissions (Combined view)
  if (urlPath === '/api/submissions' && req.method === 'GET') {
    const wishes = readWishes();
    const rsvps = readRsvps();
    const rsvpSummary = computeRsvpSummary(rsvps);
    sendJson(res, 200, {
      ok: true,
      files: {
        wishesFile: 'data/submissions/wishes.json',
        rsvpsFile: 'data/submissions/rsvps.json',
        allSubmissionsFile: 'data/submissions/all-submissions.json'
      },
      rsvpSummary,
      totalWishes: wishes.length,
      rsvps,
      wishes
    });
    return true;
  }

  sendJson(res, 404, { ok: false, error: 'API endpoint not found' });
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
