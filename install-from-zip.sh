#!/bin/bash

# Финальный скрипт установки через ZIP архив
# Это обходит проблемы с git clone

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

info "🚀 Установка AI Image Bot через ZIP архив"

# Удаляем старую директорию
info "Удаление старой директории..."
rm -rf /opt/ai-image-bot

# Создаем временную директорию
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Скачиваем ZIP архив репозитория
info "Скачивание архива с GitHub..."
curl -L "https://github.com/cherus80/ai-image-bot/archive/refs/heads/master.zip" -o repo.zip

# Проверяем что скачалось
if [ ! -f "repo.zip" ] || [ $(wc -c < repo.zip) -lt 10000 ]; then
    error "Не удалось скачать архив репозитория"
fi

# Устанавливаем unzip если нет
if ! command -v unzip &> /dev/null; then
    info "Установка unzip..."
    apt-get update && apt-get install -y unzip
fi

# Распаковываем
info "Распаковка архива..."
unzip -q repo.zip

# Перемещаем в /opt/ai-image-bot
info "Перемещение файлов..."
mv ai-image-bot-master /opt/ai-image-bot

# Очистка
cd /opt/ai-image-bot
rm -rf "$TEMP_DIR"

# Создаем необходимые директории
info "Создание директорий..."
mkdir -p backups backend/uploads backend/logs

# Проверяем что все на месте
info "Проверка файлов..."
MISSING=0

for file in docker-compose.prod.yml docker-compose.dev.yml docker-compose.yml .env.example README.md; do
    if [ ! -f "$file" ]; then
        error "Файл $file отсутствует!"
        MISSING=1
    fi
done

for dir in backend frontend telegram_bot; do
    if [ ! -d "$dir" ]; then
        error "Директория $dir отсутствует!"
        MISSING=1
    fi
done

if [ $MISSING -eq 1 ]; then
    error "Не все файлы на месте!"
fi

# Показываем что получилось
info "✅ Установка завершена успешно!"
echo ""
echo "Содержимое /opt/ai-image-bot:"
ls -lh | head -20
echo ""
info "Размеры docker-compose файлов:"
ls -lh docker-compose*.yml
echo ""
info "Теперь создайте .env файл и запустите приложение:"
echo "  cd /opt/ai-image-bot"
echo "  nano .env"
echo "  docker-compose -f docker-compose.prod.yml up -d"
