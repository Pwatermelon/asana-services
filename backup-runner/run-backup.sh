#!/usr/bin/env bash
set -euo pipefail

NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
WORK_DIR="/backup-data/current/${STAMP}"
ARCHIVE_DIR="/backup-data/archives"
TEXTFILE_DIR="${TEXTFILE_DIR:-/var/lib/node_exporter/textfile_collector}"
PROM_FILE="${TEXTFILE_DIR}/backup.prom"

mkdir -p "${WORK_DIR}/owl" "${WORK_DIR}/s3" "${ARCHIVE_DIR}" "${TEXTFILE_DIR}"

BACKUP_SUCCESS=0
GDRIVE_SUCCESS=0
ARCHIVE_SIZE=0
LAST_SUCCESS_TS=0

S3_ENDPOINT="${S3_ENDPOINT:-http://minio:9000}"
S3_BUCKET="${S3_BUCKET:-images}"
S3_BACKUP_PREFIXES="${S3_BACKUP_PREFIXES:-asans,avatars}"
ONTOLOGY_PATH="${ONTOLOGY_PATH:-/app/ontology_updated.owl}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive:asana-backups}"

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

# На Google Drive храним только один актуальный архив:
# перед загрузкой нового удаляем старые объекты в целевой папке.
rclone delete "${GDRIVE_REMOTE}" --rmdirs || true

if rclone copy "${ARCHIVE_PATH}" "${GDRIVE_REMOTE}" --create-empty-src-dirs --transfers 1 --checkers 2; then
  GDRIVE_SUCCESS=1
else
  GDRIVE_SUCCESS=0
fi

BACKUP_SUCCESS=1
LAST_SUCCESS_TS="$(date +%s)"

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
