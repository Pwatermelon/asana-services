# Grafana dashboards (Asana)

Файлы в `dashboards/` именуются **как UID** (`asana-infrastructure.json` и т.д.).
Фронт открывает `/grafana/d/<uid>/<slug>` — uid должен совпадать с полем `"uid"` в JSON.

## Ошибка «Dashboard not found» / `could not resolve dashboards:uid:…`

Обычно после смены UID в JSON при том же имени файла: Grafana в volume
`grafana_data` помнит старый mapping «файл → dashboard» и не может сохранить новый UID.

**Лечение на сервере (один раз):**

```bash
cd /app
sudo docker compose stop grafana
# переименовать файлы уже сделано в репо; подтянуть их и сбросить кэш дашбордов:
sudo docker compose rm -f grafana
sudo docker volume rm asana-services_grafana_data 2>/dev/null || sudo docker volume rm app_grafana_data 2>/dev/null || true
sudo docker compose up -d grafana
```

Имя volume может отличаться (`docker volume ls | grep grafana`). После чистого старта
provisioning заново создаст дашборды с нужными UID.

Проверка: `https://catalog-asan.ru/grafana/d/asana-infrastructure/infrastructure`
