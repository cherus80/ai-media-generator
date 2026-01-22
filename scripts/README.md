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
