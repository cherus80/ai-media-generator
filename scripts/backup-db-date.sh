#!/usr/bin/env bash
set -euo pipefail

DATE_STAMP="$(date +%Y-%m-%d)"
BACKUP_DIR="$(pwd)"
BACKUP_FILE="${BACKUP_DIR}/${DATE_STAMP}.sql"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_DIR}/docker-compose.prod.yml}"
if [[ "${COMPOSE_FILE}" != /* ]]; then
  COMPOSE_FILE="${PROJECT_DIR}/${COMPOSE_FILE}"
fi

ENV_FILE="${ENV_FILE:-${PROJECT_DIR}/.env}"
if [ -f "${ENV_FILE}" ]; then
  set -a
  . "${ENV_FILE}"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-ai_image_bot}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "${PROJECT_DIR}")}"

if [ -e "${BACKUP_FILE}" ]; then
  echo "Backup file exists, overwriting: ${BACKUP_FILE}"
fi

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  COMPOSE_CMD=(docker compose)
fi

"${COMPOSE_CMD[@]}" -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${BACKUP_FILE}"

echo "Backup saved: ${BACKUP_FILE}"
