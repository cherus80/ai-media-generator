# 🤖 Для AI-ассистентов (Claude Code / GPT Codex)

**ВАЖНО**: Прочитайте этот файл первым при старте новой сессии!

---

## ⚡ Быстрый старт контекста

### Что это за проект?

AI Image Generator - полноценное **веб-приложение** для виртуальной примерки одежды и AI-редактирования изображений.

**Важная история**: Изначально был Telegram WebApp, но в версии v0.12.0 преобразован в standalone веб-приложение с собственной системой аутентификации.

### Текущая версия: v0.12.2 (2025-11-18)

**Статус**: ✅ Production Ready (Virtual Try-On Fixed + Tested)

---

## 📚 Ключевая документация (читать в этом порядке)

1. **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** - текущий статус проекта, что работает, что исправлено
2. **[docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md)** - детальная документация последних изменений
3. **[CHANGELOG.md](CHANGELOG.md)** - история всех изменений
4. **[QUICK_START.md](QUICK_START.md)** - как запустить проект для тестирования

---

## 🎯 Что было сделано в v0.12.2?

### Исправлено:
- ✅ Виртуальная примерка: используем OpenRouter (kie.ai отключён)
  - Добавлена передача `image_urls` с фото пользователя и одежды ([fitting.py:186](backend/app/tasks/fitting.py#L186))
  - Добавлен static file serving через `/uploads` endpoint ([main.py:107](backend/app/main.py#L107))
  - Добавлена настройка `BACKEND_URL` для формирования полных URL ([config.py:30](backend/app/core/config.py#L30))
  - Исправлено database constraint violation с `prompt` полем ([fitting.py:149](backend/app/api/v1/endpoints/fitting.py#L149))

### E2E тестирование (Playwright MCP):
- ✅ Полный цикл виртуальной примерки протестирован
- ✅ Все 3 шага работают корректно
- ✅ API передает фотографии в OpenRouter (base64 data URLs)
- ✅ Static file serving функционирует

### Требования для запуска:
```bash
# 1. Redis server
redis-server --daemonize yes

# 2. Celery worker (обязательно слушаем очереди fitting, editing, maintenance)
cd backend && celery -A app.tasks.celery_app worker --loglevel=info -Q fitting,editing,maintenance

# 3. При тестировании локально
export NO_PROXY=localhost,127.0.0.1
```

---

## 🎯 Что было сделано в v0.12.1?

### Исправлено:
- ✅ **Начисление тестовых кредитов**: Новые пользователи получают 10 кредитов при регистрации
  - Email/Password: `balance_credits=10` ([auth_web.py:143](backend/app/api/v1/endpoints/auth_web.py#L143))
  - Google OAuth: `balance_credits=10` ([auth_web.py:334](backend/app/api/v1/endpoints/auth_web.py#L334))
- ✅ **Логика зоны примерки**: Кнопка "Пропустить" теперь устанавливает `zone='body'` вместо `null`
  - Файл: [Step3Zone.tsx:50](frontend/src/components/fitting/Step3Zone.tsx#L50)
- ✅ **Текст подсказки**: Убрано упоминание "AI определит автоматически"
  - Новый текст: "При нажатии 'Пропустить' примерка применится на всё тело"

### Преимущества:
- **Новые пользователи**: 10 кредитов (5 генераций) + 10 Freemium действий = **15 генераций в первый месяц**
- **Лучший UX**: Четкие и точные подсказки для выбора зоны примерки
- **Предсказуемое поведение**: Кнопка "Пропустить" дает ожидаемый результат

---

## 🎯 Что было сделано в v0.12.0?

### Реализовано:
- ✅ Email/Password регистрация и вход
- ✅ Google OAuth интеграция (опционально)
- ✅ JWT токены для API
- ✅ bcrypt password hashing (12 rounds)
- ✅ Frontend страницы (LoginPage, RegisterPage)
- ✅ Zustand state management
- ✅ E2E тестирование с Playwright MCP

### Исправлено 8 багов:
1. Missing email-validator package
2. Pydantic forward reference error
3. "login is not a function" error
4. Missing auth routes (404)
5. API endpoint mismatch
6. Router prefix mismatch
7. AuthProvider enum mismatch
8. Cached statement error

**Все баги подробно описаны в**: [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md)

---

## ⚠️ Критически важные правила

### 1. AuthProvider Enum - ВСЕГДА UPPERCASE

```python
# ✅ ПРАВИЛЬНО
class AuthProvider(str, enum.Enum):
    EMAIL = "EMAIL"
    GOOGLE = "GOOGLE"
    TELEGRAM = "TELEGRAM"

# ❌ НЕПРАВИЛЬНО
class AuthProvider(str, enum.Enum):
    EMAIL = "email"  # lowercase не работает!
```

**Причина**: Database enum использует uppercase значения.

---

### 2. API Endpoints - ПРАВИЛЬНЫЙ prefix

```typescript
// ✅ ПРАВИЛЬНО
const response = await client.post('/api/v1/auth-web/register', data);

// ❌ НЕПРАВИЛЬНО
const response = await client.post('/auth/register', data);
const response = await client.post('/api/v1/auth/register', data);
```

**Router prefix**: `/auth-web` (НЕ `/auth`)

---

### 3. Backend Restart - ОБЯЗАТЕЛЬНО после изменения DB schema

```bash
# После любого ALTER TYPE, ALTER TABLE, etc.
kill <backend-pid>
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Причина**: Connection pool кэширует prepared statements.

---

### 4. Pydantic Forward References

```python
# ✅ ПРАВИЛЬНО
from __future__ import annotations

# Класс СНАЧАЛА определяется
class UserProfile(BaseModel):
    id: int
    email: str

# Потом используется
class LoginResponse(BaseModel):
    user: UserProfile  # Работает!

# ❌ НЕПРАВИЛЬНО
class LoginResponse(BaseModel):
    user: UserProfile  # Ошибка! UserProfile не определен

class UserProfile(BaseModel):  # Определен слишком поздно
    id: int
```

---

### 5. Dev Mode Auto-Login

```typescript
// В dev режиме БЕЗ Telegram WebApp
if (isDev && !inTelegram) {
  console.log('🔧 DEV режим: автоматическая авторизация пропущена');
  return; // Skip auto-login - пользователь войдет вручную через /login
}
```

**Важно**: В dev режиме пользователь должен вручную зайти через `/login` или `/register`.

---

## 🗂️ Структура проекта

```
ai-image-bot/
├── backend/                        # FastAPI backend
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   └── auth_web.py        # ⭐ Web auth endpoints
│   │   ├── models/
│   │   │   └── user.py            # ⭐ User model + AuthProvider enum
│   │   ├── schemas/
│   │   │   └── auth_web.py        # ⭐ Pydantic schemas
│   │   └── core/
│   │       └── security.py        # Password hashing, JWT
│   └── .env                       # ⭐ Конфигурация (читай первым!)
│
├── frontend/                       # React + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx      # ⭐ Страница входа
│   │   │   └── RegisterPage.tsx   # ⭐ Страница регистрации
│   │   ├── store/
│   │   │   └── authStore.ts       # ⭐ Zustand auth state
│   │   ├── api/
│   │   │   └── authWeb.ts         # ⭐ API client
│   │   ├── hooks/
│   │   │   └── useAuth.ts         # ⭐ Auth hook
│   │   └── App.tsx                # ⭐ Routes
│   └── .env                       # ⭐ API URL, Google Client ID
│
└── docs/                          # Документация
    ├── PROJECT_STATUS.md          # ⭐ Текущий статус (читай первым!)
    ├── WEB_AUTH_IMPLEMENTATION.md # ⭐ Детали v0.12.0
    └── ...
```

**⭐** = Файлы, которые нужно читать при работе с auth системой

---

## 🔧 Как запустить проект

### Быстрый старт

```bash
# 1. Запустить PostgreSQL
docker-compose up -d postgres

# 2. Применить миграции
cd backend && alembic upgrade head

# 3. Запустить Backend (в терминале #1)
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Запустить Frontend (в терминале #2)
cd frontend && npm run dev

# 5. Открыть браузер
open http://localhost:5173/register
```

### Проверка, что всё работает

```bash
# Backend
curl http://localhost:8000/docs  # Swagger UI

# Frontend
curl http://localhost:5173  # Vite dev server

# Database
psql postgresql://postgres:postgres@localhost:5432/ai_image_bot
```

---

## 🧪 Как протестировать

### Регистрация нового пользователя

```bash
# 1. Открыть http://localhost:5173/register
# 2. Заполнить форму:
Email: test@example.com
Password: Test123!@#
First Name: Test
Last Name: User

# 3. Нажать "Create account"
# 4. Проверить редирект на "/" и отображение "0 кредитов"
```

### Вход существующего пользователя

```bash
# 1. Открыть http://localhost:5173/login
# 2. Ввести:
Email: test@example.com
Password: Test123!@#

# 3. Нажать "Sign in"
# 4. Проверить редирект на "/"
```

### E2E тест с Playwright

```javascript
// Попросите пользователя:
"Протестируй регистрацию и вход через Playwright"
```

---

## 🐛 Troubleshooting

### Проблема: "email-validator not installed"

```bash
cd backend
pip3 install email-validator
```

---

### Проблема: "AuthProvider enum: invalid input value 'EMAIL'"

**Причина**: Database enum не синхронизирован с Python enum.

**Решение**:
```sql
-- 1. Подключиться к БД
psql postgresql://postgres:postgres@localhost:5432/ai_image_bot

-- 2. Выполнить миграцию enum
ALTER TYPE auth_provider_enum RENAME TO auth_provider_enum_old;
CREATE TYPE auth_provider_enum AS ENUM ('EMAIL', 'GOOGLE', 'TELEGRAM');
ALTER TABLE users ALTER COLUMN auth_provider TYPE auth_provider_enum
  USING auth_provider::text::auth_provider_enum;
DROP TYPE auth_provider_enum_old;

-- 3. Перезапустить backend!
```

---

### Проблема: "Cached statement plan is invalid"

**Причина**: Backend connection pool кэшировал старые prepared statements.

**Решение**: Просто перезапустите backend:
```bash
# Найти процесс
ps aux | grep uvicorn

# Убить
kill <PID>

# Запустить заново
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Проблема: 404 на /api/v1/auth-web/register

**Проверьте**:

1. **Backend router prefix**:
```python
# backend/app/api/v1/endpoints/auth_web.py
router = APIRouter(prefix="/auth-web", tags=["Web Authentication"])
# НЕ prefix="/auth"
```

2. **Frontend API client**:
```typescript
// frontend/src/api/authWeb.ts
const response = await client.post('/api/v1/auth-web/register', data);
// НЕ '/auth/register'
```

3. **Backend запущен**:
```bash
curl http://localhost:8000/docs
```

---

## 💡 Best Practices

### 1. Перед началом работы

```bash
# Всегда читайте актуальную документацию:
1. docs/PROJECT_STATUS.md
2. docs/WEB_AUTH_IMPLEMENTATION.md
3. CHANGELOG.md
```

---

### 2. При создании новых features

```python
# 1. Обновите документацию СРАЗУ
# 2. Добавьте в CHANGELOG.md
# 3. Обновите PROJECT_STATUS.md
# 4. Протестируйте с Playwright
```

---

### 3. При изменении database schema

```bash
# 1. Создайте миграцию
alembic revision --autogenerate -m "описание"

# 2. Проверьте миграцию
cat alembic/versions/<latest>.py

# 3. Примените миграцию
alembic upgrade head

# 4. ОБЯЗАТЕЛЬНО перезапустите backend!
kill <backend-pid> && uvicorn app.main:app --reload
```

---

### 4. При работе с enum

```python
# Всегда используйте UPPERCASE значения
class MyEnum(str, enum.Enum):
    VALUE1 = "VALUE1"  # ✅
    VALUE2 = "VALUE2"  # ✅

# НЕ lowercase
class MyEnum(str, enum.Enum):
    VALUE1 = "value1"  # ❌
```

---

## 🚀 Следующие шаги для разработки

### Ready to implement:
- [ ] Email verification
- [ ] Password reset flow
- [ ] Two-factor authentication (2FA)
- [ ] Social login (Facebook, Apple)
- [ ] User profile editing

### Нужна настройка:
- [ ] Google OAuth credentials
- [ ] Production ЮKassa credentials
- [ ] Email service (SendGrid, Mailgun)
- [ ] SSL certificates

---

## 📞 Для вопросов и помощи

### Документация
1. **PROJECT_STATUS.md** - текущий статус
2. **WEB_AUTH_IMPLEMENTATION.md** - детали auth системы
3. **CHANGELOG.md** - история изменений

### Код
- Backend: `backend/app/api/v1/endpoints/auth_web.py`
- Frontend: `frontend/src/pages/LoginPage.tsx`
- Database: `backend/app/models/user.py`

---

## ✅ Checklist перед началом работы

- [ ] Прочитал PROJECT_STATUS.md
- [ ] Прочитал WEB_AUTH_IMPLEMENTATION.md
- [ ] Прочитал CHANGELOG.md
- [ ] Запустил PostgreSQL
- [ ] Запустил Backend
- [ ] Запустил Frontend
- [ ] Проверил, что регистрация работает
- [ ] Проверил, что вход работает

---

## 🎓 Ключевые уроки (Lessons Learned)

1. **Pydantic forward references** - используйте `from __future__ import annotations`
2. **Enum consistency** - всегда uppercase в БД и коде
3. **Backend restart** - обязателен после schema changes
4. **Router prefix** - используйте четкие naming conventions
5. **Dev mode** - отключайте auto-login для тестирования

---

**Версия документа**: 1.0
**Дата**: 2025-11-18
**Автор**: Claude Code

**Готово к работе!** 🚀
