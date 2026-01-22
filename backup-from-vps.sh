#!/usr/bin/env bash
set -euo pipefail

# Настройки подключения
VPS_USER="root"
VPS_HOST="ai-bot-vps"
VPS_PORT="22"
SSH_KEY=""          # Например: ~/.ssh/id_rsa (оставьте пустым, если не нужно)
SSH_OPTS=""         # Доп. опции ssh, например: "-o StrictHostKeyChecking=no"

# Настройки проекта на VPS
VPS_PROJECT_DIR="/root/ai-image-bot"
POSTGRES_CONTAINER="ai_image_generator_postgres_prod"
REMOTE_DOCKER_CMD="docker" # Если нужен sudo: "sudo docker"

# Проверка восстановления (для 100% уверенности)
VERIFY_RESTORE="1"       # 1 = выполнять тестовое восстановление, 0 = пропустить
VERIFY_DB_PREFIX="backup_verify"
VERIFY_KEEP_DB="0"       # 1 = оставить тестовую БД, 0 = удалить после проверки
POSTGRES_RESTORE_USER="postgres"

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
VERIFY_ID="$(TZ="${BACKUP_TZ}" date +%Y%m%d_%H%M%S)"
VERIFY_DB="${VERIFY_DB_PREFIX}_${VERIFY_ID}"

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
SCP_CMD=(scp)
if [[ -n "${VPS_PORT}" ]]; then
  SCP_CMD+=( -P "${VPS_PORT}" )
fi
if [[ -n "${SSH_KEY}" ]]; then
  SCP_CMD+=( -i "${SSH_KEY}" )
fi
if [[ -n "${SSH_OPTS}" ]]; then
  SCP_CMD+=( "${EXTRA_OPTS[@]}" )
fi

REMOTE_CMD=$(printf '%s\n' \
"set -euo pipefail" \
"cd \"${VPS_PROJECT_DIR}\"" \
"if [ -f .env ]; then" \
"  while IFS= read -r line || [ -n \"\$line\" ]; do" \
"    case \"\$line\" in" \
"      ''|\\#*) continue ;;" \
"    esac" \
"    if [[ \"\$line\" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then" \
"      key=\"\${line%%=*}\"" \
"      val=\"\${line#*=}\"" \
"      if [[ \"\$val\" == \"\\\"*\" && \"\$val\" == *\"\\\"\" ]]; then" \
"        val=\"\${val#\\\"}\"" \
"        val=\"\${val%\\\"}\"" \
"      fi" \
"      if [[ \"\$val\" == \\'*\\' && \"\$val\" == *\\' ]]; then" \
"        val=\"\${val#\\'}\"" \
"        val=\"\${val%\\'}\"" \
"      fi" \
"      export \"\${key}=\${val}\"" \
"    fi" \
"  done < .env" \
"fi" \
"POSTGRES_USER=\"\${POSTGRES_USER:-postgres}\"" \
"POSTGRES_DB=\"\${POSTGRES_DB:-ai_image_bot}\"" \
"${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" pg_dump -U \"\${POSTGRES_USER}\" \"\${POSTGRES_DB}\" | gzip -c" \
)

"${SSH_CMD[@]}" "${VPS_USER}@${VPS_HOST}" "bash -lc $(printf %q "${REMOTE_CMD}")" > "${BACKUP_FILE}"

if [[ ! -s "${BACKUP_FILE}" ]]; then
  echo "Ошибка: файл бэкапа пустой: ${BACKUP_FILE}" >&2
  exit 1
fi

if ! gzip -t "${BACKUP_FILE}"; then
  echo "Ошибка: gzip-проверка не пройдена: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ "${VERIFY_RESTORE}" == "1" ]]; then
  REMOTE_TMP="/tmp/backup_verify_${VERIFY_ID}.sql.gz"
  if ! "${SCP_CMD[@]}" "${BACKUP_FILE}" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}"; then
    echo "Ошибка: не удалось загрузить бэкап на VPS для проверки" >&2
    exit 1
  fi

  REMOTE_VERIFY_CMD=$(printf '%s\n' \
  "set -euo pipefail" \
  "cd \"${VPS_PROJECT_DIR}\"" \
  "if [ -f .env ]; then" \
  "  while IFS= read -r line || [ -n \"\$line\" ]; do" \
  "    case \"\$line\" in" \
  "      ''|\\#*) continue ;;" \
  "    esac" \
  "    if [[ \"\$line\" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then" \
  "      key=\"\${line%%=*}\"" \
  "      val=\"\${line#*=}\"" \
  "      if [[ \"\$val\" == \"\\\"*\" && \"\$val\" == *\"\\\"\" ]]; then" \
  "        val=\"\${val#\\\"}\"" \
  "        val=\"\${val%\\\"}\"" \
  "      fi" \
  "      if [[ \"\$val\" == \\'*\\' && \"\$val\" == *\\' ]]; then" \
  "        val=\"\${val#\\'}\"" \
  "        val=\"\${val%\\'}\"" \
  "      fi" \
  "      export \"\${key}=\${val}\"" \
  "    fi" \
  "  done < .env" \
  "fi" \
  "POSTGRES_USER=\"\${POSTGRES_USER:-postgres}\"" \
  "RESTORE_USER=\"${POSTGRES_RESTORE_USER}\"" \
  "POSTGRES_DB=\"\${POSTGRES_DB:-ai_image_bot}\"" \
  "VERIFY_DB=\"${VERIFY_DB}\"" \
  "REMOTE_TMP=\"${REMOTE_TMP}\"" \
  "cleanup() {" \
  "  rm -f \"\${REMOTE_TMP}\" || true" \
  "  if [[ \"${VERIFY_KEEP_DB}\" != \"1\" ]]; then" \
  "    ${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d postgres -v ON_ERROR_STOP=1 -c \"DROP DATABASE IF EXISTS \\\"${VERIFY_DB}\\\";\" || true" \
  "  fi" \
  "}" \
  "trap cleanup EXIT" \
  "${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d postgres -v ON_ERROR_STOP=1 -c \"DROP DATABASE IF EXISTS \\\"${VERIFY_DB}\\\";\"" \
  "${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d postgres -v ON_ERROR_STOP=1 -c \"CREATE DATABASE \\\"${VERIFY_DB}\\\";\"" \
  "gunzip -c \"\${REMOTE_TMP}\" | ${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d \"${VERIFY_DB}\" -v ON_ERROR_STOP=1" \
  "tables_count=\$(${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d \"${VERIFY_DB}\" -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';\")" \
  "if [ \"\$tables_count\" -lt 1 ]; then" \
  "  echo \"Ошибка: восстановление прошло, но таблицы не найдены\" >&2" \
  "  exit 1" \
  "fi" \
  )

  if ! "${SSH_CMD[@]}" "${VPS_USER}@${VPS_HOST}" "bash -lc $(printf %q "${REMOTE_VERIFY_CMD}")"; then
    echo "Ошибка: тестовое восстановление на VPS не прошло" >&2
    exit 1
  fi
fi

echo "Бэкап сохранен: ${BACKUP_FILE}"
