# Alertmanager → Telegram

## Обычная настройка

В `/app/.env`:

- `TELEGRAM_BOT_TOKEN` — от @BotFather
- `TELEGRAM_CHAT_ID` — id чата (напишите боту `/start`)

## Telegram через VLESS (VPS в РФ)

Если с сервера не открывается `api.telegram.org`, поднимается маленький HTTP-прокси **только для Alertmanager**. В `.env` вставьте ссылку из VPN-приложения (v2rayN, Happ, и т.п.):

```env
VLESS_URI=vless://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx@vpn.example.com:443?encryption=none&security=tls&sni=vpn.example.com&type=ws&path=%2Fws#MyVPN

TELEGRAM_HTTP_PROXY=http://telegram-proxy:8888
```

Деплой с прокси:

```bash
cd /app
sudo docker compose --profile telegram-vpn up -d telegram-proxy alertmanager
```

Проверка (должен ответить не «connection refused»):

```bash
sudo docker compose exec alertmanager wget -qSO- -e use_proxy=yes -e http_proxy=http://telegram-proxy:8888 https://api.telegram.org 2>&1 | head -5
```

Сайт, БД и остальные сервисы **не** используют этот прокси — только Telegram-алерты.

### Если не коннектится

- Скопируйте ссылку целиком, в кавычках в `.env`, без переносов строк.
- Для **Reality** в ссылке должны быть `security=reality`, `pbk`, `sid`, `sni`.
- Логи: `sudo docker compose logs telegram-proxy`
