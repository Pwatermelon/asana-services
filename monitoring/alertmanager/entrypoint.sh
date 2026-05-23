#!/bin/sh
set -eu

render_config() {
  _src="/etc/alertmanager/alertmanager.yml.template"
  _dst="/tmp/alertmanager.yml"
  _token="${TELEGRAM_BOT_TOKEN:-}"
  _chat="${TELEGRAM_CHAT_ID:-}"

  _token_escaped=$(printf '%s' "$_token" | sed 's/[&|\\]/\\&/g')
  _chat_escaped=$(printf '%s' "$_chat" | sed 's/[&|\\]/\\&/g')

  sed \
    -e "s|\${TELEGRAM_BOT_TOKEN}|${_token_escaped}|g" \
    -e "s|\${TELEGRAM_CHAT_ID}|${_chat_escaped}|g" \
    "$_src" > "$_dst"

  if [ -n "${TELEGRAM_HTTP_PROXY:-}" ]; then
    awk -v proxy="$TELEGRAM_HTTP_PROXY" '
      /#TELEGRAM_PROXY_BLOCK#/ {
        print "        http_config:"
        print "          proxy_url: '\''" proxy "'\''"
        next
      }
      { print }
    ' "$_dst" > "$_dst.tmp" && mv "$_dst.tmp" "$_dst"
  else
    sed '/#TELEGRAM_PROXY_BLOCK#/d' "$_dst" > "$_dst.tmp" && mv "$_dst.tmp" "$_dst"
  fi
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
