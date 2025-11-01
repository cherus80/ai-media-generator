# 🐳 Развертывание AI Image Bot через Portainer

Пошаговое руководство по развертыванию приложения на VPS с помощью Portainer.io

---

## 📑 Содержание

1. [Подготовка сервера](#1-подготовка-сервера)
2. [Клонирование репозитория](#2-клонирование-репозитория)
3. [Настройка переменных окружения](#3-настройка-переменных-окружения)
4. [Развертывание через Portainer](#4-развертывание-через-portainer)
5. [Настройка Nginx и SSL](#5-настройка-nginx-и-ssl)
6. [Инициализация базы данных](#6-инициализация-базы-данных)
7. [Настройка Telegram бота](#7-настройка-telegram-бота)
8. [Проверка и мониторинг](#8-проверка-и-мониторинг)

---

## 1. Подготовка сервера

### 1.1 Подключение к VPS

```bash
ssh username@your-vps-ip
```

### 1.2 Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Проверка Docker и Docker Compose

```bash
docker --version
# Должно вывести: Docker version 20.10+ или выше

docker-compose --version
# Должно вывести: docker-compose version 1.29+ или выше
```

Если Docker не установлен (что маловероятно при наличии Portainer):

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 1.4 Установка необходимых утилит

```bash
sudo apt install -y git curl nano htop ufw
```

### 1.5 Настройка Firewall

```bash
# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Разрешить Portainer (если нужен внешний доступ)
sudo ufw allow 9000/tcp
sudo ufw allow 9443/tcp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

---

## 2. Клонирование репозитория

### 2.1 Выбор директории

```bash
# Рекомендуется: /opt для production приложений
cd /opt

# Или домашняя директория пользователя
cd ~
```

### 2.2 Клонирование из GitHub

```bash
git clone https://github.com/cherus80/ai-image-bot.git
cd ai-image-bot
```

### 2.3 Проверка структуры проекта

```bash
ls -la
# Должны увидеть:
# - backend/
# - frontend/
# - telegram_bot/
# - docker-compose.prod.yml
# - .env.example
# и другие файлы
```

---

## 3. Настройка переменных окружения

### 3.1 Создание .env файла

```bash
# Копируем шаблон
cp .env.example .env

# Открываем для редактирования
nano .env
```

### 3.2 Генерация секретных ключей

**На локальном компьютере или сервере:**

```bash
# Генерация SECRET_KEY
openssl rand -hex 32

# Генерация JWT_SECRET_KEY
openssl rand -hex 32

# Генерация ADMIN_SECRET_KEY
openssl rand -hex 32

# Генерация надежного пароля для PostgreSQL
openssl rand -base64 32
```

### 3.3 Заполнение обязательных переменных

Отредактируйте `.env` файл со следующими значениями:

```bash
# ==================== ОСНОВНЫЕ НАСТРОЙКИ ====================
ENVIRONMENT=production
DEBUG=False

# ==================== БЕЗОПАСНОСТЬ ====================
SECRET_KEY=<сгенерированный_ключ_1>
JWT_SECRET_KEY=<сгенерированный_ключ_2>
ADMIN_SECRET_KEY=<сгенерированный_ключ_3>

# ==================== БАЗА ДАННЫХ ====================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<сгенерированный_пароль>
POSTGRES_DB=ai_image_bot
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# ==================== REDIS ====================
REDIS_URL=redis://redis:6379/0

# ==================== ВНЕШНИЕ API ====================
KIE_AI_API_KEY=<ваш_kie_ai_ключ>
OPENROUTER_API_KEY=<ваш_openrouter_ключ>

# ==================== TELEGRAM ====================
TELEGRAM_BOT_TOKEN=<токен_от_@BotFather>
BOT_USERNAME=<имя_бота_без_@>

# ==================== URLS ====================
WEB_APP_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# ==================== ПЛАТЕЖИ ====================
# Для тестирования:
PAYMENT_MOCK_MODE=true

# Для production с реальными платежами:
# PAYMENT_MOCK_MODE=false
# YUKASSA_SHOP_ID=<ваш_shop_id>
# YUKASSA_SECRET_KEY=<ваш_secret_key>
# YUKASSA_WEBHOOK_SECRET=<ваш_webhook_secret>

# ==================== VITE FRONTEND ====================
VITE_API_BASE_URL=https://yourdomain.com
VITE_ENV=production
```

**Сохраните файл:** `Ctrl+X`, затем `Y`, затем `Enter`

### 3.4 Проверка .env файла

```bash
# Убедитесь, что файл существует и содержит правильные значения
cat .env | grep -E "(SECRET_KEY|POSTGRES_PASSWORD|API_KEY|BOT_TOKEN)"

# ⚠️ ВАЖНО: Проверьте, что нет пустых значений у критичных переменных
```

---

## 4. Развертывание через Portainer

### 4.1 Вход в Portainer

1. Откройте браузер
2. Перейдите на URL Portainer: `http://your-vps-ip:9000` или `https://your-vps-ip:9443`
3. Войдите с вашими учетными данными

### 4.2 Создание нового Stack

1. В левом меню выберите **"Stacks"**
2. Нажмите **"Add stack"**
3. Введите имя: `ai-image-bot`

### 4.3 Загрузка docker-compose.prod.yml

**Вариант A: Через Web editor (рекомендуется)**

1. Выберите **"Web editor"**
2. Скопируйте содержимое файла `docker-compose.prod.yml`
3. Вставьте в редактор Portainer

**Вариант B: Через Git repository**

1. Выберите **"Repository"**
2. URL: `https://github.com/cherus80/ai-image-bot`
3. Compose path: `docker-compose.prod.yml`

**Вариант C: Через Upload**

1. Выберите **"Upload"**
2. Загрузите файл `docker-compose.prod.yml`

### 4.4 Добавление переменных окружения

В секции **"Environment variables"** добавьте переменные из вашего `.env` файла:

**Способ 1: Advanced mode (рекомендуется)**

1. Нажмите **"Add environment variable"**
2. Включите **"Advanced mode"**
3. Скопируйте и вставьте содержимое вашего `.env` файла

**Способ 2: По одной переменной**

Добавьте каждую переменную вручную:
- Name: `ENVIRONMENT`, Value: `production`
- Name: `DEBUG`, Value: `False`
- И так далее для всех переменных...

### 4.5 Настройка Volume mappings (опционально)

Если хотите хранить данные на хосте, добавьте в секции **"Volumes"**:

```yaml
- /opt/ai-image-bot/postgres_data:/var/lib/postgresql/data
- /opt/ai-image-bot/uploads:/app/uploads
- /opt/ai-image-bot/logs:/app/logs
```

### 4.6 Запуск Stack

1. Пролистайте вниз
2. Нажмите **"Deploy the stack"**
3. Дождитесь завершения развертывания (2-5 минут)

### 4.7 Проверка статуса контейнеров

1. В левом меню выберите **"Containers"**
2. Убедитесь, что все контейнеры в статусе **"running"**:
   - `ai_image_bot_backend_prod`
   - `ai_image_bot_frontend_prod`
   - `ai_image_bot_postgres_prod`
   - `ai_image_bot_redis_prod`
   - `ai_image_bot_celery_worker_prod`
   - `ai_image_bot_celery_beat_prod`
   - `ai_image_bot_telegram_prod`

### 4.8 Просмотр логов

Для каждого контейнера:
1. Нажмите на имя контейнера
2. Выберите **"Logs"**
3. Проверьте на наличие ошибок

---

## 5. Настройка Nginx и SSL

### 5.1 Установка Nginx

```bash
sudo apt install -y nginx
```

### 5.2 Создание конфигурации Nginx

```bash
sudo nano /etc/nginx/sites-available/ai-image-bot
```

Вставьте следующую конфигурацию:

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other requests to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (будут созданы позже через certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/ai-image-bot-access.log;
    error_log /var/log/nginx/ai-image-bot-error.log;

    # Frontend (React app)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-running requests (image generation)
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # WebSocket для real-time updates
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Static files
    location /uploads {
        alias /opt/ai-image-bot/uploads;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Замените `yourdomain.com` на ваш реальный домен!**

### 5.3 Активация конфигурации

```bash
# Создать симлинк
sudo ln -s /etc/nginx/sites-available/ai-image-bot /etc/nginx/sites-enabled/

# Проверить конфигурацию (должна быть ошибка про SSL - это нормально, пока нет сертификатов)
sudo nginx -t

# Перезапустить nginx
sudo systemctl restart nginx
```

### 5.4 Установка SSL сертификата (Let's Encrypt)

```bash
# Установить certbot
sudo apt install -y certbot python3-certbot-nginx

# Временно отключить SSL в конфигурации nginx
sudo nano /etc/nginx/sites-available/ai-image-bot
# Закомментируйте строки с ssl_certificate

# Получить сертификат
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Следуйте инструкциям certbot
# Выберите: Redirect (автоматический редирект на HTTPS)

# Проверить автообновление сертификата
sudo certbot renew --dry-run
```

### 5.5 Проверка Nginx

```bash
# Проверить статус
sudo systemctl status nginx

# Проверить логи
sudo tail -f /var/log/nginx/ai-image-bot-error.log
```

---

## 6. Инициализация базы данных

### 6.1 Запуск миграций Alembic

```bash
# Через Portainer Exec Console:
# 1. Откройте контейнер ai_image_bot_backend_prod
# 2. Нажмите "Exec Console"
# 3. Выполните:
alembic upgrade head

# Или через SSH на сервере:
docker exec -it ai_image_bot_backend_prod alembic upgrade head
```

### 6.2 Проверка создания таблиц

```bash
# Подключиться к PostgreSQL
docker exec -it ai_image_bot_postgres_prod psql -U postgres -d ai_image_bot

# Посмотреть список таблиц
\dt

# Должны увидеть:
# - users
# - generations
# - chat_messages
# - payments
# - referrals
# - alembic_version

# Выход
\q
```

---

## 7. Настройка Telegram бота

### 7.1 Настройка Menu Button (Web App)

Отправьте следующие команды @BotFather в Telegram:

```
/mybots
→ Выберите вашего бота
→ Bot Settings
→ Menu Button
→ Edit menu button URL
→ Введите: https://yourdomain.com
→ Done
```

### 7.2 Настройка команд бота (опционально)

```
/mybots
→ Выберите вашего бота
→ Edit Bot
→ Edit Commands
→ Введите:

start - Запустить бота
fitting - Примерка одежды
editing - Редактирование изображений
profile - Мой профиль
help - Помощь
```

### 7.3 Тест бота

1. Найдите вашего бота в Telegram
2. Нажмите `/start`
3. Должна открыться Web App с вашим интерфейсом

---

## 8. Проверка и мониторинг

### 8.1 Health Check эндпоинтов

```bash
# Backend health
curl https://yourdomain.com/api/v1/health

# Должно вернуть:
# {"status": "ok"}
```

### 8.2 Проверка всех сервисов

В Portainer:
1. **Stacks** → **ai-image-bot**
2. Проверьте статус всех контейнеров: все должны быть **"running"**
3. Просмотрите логи каждого контейнера на наличие ошибок

### 8.3 Тестирование функционала

1. **Авторизация через Telegram:**
   - Откройте бота в Telegram
   - Нажмите `/start`
   - Проверьте, что Web App открывается

2. **Примерка одежды:**
   - Загрузите фото пользователя
   - Загрузите фото одежды
   - Выберите зону
   - Проверьте генерацию

3. **Редактирование изображений:**
   - Откройте раздел "Editing"
   - Загрузите изображение
   - Отправьте запрос AI
   - Проверьте генерацию вариантов

4. **Платежная система:**
   - Перейдите в профиль
   - Попробуйте купить кредиты или подписку
   - Проверьте работу mock платежей (если включен PAYMENT_MOCK_MODE)

### 8.4 Настройка мониторинга

**Проверка логов:**

```bash
# Все логи
docker-compose -f /opt/ai-image-bot/docker-compose.prod.yml logs -f

# Только backend
docker logs -f ai_image_bot_backend_prod

# Только celery worker
docker logs -f ai_image_bot_celery_worker_prod
```

**Мониторинг ресурсов:**

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
df -h

# Использование памяти
free -h
```

### 8.5 Настройка автоматического backup

Создайте cron задачу для ежедневного backup:

```bash
sudo crontab -e
```

Добавьте:

```bash
# Backup БД каждый день в 3:00
0 3 * * * docker exec ai_image_bot_postgres_prod pg_dump -U postgres ai_image_bot > /opt/backups/ai-image-bot-$(date +\%Y\%m\%d).sql

# Удаление старых backup (старше 30 дней)
0 4 * * * find /opt/backups -name "ai-image-bot-*.sql" -mtime +30 -delete
```

Создайте директорию для backup:

```bash
sudo mkdir -p /opt/backups
```

---

## 🎉 Готово!

Ваш AI Image Bot успешно развернут и работает!

**Доступ к приложению:**
- Frontend: `https://yourdomain.com`
- Backend API: `https://yourdomain.com/api/v1`
- Telegram Bot: `@YourBotUsername`
- Portainer: `https://your-vps-ip:9443`

**Следующие шаги:**

1. Протестируйте все функции
2. Настройте реальные платежи (отключите PAYMENT_MOCK_MODE)
3. Настройте мониторинг и алерты
4. Регулярно проверяйте логи
5. Делайте backup базы данных

---

## 🆘 Решение проблем

### Контейнер не запускается

```bash
# Проверить логи
docker logs ai_image_bot_backend_prod

# Перезапустить контейнер
docker restart ai_image_bot_backend_prod
```

### Ошибки подключения к БД

```bash
# Проверить, что PostgreSQL запущен
docker ps | grep postgres

# Проверить логи PostgreSQL
docker logs ai_image_bot_postgres_prod

# Проверить переменные окружения
docker exec ai_image_bot_backend_prod env | grep POSTGRES
```

### Frontend не открывается

```bash
# Проверить статус nginx
sudo systemctl status nginx

# Проверить логи nginx
sudo tail -f /var/log/nginx/ai-image-bot-error.log

# Проверить, что frontend контейнер запущен
docker ps | grep frontend
```

### Celery не обрабатывает задачи

```bash
# Проверить статус Celery worker
docker logs ai_image_bot_celery_worker_prod

# Проверить Redis
docker logs ai_image_bot_redis_prod

# Перезапустить Celery
docker restart ai_image_bot_celery_worker_prod
```

---

## 📚 Дополнительные ресурсы

- [Основная документация проекта](../../README.md)
- [Руководство по локальной разработке](../development/LOCAL_TESTING_GUIDE.md)
- [API документация](../development/API.md)
- [Telegram Bot API](https://core.telegram.org/bots/api)
