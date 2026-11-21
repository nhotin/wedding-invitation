'use strict';

const https = require('https');
const { config } = require('./config.js');

function escapeTelegramHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateText(text, maxLen) {
  const s = String(text ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function sendTelegramMessage(htmlText) {
  return new Promise((resolve) => {
    const token = config.telegramBotToken;
    const chatId = config.telegramChatId;
    if (!token || !chatId) {
      resolve({ ok: false, skipped: true, reason: 'telegram_not_configured' });
      return;
    }

    const payload = JSON.stringify({
      chat_id: chatId,
      text: truncateText(htmlText, 3900),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const req = https.request(
      {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 4096) body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, statusCode: res.statusCode });
          } else {
            // Do not log token or response secrets
            console.warn(`[telegram] sendMessage failed with HTTP ${res.statusCode}`);
            resolve({ ok: false, statusCode: res.statusCode });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      console.warn('[telegram] sendMessage timed out');
      resolve({ ok: false, reason: 'timeout' });
    });

    req.on('error', (err) => {
      console.warn('[telegram] sendMessage network error:', err.code || 'ERR');
      resolve({ ok: false, reason: err.code || 'network_error' });
    });

    req.write(payload);
    req.end();
  });
}

function notifyRsvpConfirmed(item, summary) {
  if (!item) return Promise.resolve({ ok: false, skipped: true });
  if (item.attending !== 'yes' && !config.telegramNotifyDeclined) {
    return Promise.resolve({ ok: true, skipped: true });
  }

  const isYes = item.attending === 'yes';
  const adminUrl = `${config.publicOrigin}/admin`;
  const lines = [
    isYes ? '💍 <b>KHÁCH XÁC NHẬN THAM DỰ ĐÁM CƯỚI</b>' : '📩 <b>PHẢN HỒI BÁO BẬN THIỆP CƯỚI</b>',
    '━━━━━━━━━━━━━━━━━━',
    `👤 <b>Khách mời:</b> ${escapeTelegramHtml(item.name)}`,
    isYes
      ? `✅ <b>Trạng thái:</b> Đồng ý tham dự (${escapeTelegramHtml(item.guests)} khách)`
      : '❌ <b>Trạng thái:</b> Không thể tham dự',
    `📝 <b>Lời nhắn:</b> ${item.note ? escapeTelegramHtml(truncateText(item.note, 800)) : '<i>Không có</i>'}`,
    `🕒 <b>Thời gian:</b> ${escapeTelegramHtml(item.time)}`,
    `📊 <b>Tổng hợp:</b> ${escapeTelegramHtml(summary.attendingResponses)} lượt đồng ý • ${escapeTelegramHtml(summary.totalAttendingGuests)} khách dự kiến`,
    `🔗 <a href="${escapeTelegramHtml(adminUrl)}">Mở trang quản trị</a>`
  ];

  return sendTelegramMessage(lines.join('\n'));
}

function notifyNewWish(item, totalWishes) {
  if (!item) return Promise.resolve({ ok: false, skipped: true });
  const adminUrl = `${config.publicOrigin}/admin`;
  const lines = [
    '💌 <b>LỜI CHÚC MỚI TRÊN THIỆP CƯỚI</b>',
    '━━━━━━━━━━━━━━━━━━',
    `👤 <b>Người gửi:</b> ${escapeTelegramHtml(item.name)}`,
    `💬 <b>Lời chúc:</b>\n${escapeTelegramHtml(truncateText(item.message, 1500))}`,
    `🕒 <b>Thời gian:</b> ${escapeTelegramHtml(item.time)}`,
    `📊 <b>Tổng lời chúc:</b> ${escapeTelegramHtml(totalWishes)}`,
    `🔗 <a href="${escapeTelegramHtml(adminUrl)}">Mở trang quản trị</a>`
  ];

  return sendTelegramMessage(lines.join('\n'));
}

function notifyAdminTest() {
  const adminUrl = `${config.publicOrigin}/admin`;
  const nowStr = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());

  const lines = [
    '🔔 <b>KIỂM TRA KẾT NỐI TELEGRAM — THIỆP CƯỚI</b>',
    '━━━━━━━━━━━━━━━━━━',
    '✅ Bot Telegram đã kết nối thành công với hệ thống thiệp cưới <b>Nho Tín &amp; Hồng Ngân</b>.',
    `🕒 <b>Thời gian:</b> ${escapeTelegramHtml(nowStr)}`,
    `🔗 <a href="${escapeTelegramHtml(adminUrl)}">Trang quản trị</a>`
  ];

  return sendTelegramMessage(lines.join('\n'));
}

module.exports = {
  notifyRsvpConfirmed,
  notifyNewWish,
  notifyAdminTest
};
