#!/bin/sh
set -eu

if [ -z "${VLESS_URI:-}" ]; then
  echo "Задайте VLESS_URI в .env (ссылка vless://... из VPN-клиента)."
  exit 1
fi

python3 /opt/telegram-proxy/vless_to_singbox.py > /tmp/sing-box.json
echo "sing-box: HTTP proxy :${TELEGRAM_PROXY_PORT:-8888} → VLESS"
exec sing-box run -c /tmp/sing-box.json
