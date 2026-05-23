# Alertmanager → Telegram

## Переменные в `/app/.env`

```env
TELEGRAM_BOT_TOKEN=...          # от @BotFather
TELEGRAM_CHAT_ID=709857057      # ваш chat id (число)
VLESS_URI=vless://...           # ссылка из VPN-клиента (для VPS в РФ)
# TELEGRAM_HTTP_PROXY задаётся автоматически при деплое, если есть VLESS_URI
```

Боту напишите `/start` в личку или добавьте в группу.

## Контейнеры

После `docker compose up -d` должны быть:

- `telegram-proxy` — VLESS + HTTP-прокси `:8888` (или «спит», если нет `VLESS_URI`)
- `alertmanager` — шлёт в Telegram **только когда получает алерт** (при старте молчит)

**Alertmanager не шлёт «я запустился» сам.** Алерт приходит если:
- CI-деплой отправил `DeployCompleted`;
- Prometheus сработал по правилам (сервис down 3–5 мин и т.д.);
- вы вручную POST в `/api/v2/alerts`.

### Тест вручную (на сервере)

```bash
cd /app
sudo docker compose exec -T prometheus wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='[{"labels":{"alertname":"TelegramTest","severity":"info"},"annotations":{"summary":"Ручной тест","description":"Проверка Telegram"}}]' \
  http://alertmanager:9093/api/v2/alerts

# через ~5 сек смотрите логи (ошибки Telegram будут здесь):
sudo docker compose logs --tail=30 alertmanager
```

Или: `TELEGRAM_STARTUP_TEST=1` в `.env` → один тест при каждом перезапуске alertmanager.

```bash
grep -q '^TELEGRAM_STARTUP_TEST=' .env || echo 'TELEGRAM_STARTUP_TEST=1' >> .env
sudo docker compose up -d --force-recreate alertmanager
```

```bash
cd /app
sudo docker compose ps telegram-proxy alertmanager
sudo docker compose logs --tail=30 telegram-proxy
sudo docker compose logs --tail=30 alertmanager
```

## Проверка вручную

```bash
cd /app
sudo bash monitoring/test-telegram-alert.sh
```

## Если алертов нет

1. `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` пустые → alertmanager пишет в лог «отключены».
2. Нет `VLESS_URI` на сервере в РФ → `api.telegram.org` недоступен напрямую.
3. `telegram-proxy` не запущен — раньше был профиль `telegram-vpn`, сейчас поднимается с основным стеком.
4. После смены `.env`: `sudo docker compose up -d --force-recreate telegram-proxy alertmanager`
