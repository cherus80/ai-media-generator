# Production Scripts

Скрипты для управления production deployment AI Generator.

## Backup Scripts

### backup-from-vps.sh (локальный)

Простой локальный скрипт для создания бэкапа БД на VPS и сохранения на вашем компьютере.

**Использование:**
1) Откройте `scripts/backup-from-vps.sh` и при необходимости поправьте `VPS_USER`, `VPS_HOST`, `VPS_PROJECT_DIR`.
2) Запустите:
```bash
./scripts/backup-from-vps.sh
```

**Результат:**
- Файл сохраняется в `backup/YYYY-MM-DD.sql.gz` на локальной машине.
- По умолчанию выполняется тестовое восстановление в временную БД на VPS (для максимальной уверенности).

**Параметры проверки:**
- `VERIFY_RESTORE` (default: `1`) — включить/выключить тестовое восстановление
- `VERIFY_DB_PREFIX` (default: `backup_verify`)
- `VERIFY_KEEP_DB` (default: `0`) — оставить тестовую БД
- `POSTGRES_RESTORE_USER` (default: `postgres`) — пользователь для тестового восстановления
- Во время проверки файл временно загружается на VPS в `/tmp`, затем удаляется.

### restore-vps-db.sh (локальный)

Скрипт для восстановления БД на VPS из локального бэкапа.

**Использование:**
1) Убедитесь, что `VPS_USER`, `VPS_HOST`, `VPS_PROJECT_DIR` заполнены.
2) Запустите с явным файлом:
```bash
./scripts/restore-vps-db.sh ./scripts/backup/2025-01-01.sql.gz
```
или без аргумента (возьмет самый свежий бэкап из `scripts/backup`):
```bash
./scripts/restore-vps-db.sh
```

**Проверка корректности:**
- После восстановления скрипт проверяет, что в `public` есть таблицы и колонки.
- Дополнительно проверяются обязательные таблицы и alembic revision (если определен).
- При включенном `CREATE_REMOTE_SAFETY_BACKUP=1` создается резервный дамп текущей БД на VPS перед восстановлением.

**Параметры:**
- `POSTGRES_RESTORE_USER` (default: `postgres`) — пользователь для drop/create и восстановления
- `TARGET_DB_OVERRIDE` (default: пусто) — восстановление в указанную БД вместо `POSTGRES_DB`
- `CREATE_REMOTE_SAFETY_BACKUP` (default: `1`) — создать резервную копию текущей БД на VPS
- `KEEP_REMOTE_SAFETY_BACKUP` (default: `1`) — оставить резервный дамп на VPS
- `KEEP_REMOTE_DUMP` (default: `0`) — оставить загруженный дамп на VPS
- `REQUIRED_TABLES` (default: `alembic_version,users`) — обязательные таблицы для проверки восстановления
- `EXPECTED_ALEMBIC_VERSION` (default: авто) — ожидаемая версия alembic; если пусто, определяется по последней миграции в `backend/alembic/versions`

## CI/CD Setup

### setup-github-cicd-ghcr.sh (локальный)

Интерактивный скрипт для безопасной настройки GitHub Actions `Secrets`/`Variables` под автодеплой `GHCR + sha-tag + latest`.

Особенности:
- Не печатает значения секретов в консоль
- Для `VPS_SSH_KEY` читает приватный ключ из файла
- Может сразу запустить workflow `Deploy to Production`

Использование:

```bash
./scripts/setup-github-cicd-ghcr.sh
```
