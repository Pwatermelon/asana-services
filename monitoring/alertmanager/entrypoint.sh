#!/bin/sh
set -eu

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы — алерты в Telegram отключены."
  cat >/tmp/alertmanager.yml <<'EOF'
global:
  resolve_timeout: 5m
route:
  receiver: 'null'
receivers:
  - name: 'null'
EOF
  exec /bin/alertmanager --config.file=/tmp/alertmanager.yml --storage.path=/alertmanager
fi

envsubst '${TELEGRAM_BOT_TOKEN} ${TELEGRAM_CHAT_ID}' \
  < /etc/alertmanager/alertmanager.yml.template \
  > /tmp/alertmanager.yml

exec /bin/alertmanager \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager
