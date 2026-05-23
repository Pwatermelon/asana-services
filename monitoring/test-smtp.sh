#!/bin/sh
# Проверка SMTP на сервере: cd /app && sudo bash monitoring/test-smtp.sh [email]
set -eu
cd /app

TO="${1:-}"
if [ -z "$TO" ]; then
  TO=$(grep -E '^SMTP_USER=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d "'\"")
fi

echo "=== SMTP в .env (без пароля) ==="
grep -E '^(SMTP_HOST|SMTP_SERVER|SMTP_PORT|SMTP_USER|SMTP_FROM)=' .env 2>/dev/null || true
if grep -qE '^SMTP_PASSWORD=.' .env 2>/dev/null; then
  echo "SMTP_PASSWORD= (задан, длина $(grep -E '^SMTP_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d "'\"" | wc -c | tr -d ' ') символов)"
else
  echo "SMTP_PASSWORD= (ПУСТО!)"
fi

echo ""
echo "=== Переменные внутри server-module (восстановление пароля) ==="
docker compose exec -T server-module python3 - <<'PY' 2>/dev/null || docker-compose exec -T server-module python3 - <<'PY'
from config import get_settings
s = get_settings()
print(f"host={s.SMTP_SERVER!r} port={s.SMTP_PORT!r} user={s.SMTP_USER!r} from={s.SMTP_FROM!r} pass_len={len(s.SMTP_PASSWORD or '')}")
PY

echo ""
echo "=== Переменные внутри asana-backend (письма при создании user) ==="
docker compose exec -T asana-backend python3 - <<'PY' 2>/dev/null || docker-compose exec -T asana-backend python3 - <<'PY'
from app import config
print(f"host={config.SMTP_SERVER!r} port={config.SMTP_PORT!r} user={config.SMTP_USER!r} from={config.SMTP_FROM!r} pass_len={len(config.SMTP_PASSWORD or '')}")
PY

if [ -z "$TO" ]; then
  echo ""
  echo "Укажите email: sudo bash monitoring/test-smtp.sh your@mail.com"
  exit 0
fi

echo ""
echo "=== Тест login + send через server-module → $TO ==="
docker compose exec -T server-module python3 - <<PY 2>/dev/null || docker-compose exec -T server-module python3 - <<PY
from src.api.auth.utils.smtp_client import send_email
send_email("${TO}", "SMTP test (server-module)", "Тест отправки с catalog-asan.ru")
print("OK: server-module отправил письмо")
PY

echo ""
echo "=== Тест через asana-backend → $TO ==="
docker compose exec -T asana-backend python3 - <<PY 2>/dev/null || docker-compose exec -T asana-backend python3 - <<PY
from app.smtp_client import send_email
send_email("${TO}", "SMTP test (asana-backend)", "Тест отправки с catalog-asan.ru")
print("OK: asana-backend отправил письмо")
PY
