#!/bin/bash
#
# AI Media Generator - Database Backup Script
#
# Автоматическое резервное копирование PostgreSQL базы данных
# с ротацией старых backup'ов
#
# Использование:
#   ./scripts/backup-database.sh
#
# Для автоматического backup через cron:
#   0 2 * * * /root/ai-image-bot/scripts/backup-database.sh >> /var/log/ai-bot-backup.log 2>&1
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
KEEP_DAYS=7  # Хранить backup'ы за последние 7 дней
KEEP_WEEKS=4  # Хранить еженедельные backup'ы за последние 4 недели
KEEP_MONTHS=3  # Хранить ежемесячные backup'ы за последние 3 месяца

# Имя контейнера PostgreSQL
POSTGRES_CONTAINER="ai_image_bot_postgres_prod"

# Загрузка переменных из .env
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(cat "${PROJECT_DIR}/.env" | grep -v '^#' | grep -v '^$' | xargs)
else
    echo -e "${RED}❌ Error: .env file not found at ${PROJECT_DIR}/.env${NC}"
    exit 1
fi

# Создание директории для backup'ов
mkdir -p "${BACKUP_DIR}"

echo -e "${GREEN}🔄 Starting database backup...${NC}"
echo "Timestamp: ${TIMESTAMP}"
echo "Backup file: ${BACKUP_FILE}"

# Проверка, что контейнер PostgreSQL запущен
if ! docker ps | grep -q "${POSTGRES_CONTAINER}"; then
    echo -e "${RED}❌ Error: PostgreSQL container '${POSTGRES_CONTAINER}' is not running${NC}"
    exit 1
fi

# Создание backup
echo -e "${YELLOW}📦 Creating backup...${NC}"
docker exec -t "${POSTGRES_CONTAINER}" pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip > "${BACKUP_FILE}"

# Проверка успешности backup
if [ $? -eq 0 ] && [ -f "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully${NC}"
    echo "Size: ${BACKUP_SIZE}"

    # Создание символических ссылок для разных типов backup'ов
    DAILY_LINK="${BACKUP_DIR}/daily_latest.sql.gz"
    ln -sf "$(basename ${BACKUP_FILE})" "${DAILY_LINK}"

    # Еженедельный backup (каждое воскресенье)
    if [ $(date +%u) -eq 7 ]; then
        WEEKLY_LINK="${BACKUP_DIR}/weekly_$(date +%Y_W%V).sql.gz"
        cp "${BACKUP_FILE}" "${WEEKLY_LINK}"
        echo -e "${GREEN}📅 Weekly backup created: ${WEEKLY_LINK}${NC}"
    fi

    # Ежемесячный backup (первый день месяца)
    if [ $(date +%d) -eq 01 ]; then
        MONTHLY_LINK="${BACKUP_DIR}/monthly_$(date +%Y_%m).sql.gz"
        cp "${BACKUP_FILE}" "${MONTHLY_LINK}"
        echo -e "${GREEN}📅 Monthly backup created: ${MONTHLY_LINK}${NC}"
    fi
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi

# Ротация старых backup'ов
echo -e "${YELLOW}🗑️  Rotating old backups...${NC}"

# Удаление дневных backup'ов старше KEEP_DAYS дней
find "${BACKUP_DIR}" -name "db_backup_*.sql.gz" -type f -mtime +${KEEP_DAYS} -delete
echo "Removed daily backups older than ${KEEP_DAYS} days"

# Удаление еженедельных backup'ов старше KEEP_WEEKS недель
KEEP_WEEKS_DAYS=$((KEEP_WEEKS * 7))
find "${BACKUP_DIR}" -name "weekly_*.sql.gz" -type f -mtime +${KEEP_WEEKS_DAYS} -delete
echo "Removed weekly backups older than ${KEEP_WEEKS} weeks"

# Удаление ежемесячных backup'ов старше KEEP_MONTHS месяцев
KEEP_MONTHS_DAYS=$((KEEP_MONTHS * 30))
find "${BACKUP_DIR}" -name "monthly_*.sql.gz" -type f -mtime +${KEEP_MONTHS_DAYS} -delete
echo "Removed monthly backups older than ${KEEP_MONTHS} months"

# Статистика backup'ов
echo ""
echo -e "${GREEN}📊 Backup Statistics:${NC}"
echo "Daily backups: $(find "${BACKUP_DIR}" -name "db_backup_*.sql.gz" -type f | wc -l)"
echo "Weekly backups: $(find "${BACKUP_DIR}" -name "weekly_*.sql.gz" -type f | wc -l)"
echo "Monthly backups: $(find "${BACKUP_DIR}" -name "monthly_*.sql.gz" -type f | wc -l)"
echo "Total size: $(du -sh "${BACKUP_DIR}" | cut -f1)"

# Тест целостности backup (опционально)
echo ""
echo -e "${YELLOW}🔍 Testing backup integrity...${NC}"
if gzip -t "${BACKUP_FILE}"; then
    echo -e "${GREEN}✅ Backup integrity check passed${NC}"
else
    echo -e "${RED}❌ Backup integrity check failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Database backup completed successfully!${NC}"
echo "Latest backup: ${BACKUP_FILE}"

# Отправка уведомления (опционально, требует настройки)
# Можно отправить уведомление в Slack/email/webhook
# if [ ! -z "${BACKUP_NOTIFICATION_CHAT_ID}" ]; then
#     curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
#         -d chat_id="${BACKUP_NOTIFICATION_CHAT_ID}" \
#         -d text="✅ Database backup completed successfully! Size: ${BACKUP_SIZE}" \
#         > /dev/null
# fi

exit 0
