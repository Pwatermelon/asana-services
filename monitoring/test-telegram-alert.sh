#!/bin/sh
# Ручная проверка: Alertmanager → Telegram (на сервере в /app)
set -eu
cd /app

echo "=== Контейнеры ==="
docker compose ps telegram-proxy alertmanager 2>/dev/null || docker-compose ps telegram-proxy alertmanager

echo ""
echo "=== .env (без секретов) ==="
grep -E '^(VLESS_URI|TELEGRAM_HTTP_PROXY|TELEGRAM_CHAT_ID)=' .env 2>/dev/null | sed 's/VLESS_URI=vless:\/\/[^@]*@/VLESS_URI=vless:\/\/***@/' || true
if ! grep -qE '^TELEGRAM_BOT_TOKEN=.' .env 2>/dev/null; then
  echo "TELEGRAM_BOT_TOKEN= (не задан!)"
fi

echo ""
echo "=== telegram-proxy (последние 15 строк) ==="
docker compose logs --tail=15 telegram-proxy 2>/dev/null || docker-compose logs --tail=15 telegram-proxy

echo ""
echo "=== alertmanager (последние 15 строк) ==="
docker compose logs --tail=15 alertmanager 2>/dev/null || docker-compose logs --tail=15 alertmanager

echo ""
echo "=== Тест API Alertmanager ==="
docker compose exec -T alertmanager wget -qO- http://127.0.0.1:9093/-/ready 2>/dev/null || echo "alertmanager not ready"

echo ""
echo "=== Отправка тестового алерта ==="
docker compose exec -T prometheus wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='[{"labels":{"alertname":"TelegramTest","severity":"info"},"annotations":{"summary":"Тест Telegram","description":"Проверка после docker compose up"}}]' \
  http://alertmanager:9093/api/v2/alerts || true

echo ""
echo "Проверьте Telegram через ~30 сек. Если пусто — смотрите: docker compose logs -f alertmanager"
