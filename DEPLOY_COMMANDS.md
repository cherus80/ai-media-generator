# ⚡ Команды для быстрого развертывания

## 🚀 Копируйте и вставляйте эти команды в SSH терминал

### 1️⃣ Подключение к VPS
```bash
ssh root@185.135.82.109
# Пароль: huIRNA0
```

---

### 2️⃣ Быстрая установка (автоматический скрипт)

```bash
# Скачать скрипт
cd /root && \
curl -L https://raw.githubusercontent.com/cherus80/ai-image-bot/master/vps-deploy-script.sh -o vps-deploy-script.sh && \
chmod +x vps-deploy-script.sh

# ПЕРЕД ЗАПУСКОМ: отредактируйте API ключи
nano vps-deploy-script.sh
# Найдите секцию КОНФИГУРАЦИЯ и заполните:
# - TELEGRAM_BOT_TOKEN
# - KIE_AI_API_KEY
# - OPENROUTER_API_KEY
# Ctrl+X, Y, Enter для сохранения

# Запустить скрипт
./vps-deploy-script.sh
```

---

### 3️⃣ Ручная установка (если скрипт не сработал)

#### Установка необходимых пакетов
```bash
apt update && apt upgrade -y && \
apt install -y git curl nano htop ufw nginx certbot python3-certbot-nginx
```

#### Настройка firewall
```bash
ufw --force enable && \
ufw allow 22/tcp && \
ufw allow 80/tcp && \
ufw allow 443/tcp && \
ufw allow 9000/tcp && \
ufw status
```

#### Клонирование репозитория
```bash
cd /opt && \
git clone https://github.com/cherus80/ai-image-bot.git && \
cd ai-image-bot
```

#### Генерация ключей
```bash
echo "SECRET_KEY=$(openssl rand -hex 32)"
echo "JWT_SECRET_KEY=$(openssl rand -hex 32)"
echo "ADMIN_SECRET_KEY=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-25)"
```

#### Создание .env файла
```bash
cp .env.example .env && nano .env
# Заполните все переменные (см. QUICK_DEPLOY_GUIDE.md)
# Ctrl+X, Y, Enter для сохранения
```

---

### 4️⃣ Запуск приложения через Docker Compose

```bash
cd /opt/ai-image-bot && \
docker-compose -f docker-compose.prod.yml up -d
```

#### Проверка статуса контейнеров
```bash
docker-compose -f docker-compose.prod.yml ps
```

#### Просмотр логов (если что-то не запустилось)
```bash
# Все логи
docker-compose -f docker-compose.prod.yml logs

# Backend
docker logs ai_image_bot_backend_prod

# Frontend
docker logs ai_image_bot_frontend_prod

# Postgres
docker logs ai_image_bot_postgres_prod
```

---

### 5️⃣ Инициализация базы данных

```bash
# Запуск миграций
docker exec -it ai_image_bot_backend_prod alembic upgrade head

# Проверка таблиц
docker exec -it ai_image_bot_postgres_prod psql -U postgres -d ai_image_bot -c "\dt"
```

---

### 6️⃣ Получение SSL сертификата

**⚠️ Выполняйте ТОЛЬКО когда DNS заработает!**

```bash
# Проверка DNS
ping ai-bot-media.mix4.ru
# Должен вернуть: 185.135.82.109

# Получение сертификата
certbot --nginx -d ai-bot-media.mix4.ru

# Или вручную:
systemctl stop nginx && \
certbot certonly --standalone -d ai-bot-media.mix4.ru && \
systemctl start nginx
```

---

### 7️⃣ Проверка работы

```bash
# Backend API
curl https://ai-bot-media.mix4.ru/api/v1/health

# Nginx статус
systemctl status nginx

# Все контейнеры
docker ps

# Использование ресурсов
docker stats --no-stream
```

---

## 🔧 Полезные команды для управления

### Просмотр логов
```bash
# Все сервисы (live)
docker-compose -f /opt/ai-image-bot/docker-compose.prod.yml logs -f

# Только backend
docker logs -f ai_image_bot_backend_prod

# Последние 100 строк
docker logs --tail 100 ai_image_bot_backend_prod
```

