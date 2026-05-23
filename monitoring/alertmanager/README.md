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
- `alertmanager` — шлёт в Telegram через прокси, если задан `VLESS_URI`

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
