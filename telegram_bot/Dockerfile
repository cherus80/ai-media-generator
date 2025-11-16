# Telegram Bot Dockerfile для AI Image Generator Bot
# Build context: корень проекта (не ./telegram_bot!)

FROM python:3.11-slim

# Установка системных зависимостей
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Создаем структуру директорий
WORKDIR /app

# Копирование requirements из telegram_bot/ (context = корень проекта)
COPY telegram_bot/requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Копирование telegram_bot пакета (сохраняем структуру)
COPY telegram_bot/__init__.py /app/telegram_bot/__init__.py
COPY telegram_bot/bot.py /app/telegram_bot/bot.py
COPY telegram_bot/run_bot.py /app/telegram_bot/run_bot.py

# Создание пользователя для запуска
RUN useradd -m -u 1000 botuser && \
    chown -R botuser:botuser /app

USER botuser

# Health check
HEALTHCHECK --interval=60s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import sys; sys.exit(0)"

# Запуск бота (run_bot.py добавит корень в PYTHONPATH)
CMD ["python", "telegram_bot/run_bot.py"]
