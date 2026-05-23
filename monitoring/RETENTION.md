# Лимиты мониторинга (диск)

По умолчанию стек **не должен забивать весь диск**: срок хранения + потолок по размеру.

## Prometheus (метрики)

| Переменная | По умолчанию | Смысл |
|------------|--------------|--------|
| `PROMETHEUS_RETENTION_TIME` | `1d` | Максимальный возраст метрик |
| `PROMETHEUS_RETENTION_SIZE` | `10GB` | Потолок на диске (что наступит раньше) |

Лимит по размеру (`PROMETHEUS_RETENTION_SIZE`, по умолчанию 10GB) сработает раньше, если метрик очень много.

## Elasticsearch (логи Kibana)

| Переменная | По умолчанию | Смысл |
|------------|--------------|--------|
| `ES_LOG_RETENTION` | `7d` | ILM удаляет индексы `asana-logs-*` старше срока |
| `ES_DISK_WATERMARK_*` | 15/10/5 GB free | ES перестаёт писать, если на диске мало места |
| `ES_PURGE_OLD_LOGS` | `false` | `true` один раз — удалить все `asana-logs-*` |

После переполнения диска на сервере:

```env
ES_PURGE_OLD_LOGS=true
```

```bash
cd /app
sudo docker-compose run --rm kibana-setup
# вернуть false и снова deploy, либо вручную ES_PURGE_OLD_LOGS=false
```

Разово освободить volume (все логи пропадут):

```bash
sudo docker-compose stop elasticsearch filebeat kibana
sudo docker volume rm app_elasticsearch_data
sudo docker-compose up -d elasticsearch kibana
sudo docker-compose run --rm kibana-setup
sudo docker-compose up -d filebeat
```

## Примеры `.env`

Мало диска (~50 GB свободно на всём сервере):

```env
PROMETHEUS_RETENTION_TIME=3d
PROMETHEUS_RETENTION_SIZE=5GB
ES_LOG_RETENTION=3d
```

Нужно больше истории:

```env
PROMETHEUS_RETENTION_TIME=14d
PROMETHEUS_RETENTION_SIZE=15GB
ES_LOG_RETENTION=14d
```
