#!/bin/sh
set -e
cd /app

# Идемпотентная миграция photoDedupFingerprint при старте контейнера (внутри образа, не с хоста).
# Отключить: SKIP_PHOTO_DEDUP_MIGRATION=1 в environment compose.
if [ "${SKIP_PHOTO_DEDUP_MIGRATION:-}" != "1" ]; then
  echo "[docker-entrypoint] migrate_photo_dedup_fingerprints..."
  python scripts/migrate_photo_dedup_fingerprints.py
fi

exec "$@"
