#!/bin/bash

###############################################################################
# AI Media Generator - Скрипт автоматического развертывания на VPS
# Для использования: скопируйте этот скрипт на VPS и запустите
###############################################################################

set -e  # Остановить при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для красивого вывода
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${BLUE}[SUCCESS]${NC} $1"
}

###############################################################################
# КОНФИГУРАЦИЯ - ЗАПОЛНИТЕ ПЕРЕД ЗАПУСКОМ
###############################################################################

DOMAIN="ai-bot-media.mix4.ru"
GITHUB_REPO="https://github.com/cherus80/ai-image-bot.git"
INSTALL_DIR="/opt/ai-image-bot"

# API Keys
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"

# Payment (для начала используем mock режим)
PAYMENT_MOCK_MODE="true"
# YUKASSA_SHOP_ID=""
# YUKASSA_SECRET_KEY=""
# YUKASSA_WEBHOOK_SECRET=""

###############################################################################
# ПРОВЕРКА ПРАВ ROOT
###############################################################################

if [ "$EUID" -ne 0 ]; then
    error "Пожалуйста, запустите скрипт от имени root"
    exit 1
fi

info "Начинаем развертывание AI Media Generator на VPS..."

###############################################################################
# ШАГ 1: ОБНОВЛЕНИЕ СИСТЕМЫ
###############################################################################

info "Шаг 1/10: Обновление системы..."
apt update && apt upgrade -y

###############################################################################
# ШАГ 2: УСТАНОВКА НЕОБХОДИМЫХ ПАКЕТОВ
###############################################################################

info "Шаг 2/10: Установка необходимых пакетов..."
apt install -y git curl nano htop ufw nginx certbot python3-certbot-nginx

###############################################################################
# ШАГ 3: ПРОВЕРКА DOCKER
###############################################################################

info "Шаг 3/10: Проверка Docker и Docker Compose..."

if ! command -v docker &> /dev/null; then
    error "Docker не установлен! Устанавливаю..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    success "Docker установлен"
else
    success "Docker уже установлен: $(docker --version)"
fi

if ! command -v docker-compose &> /dev/null; then
    warn "docker-compose не установлен! Устанавливаю..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    success "docker-compose установлен"
else
    success "docker-compose уже установлен: $(docker-compose --version)"
fi

###############################################################################
# ШАГ 4: НАСТРОЙКА FIREWALL
###############################################################################

info "Шаг 4/10: Настройка firewall..."

ufw --force enable
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 9000/tcp # Portainer
ufw allow 9443/tcp # Portainer HTTPS
ufw status

success "Firewall настроен"

###############################################################################
# ШАГ 5: КЛОНИРОВАНИЕ РЕПОЗИТОРИЯ
###############################################################################

info "Шаг 5/10: Клонирование репозитория..."

if [ -d "$INSTALL_DIR" ]; then
    warn "Директория $INSTALL_DIR уже существует. Удаляю..."
    rm -rf "$INSTALL_DIR"
fi

git clone "$GITHUB_REPO" "$INSTALL_DIR"
cd "$INSTALL_DIR"

success "Репозиторий склонирован в $INSTALL_DIR"

###############################################################################
# ШАГ 6: ГЕНЕРАЦИЯ СЕКРЕТНЫХ КЛЮЧЕЙ
###############################################################################

info "Шаг 6/10: Генерация секретных ключей..."

SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
ADMIN_SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

success "Секретные ключи сгенерированы"

###############################################################################
# ШАГ 7: СОЗДАНИЕ .env ФАЙЛА
###############################################################################

info "Шаг 7/10: Создание .env файла..."

cat > "$INSTALL_DIR/.env" << EOF
# =============================================================================
# AI Image Generator - Production Environment
# Сгенерировано: $(date)
# =============================================================================

# -----------------------------------------------------------------------------
# Окружение
# -----------------------------------------------------------------------------
ENVIRONMENT=production
DEBUG=False

# -----------------------------------------------------------------------------
# Backend FastAPI
# -----------------------------------------------------------------------------
SECRET_KEY=${SECRET_KEY}
API_V1_PREFIX=/api/v1
PROJECT_NAME=AI Image Generator

# -----------------------------------------------------------------------------
# База данных PostgreSQL
# -----------------------------------------------------------------------------
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=ai_image_bot
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@postgres:5432/ai_image_bot

# -----------------------------------------------------------------------------
# Redis
# -----------------------------------------------------------------------------
REDIS_URL=redis://redis:6379/0

# -----------------------------------------------------------------------------
# External APIs
# -----------------------------------------------------------------------------
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=anthropic/claude-3-haiku-20240307

# -----------------------------------------------------------------------------
# URLs
# -----------------------------------------------------------------------------
WEB_APP_URL=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}

# -----------------------------------------------------------------------------
# ЮKassa
# -----------------------------------------------------------------------------
PAYMENT_MOCK_MODE=${PAYMENT_MOCK_MODE}
YUKASSA_SHOP_ID=
YUKASSA_SECRET_KEY=
YUKASSA_WEBHOOK_SECRET=

# -----------------------------------------------------------------------------
# JWT Authentication
# -----------------------------------------------------------------------------
JWT_SECRET_KEY=${JWT_SECRET_KEY}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# -----------------------------------------------------------------------------
# Admin Panel
# -----------------------------------------------------------------------------
ADMIN_SECRET_KEY=${ADMIN_SECRET_KEY}

