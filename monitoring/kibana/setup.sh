#!/bin/sh
set -eu

KIBANA_URL="${KIBANA_URL:-http://kibana:5601/kibana}"
ES_URL="${ES_URL:-http://elasticsearch:9200}"
ES_LOG_RETENTION="${ES_LOG_RETENTION:-7d}"

echo "Ожидание Elasticsearch..."
for i in $(seq 1 60); do
  if curl -fsS "${ES_URL}/_cluster/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "ILM: удаление индексов asana-logs-* старше ${ES_LOG_RETENTION}..."
curl -fsS -X PUT "${ES_URL}/_ilm/policy/asana-logs-policy" \
  -H "Content-Type: application/json" \
  -d "{
    \"policy\": {
      \"phases\": {
        \"delete\": {
          \"min_age\": \"${ES_LOG_RETENTION}\",
          \"actions\": { \"delete\": {} }
        }
      }
    }
  }" >/dev/null

curl -fsS -X PUT "${ES_URL}/_index_template/asana-logs-template" \
  -H "Content-Type: application/json" \
  -d '{
    "index_patterns": ["asana-logs-*"],
    "template": {
      "settings": {
        "index.number_of_shards": 1,
        "index.codec": "best_compression",
        "index.lifecycle.name": "asana-logs-policy"
      }
    },
    "priority": 200
  }' >/dev/null

# Одноразовая очистка после переполнения диска: ES_PURGE_OLD_LOGS=true в .env
if [ "${ES_PURGE_OLD_LOGS:-false}" = "true" ]; then
  echo "ES_PURGE_OLD_LOGS=true — удаляем все asana-logs-*..."
  curl -fsS -X DELETE "${ES_URL}/asana-logs-*" >/dev/null 2>&1 || true
fi

echo "Ожидание Kibana..."
for i in $(seq 1 90); do
  if curl -fsS "${KIBANA_URL}/api/status" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Создание Data View asana-logs-* ..."
curl -fsS -X POST "${KIBANA_URL}/api/data_views/data_view" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{
    "data_view": {
      "title": "asana-logs-*",
      "name": "Asana Logs",
      "timeFieldName": "@timestamp"
    },
    "override": true
  }' >/dev/null 2>&1 || echo "Data view уже существует или будет создан вручную."

echo "Kibana setup завершён."
