#!/bin/sh
set -eu

KIBANA_URL="${KIBANA_URL:-http://kibana:5601/kibana}"
ES_URL="${ES_URL:-http://elasticsearch:9200}"

echo "Ожидание Elasticsearch..."
for i in $(seq 1 60); do
  if curl -fsS "${ES_URL}/_cluster/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

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
