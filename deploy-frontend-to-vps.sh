#!/bin/bash

###############################################################################
# Скрипт для деплоя ТОЛЬКО фронтенда на VPS (с cache busting)
# Использование: ./deploy-frontend-to-vps.sh
###############################################################################

set -e

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Конфигурация VPS
VPS_HOST="ai-bot-vps"  # Используем alias из ~/.ssh/config
VPS_PROJECT_DIR="/root/ai-image-bot"
DEPLOY_BRANCH="feature/instructions-examples"

echo ""
info "🚀 Деплой фронтенда AI Generator на VPS (Cache Busting v0.11.3)"
echo ""

# Проверка подключения к VPS
step "Шаг 1/5: Проверка подключения к VPS..."
if ! ssh $VPS_HOST "echo 'Подключение успешно'" > /dev/null 2>&1; then
    error "Не удалось подключиться к VPS. Проверьте SSH ключи и доступ."
fi
info "✅ Подключение к VPS успешно"
echo ""

# Pull изменений на VPS
step "Шаг 2/5: Обновление кода на VPS..."
ssh $VPS_HOST "cd $VPS_PROJECT_DIR && git fetch origin $DEPLOY_BRANCH && git checkout $DEPLOY_BRANCH && git pull origin $DEPLOY_BRANCH" || error "Не удалось обновить код на VPS"
info "✅ Код обновлён"
echo ""

# Деплой фронтенда на VPS
step "Шаг 3/5: Пересборка и деплой фронтенда..."
ssh $VPS_HOST << 'ENDSSH'
cd /root/ai-image-bot

echo "🐳 Пересборка Docker образа frontend с cache busting..."
echo ""

# Остановка контейнера frontend
echo "⏹️  Остановка контейнера frontend..."
docker-compose -f docker-compose.prod.yml stop frontend
docker-compose -f docker-compose.prod.yml rm -f frontend

# Удаление старого образа (чтобы точно пересобрать)
echo "🗑️  Удаление старого образа..."
docker rmi ai-image-bot-frontend || true

# Пересборка Docker образа фронтенда БЕЗ кэша
# Docker сам соберёт фронтенд внутри (multi-stage build)
echo "🔨 Сборка Docker образа (это займёт 2-3 минуты)..."
DOCKER_BUILDKIT=1 docker-compose -f docker-compose.prod.yml build --no-cache frontend

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при сборке Docker образа!"
    exit 1
fi

echo "✅ Docker образ собран успешно!"
echo ""

# Запуск контейнера frontend
echo "🚀 Запуск контейнера frontend..."
docker-compose -f docker-compose.prod.yml up -d --no-deps frontend

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при запуске контейнера!"
    exit 1
fi

echo "✅ Контейнер запущен!"
echo ""

# Ожидание запуска
echo "⏳ Ожидание запуска (15 секунд)..."
sleep 15

# Проверка статуса
echo "📊 Статус контейнера frontend:"
docker-compose -f docker-compose.prod.yml ps frontend

echo ""
echo "📄 Последние 30 строк логов:"
docker-compose -f docker-compose.prod.yml logs --tail=30 frontend

ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    step "Шаг 4/5: Проверка headers на production..."

    # Проверка Cache-Control headers
    echo ""
    info "Проверка index.html (должен быть no-cache):"
    ssh $VPS_HOST "curl -sI https://ai-bot-media.mix4.ru/ | grep -i cache-control" || warn "Не удалось проверить headers"

    echo ""
    info "Проверка что файлы с хешами:"
    ssh $VPS_HOST "curl -s https://ai-bot-media.mix4.ru/ | grep -o 'src=\"[^\"]*\.js\"' | head -3" || warn "Не удалось проверить файлы"

    echo ""
    step "Шаг 5/5: Финальная проверка..."

    # Проверка что контейнер работает
    ssh $VPS_HOST "cd $VPS_PROJECT_DIR && docker-compose -f docker-compose.prod.yml ps frontend | grep Up" > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo ""
        info "✅ ✅ ✅ Деплой фронтенда успешно завершён! ✅ ✅ ✅"
        echo ""
        info "🌐 Приложение доступно по адресу: https://ai-bot-media.mix4.ru"
        echo ""
        info "📝 Что делать дальше:"
        echo "  1. Выполните hard reload страницы (Cmd+Shift+R / Ctrl+Shift+R)"
        echo "  2. Очистите кэш сайта, если используете мобильный браузер"
        echo "  3. Убедитесь, что загружается https://ai-bot-media.mix4.ru"
        echo ""
        info "⚠️  Если изменения всё ещё не видны:"
        echo "  1. Очистите кэш браузера или откройте страницу в режиме инкогнито"
        echo "  2. Добавьте ?v=2 к URL, чтобы принудительно обновить ресурсы"
        echo ""
        info "📊 Для просмотра логов:"
        echo "  ssh $VPS_HOST 'cd $VPS_PROJECT_DIR && docker-compose -f docker-compose.prod.yml logs -f frontend'"
        echo ""
    else
        error "Контейнер frontend не запустился!"
    fi
else
    error "Деплой завершился с ошибками!"
fi
