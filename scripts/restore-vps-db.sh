#!/usr/bin/env bash
set -euo pipefail

# Connection settings
VPS_USER="root"
VPS_HOST="ai-bot-vps"
VPS_PORT="22"
SSH_KEY=""          # Example: ~/.ssh/id_rsa (leave empty if not needed)
SSH_OPTS=""         # Extra ssh options, e.g. "-o StrictHostKeyChecking=no"

# VPS project settings
VPS_PROJECT_DIR="/root/ai-image-bot"
POSTGRES_CONTAINER="ai_image_generator_postgres_prod"
REMOTE_DOCKER_CMD="docker" # If sudo is needed: "sudo docker"

# Restore options
POSTGRES_RESTORE_USER="postgres"
TARGET_DB_OVERRIDE=""         # Optional: force restore into this DB name
CREATE_REMOTE_SAFETY_BACKUP="1" # 1 = dump current DB before restore
KEEP_REMOTE_SAFETY_BACKUP="1"   # 1 = keep safety dump on VPS
KEEP_REMOTE_DUMP="0"            # 1 = keep uploaded dump on VPS
BACKUP_TZ="Europe/Moscow"
REQUIRED_TABLES="alembic_version,users"
EXPECTED_ALEMBIC_VERSION=""    # Auto-detect from local alembic versions if empty

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_BACKUP_DIR="${SCRIPT_DIR}/backup"

if [[ "${VPS_USER}" == "CHANGE_ME_USER" || "${VPS_HOST}" == "CHANGE_ME_HOST" || "${VPS_PROJECT_DIR}" == "/path/to/repo" ]]; then
  echo "Заполните VPS_USER, VPS_HOST и VPS_PROJECT_DIR в restore-vps-db.sh" >&2
  exit 1
fi

BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" ]]; then
  if ! ls "${DEFAULT_BACKUP_DIR}"/*.sql.gz >/dev/null 2>&1; then
    echo "Не найдено бэкапов в ${DEFAULT_BACKUP_DIR}. Укажите путь к .sql.gz." >&2
    exit 1
  fi
  BACKUP_FILE="$(ls -t "${DEFAULT_BACKUP_DIR}"/*.sql.gz | head -n 1)"
fi

if [[ -z "${EXPECTED_ALEMBIC_VERSION}" ]]; then
  ALEMBIC_VERSIONS_DIR="${SCRIPT_DIR}/../backend/alembic/versions"
  if [[ -d "${ALEMBIC_VERSIONS_DIR}" ]]; then
    LATEST_MIGRATION_FILE="$(ls -1 "${ALEMBIC_VERSIONS_DIR}"/*.py 2>/dev/null | sort | tail -n 1)"
    if [[ -n "${LATEST_MIGRATION_FILE}" ]]; then
      EXPECTED_ALEMBIC_VERSION="$(grep -m1 -E '^revision' "${LATEST_MIGRATION_FILE}" | sed -E 's/^revision[^=]*=[[:space:]]*["'\'']([^"'\'']+)["'\''].*/\1/')"
    fi
  fi
fi

if [[ -z "${EXPECTED_ALEMBIC_VERSION}" ]]; then
  echo "Предупреждение: не удалось автоматически определить alembic revision. Проверка версии будет пропущена." >&2
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Файл бэкапа не найден: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ ! -s "${BACKUP_FILE}" ]]; then
  echo "Файл бэкапа пустой: ${BACKUP_FILE}" >&2
  exit 1
fi

if ! gzip -t "${BACKUP_FILE}"; then
  echo "Ошибка: gzip-проверка не пройдена: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "ВНИМАНИЕ: восстановление перезапишет текущую БД на VPS."
echo "VPS: ${VPS_USER}@${VPS_HOST}"
echo "Бэкап: ${BACKUP_FILE}"
read -r -p "Введите RESTORE для продолжения: " CONFIRM
if [[ "${CONFIRM}" != "RESTORE" ]]; then
  echo "Отменено."
  exit 1
fi

RESTORE_ID="$(TZ="${BACKUP_TZ}" date +%Y%m%d_%H%M%S)"
REMOTE_TMP="/tmp/restore_${RESTORE_ID}.sql.gz"
REMOTE_SAFETY="/tmp/restore_safety_${RESTORE_ID}.sql.gz"

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

if ! "${SCP_CMD[@]}" "${BACKUP_FILE}" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}"; then
  echo "Ошибка: не удалось загрузить бэкап на VPS" >&2
  exit 1
fi

