# Production Scripts

Скрипты для управления production deployment AI Generator.

## Backup Scripts

### backup-database.sh

Автоматическое резервное копирование PostgreSQL базы данных с ротацией.

**Использование:**
```bash
./scripts/backup-database.sh
```

**Возможности:**
- Создание сжатых backup'ов БД (gzip)
- Автоматическая ротация старых backup'ов
- Дневные backup'ы (хранятся 7 дней)
- Еженедельные backup'ы (хранятся 4 недели)
- Ежемесячные backup'ы (хранятся 3 месяца)
- Проверка целостности backup'а
- Статистика по всем backup'ам

**Настройка автоматического backup через cron:**
```bash
# Редактировать crontab
crontab -e

# Добавить строку для ежедневного backup в 2:00 ночи
0 2 * * * /root/ai-media-generator/scripts/backup-database.sh >> /var/log/ai-bot-backup.log 2>&1
```

**Расположение backup'ов:**
```
backups/
├── db_backup_20251102_020000.sql.gz  # Дневной backup
├── db_backup_20251103_020000.sql.gz
├── weekly_2025_W44.sql.gz            # Еженедельный backup
├── monthly_2025_11.sql.gz            # Ежемесячный backup
└── daily_latest.sql.gz               # Симлинк на последний backup
```

**Конфигурация:**
Параметры можно изменить в начале скрипта:
- `KEEP_DAYS=7` - хранить дневные backup'ы 7 дней
- `KEEP_WEEKS=4` - хранить еженедельные backup'ы 4 недели
- `KEEP_MONTHS=3` - хранить ежемесячные backup'ы 3 месяца

### backup-db-date.sh

Простой backup БД в текущую директорию с именем файла по дате.

**Использование:**
```bash
# Запуск из поддиректории backup (файл сохранится здесь же)
cd backup
../scripts/backup-db-date.sh
```

**Что делает:**
- Сохраняет файл `YYYY-MM-DD.sql` в текущей директории
- Если файл за эту дату уже есть, он перезаписывается
- Берёт `POSTGRES_USER` и `POSTGRES_DB` из `.env` в корне проекта (можно переопределить через `ENV_FILE`)
- Использует `docker-compose.prod.yml` в корне проекта (можно переопределить через `COMPOSE_FILE`)
- Для docker compose использует `COMPOSE_PROJECT_NAME` (или имя корня проекта)
- Часовой пояс можно переопределить через `BACKUP_TZ` (по умолчанию `Europe/Moscow`)

### backup-db-gdrive.sh

Backup БД с загрузкой в Google Drive через rclone.

**Требования:**
- Установить rclone на VPS
- Настроить remote (по умолчанию имя `gdrive`):
  ```bash
  rclone config
  ```

**Использование:**
```bash
# Запуск из корня проекта
./scripts/backup-db-gdrive.sh
```

**Переменные окружения:**
- `GDRIVE_REMOTE` (default: `gdrive`)
- `GDRIVE_DIR` (default: `ai-media-generator/backup`)
- `BACKUP_TZ` (default: `Europe/Moscow`)
- `RCLONE_BIN`, `RCLONE_CONFIG`, `RCLONE_FLAGS` (опционально)

### install-backup-cron.sh

Установка cron-задачи для ежедневного backup в 06:00 по МСК.

**Использование (на VPS):**
```bash
./scripts/install-backup-cron.sh
```

**Опциональные переменные:**
- `CRON_TZ` (default: `Europe/Moscow`)
- `SCHEDULE` (default: `0 6 * * *`)
- `LOG_FILE` (default: `/var/log/ai-bot-backup.log`)
- `GDRIVE_REMOTE`, `GDRIVE_DIR`, `RCLONE_*`, `BACKUP_TZ`

### restore-database.sh

Восстановление базы данных из backup.

**Использование:**
```bash
# Восстановить из конкретного файла
./scripts/restore-database.sh /path/to/backup.sql.gz

# Восстановить из последнего backup'а
./scripts/restore-database.sh latest

# Показать список доступных backup'ов
./scripts/restore-database.sh
```

**Возможности:**
- Восстановление из любого backup файла
- Автоматический safety backup перед восстановлением
- Остановка зависимых сервисов на время восстановления
- Автоматический запуск сервисов после восстановления
- Проверка целостности backup файла
- Проверка здоровья системы после восстановления