### Перезапуск сервисов
```bash
# Все контейнеры
docker-compose -f /opt/ai-image-bot/docker-compose.prod.yml restart

# Конкретный контейнер
docker restart ai_image_bot_backend_prod

# Nginx
systemctl restart nginx
```

### Остановка/запуск
```bash
# Остановить все
docker-compose -f /opt/ai-image-bot/docker-compose.prod.yml down

# Запустить все
docker-compose -f /opt/ai-image-bot/docker-compose.prod.yml up -d
```

### Обновление приложения
```bash
cd /opt/ai-image-bot && \
git pull && \
docker-compose -f docker-compose.prod.yml build && \
docker-compose -f docker-compose.prod.yml up -d
```

### Backup базы данных
```bash
# Создать backup
mkdir -p /opt/backups && \
docker exec -it ai_image_bot_postgres_prod pg_dump -U postgres ai_image_bot > /opt/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить backup
docker exec -i ai_image_bot_postgres_prod psql -U postgres ai_image_bot < /opt/backups/backup_20250101_120000.sql
```

### Очистка системы
```bash
# Удалить неиспользуемые образы
docker image prune -a

# Удалить неиспользуемые volumes
docker volume prune

# Полная очистка
docker system prune -a --volumes
```

---

## 🐞 Решение проблем

### Контейнер не запускается
```bash
# Посмотреть причину
docker logs ai_image_bot_backend_prod

# Проверить переменные окружения
docker exec ai_image_bot_backend_prod env | grep -E "(POSTGRES|REDIS|API)"

# Пересоздать контейнер
docker-compose -f /opt/ai-image-bot/docker-compose.prod.yml up -d --force-recreate backend
```

### Проблемы с базой данных
```bash
# Проверить что PostgreSQL запущен
docker ps | grep postgres

# Подключиться к базе
docker exec -it ai_image_bot_postgres_prod psql -U postgres -d ai_image_bot

# В psql:
# \l          - список баз данных
# \dt         - список таблиц
# \q          - выход
```

### Проблемы с Nginx
```bash
# Проверить конфигурацию
nginx -t

# Проверить логи
tail -f /var/log/nginx/ai-image-bot-error.log

# Перезапустить
systemctl restart nginx
```

### Frontend не открывается
```bash
# Проверить frontend контейнер
docker logs ai_image_bot_frontend_prod

# Проверить что порт 3000 доступен
curl http://localhost:3000

# Перезапустить frontend
docker restart ai_image_bot_frontend_prod
```

### Celery не обрабатывает задачи
```bash
# Проверить Celery worker
docker logs ai_image_bot_celery_worker_prod

# Проверить Redis
docker exec ai_image_bot_redis_prod redis-cli ping
# Должно вернуть: PONG

# Перезапустить Celery
docker restart ai_image_bot_celery_worker_prod
```

---

## 📊 Мониторинг

### Использование ресурсов
```bash
# Контейнеры
docker stats

# Диск
df -h

# Память
free -h

# CPU
htop
```

### Проверка здоровья сервисов
```bash
# Backend
curl http://localhost:8000/health

# Frontend
curl http://localhost:3000

# PostgreSQL
docker exec ai_image_bot_postgres_prod pg_isready

# Redis
docker exec ai_image_bot_redis_prod redis-cli ping
```

---

## 🎯 Быстрые действия

### Полный перезапуск
```bash
cd /opt/ai-image-bot && \
docker-compose -f docker-compose.prod.yml down && \
sleep 5 && \
docker-compose -f docker-compose.prod.yml up -d && \
systemctl restart nginx
```

### Очистка и перезапуск
```bash
cd /opt/ai-image-bot && \
docker-compose -f docker-compose.prod.yml down -v && \
docker system prune -f && \
docker-compose -f docker-compose.prod.yml up -d --build
```

### Проверка всего
```bash
echo "=== Docker Containers ===" && \
docker ps && \
echo "" && \
echo "=== Nginx Status ===" && \
systemctl status nginx --no-pager && \
echo "" && \
echo "=== Backend Health ===" && \
curl -s http://localhost:8000/health && \
echo "" && \
echo "=== Disk Usage ===" && \
df -h | grep -E "(Filesystem|/dev/vda)" && \
echo "" && \
echo "=== Memory Usage ===" && \
free -h
```
