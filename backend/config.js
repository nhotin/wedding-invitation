'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_ENV_FILE = path.join(os.homedir(), '.config', 'wedding-invitation', '.env');
const LOCAL_ENV_FILE = path.join(__dirname, '..', '.env');

function parseEnvFile(filePath) {
  const result = {};
  if (!filePath || !fs.existsSync(filePath)) return result;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) result[key] = val;
    }
  } catch (err) {
    console.warn('[config] Failed to read env file:', err.code || 'ERR');
  }
  return result;
}

function loadConfig() {
  const envFilePath = process.env.WEDDING_ENV_FILE || (fs.existsSync(LOCAL_ENV_FILE) ? LOCAL_ENV_FILE : DEFAULT_ENV_FILE);
  const fileVars = parseEnvFile(envFilePath);

  const getVar = (name, fallback = '') => {
    if (process.env[name] !== undefined && process.env[name] !== '') {
      return String(process.env[name]).trim();
    }
    if (fileVars[name] !== undefined && fileVars[name] !== '') {
      return String(fileVars[name]).trim();
    }
    return fallback;
  };

  const portRaw = parseInt(getVar('PORT', '3003'), 10);
  const port = Number.isInteger(portRaw) && portRaw >= 1 && portRaw <= 65535 ? portRaw : 3003;

  // Bind loopback only by default so traffic must go through Nginx + Cloudflare Tunnel
  const hostRaw = getVar('HOST', '127.0.0.1');
  const host = hostRaw === '127.0.0.1' || hostRaw === '::1' || hostRaw === 'localhost' ? hostRaw : '127.0.0.1';

  const publicOrigin = getVar('PUBLIC_ORIGIN', 'https://wedding.nhotin.space').replace(/\/+$/, '');

  const adminPasswordHash = getVar('ADMIN_PASSWORD_HASH', '');
  const adminApiToken = getVar('ADMIN_API_TOKEN', '');

  let sessionSecret = getVar('SESSION_SECRET', '');
  if (!sessionSecret) {
    console.warn('[security] SESSION_SECRET not configured; generating ephemeral per-instance secret.');
    sessionSecret = crypto.randomBytes(32).toString('hex');
  }

  const telegramBotToken = getVar('TELEGRAM_BOT_TOKEN', '');
  const telegramChatId = getVar('TELEGRAM_CHAT_ID', '');
  const telegramNotifyDeclined = getVar('TELEGRAM_NOTIFY_DECLINED', 'false').toLowerCase() === 'true';

  const allowedOrigins = new Set([
    publicOrigin,
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`
  ]);

  const extraOrigins = getVar('EXTRA_ALLOWED_ORIGINS', '');
  if (extraOrigins) {
    for (const item of extraOrigins.split(',')) {
      const cleaned = item.trim().replace(/\/+$/, '');
      if (cleaned) allowedOrigins.add(cleaned);
    }
  }

  return Object.freeze({
    envFilePath,
    port,
    host,
    publicOrigin,
    adminPasswordHash,
    adminApiToken,
    sessionSecret,
    telegramBotToken,
    telegramChatId,
    telegramNotifyDeclined,
    allowedOrigins
  });
}

const config = loadConfig();

module.exports = {
  config,
  loadConfig,
  DEFAULT_ENV_FILE
};
