#!/usr/bin/env bash
set -euo pipefail

NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
WORK_DIR="/backup-data/current/${STAMP}"
ARCHIVE_DIR="/backup-data/archives"
GDRIVE_STAGING="/backup-data/gdrive-staging"
TEXTFILE_DIR="${TEXTFILE_DIR:-/var/lib/node_exporter/textfile_collector}"
PROM_FILE="${TEXTFILE_DIR}/backup.prom"
LAST_RUN_FILE="/backup-data/.last_backup_ts"
LOCK_FILE="/backup-data/.backup.lock"

MIN_INTERVAL="${BACKUP_MIN_INTERVAL_SECONDS:-82800}" # 23 ч — не чаще раза в сутки (cron + рестарты)
KEEP_LOCAL_ARCHIVES="${BACKUP_KEEP_LOCAL_ARCHIVES:-1}"

mkdir -p "${WORK_DIR}/owl" "${WORK_DIR}/s3" "${ARCHIVE_DIR}" "${GDRIVE_STAGING}" "${TEXTFILE_DIR}"

if [[ "${BACKUP_FORCE:-0}" != "1" && -f "${LAST_RUN_FILE}" ]]; then
  LAST_TS="$(cat "${LAST_RUN_FILE}" 2>/dev/null || echo 0)"
  NOW_TS="$(date +%s)"
  ELAPSED=$((NOW_TS - LAST_TS))
  if (( ELAPSED < MIN_INTERVAL )); then
    echo "[${NOW_UTC}] backup skipped: last run ${ELAPSED}s ago (min interval ${MIN_INTERVAL}s). Set BACKUP_FORCE=1 to override."
    exit 0
  fi
fi

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "[${NOW_UTC}] backup skipped: another run in progress"
  exit 0
fi

BACKUP_SUCCESS=0
GDRIVE_SUCCESS=0
ARCHIVE_SIZE=0
LAST_SUCCESS_TS=0

S3_ENDPOINT="${S3_ENDPOINT:-http://minio:9000}"
S3_BUCKET="${S3_BUCKET:-images}"
S3_BACKUP_PREFIXES="${S3_BACKUP_PREFIXES:-asans,avatars}"
ONTOLOGY_PATH="${ONTOLOGY_PATH:-/app/ontology_updated.owl}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive:asana-backups}"
GDRIVE_ARCHIVE_NAME="${GDRIVE_ARCHIVE_NAME:-asana-backup-latest.tar.gz}"

export AWS_ACCESS_KEY_ID="${MINIO_ROOT_USER:-${USER_MINIO:-minioadmin}}"
export AWS_SECRET_ACCESS_KEY="${MINIO_ROOT_PASSWORD:-${PASSWORD_MINIO:-minioadmin}}"

if [[ -f "${ONTOLOGY_PATH}" ]]; then
  cp "${ONTOLOGY_PATH}" "${WORK_DIR}/owl/ontology_updated.owl"
fi

IFS=',' read -ra PREFIXES <<< "${S3_BACKUP_PREFIXES}"
for prefix in "${PREFIXES[@]}"; do
  CLEAN_PREFIX="$(echo "${prefix}" | xargs)"
  [[ -z "${CLEAN_PREFIX}" ]] && continue
  mkdir -p "${WORK_DIR}/s3/${CLEAN_PREFIX}"
  aws --endpoint-url "${S3_ENDPOINT}" s3 sync \
    "s3://${S3_BUCKET}/${CLEAN_PREFIX}" \
    "${WORK_DIR}/s3/${CLEAN_PREFIX}" >/dev/null
done

ARCHIVE_PATH="${ARCHIVE_DIR}/backup_${STAMP}.tar.gz"
tar -czf "${ARCHIVE_PATH}" -C "${WORK_DIR}" .
ARCHIVE_SIZE="$(stat -c%s "${ARCHIVE_PATH}" 2>/dev/null || stat -f%z "${ARCHIVE_PATH}")"

# На Drive один файл с фиксированным именем; sync удаляет лишнее БЕЗ корзины (иначе квота забивается).
rm -rf "${GDRIVE_STAGING:?}"/*
cp "${ARCHIVE_PATH}" "${GDRIVE_STAGING}/${GDRIVE_ARCHIVE_NAME}"

if rclone sync "${GDRIVE_STAGING}/" "${GDRIVE_REMOTE}/" \
  --create-empty-src-dirs \
  --transfers 1 \
  --checkers 2 \
  --drive-use-trash=false; then
  GDRIVE_SUCCESS=1
else
  GDRIVE_SUCCESS=0
fi

# Локально оставляем только последние N архивов
OLD_ARCHIVES="$(ls -1t "${ARCHIVE_DIR}"/backup_*.tar.gz 2>/dev/null | tail -n +"$((KEEP_LOCAL_ARCHIVES + 1))" || true)"
if [[ -n "${OLD_ARCHIVES}" ]]; then
  while IFS= read -r _old; do
    [[ -n "${_old}" ]] && rm -f "${_old}"
  done <<< "${OLD_ARCHIVES}"
fi
find /backup-data/current -mindepth 1 -maxdepth 1 -type d -mtime +2 -exec rm -rf {} + 2>/dev/null || true

BACKUP_SUCCESS=1
LAST_SUCCESS_TS="$(date +%s)"
echo "${LAST_SUCCESS_TS}" > "${LAST_RUN_FILE}"

cat > "${PROM_FILE}" <<EOF
# HELP backup_last_success Backup success status.
# TYPE backup_last_success gauge
backup_last_success{component="all"} ${BACKUP_SUCCESS}
# HELP backup_upload_gdrive_success Google Drive upload status.
# TYPE backup_upload_gdrive_success gauge
backup_upload_gdrive_success{component="gdrive"} ${GDRIVE_SUCCESS}
# HELP backup_last_size_bytes Last archive size in bytes.
# TYPE backup_last_size_bytes gauge
backup_last_size_bytes{component="archive"} ${ARCHIVE_SIZE}
# HELP backup_last_success_timestamp Unix timestamp of last successful backup.
# TYPE backup_last_success_timestamp gauge
backup_last_success_timestamp{component="all"} ${LAST_SUCCESS_TS}
EOF

echo "[${NOW_UTC}] backup finished: archive=${ARCHIVE_PATH} size=${ARCHIVE_SIZE} gdrive=${GDRIVE_SUCCESS}"