# -----------------------------------------------------------------------------
# File Storage
# -----------------------------------------------------------------------------
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=5
ALLOWED_EXTENSIONS=jpg,jpeg,png
PHOTO_RETENTION_HOURS=24
CHAT_HISTORY_RETENTION_DAYS=30

# -----------------------------------------------------------------------------
# Monetization
# -----------------------------------------------------------------------------
FREEMIUM_ACTIONS_PER_MONTH=10
FREEMIUM_WATERMARK_TEXT=AI Image Generator
NPD_TAX_RATE=0.04
YUKASSA_COMMISSION_RATE=0.028

# -----------------------------------------------------------------------------
# Rate Limiting
# -----------------------------------------------------------------------------
RATE_LIMIT_PER_MINUTE=10

# -----------------------------------------------------------------------------
# Sentry
# -----------------------------------------------------------------------------
SENTRY_DSN=

# -----------------------------------------------------------------------------
# Vite Frontend
# -----------------------------------------------------------------------------
VITE_API_BASE_URL=https://${DOMAIN}
VITE_APP_NAME=AI Image Generator
VITE_ENV=production
EOF

success ".env файл создан"

###############################################################################
# ШАГ 8: СОЗДАНИЕ ДИРЕКТОРИЙ
###############################################################################

info "Шаг 8/10: Создание необходимых директорий..."

mkdir -p "$INSTALL_DIR/backups"
mkdir -p "$INSTALL_DIR/backend/uploads"
mkdir -p "$INSTALL_DIR/backend/logs"

success "Директории созданы"

###############################################################################
# ШАГ 9: НАСТРОЙКА NGINX
###############################################################################

info "Шаг 9/10: Настройка Nginx..."

cat > /etc/nginx/sites-available/ai-image-bot << 'NGINXCONF'
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

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

    # Frontend
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
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # WebSocket
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
}
NGINXCONF

# Заменяем placeholder на реальный домен
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/sites-available/ai-image-bot

# Удаляем default конфигурацию nginx
rm -f /etc/nginx/sites-enabled/default

# Активируем конфигурацию (пока без SSL)
ln -sf /etc/nginx/sites-available/ai-image-bot /etc/nginx/sites-enabled/

success "Nginx настроен"

###############################################################################
# ШАГ 10: ВЫВОД ИТОГОВОЙ ИНФОРМАЦИИ
###############################################################################

info "Шаг 10/10: Подготовка завершена!"

echo ""
echo "========================================================================="
success "✅ Сервер подготовлен для развертывания!"
echo "========================================================================="
echo ""
echo "📋 СЛЕДУЮЩИЕ ШАГИ:"
echo ""
echo "1️⃣  Проверьте и отредактируйте .env файл:"
echo "    nano $INSTALL_DIR/.env"
echo "    Убедитесь, что все API ключи заполнены!"
echo ""
echo "2️⃣  Запустите приложение через Docker Compose:"
echo "    cd $INSTALL_DIR"
echo "    docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "3️⃣  Дождитесь запуска всех контейнеров (2-5 минут)"
echo "    docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "4️⃣  Запустите миграции базы данных:"
echo "    docker exec -it ai_image_bot_backend_prod alembic upgrade head"
echo ""
echo "5️⃣  Получите SSL сертификат (ПОСЛЕ того как DNS заработает!):"
echo "    certbot --nginx -d $DOMAIN"
echo ""
echo "6️⃣  Перезапустите Nginx:"
echo "    systemctl restart nginx"
echo ""
echo "========================================================================="
echo "📊 ПОЛЕЗНАЯ ИНФОРМАЦИЯ:"
echo "========================================================================="
echo ""
echo "🌐 Домен:              https://$DOMAIN"
echo "📁 Директория:         $INSTALL_DIR"
echo "📝 Конфигурация:       $INSTALL_DIR/.env"
echo "🔐 Postgres пароль:    $POSTGRES_PASSWORD"
echo ""
echo "🐳 Docker команды:"
echo "   Статус:    docker-compose -f docker-compose.prod.yml ps"
echo "   Логи:      docker-compose -f docker-compose.prod.yml logs -f"
echo "   Остановка: docker-compose -f docker-compose.prod.yml down"
echo "   Перезапуск: docker-compose -f docker-compose.prod.yml restart"
echo ""
echo "📦 Portainer: http://185.135.82.109:9000"
echo ""
echo "========================================================================="
echo ""

# Сохраняем информацию в файл
cat > "$INSTALL_DIR/deployment-info.txt" << EOF
AI Media Generator - Deployment Information
======================================
Дата развертывания: $(date)
Домен: https://${DOMAIN}
Директория: ${INSTALL_DIR}

Учетные данные:
---------------
PostgreSQL пароль: ${POSTGRES_PASSWORD}
Secret Key: ${SECRET_KEY}
JWT Secret: ${JWT_SECRET_KEY}
Admin Secret: ${ADMIN_SECRET_KEY}

Следующие шаги см. в выводе выше или в PORTAINER_DEPLOY.md
EOF

success "Информация о развертывании сохранена в: $INSTALL_DIR/deployment-info.txt"
echo ""
warn "⚠️  ВАЖНО: Сохраните пароль PostgreSQL в надежном месте!"
warn "⚠️  Не забудьте заполнить API ключи в .env файле!"
echo ""
