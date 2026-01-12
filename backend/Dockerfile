# Backend Dockerfile для AI Generator

FROM python:3.11-slim

# Установка рабочей директории
WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libmagic1 \
    libheif-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копирование requirements.txt
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создание директории для uploads/logs и пользователя приложения
RUN groupadd -g 10001 appuser \
    && useradd -u 10001 -g appuser -m appuser \
    && mkdir -p /app/uploads /app/logs \
    && chown -R appuser:appuser /app/uploads /app/logs

# Установка переменных окружения
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose порт
EXPOSE 8000

# Команда запуска (можно переопределить в docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