REMOTE_RESTORE_CMD=$(printf '%s\n' \
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
"POSTGRES_DB=\"\${POSTGRES_DB:-ai_image_bot}\"" \
"TARGET_DB_OVERRIDE=\"${TARGET_DB_OVERRIDE}\"" \
"TARGET_DB=\"\${POSTGRES_DB}\"" \
"if [ -n \"\${TARGET_DB_OVERRIDE}\" ]; then TARGET_DB=\"\${TARGET_DB_OVERRIDE}\"; fi" \
"RESTORE_USER=\"${POSTGRES_RESTORE_USER}\"" \
"REQUIRED_TABLES=\"${REQUIRED_TABLES}\"" \
"EXPECTED_ALEMBIC_VERSION=\"${EXPECTED_ALEMBIC_VERSION}\"" \
"REMOTE_TMP=\"${REMOTE_TMP}\"" \
"REMOTE_SAFETY=\"${REMOTE_SAFETY}\"" \
"CREATE_REMOTE_SAFETY_BACKUP=\"${CREATE_REMOTE_SAFETY_BACKUP}\"" \
"KEEP_REMOTE_SAFETY_BACKUP=\"${KEEP_REMOTE_SAFETY_BACKUP}\"" \
"KEEP_REMOTE_DUMP=\"${KEEP_REMOTE_DUMP}\"" \
"cleanup() {" \
"  if [[ \"\${KEEP_REMOTE_DUMP}\" != \"1\" ]]; then" \
"    rm -f \"\${REMOTE_TMP}\" || true" \
"  fi" \
"  if [[ \"\${CREATE_REMOTE_SAFETY_BACKUP}\" == \"1\" && \"\${KEEP_REMOTE_SAFETY_BACKUP}\" != \"1\" ]]; then" \
"    rm -f \"\${REMOTE_SAFETY}\" || true" \
"  fi" \
"}" \
"trap cleanup EXIT" \
"if [[ \"\${CREATE_REMOTE_SAFETY_BACKUP}\" == \"1\" ]]; then" \
"  ${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" pg_dump -U \"\${RESTORE_USER}\" \"\${TARGET_DB}\" | gzip -c > \"\${REMOTE_SAFETY}\"" \
"fi" \
"${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d postgres -v ON_ERROR_STOP=1 -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\${TARGET_DB}' AND pid <> pg_backend_pid();\"" \
"${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d postgres -v ON_ERROR_STOP=1 -c \"DROP DATABASE IF EXISTS \\\"\${TARGET_DB}\\\";\"" \
"${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d postgres -v ON_ERROR_STOP=1 -c \"CREATE DATABASE \\\"\${TARGET_DB}\\\";\"" \
"gunzip -c \"\${REMOTE_TMP}\" | ${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d \"\${TARGET_DB}\" -v ON_ERROR_STOP=1" \
"tables_count=\$(${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d \"\${TARGET_DB}\" -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';\")" \
"columns_count=\$(${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d \"\${TARGET_DB}\" -tAc \"SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public';\")" \
"if [ \"\$tables_count\" -lt 1 ] || [ \"\$columns_count\" -lt 1 ]; then" \
"  echo \"Ошибка: восстановление завершено, но структура БД пуста\" >&2" \
"  exit 1" \
"fi" \
"if [[ -n \"\${REQUIRED_TABLES}\" ]]; then" \
"  IFS=',' read -r -a REQUIRED_TABLE_LIST <<< \"\${REQUIRED_TABLES}\"" \
"  for raw_table in \"\${REQUIRED_TABLE_LIST[@]}\"; do" \
"    table_name=\"\${raw_table//[[:space:]]/}\"" \
"    if [[ -z \"\${table_name}\" ]]; then" \
"      continue" \
"    fi" \
"    table_exists=\$(${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d \"\${TARGET_DB}\" -tAc \"SELECT to_regclass('public.\${table_name}') IS NOT NULL;\")" \
"    if [[ \"\${table_exists}\" != \"t\" ]]; then" \
"      echo \"Ошибка: обязательная таблица не найдена: \${table_name}\" >&2" \
"      exit 1" \
"    fi" \
"  done" \
"fi" \
"if [[ -n \"\${EXPECTED_ALEMBIC_VERSION}\" ]]; then" \
"  alembic_match=\$(${REMOTE_DOCKER_CMD} exec -i \"${POSTGRES_CONTAINER}\" psql -q -X -U \"\${RESTORE_USER}\" -d \"\${TARGET_DB}\" -tAc \"SELECT 1 FROM alembic_version WHERE version_num='\${EXPECTED_ALEMBIC_VERSION}' LIMIT 1;\")" \
"  if [[ \"\${alembic_match}\" != \"1\" ]]; then" \
"    echo \"Ошибка: alembic version не совпадает с ожидаемой: \${EXPECTED_ALEMBIC_VERSION}\" >&2" \
"    exit 1" \
"  fi" \
"fi" \
"echo \"Восстановление завершено. Таблиц: \$tables_count, колонок: \$columns_count\"" \
"if [[ \"\${CREATE_REMOTE_SAFETY_BACKUP}\" == \"1\" ]]; then" \
"  echo \"Резервный дамп до восстановления: \${REMOTE_SAFETY}\"" \
"fi" \
)

if ! "${SSH_CMD[@]}" "${VPS_USER}@${VPS_HOST}" "bash -lc $(printf %q "${REMOTE_RESTORE_CMD}")"; then
  echo "Ошибка: восстановление на VPS не прошло" >&2
  exit 1
fi

echo "Готово: восстановление завершено успешно."
