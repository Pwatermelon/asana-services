#!/usr/bin/env bash
set -euo pipefail

mkdir -p /backup-data/current /var/lib/node_exporter/textfile_collector /root/.config/rclone

if [[ -n "${RCLONE_CONFIG_BASE64:-}" ]]; then
  echo "$RCLONE_CONFIG_BASE64" | base64 -d > /root/.config/rclone/rclone.conf
fi

CRON_EXPR="${BACKUP_CRON:-0 3 * * *}"
echo "${CRON_EXPR} /run-backup.sh >> /var/log/backup-cron.log 2>&1" > /etc/crontabs/root

if [[ "${RUN_BACKUP_ON_START:-true}" == "true" ]]; then
  /run-backup.sh || true
fi

exec crond -f -l 8
