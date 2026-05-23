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

# Alertmanager сам по себе при старте ничего не шлёт — только когда получает алерт.
# TELEGRAM_STARTUP_TEST=1 → один тестовый алерт после готовности (ручной compose up).
if [ "${TELEGRAM_STARTUP_TEST:-0}" = "1" ]; then
  echo "TELEGRAM_STARTUP_TEST=1 — после старта отправим тестовый алерт"
  /bin/alertmanager \
    --config.file=/tmp/alertmanager.yml \
    --storage.path=/alertmanager &
  _am_pid=$!
  _ready=0
  _i=0
  while [ "$_i" -lt 30 ]; do
    if wget -qO- http://127.0.0.1:9093/-/ready >/dev/null 2>&1; then
      _ready=1
      break
    fi
    _i=$((_i + 1))
    sleep 1
  done
  if [ "$_ready" = "1" ]; then
  wget -qO- \
    --header="Content-Type: application/json" \
    --post-data='[{"labels":{"alertname":"TelegramTest","severity":"info"},"annotations":{"summary":"Alertmanager запущен","description":"Тестовый алерт при старте (TELEGRAM_STARTUP_TEST=1)"}}]' \
    http://127.0.0.1:9093/api/v2/alerts \
    && echo "Тестовый алерт отправлен в Alertmanager (ждите ~20с group_wait → Telegram)" \
    || echo "WARN: не удалось отправить тестовый алерт"
  else
    echo "WARN: Alertmanager не стал ready за 30с, тестовый алерт пропущен"
  fi
  wait "$_am_pid"
  exit $?
fi

exec /bin/alertmanager \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager
