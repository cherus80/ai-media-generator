#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backup}"
BACKUP_TZ="${BACKUP_TZ:-Europe/Moscow}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_DIR="${GDRIVE_DIR:-ai-media-generator/backup}"
RCLONE_BIN="${RCLONE_BIN:-}"
RCLONE_CONFIG="${RCLONE_CONFIG:-}"
RCLONE_FLAGS="${RCLONE_FLAGS:-}"

mkdir -p "${BACKUP_DIR}"

if [ -z "${RCLONE_BIN}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    RCLONE_BIN="$(command -v rclone)"
  elif [ -x /usr/local/bin/rclone ]; then
    RCLONE_BIN=/usr/local/bin/rclone
  elif [ -x /usr/bin/rclone ]; then
    RCLONE_BIN=/usr/bin/rclone
  fi
fi

if [ -z "${RCLONE_BIN}" ]; then
  echo "rclone not found. Install rclone or set RCLONE_BIN." >&2
  exit 1
fi

pushd "${BACKUP_DIR}" >/dev/null
BACKUP_TZ="${BACKUP_TZ}" "${PROJECT_DIR}/scripts/backup-db-date.sh"
BACKUP_FILE="${BACKUP_DIR}/$(TZ="${BACKUP_TZ}" date +%Y-%m-%d).sql"

if [ ! -s "${BACKUP_FILE}" ]; then
  echo "Backup file not found or empty: ${BACKUP_FILE}" >&2
  popd >/dev/null
  exit 1
fi

RCLONE_ARGS=()
if [ -n "${RCLONE_CONFIG}" ]; then
  RCLONE_ARGS+=(--config "${RCLONE_CONFIG}")
fi
if [ -n "${RCLONE_FLAGS}" ]; then
  read -r -a EXTRA_FLAGS <<< "${RCLONE_FLAGS}"
  RCLONE_ARGS+=("${EXTRA_FLAGS[@]}")
fi

"${RCLONE_BIN}" copy "${BACKUP_FILE}" "${GDRIVE_REMOTE}:${GDRIVE_DIR}/" "${RCLONE_ARGS[@]}"

echo "Uploaded to ${GDRIVE_REMOTE}:${GDRIVE_DIR}/$(basename "${BACKUP_FILE}")"
popd >/dev/null
