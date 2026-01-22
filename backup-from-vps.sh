#!/usr/bin/env bash
set -euo pipefail

# Настройки подключения
VPS_USER="CHANGE_ME_USER"
VPS_HOST="CHANGE_ME_HOST"
VPS_PORT="22"
SSH_KEY=""          # Например: ~/.ssh/id_rsa (оставьте пустым, если не нужно)
SSH_OPTS=""         # Доп. опции ssh, например: "-o StrictHostKeyChecking=no"

# Настройки проекта на VPS
VPS_PROJECT_DIR="/path/to/repo"
POSTGRES_CONTAINER="ai_image_generator_postgres_prod"
REMOTE_DOCKER_CMD="docker" # Если нужен sudo: "sudo docker"

# Настройки локального сохранения
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backup"
BACKUP_TZ="Europe/Moscow"

if [[ "${VPS_USER}" == "CHANGE_ME_USER" || "${VPS_HOST}" == "CHANGE_ME_HOST" || "${VPS_PROJECT_DIR}" == "/path/to/repo" ]]; then
  echo "Заполните VPS_USER, VPS_HOST и VPS_PROJECT_DIR в backup-from-vps.sh" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/$(TZ="${BACKUP_TZ}" date +%Y-%m-%d).sql.gz"

SSH_CMD=(ssh)
if [[ -n "${VPS_PORT}" ]]; then
  SSH_CMD+=( -p "${VPS_PORT}" )
fi
if [[ -n "${SSH_KEY}" ]]; then
  SSH_CMD+=( -i "${SSH_KEY}" )
fi
if [[ -n "${SSH_OPTS}" ]]; then
  read -r -a EXTRA_OPTS <<< "${SSH_OPTS}"
  SSH_CMD+=( "${EXTRA_OPTS[@]}" )
fi

REMOTE_CMD="cd \"${VPS_PROJECT_DIR}\" && "
REMOTE_CMD+="if [ -f .env ]; then set -a; . ./.env; set +a; fi; "
REMOTE_CMD+="POSTGRES_USER=\"\${POSTGRES_USER:-postgres}\"; "
REMOTE_CMD+="POSTGRES_DB=\"\${POSTGRES_DB:-ai_image_bot}\"; "
REMOTE_CMD+="${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" pg_dump -U \"\${POSTGRES_USER}\" \"\${POSTGRES_DB}\" | gzip -c"

"${SSH_CMD[@]}" "${VPS_USER}@${VPS_HOST}" "${REMOTE_CMD}" > "${BACKUP_FILE}"

if [[ ! -s "${BACKUP_FILE}" ]]; then
  echo "Ошибка: файл бэкапа пустой: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "Бэкап сохранен: ${BACKUP_FILE}"