**Безопасность:**
- Запрашивает подтверждение перед восстановлением
- Создаёт safety backup текущей БД перед восстановлением
- Останавливает сервисы, чтобы избежать повреждения данных

**Важно:**
После восстановления обязательно проверьте:
1. Логи backend: `docker logs ai_image_bot_backend_prod -f`
2. Логи telegram bot: `docker logs ai_image_bot_telegram_prod -f`
3. Health endpoint: `curl http://localhost:8000/health`
4. Функциональность приложения

## Полезные команды

### Просмотр backup'ов
```bash
# Список всех backup'ов
ls -lh backups/

# Последние 10 backup'ов
ls -lt backups/db_backup_*.sql.gz | head -10

# Размер всех backup'ов
du -sh backups/
```

### Ручное создание backup
```bash
# Создать backup вручную
docker exec -t ai_image_bot_postgres_prod pg_dump \
    -U postgres \
    -d ai_image_bot \
    --no-owner \
    --no-acl \
    | gzip > manual_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Проверка backup файла
```bash
# Проверить целостность
gzip -t backup_file.sql.gz

# Посмотреть содержимое (первые 100 строк)
gunzip -c backup_file.sql.gz | head -100
```

### Копирование backup на локальную машину
```bash
# С VPS на локальную машину
scp root@185.135.82.109:/root/ai-media-generator/backups/db_backup_*.sql.gz ./

# Или скачать последний backup
ssh root@185.135.82.109 "cat /root/ai-media-generator/backups/daily_latest.sql.gz" > latest_backup.sql.gz
```

## Troubleshooting

### Backup fails with "disk full"
```bash
# Проверить место на диске
df -h

# Удалить старые backup'ы вручную
cd /root/ai-media-generator/backups
rm db_backup_2024*.sql.gz

# Очистить Docker volumes (осторожно!)
docker system prune -a --volumes
```

### Restore fails with connection error
```bash
# Проверить, что PostgreSQL запущен
docker ps | grep postgres

# Проверить логи PostgreSQL
docker logs ai_image_bot_postgres_prod

# Перезапустить PostgreSQL
docker-compose -f docker-compose.prod.yml restart postgres
```

### Permission denied
```bash
# Дать права на выполнение скриптам
chmod +x scripts/*.sh

# Или для конкретного скрипта
chmod +x scripts/backup-database.sh
```

## Best Practices

1. **Регулярные backup'ы**: Настройте cron для автоматических backup'ов
2. **Проверка backup'ов**: Периодически проверяйте целостность backup'ов
3. **Тестирование восстановления**: Регулярно тестируйте процесс восстановления на dev окружении
4. **Удалённое хранение**: Копируйте важные backup'ы на удалённое хранилище (S3, другой сервер)
5. **Мониторинг**: Настройте уведомления об успехе/неудаче backup'ов
6. **Документация**: Фиксируйте все изменения в схеме БД и процедурах восстановления

## Автоматизация

### Скрипт для загрузки backup в S3 (пример)
```bash
#!/bin/bash
# upload-to-s3.sh

BACKUP_FILE=$1
S3_BUCKET="s3://your-backup-bucket/ai-media-generator/"

aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}" \
    --storage-class STANDARD_IA \
    --metadata "date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "Backup uploaded to S3: ${S3_BUCKET}$(basename ${BACKUP_FILE})"
```

### Уведомления о backup
Раскомментируйте секцию в конце `backup-database.sh` и настройте отправку в любой канал (email, Slack, webhook). Пример переменных:
```bash
BACKUP_NOTIFICATION_WEBHOOK=https://hooks.slack.com/services/...
```

## Мониторинг backup'ов

### Проверка последнего backup
```bash
#!/bin/bash
# check-backup-age.sh

LATEST_BACKUP=$(ls -t /root/ai-media-generator/backups/db_backup_*.sql.gz | head -1)
BACKUP_AGE=$(($(date +%s) - $(stat -c %Y "${LATEST_BACKUP}")))
MAX_AGE=$((24 * 3600))  # 24 hours

if [ ${BACKUP_AGE} -gt ${MAX_AGE} ]; then
    echo "WARNING: Latest backup is older than 24 hours!"
    # Отправить уведомление
fi
```

## См. также

- [DEPLOYMENT_SUMMARY.md](../DEPLOYMENT_SUMMARY.md) - Общая информация о deployment
- [QUICK_DEPLOY_GUIDE.md](../QUICK_DEPLOY_GUIDE.md) - Быстрое развёртывание
