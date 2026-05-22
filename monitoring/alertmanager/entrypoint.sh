#!/bin/sh
set -eu

render_config() {
  _src="/etc/alertmanager/alertmanager.yml.template"
  _dst="/tmp/alertmanager.yml"
  _token="${TELEGRAM_BOT_TOKEN:-}"
  _chat="${TELEGRAM_CHAT_ID:-}"

  # prom/alertmanager не содержит envsubst — подставляем через sed
  _token_escaped=$(printf '%s' "$_token" | sed 's/[&|\\]/\\&/g')
  _chat_escaped=$(printf '%s' "$_chat" | sed 's/[&|\\]/\\&/g')

  sed \
    -e "s|\${TELEGRAM_BOT_TOKEN}|${_token_escaped}|g" \
    -e "s|\${TELEGRAM_CHAT_ID}|${_chat_escaped}|g" \
    "$_src" > "$_dst"
}

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

render_config

exec /bin/alertmanager \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager
