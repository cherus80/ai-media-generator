#!/usr/bin/env bash
set -euo pipefail

DATE_STAMP="$(date +%Y-%m-%d)"
BACKUP_DIR="$(pwd)"
BACKUP_FILE="${BACKUP_DIR}/${DATE_STAMP}.sql"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-ai_image_bot}"

if [ -e "${BACKUP_FILE}" ]; then
  echo "Backup file already exists: ${BACKUP_FILE}" >&2
  exit 1
fi

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  COMPOSE_CMD=(docker compose)
fi

"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${BACKUP_FILE}"

echo "Backup saved: ${BACKUP_FILE}"
