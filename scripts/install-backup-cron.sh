#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CRON_TZ="${CRON_TZ:-Europe/Moscow}"
BACKUP_TZ="${BACKUP_TZ:-Europe/Moscow}"
SCHEDULE="${SCHEDULE:-0 6 * * *}"
LOG_FILE="${LOG_FILE:-/var/log/ai-bot-backup.log}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_DIR="${GDRIVE_DIR:-ai-media-generator/backup}"
RCLONE_BIN="${RCLONE_BIN:-}"
RCLONE_CONFIG="${RCLONE_CONFIG:-}"
RCLONE_FLAGS="${RCLONE_FLAGS:-}"

MARKER="ai-media-generator-gdrive-backup"

CRON_CMD="BACKUP_TZ=${BACKUP_TZ} GDRIVE_REMOTE=${GDRIVE_REMOTE} GDRIVE_DIR=${GDRIVE_DIR}"
if [ -n "${RCLONE_BIN}" ]; then
  CRON_CMD+=" RCLONE_BIN=${RCLONE_BIN}"
fi
if [ -n "${RCLONE_CONFIG}" ]; then
  CRON_CMD+=" RCLONE_CONFIG=${RCLONE_CONFIG}"
fi
if [ -n "${RCLONE_FLAGS}" ]; then
  CRON_CMD+=" RCLONE_FLAGS=\"${RCLONE_FLAGS}\""
fi
CRON_CMD+=" ${PROJECT_DIR}/scripts/backup-db-gdrive.sh >> ${LOG_FILE} 2>&1"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "${MARKER}" > "${TMP_CRON}" || true
{
  echo "CRON_TZ=${CRON_TZ} # ${MARKER}"
  echo "${SCHEDULE} ${CRON_CMD} # ${MARKER}"
} >> "${TMP_CRON}"

crontab "${TMP_CRON}"
rm -f "${TMP_CRON}"

echo "Cron installed: ${SCHEDULE} (${CRON_TZ})"
