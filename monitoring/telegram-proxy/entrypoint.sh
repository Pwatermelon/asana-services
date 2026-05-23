#!/bin/sh
set -eu

if [ -z "${VLESS_URI:-}" ]; then
  echo "VLESS_URI не задан — telegram-proxy ждёт (алерты без прокси, если api.telegram.org доступен)."
  exec sleep infinity
fi

python3 /opt/telegram-proxy/vless_to_singbox.py > /tmp/sing-box.json
echo "sing-box: HTTP :${TELEGRAM_PROXY_PORT:-8888} → VLESS (${VLESS_URI%%#*})"
exec sing-box run -c /tmp/sing-box.json
