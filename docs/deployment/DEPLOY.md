# Инструкция по деплою AI Image Generator на Beget VPS

Полное руководство по развёртыванию веб-приложения AI Image Generator на VPS сервере Beget.

---

## Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Подготовка сервера](#подготовка-сервера)
3. [Настройка SSL сертификатов](#настройка-ssl-сертификатов)
4. [Подготовка приложения](#подготовка-приложения)
5. [Настройка nginx](#настройка-nginx)
6. [Деплой через Docker](#деплой-через-docker)
7. [Настройка ЮKassa Webhook](#настройка-юkassa-webhook)
8. [Мониторинг и логи](#мониторинг-и-логи)
9. [Backup и восстановление](#backup-и-восстановление)
10. [Troubleshooting](#troubleshooting)

---

## Предварительные требования

### Что должно быть готово:

- ✅ VPS сервер Beget с SSH доступом
- ✅ Docker и Docker Compose установлены
- ✅ Portainer установлен (опционально)
- ✅ nginx установлен
- ✅ Доменное имя (например: `your-domain.com`)
- ✅ API ключи:
  - OpenRouter API Key
  - ЮKassa Shop ID и Secret Key
  - JWT/SECRET ключи, параметры антиабуза

### Технические требования:

- **RAM**: минимум 2GB (рекомендуется 4GB)
- **Disk**: минимум 10GB свободного места
- **CPU**: минимум 2 cores
- **OS**: Ubuntu 20.04+ или Debian 11+

---

## Подготовка сервера

### 1. Подключение к серверу

```bash
ssh root@your-server-ip
# или
ssh your-username@your-server-ip
```

### 2. Обновление системы

```bash
sudo apt update
sudo apt upgrade -y
```

### 3. Установка необходимых пакетов

```bash
sudo apt install -y curl git htop nano certbot python3-certbot-nginx
```

### 4. Создание директории для проекта

```bash
sudo mkdir -p /var/www/ai-image-bot
sudo chown -R $USER:$USER /var/www/ai-image-bot
cd /var/www/ai-image-bot
```

### 5. Клонирование проекта

```bash
# Если используете git
git clone https://github.com/your-repo/ai-image-bot.git .

# Или загрузите файлы через SFTP/SCP
```

---

## Настройка SSL сертификатов

### Вариант 1: Let's Encrypt (рекомендуется, бесплатно)

```bash
# Остановите nginx временно
sudo systemctl stop nginx

# Получите сертификат
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Запустите nginx обратно
sudo systemctl start nginx
```

### Вариант 2: Автоматическое обновление через nginx

```bash
# Создайте директорию для ACME challenge
sudo mkdir -p /var/www/certbot

# Получите сертификат
sudo certbot certonly --webroot -w /var/www/certbot -d your-domain.com -d www.your-domain.com
```

### Настройка автообновления сертификата

```bash
# Добавьте cron job для автообновления
sudo crontab -e

# Добавьте строку (обновление каждый понедельник в 3:00)
0 3 * * 1 /usr/bin/certbot renew --quiet && systemctl reload nginx
```

---

## Подготовка приложения

### 1. Создание production .env файлов

#### Backend (.env.production)

```bash
cd /var/www/ai-image-bot
cp backend/.env.example backend/.env.production
nano backend/.env.production
```

**Заполните следующие значения:**

```env
# Environment
ENVIRONMENT=production
DEBUG=False

# Backend
SECRET_KEY=<СГЕНЕРИРУЙТЕ_СЛУЧАЙНЫЙ_КЛЮЧ_64_СИМВОЛА>
FRONTEND_URL=https://your-domain.com

# Database PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<СЛОЖНЫЙ_ПАРОЛЬ>
POSTGRES_DB=ai_image_bot
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/0

# External APIs
OPENROUTER_API_KEY=<ВАШ_OPENROUTER_КЛЮЧ>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=anthropic/claude-3-haiku-20240307

# YooKassa
YUKASSA_SHOP_ID=<ВАШ_SHOP_ID>
YUKASSA_SECRET_KEY=<ВАШ_SECRET_KEY>
YUKASSA_WEBHOOK_SECRET=<СЛУЧАЙНЫЙ_КЛЮЧ_ДЛЯ_WEBHOOK>

# JWT
JWT_SECRET_KEY=<СГЕНЕРИРУЙТЕ_СЛУЧАЙНЫЙ_КЛЮЧ_64_СИМВОЛА>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Admin
ADMIN_SECRET_KEY=<СГЕНЕРИРУЙТЕ_СЛУЧАЙНЫЙ_КЛЮЧ_32_СИМВОЛА>

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=5
ALLOWED_EXTENSIONS=jpg,jpeg,png
PHOTO_RETENTION_HOURS=24
CHAT_HISTORY_RETENTION_DAYS=30

# Monetization
FREEMIUM_ACTIONS_PER_MONTH=10
FREEMIUM_WATERMARK_TEXT=AI Image Generator
NPD_TAX_RATE=0.04
YUKASSA_COMMISSION_RATE=0.028

# Rate Limiting
RATE_LIMIT_PER_MINUTE=10
REGISTRATION_LIMIT_PER_IP_PER_DAY=3
FREE_ACTIONS_PER_MONTH=10
REQUIRE_PHONE_VERIFICATION=true
ENABLE_DEVICE_FINGERPRINT=true

# Sentry (опционально)
SENTRY_DSN=
```

**Генерация случайных ключей:**

```bash
# Для SECRET_KEY и JWT_SECRET_KEY (64 символа)
openssl rand -hex 32

# Для ADMIN_SECRET_KEY (32 символа)
openssl rand -hex 16

# Для YUKASSA_WEBHOOK_SECRET
openssl rand -hex 24
```

#### Frontend (.env.production)

```bash
cp frontend/.env.example frontend/.env.production
nano frontend/.env.production
```

```env
VITE_API_BASE_URL=https://your-domain.com
VITE_APP_NAME=AI Image Generator
VITE_ENV=production
```

### 2. Проверка файлов

```bash
# Убедитесь, что все .env.production файлы созданы
ls -la backend/.env.production
ls -la frontend/.env.production
```

---

## Настройка nginx

### 1. Копирование конфигурации

```bash
sudo cp nginx/ai-image-bot.conf /etc/nginx/sites-available/ai-image-bot.conf
```

### 2. Редактирование конфигурации

```bash
sudo nano /etc/nginx/sites-available/ai-image-bot.conf
```

**Замените `your-domain.com` на ваш домен** во всех местах:

```nginx
server_name your-domain.com www.your-domain.com;  # <- ИЗМЕНИТЬ

# SSL сертификаты
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;  # <- ИЗМЕНИТЬ
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;  # <- ИЗМЕНИТЬ
ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;  # <- ИЗМЕНИТЬ
```

### 3. Создание симлинка

```bash
sudo ln -s /etc/nginx/sites-available/ai-image-bot.conf /etc/nginx/sites-enabled/
```

### 4. Отключение дефолтной конфигурации (если нужно)

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### 5. Проверка конфигурации nginx

```bash
sudo nginx -t
```

Должно вывести:

```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 6. Перезагрузка nginx

```bash
sudo systemctl reload nginx
```

---

## Деплой через Docker

### 1. Сборка образов

```bash
cd /var/www/ai-image-bot
./deploy.sh build
```

Эта команда:
- Проверит наличие .env файлов
- Соберёт Docker образы для backend, frontend, worker/beat
- Это может занять 5-10 минут

### 2. Запуск production окружения

```bash
./deploy.sh start
```

Эта команда:
- Запустит PostgreSQL и Redis
- Дождётся их готовности (healthcheck)
- Запустит Backend (FastAPI)
    - Запустит Celery Worker и Celery Beat
    - Запустит Frontend (nginx + React)

### 3. Проверка статуса

```bash
./deploy.sh status
```

Должны быть запущены все сервисы:

```
NAME                                  STATE    PORTS
ai_image_bot_backend_prod            Up       127.0.0.1:8000->8000/tcp
ai_image_bot_celery_beat_prod        Up
ai_image_bot_celery_worker_prod      Up
ai_image_bot_frontend_prod           Up       127.0.0.1:3000->80/tcp
ai_image_bot_postgres_prod           Up       127.0.0.1:5432->5432/tcp
ai_image_bot_redis_prod              Up       127.0.0.1:6379->6379/tcp
```

### 4. Запуск миграций БД

```bash
./deploy.sh migrate
```

### 5. Проверка здоровья сервисов

```bash
./deploy.sh health
```

Должно вывести:

```
✓ Backend: OK
✓ Frontend: OK
✓ PostgreSQL: OK
✓ Redis: OK
```

### 6. Просмотр логов

```bash
# Все сервисы
./deploy.sh logs

# Конкретный сервис
./deploy.sh logs backend
./deploy.sh logs celery_worker
```

---

## Настройка ЮKassa Webhook

### 1. Войти в личный кабинет ЮKassa

https://yookassa.ru/my

### 2. Перейти в настройки магазина

Настройки → Уведомления → HTTP-уведомления

### 3. Добавить webhook URL

```
https://your-domain.com/api/v1/payments/webhook
```

### 4. Выбрать события

Отметьте:
- ✅ `payment.succeeded` — успешный платёж
- ✅ `payment.canceled` — отменённый платёж

### 5. Сохранить

ЮKassa начнёт отправлять уведомления о платежах на ваш сервер.

### 6. Проверка webhook

После первого тестового платежа проверьте логи:

```bash
./deploy.sh logs backend | grep "webhook"
```

Должны увидеть успешную обработку webhook.

---

## Мониторинг и логи

### Полезные команды

```bash
# Статус всех сервисов
./deploy.sh status

# Health check
./deploy.sh health

# Логи всех сервисов
./deploy.sh logs

# Логи backend
./deploy.sh logs backend

# Логи с фильтром (например, только ошибки)
./deploy.sh logs backend | grep ERROR

# Использование ресурсов
docker stats

# Занятое место
docker system df
```

### Системные логи

```bash
# nginx логи
sudo tail -f /var/log/nginx/ai-image-bot-access.log
sudo tail -f /var/log/nginx/ai-image-bot-error.log

# Docker логи
docker logs -f ai_image_bot_backend_prod
docker logs -f ai_image_bot_celery_worker_prod
```

### Portainer (если установлен)

Откройте Portainer в браузере:

```
https://your-server-ip:9443
```

Там можно мониторить:
- Статус контейнеров
- Использование CPU/RAM
- Логи в реальном времени
- Управление через UI

---

## Backup и восстановление

### Автоматический backup БД

```bash
# Создать backup
./deploy.sh backup

# Backup сохранится в ./backups/backup_YYYYMMDD_HHMMSS.sql
```

### Настройка автоматического backup (cron)

```bash
# Редактировать crontab
crontab -e

# Добавить backup каждый день в 4:00 утра
0 4 * * * cd /var/www/ai-image-bot && ./deploy.sh backup
```

### Восстановление из backup

```bash
# Остановить приложение
./deploy.sh stop

# Запустить только PostgreSQL
docker-compose -f docker-compose.prod.yml up -d postgres

# Восстановить из backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres ai_image_bot < backups/backup_20250131_040000.sql

# Запустить приложение
./deploy.sh start
```

### Backup загруженных файлов

```bash
# Создать архив uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz -C /var/lib/docker/volumes/ai_image_bot_backend_uploads/_data .

# Восстановить uploads
tar -xzf uploads_backup_20250131.tar.gz -C /var/lib/docker/volumes/ai_image_bot_backend_uploads/_data
```

---

## Troubleshooting

### Проблема: Сервисы не запускаются

**Решение:**

```bash
# Проверьте логи
./deploy.sh logs

# Проверьте .env файлы
cat backend/.env.production
cat frontend/.env.production

# Проверьте наличие портов
sudo netstat -tulpn | grep -E '8000|3000|5432|6379'

# Пересоберите образы
./deploy.sh build
./deploy.sh restart
```

### Проблема: 502 Bad Gateway в nginx

**Решение:**

```bash
# Проверьте, что backend запущен
docker ps | grep backend

# Проверьте логи backend
./deploy.sh logs backend

# Проверьте, что backend отвечает
curl http://localhost:8000/health

# Проверьте nginx конфигурацию
sudo nginx -t

# Перезапустите nginx
sudo systemctl restart nginx
```

### Проблема: Celery задачи не выполняются

**Решение:**

```bash
# Проверьте логи celery worker
./deploy.sh logs celery_worker

# Проверьте, что Redis работает
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Перезапустите celery
docker-compose -f docker-compose.prod.yml restart celery_worker celery_beat
```

### Проблема: БД недоступна

**Решение:**

```bash
# Проверьте статус PostgreSQL
docker-compose -f docker-compose.prod.yml ps postgres

# Проверьте логи PostgreSQL
./deploy.sh logs postgres

# Проверьте подключение
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres

# Проверьте пароль в .env
grep POSTGRES_PASSWORD backend/.env.production
```

### Проблема: SSL сертификаты не работают

**Решение:**

```bash
# Проверьте сертификаты
sudo certbot certificates

# Обновите сертификаты
sudo certbot renew

# Проверьте права доступа
sudo ls -la /etc/letsencrypt/live/your-domain.com/

# Перезагрузите nginx
sudo systemctl reload nginx
```

### Проблема: Нет места на диске

**Решение:**

```bash
# Проверьте занятое место
df -h

# Очистите Docker ресурсы
./deploy.sh cleanup

# Удалите старые образы
docker image prune -a

# Удалите старые логи
docker-compose -f docker-compose.prod.yml logs --tail=0

# Очистите старые backups
rm backups/backup_*.sql.old
```

---

## Обновление приложения

### Способ 1: Через git (рекомендуется)

```bash
cd /var/www/ai-image-bot

# Обновить код, пересобрать, перезапустить
./deploy.sh update
```

### Способ 2: Вручную

```bash
# 1. Pull изменений
git pull

# 2. Пересобрать образы
./deploy.sh build

# 3. Остановить старые контейнеры
./deploy.sh stop

# 4. Запустить миграции (если есть)
./deploy.sh migrate

# 5. Запустить новые контейнеры
./deploy.sh start

# 6. Проверить здоровье
./deploy.sh health
```

---

## Полезные ссылки

- **Frontend**: https://your-domain.com
- **Backend API**: https://your-domain.com/api/v1
- **Swagger UI**: https://your-domain.com/docs (отключите в production!)
- **Админка**: https://your-domain.com/admin (требует ADMIN_SECRET_KEY)

---

## Чек-лист деплоя

Перед запуском в production убедитесь:

- [ ] Все .env.production файлы созданы и заполнены
- [ ] SSL сертификаты получены и работают
- [ ] nginx конфигурация проверена (`nginx -t`)
- [ ] Docker образы собраны (`./deploy.sh build`)
- [ ] Все сервисы запущены (`./deploy.sh status`)
- [ ] Health check пройден (`./deploy.sh health`)
- [ ] Миграции БД выполнены (`./deploy.sh migrate`)
- [ ] ЮKassa webhook настроен
- [ ] Backup настроен (cron job)
- [ ] Логи проверены на ошибки (`./deploy.sh logs`)
- [ ] Доступ к приложению работает (https://your-domain.com)
- [ ] Swagger UI отключен в production (закомментировать в nginx.conf)
- [ ] ADMIN_SECRET_KEY надёжно сохранён

---

**Поздравляем! Ваш AI Image Generator развёрнут на production! 🎉**

По вопросам и проблемам создавайте issue в репозитории проекта.
