#!/usr/bin/env bash
set -euo pipefail

mkdir -p /backup-data/current /backup-data/archives /backup-data/gdrive-staging \
  /var/lib/node_exporter/textfile_collector /root/.config/rclone

if [[ -n "${RCLONE_CONFIG_BASE64:-}" ]]; then
  echo "$RCLONE_CONFIG_BASE64" | base64 -d > /root/.config/rclone/rclone.conf
fi

CRON_EXPR="${BACKUP_CRON:-0 3 * * *}"
echo "${CRON_EXPR} /run-backup.sh >> /var/log/backup-cron.log 2>&1" > /etc/crontabs/root

# Бэкап при каждом рестарте контейнера (деплой) — главная причина «каждый час».
if [[ "${RUN_BACKUP_ON_START:-false}" == "true" ]]; then
  echo "[entrypoint] RUN_BACKUP_ON_START=true — one-shot backup (respects BACKUP_MIN_INTERVAL_SECONDS)"
  /run-backup.sh || true
fi

exec crond -f -s
