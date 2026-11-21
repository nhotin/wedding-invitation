#!/usr/bin/env bash
set -euo pipefail

# Deploy Nginx reverse proxy + Cloudflare Tunnel ingress for https://wedding.nhotin.space
# Usage: sudo bash /home/nhotin/work/wedding-invitation/deploy/setup_cloudflare_nginx.sh

if [ "${EUID}" -ne 0 ]; then
  echo "Vui lòng chạy script này với sudo:"
  echo "  sudo bash $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RATE_SRC="${SCRIPT_DIR}/nginx-wedding-ratelimit.conf"
VHOST_SRC="${SCRIPT_DIR}/nginx-wedding.nhotin.space.conf"

RATE_DST="/etc/nginx/conf.d/wedding-ratelimit.conf"
VHOST_AVAIL="/etc/nginx/sites-available/wedding.nhotin.space.conf"
VHOST_ENABLED="/etc/nginx/sites-enabled/wedding.nhotin.space.conf"

CF_ETC_CFG="/etc/cloudflared/config.yml"
TARGET_USER="${SUDO_USER:-$(whoami)}"
TARGET_HOME="$(getent passwd "${TARGET_USER}" | cut -d: -f6 || true)"
CF_USER_CFG="${TARGET_HOME:+${TARGET_HOME}/.cloudflared/config.yml}"
BACKUP_TS="$(date +%Y%m%d_%H%M%S)"

echo "==> 1/4: Cài đặt cấu hình Nginx cho wedding.nhotin.space..."
cp "${RATE_SRC}" "${RATE_DST}"
cp "${VHOST_SRC}" "${VHOST_AVAIL}"
ln -sf "${VHOST_AVAIL}" "${VHOST_ENABLED}"
chmod 644 "${RATE_DST}" "${VHOST_AVAIL}"

echo "==> 2/4: Kiểm tra cấu hình Nginx..."
if ! nginx -t; then
  echo "Lỗi cấu hình Nginx! Đang gỡ file mới để giữ hệ thống ổn định..."
  rm -f "${VHOST_ENABLED}" "${RATE_DST}"
  exit 1
fi

systemctl reload nginx
echo "    Nginx đã reload thành công."

echo "==> 3/4: Cập nhật Cloudflare Tunnel ingress (${CF_ETC_CFG})..."
cp "${CF_ETC_CFG}" "${CF_ETC_CFG}.bak.${BACKUP_TS}"

python3 - "${CF_ETC_CFG}" << 'PYEOF'
import sys

cfg_path = sys.argv[1]
with open(cfg_path, "r", encoding="utf-8") as f:
    content = f.read()

if "hostname: wedding.nhotin.space" in content:
    print("    Ingress cho wedding.nhotin.space đã tồn tại, bỏ qua bước chèn.")
    sys.exit(0)

block = """  - hostname: wedding.nhotin.space
    service: https://127.0.0.1:443
    originRequest:
      noTLSVerify: true
"""

anchor = "  - service: http_status:404"
if anchor not in content:
    raise SystemExit("Không tìm thấy dòng catch-all '- service: http_status:404' trong config.yml")

updated = content.replace(anchor, block + anchor, 1)
with open(cfg_path, "w", encoding="utf-8") as f:
    f.write(updated)
print("    Đã thêm ingress wedding.nhotin.space vào", cfg_path)
PYEOF

if ! cloudflared tunnel --config "${CF_ETC_CFG}" ingress validate; then
  echo "Lỗi validate cloudflared config! Đang khôi phục bản sao lưu..."
  cp "${CF_ETC_CFG}.bak.${BACKUP_TS}" "${CF_ETC_CFG}"
  exit 1
fi

# Đồng bộ cấu hình user-level cho nhất quán
if [ -n "${CF_USER_CFG}" ] && [ -d "$(dirname "${CF_USER_CFG}")" ]; then
  cp "${CF_ETC_CFG}" "${CF_USER_CFG}"
  chown "${TARGET_USER}:${TARGET_USER}" "${CF_USER_CFG}"
  chmod 644 "${CF_USER_CFG}"
fi

echo "==> 4/4: Khởi động lại cloudflared.service..."
systemctl restart cloudflared
sleep 2
systemctl is-active --quiet cloudflared && echo "    cloudflared.service đang chạy ổn định."

echo ""
echo "==> Kiểm tra kết nối HTTPS cục bộ qua Nginx:"
curl -sk --resolve wedding.nhotin.space:443:127.0.0.1 https://wedding.nhotin.space/api/health && echo ""
echo "==> Kiểm tra qua Cloudflare (https://wedding.nhotin.space/api/health):"
curl -sS --max-time 10 https://wedding.nhotin.space/api/health || echo "(DNS/Tunnel có thể cần thêm vài giây để đồng bộ)"
echo ""
echo "Hoàn tất! Truy cập thiệp cưới tại: https://wedding.nhotin.space"
echo "Trang quản trị RSVP & Sổ lưu bút:   https://wedding.nhotin.space/admin"
