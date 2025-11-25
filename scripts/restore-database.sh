#!/bin/bash
#
# AI Media Generator - Database Restore Script
#
# Восстановление PostgreSQL базы данных из backup
#
# Использование:
#   ./scripts/restore-database.sh /path/to/backup.sql.gz
#   ./scripts/restore-database.sh latest  # восстановить последний backup
#

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
POSTGRES_CONTAINER="ai_image_bot_postgres_prod"

# Проверка аргументов
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Backup file not specified${NC}"
    echo ""
    echo "Usage:"
    echo "  $0 /path/to/backup.sql.gz     # Restore from specific file"
    echo "  $0 latest                      # Restore from latest backup"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"/db_backup_*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"
    exit 1
fi

# Загрузка переменных из .env
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(cat "${PROJECT_DIR}/.env" | grep -v '^#' | grep -v '^$' | xargs)
else
    echo -e "${RED}❌ Error: .env file not found at ${PROJECT_DIR}/.env${NC}"
    exit 1
fi

# Определение файла backup
if [ "$1" == "latest" ]; then
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/db_backup_*.sql.gz 2>/dev/null | head -1)
    if [ -z "${BACKUP_FILE}" ]; then
        echo -e "${RED}❌ Error: No backup files found in ${BACKUP_DIR}${NC}"
        exit 1
    fi
    echo -e "${YELLOW}📦 Using latest backup: ${BACKUP_FILE}${NC}"
else
    BACKUP_FILE="$1"
fi

# Проверка существования файла
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}❌ Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

# Проверка целостности backup
echo -e "${YELLOW}🔍 Checking backup integrity...${NC}"
if ! gzip -t "${BACKUP_FILE}"; then
    echo -e "${RED}❌ Error: Backup file is corrupted${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Backup integrity check passed${NC}"

# Проверка, что контейнер PostgreSQL запущен
if ! docker ps | grep -q "${POSTGRES_CONTAINER}"; then
    echo -e "${RED}❌ Error: PostgreSQL container '${POSTGRES_CONTAINER}' is not running${NC}"
    exit 1
fi

# Предупреждение
echo ""
echo -e "${RED}⚠️  WARNING: This will REPLACE the current database!${NC}"
echo -e "${YELLOW}Database: ${POSTGRES_DB}${NC}"
echo -e "${YELLOW}Backup file: ${BACKUP_FILE}${NC}"
echo -e "${YELLOW}Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo -e "${YELLOW}❌ Restore cancelled${NC}"
    exit 0
fi

# Создание backup текущей БД перед восстановлением
echo ""
echo -e "${YELLOW}📦 Creating safety backup of current database...${NC}"
SAFETY_BACKUP="${BACKUP_DIR}/before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
docker exec -t "${POSTGRES_CONTAINER}" pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner \
    --no-acl \
    | gzip > "${SAFETY_BACKUP}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Safety backup created: ${SAFETY_BACKUP}${NC}"
else
    echo -e "${RED}❌ Failed to create safety backup${NC}"
    exit 1
fi

# Остановка зависимых сервисов
echo ""
echo -e "${YELLOW}🛑 Stopping dependent services...${NC}"
cd "${PROJECT_DIR}"
docker-compose -f docker-compose.prod.yml stop backend celery_worker celery_beat telegram_bot

# Восстановление из backup
echo ""
echo -e "${YELLOW}🔄 Restoring database from backup...${NC}"
gunzip -c "${BACKUP_FILE}" | docker exec -i "${POSTGRES_CONTAINER}" psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --quiet

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database restored successfully${NC}"
else
    echo -e "${RED}❌ Database restore failed${NC}"
    echo -e "${YELLOW}💡 You can restore from safety backup: ${SAFETY_BACKUP}${NC}"
    exit 1
fi

# Запуск сервисов
echo ""
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose -f docker-compose.prod.yml start backend celery_worker celery_beat telegram_bot

# Ожидание готовности backend
echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
sleep 5

# Проверка здоровья системы
echo ""
echo -e "${YELLOW}🔍 Checking system health...${NC}"

# Проверка backend
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

# Проверка статуса сервисов
echo ""
echo -e "${GREEN}📊 Services status:${NC}"
docker-compose -f docker-compose.prod.yml ps backend celery_worker celery_beat telegram_bot

echo ""
echo -e "${GREEN}✅ Database restore completed!${NC}"
echo ""
echo -e "${YELLOW}Important notes:${NC}"
echo "1. Safety backup was created: ${SAFETY_BACKUP}"
echo "2. Check application logs for any issues"
echo "3. Test critical functionality before going live"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  docker logs ai_image_bot_backend_prod -f      # Check backend logs"
echo "  docker logs ai_image_bot_telegram_prod -f     # Check bot logs"
echo "  curl http://localhost:8000/health              # Check backend health"

exit 0
