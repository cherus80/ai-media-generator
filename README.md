# AI Generator

Веб-приложение для:
- виртуальной примерки одежды/аксессуаров;
- AI-редактирования изображений через чат;
- генерации по готовым примерам;
- управления оплатой (подписки и ⭐️звезды).

README ниже описывает фактический функционал по текущему коду репозитория.

## Что реализовано сейчас

### Пользовательский функционал
- **Виртуальная примерка**: загрузка фото пользователя и вещи, выбор зоны (голова/лицо/шея/руки/ноги/всё тело), выбор aspect ratio (`auto`, `1:1`, `16:9`, `9:16`), генерация через очередь задач.
- **Редактирование фото (чат)**:
  - загрузка базового изображения;
  - прикрепление референсов;
  - выбор: отправить запрос сразу или улучшить промпт через AI-ассистента;
  - генерация результата и история сообщений по сессии.
- **Генерация по примерам**: выбор опубликованного примера, подстановка промпта, запуск генерации без сохранения чат-истории.
- **История генераций**: просмотр последних генераций примерки и редактирования.
- **Инструкции и примеры**: публичные и in-app страницы с видео/текстовыми инструкциями и библиотекой примеров.
- **Оповещения**:
  - раздел пользовательских уведомлений;
  - одноразовое welcome-оповещение новым пользователям;
  - отметка прочитанного (включая массовую).

### Аутентификация и аккаунт
- Email/Password (регистрация/логин).
- Подтверждение email (verify-ссылка), повторная отправка письма.
- Сброс пароля (request/confirm).
- Google OAuth.
- VK ID OAuth (silent + PKCE).
- Legacy Telegram auth endpoint (обратная совместимость).
- Согласие на обработку ПДн сохраняется отдельно.

### Монетизация (Billing v5)
- Модель: **подписка + ⭐️звезды** (без freemium-лимита в пользовательском потоке).
- Стоимости действий по умолчанию:
  - генерация (примерка/редактирование): **1 действие подписки** или **2 ⭐️звезды**;
  - AI-ассистент в редакторе: **1 ⭐️звезда**.
- Приветственный бонус при регистрации: **6 ⭐️звезд** (по умолчанию).
- Оплата через ЮKassa + webhook обработка.
- Mock-режим платежей для локальной разработки (`PAYMENT_MOCK_MODE=true`) + страница `/mock-payment-emulator`.

Тарифы и пакеты по умолчанию (могут переопределяться переменными окружения):
- Подписки: `basic` (399₽ / 30 действий), `standard` (699₽ / 60), `premium` (1290₽ / 120).
- Пакеты ⭐️звезд: 20 (199₽), 50 (449₽), 100 (799₽), 250 (1690₽).

### Реферальная система
- Генерация персональной реферальной ссылки.
- Регистрация по коду.
- Бонус рефереру начисляется после первой успешной оплаты приглашённого пользователя.

### Админ-панель
- Дашборд и статистика.
- Управление пользователями (поиск/фильтры, детали, изменение баланса, назначение админа, удаление).
- Экспорт данных (users/payments/generations/consents).
- Управление промптами примерки.
- Runtime-настройка провайдеров генерации (primary/fallback).
- Управление инструкциями и примерами (включая загрузку медиа).
- Массовая отправка уведомлений пользователям.

## Технический стек

### Backend
- FastAPI
- SQLAlchemy 2.x + Alembic
- PostgreSQL
- Celery + Redis

### Frontend
- React 18 + TypeScript
- Vite
- Zustand
- Tailwind CSS

### AI/внешние интеграции
- Генерация изображений: GrsAI (primary), fallback-провайдеры kie.ai / OpenRouter (конфигурируются).
- Ассистент промптов: OpenRouter.
- Платежи: ЮKassa.

## Структура репозитория

```text
.
├── backend/                  # FastAPI + модели + сервисы + задачи + тесты
├── frontend/                 # React приложение
├── docs/                     # Дополнительная документация
├── scripts/                  # Скрипты бэкапа/восстановления и утилиты
├── docker-compose.dev.yml    # Локально: PostgreSQL + Redis
├── docker-compose.prod.yml   # Production stack
├── start-dev.sh              # Локальный запуск всего dev-стека
└── stop-dev.sh               # Остановка dev-стека
```

## Быстрый старт (локальная разработка)

### 1) Подготовьте переменные окружения

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Если нужен root `.env` для production compose/скриптов:

```bash
cp .env.example .env
```

### 2) Запуск через скрипт (рекомендуется)

```bash
npm run dev
# или
./start-dev.sh
```

Скрипт поднимает:
- PostgreSQL + Redis (Docker);
- backend (uvicorn) + celery worker;
- frontend (Vite на `5173`).

### 3) Ручной запуск (если нужен полный контроль)

Инфраструктура:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Celery (в отдельном терминале):

```bash
cd backend
source venv/bin/activate
celery -A app.tasks.celery_app:celery_app worker --loglevel=info -Q fitting,editing,maintenance
```

Frontend:

```bash
# Перед запуском проверьте порт 5173
lsof -i :5173
# если это старый dev-процесс проекта — завершите его
# kill <PID>

cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

После запуска:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger (в debug): http://localhost:8000/docs

## Production (Docker Compose)

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

## Форматы и лимиты файлов (фактические)

- Изображения: `JPEG`, `PNG`, `WebP`, `HEIC/HEIF`, `MPO`.
- Валидация backend: `MAX_FILE_SIZE_MB` (по умолчанию 10MB).
- Клиентские загрузки для генераций: автосжатие до ~9MB (при исходном лимите 40MB).
- Видео для инструкций (админ): `MP4`, `WebM`, `MOV` (по лимиту `MAX_VIDEO_FILE_SIZE_MB`, по умолчанию 200MB).

## Основные API-группы

- `/api/v1/auth-web/*` — web auth (email/google/vk, verify, password reset)
- `/api/v1/auth/*` — legacy telegram auth
- `/api/v1/fitting/*` — загрузка/генерация/статус/результат/история
- `/api/v1/editing/*` — сессии чата, ассистент, генерация, история
- `/api/v1/content/*` — публичные инструкции/примеры/теги
- `/api/v1/payments/*` — платежи, тарифы, история, webhook
- `/api/v1/billing/*` — состояние биллинга и ledger
- `/api/v1/referrals/*` — реферальные ссылки и статистика
- `/api/v1/notifications/*` — пользовательские уведомления
- `/api/v1/admin/*` — админские endpoints

## Тесты

Backend:

```bash
cd backend
pytest tests/ -v
```

Frontend:

```bash
cd frontend
npm test
```

Из корня:

```bash
npm run test:backend
npm run test:frontend
```

## Полезные документы

- [CHANGELOG.md](CHANGELOG.md)
- [docs/deployment/DEPLOY.md](docs/deployment/DEPLOY.md)
- [docs/deployment/NGINX_SETUP.md](docs/deployment/NGINX_SETUP.md)
- [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)
- [docs/VK_OAUTH_SETUP.md](docs/VK_OAUTH_SETUP.md)
- [docs/MCP_PLAYWRIGHT_SETUP.md](docs/MCP_PLAYWRIGHT_SETUP.md)
- [scripts/README.md](scripts/README.md)
