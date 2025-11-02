#!/bin/bash

# Скрипт для обновления и развертывания на VPS
# Использование: ./update-and-deploy.sh

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

info "Обновление кода из GitHub..."
cd /opt/ai-image-bot
git pull

info "Остановка контейнеров..."
docker-compose -f docker-compose.prod.yml down

info "Сборка и запуск контейнеров..."
docker-compose -f docker-compose.prod.yml up -d --build

info "Ожидание запуска контейнеров (30 секунд)..."
sleep 30

info "Проверка статуса контейнеров:"
docker ps

info "Проверка здоровья Backend API:"
curl -s http://localhost:8000/api/v1/health || error "Backend API не отвечает!"

info "Запуск миграций базы данных..."
docker exec -it ai_image_bot_backend_prod alembic upgrade head || error "Ошибка миграций!"

echo ""
info "✅ Развертывание завершено успешно!"
echo ""
echo "Проверьте логи:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
