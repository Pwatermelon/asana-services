#!/bin/sh
set -eu

render_config() {
  _src="/etc/alertmanager/alertmanager.yml.template"
  _dst="/tmp/alertmanager.yml"
  _token="${TELEGRAM_BOT_TOKEN:-}"
  _chat="${TELEGRAM_CHAT_ID:-}"
  _proxy="${TELEGRAM_HTTP_PROXY:-}"

  # Если задан VLESS, но прокси не указан — дефолт на telegram-proxy в compose-сети
  if [ -z "$_proxy" ] && [ -n "${VLESS_URI:-}" ]; then
    _proxy="http://telegram-proxy:8888"
  fi

  _token_escaped=$(printf '%s' "$_token" | sed 's/[&|\\]/\\&/g')
  _chat_escaped=$(printf '%s' "$_chat" | sed 's/[&|\\]/\\&/g')

  sed \
    -e "s|\${TELEGRAM_BOT_TOKEN}|${_token_escaped}|g" \
    -e "s|\${TELEGRAM_CHAT_ID}|${_chat_escaped}|g" \
    "$_src" > "$_dst"

  if [ -n "$_proxy" ]; then
    echo "Alertmanager Telegram proxy: $_proxy"
    awk -v proxy="$_proxy" '
      /#TELEGRAM_PROXY_BLOCK#/ {
        print "        http_config:"
        print "          proxy_url: '\''" proxy "'\''"
        next
      }
      { print }
    ' "$_dst" > "$_dst.tmp" && mv "$_dst.tmp" "$_dst"
  else
    echo "Alertmanager Telegram: без HTTP-прокси (прямой доступ к api.telegram.org)"
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

echo "Alertmanager Telegram: chat_id=${TELEGRAM_CHAT_ID}"
render_config

exec /bin/alertmanager \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager
