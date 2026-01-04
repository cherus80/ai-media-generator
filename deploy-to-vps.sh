#!/bin/bash

###############################################################################
# Скрипт для деплоя AI Generator на VPS с локальной машины
# Использование: ./deploy-to-vps.sh
###############################################################################

set -e

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Конфигурация VPS
VPS_HOST="ai-bot-vps"  # Используем alias из ~/.ssh/config
VPS_PROJECT_DIR="/root/ai-image-bot"
DEPLOY_BRANCH="feature/instructions-examples"
SSH_OPTS=""  # SSH config берёт всё из ~/.ssh/config

info "Деплой AI Generator на VPS..."

# Проверка подключения к VPS
info "Шаг 1/6: Проверка подключения к VPS..."
if ! ssh $VPS_HOST "echo 'Подключение успешно'" > /dev/null 2>&1; then
    error "Не удалось подключиться к VPS. Проверьте SSH ключи и доступ."
fi
info "Подключение к VPS успешно"

# Push изменений в git
info "Шаг 2/6: Push изменений в GitHub..."
git push origin "$DEPLOY_BRANCH" || warn "Не удалось отправить изменения в GitHub. Продолжаем..."

# Pull изменений на VPS
info "Шаг 3/6: Обновление кода на VPS..."
ssh $VPS_HOST "cd $VPS_PROJECT_DIR && git fetch origin $DEPLOY_BRANCH && git checkout $DEPLOY_BRANCH && git pull origin $DEPLOY_BRANCH" || error "Не удалось обновить код на VPS"

# Копирование .env файла на VPS
info "Шаг 4/6: Копирование .env файла на VPS..."
scp .env $VPS_HOST:$VPS_PROJECT_DIR/.env || warn ".env файл не скопирован (возможно, уже существует)"

# Остановка контейнеров
info "Шаг 5/6: Остановка контейнеров на VPS..."
ssh $VPS_HOST "cd $VPS_PROJECT_DIR && docker compose -f docker-compose.prod.yml down" || warn "Контейнеры не были запущены"

# Сборка и запуск контейнеров
info "Шаг 6/6: Сборка и запуск контейнеров на VPS..."
ssh $VPS_HOST << ENDSSH
cd $VPS_PROJECT_DIR

# Загрузка переменных окружения
export $(grep -v '^#' .env | xargs)

# Сборка образов
echo "Сборка Docker образов..."
DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build --no-cache

# Запуск контейнеров
echo "Запуск контейнеров..."
docker compose -f docker-compose.prod.yml up -d

# Ожидание запуска
echo "Ожидание запуска контейнеров (30 секунд)..."
sleep 30

# Проверка статуса
echo "Проверка статуса контейнеров:"
docker compose -f docker-compose.prod.yml ps

# Проверка логов
echo "Последние логи backend:"
docker compose -f docker-compose.prod.yml logs --tail=20 backend

echo "Последние логи frontend:"
docker compose -f docker-compose.prod.yml logs --tail=20 frontend
ENDSSH

if [ $? -eq 0 ]; then
    info "✅ Деплой успешно завершён!"
    echo ""
    info "Проверьте приложение по адресу: https://ai-bot-media.mix4.ru"
    echo ""
    info "Для просмотра логов используйте:"
    echo "  ssh $VPS_HOST 'cd $VPS_PROJECT_DIR && docker compose -f docker-compose.prod.yml logs -f'"
else
    error "Деплой завершился с ошибками!"
fi
