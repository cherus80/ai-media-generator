# 🔐 Web Authentication Implementation Report

**Дата**: 2025-12-12
**Версия**: v0.15.12
**Статус**: ✅ Completed & Tested

---

## 📋 Обзор

Реализована полноценная система веб-аутентификации для перехода от Telegram WebApp к standalone веб-приложению. Система поддерживает Email/Password авторизацию с возможностью добавления Google OAuth в будущем.

---

## 🎯 Цель проекта

Преобразовать приложение из Telegram WebApp в полноценное веб-приложение с собственной системой аутентификации, сохранив обратную совместимость с Telegram для существующих пользователей.

---

## ✅ Реализованная функциональность

### Обновление 2025-12-13 — обязательное согласие при OAuth + UI выгрузка

- Google/VK вход на фронте теперь требует отметку согласия на ПДн: кнопки OAuth неактивны без чекбокса, в запросы уходит `consent_version` (`PD_CONSENT_VERSION`).
- Backend сохраняет согласие для Google/VK (включая PKCE) с фиксацией IP/User-Agent через `_save_pd_consent`. Отмеченная версия хранится в `auth-storage`, чтобы не запрашивать повторно ту же версию.
- В админ-панели добавлен таб «Согласия ПДн» с фильтрами по дате/версии и выгрузкой CSV/JSON через `/api/v1/admin/export/consents`.

### Обновление 2025-12-12 — аудит согласий на ПДн

- Добавлена таблица `user_consents` с фиксацией: `user_id`, `consent_version`, `source` (register/login), IP, User-Agent, `created_at`.
- Бэкенд принимает `consent_version` в `RegisterRequest`/`LoginRequest`, сохраняет согласие при регистрации и логине (см. `_save_pd_consent` в `backend/app/api/v1/endpoints/auth_web.py`).
- Константа версии согласия `PD_CONSENT_VERSION` (config и фронт `frontend/src/constants/pdConsent.ts`), фронт отправляет её в запросах регистрации/логина.
- Админ-выгрузка согласий: `GET /api/v1/admin/export/consents?format=csv|json&date_from&date_to&version` (см. `backend/app/api/v1/endpoints/admin.py`).

### 1. Backend (FastAPI)

#### Новый API endpoint: `/api/v1/auth-web`

**Файл**: `backend/app/api/v1/endpoints/auth_web.py`

**Endpoints**:

```python
POST /api/v1/auth-web/register  # Email/Password регистрация
POST /api/v1/auth-web/login     # Email/Password вход
POST /api/v1/auth-web/google    # Google OAuth (опционально)
GET  /api/v1/auth-web/me        # Получение профиля пользователя
```

**Схемы данных** (`backend/app/schemas/auth_web.py`):

- `RegisterRequest` - данные для регистрации
- `LoginRequest` - данные для входа
- `LoginResponse` - ответ с токеном и профилем
- `UserProfile` - профиль пользователя
- `GoogleOAuthRequest/Response` - для Google OAuth

#### Модель пользователя (`backend/app/models/user.py`)

**Обновлена таблица `users`**:

```python
class User(Base):
    # Существующие поля
    telegram_id = Column(BigInteger, unique=True, nullable=True)

    # Новые поля для web-авторизации
    email = Column(String(255), unique=True, nullable=True, index=True)
    email_verified = Column(Boolean, default=False)
    password_hash = Column(String(255), nullable=True)
    auth_provider = Column(Enum(AuthProvider), default=AuthProvider.EMAIL)
    oauth_provider_id = Column(String(255), nullable=True)
```

**Enum AuthProvider**:
```python
class AuthProvider(str, enum.Enum):
    EMAIL = "EMAIL"       # Email/Password
    GOOGLE = "GOOGLE"     # Google OAuth
    TELEGRAM = "TELEGRAM" # Legacy Telegram
```

#### Безопасность

**Хеширование паролей** (`backend/app/core/security.py`):
```python
import bcrypt

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )
```

**Валидация паролей**:
- Минимум 8 символов
- Хотя бы 1 заглавная буква
- Хотя бы 1 строчная буква
- Хотя бы 1 цифра
- Хотя бы 1 специальный символ

**JWT токены**:
```python
JWT_ALGORITHM = HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60
```

---

### 2. Frontend (React + TypeScript)

#### Страницы аутентификации

**LoginPage** (`frontend/src/pages/LoginPage.tsx`):
- Email/Password форма входа
- Google Sign-In кнопка (опционально)
- Валидация форм
- Обработка ошибок
- Редирект на главную после успешного входа
- UI (2025-12-05): карточный фон, единый стиль полей и CTA; кнопки Google/VK одинаковой высоты/ширины на десктопе и мобильных.

**RegisterPage** (`frontend/src/pages/RegisterPage.tsx`):
- Email/Password форма регистрации
- Поля: First Name, Last Name, Email, Password
- Валидация паролей (силы пароля)
- Google Sign-In кнопка (опционально)
- Редирект на главную после успешной регистрации

#### State Management (Zustand)

**AuthStore** (`frontend/src/store/authStore.ts`):

```typescript
interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  registerWithEmail: (data: RegisterRequest) => Promise<void>;
  loginWithEmail: (data: LoginRequest) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithTelegram: () => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}
```

**Персистентность**:
```typescript
persist(
  (set, get) => ({ /* ... */ }),
  {
    name: 'auth-storage',
    storage: createJSONStorage(() => localStorage),
  }
)
```

#### API Client (`frontend/src/api/authWeb.ts`)

```typescript
export async function registerWithEmail(data: RegisterRequest): Promise<LoginResponse>
export async function loginWithEmail(data: LoginRequest): Promise<LoginResponse>
export async function loginWithGoogle(idToken: string): Promise<GoogleOAuthResponse>
export async function getCurrentUser(): Promise<UserProfileResponse>
```

**Axios interceptors** для автоматического добавления JWT токена:
```typescript
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Routing (`frontend/src/App.tsx`)

```typescript
<Routes>
  {/* Auth pages */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* Главная страница - выбор функции */}
  <Route path="/" element={<HomePage />} />

  {/* ... другие роуты ... */}
</Routes>
```

#### Auth Hook (`frontend/src/hooks/useAuth.ts`)

```typescript
export const useAuth = () => {
  // Auto-login логика для Telegram
  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const inTelegram = isTelegramWebApp();

    // В dev режиме без Telegram - skip auto-login
    if (isDev && !inTelegram) {
      console.log('🔧 DEV режим: автоматическая авторизация пропущена');
      return;
    }

    // Attempt Telegram login только если в Telegram
    if (inTelegram) {
      await loginWithTelegram();
    }
  }, []);

  return {
    user, token, isAuthenticated,
    registerWithEmail, loginWithEmail, logout,
    hasCredits, canUseFreemium, hasActiveSubscription
  };
};
```

---

## 🐛 Проблемы и их решения

### Проблема 1: Missing email-validator Package

**Ошибка**:
```
ImportError: email-validator is not installed, run pip install pydantic[email]
```

**Причина**: Pydantic EmailStr требует установленную библиотеку `email-validator`.

**Решение**:
```bash
pip3 install email-validator
```

**Файлы**: `backend/app/schemas/auth_web.py`

---

### Проблема 2: Pydantic Undefined Annotation

**Ошибка**:
```
pydantic.errors.PydanticUndefinedAnnotation: name 'UserProfile' is not defined
```

**Причина**: `UserProfile` класс использовался в `LoginResponse` до его определения.

**Решение**:
1. Добавлен `from __future__ import annotations` в начало файла
2. Класс `UserProfile` перенесен с конца файла (строка 143) в начало (строка 21)

**Файлы**: `backend/app/schemas/auth_web.py`

**Изменения**:
```python
# Было (строка 143):
class UserProfile(BaseModel):
    id: int
    # ...

# Стало (строка 21):
from __future__ import annotations

class UserProfile(BaseModel):
    id: int
    # ...
```

---

### Проблема 3: "login is not a function"

**Ошибка**:
```javascript
TypeError: login is not a function
```

**Причина**: В `useAuth` hook пытались деструктурировать несуществующий метод `login` из authStore.

**Решение**: Изменены методы на правильные:
```typescript
// Было:
const { login, register, ... } = useAuthStore();

// Стало:
const {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  loginWithTelegram,
  ...
} = useAuthStore();
```

**Файлы**: `frontend/src/hooks/useAuth.ts`

---

### Проблема 4: Missing Auth Routes (404)

**Ошибка**: Навигация на `/register` или `/login` показывала 404 страницу.

**Причина**: Роуты не были зарегистрированы в `App.tsx`.

**Решение**: Добавлены импорты и роуты:
```typescript
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  {/* ... */}
</Routes>
```

**Файлы**: `frontend/src/App.tsx` (строки 3-4, 17-18)

---

### Проблема 5: API 404 Errors (Wrong Endpoints)

**Ошибка**:
```
POST /auth/register HTTP/1.1" 404 Not Found
```

**Причина**: Frontend API client использовал неправильные пути:
- Использовал: `/auth/register`
- Нужно было: `/api/v1/auth-web/register`

**Решение**: Обновлены все endpoints в `authWeb.ts`:
```typescript
// Было:
'/auth/register'
'/auth/login'
'/auth/google'
'/auth/me'

// Стало:
'/api/v1/auth-web/register'
'/api/v1/auth-web/login'
'/api/v1/auth-web/google'
'/api/v1/auth-web/me'
```

**Файлы**: `frontend/src/api/authWeb.ts`

---

### Проблема 6: Router Prefix Mismatch

**Ошибка**: Даже после исправления frontend - все еще получали 404 от backend.

**Причина**: Router в `auth_web.py` имел prefix `/auth`, в сочетании с `/api/v1` давало `/api/v1/auth`, но нужно было `/api/v1/auth-web`.

**Решение**: Изменен prefix роутера:
```python
# Было:
router = APIRouter(prefix="/auth", tags=["Web Authentication"])

# Стало:
router = APIRouter(prefix="/auth-web", tags=["Web Authentication"])
```

**Файлы**: `backend/app/api/v1/endpoints/auth_web.py` (строка 36)

---

### Проблема 7: AuthProvider Enum Mismatch

**Ошибка**:
```
asyncpg.exceptions.InvalidTextRepresentationError:
invalid input value for enum auth_provider_enum: "EMAIL"
```

**Причина**:
- Python enum имел uppercase значения (`AuthProvider.EMAIL = "EMAIL"`)
- База данных enum имела lowercase значения (`'email', 'google', 'telegram'`)
- SQLAlchemy отправлял uppercase строку в БД

**Решение**:

1. **Обновлен Python enum**:
```python
# Было:
class AuthProvider(str, enum.Enum):
    EMAIL = "email"
    GOOGLE = "google"
    TELEGRAM = "telegram"

# Стало:
class AuthProvider(str, enum.Enum):
    EMAIL = "EMAIL"
    GOOGLE = "GOOGLE"
    TELEGRAM = "TELEGRAM"
```

2. **Обновлен database enum через SQL**:
```sql
ALTER TYPE auth_provider_enum RENAME TO auth_provider_enum_old;
CREATE TYPE auth_provider_enum AS ENUM ('EMAIL', 'GOOGLE', 'TELEGRAM');
ALTER TABLE users ALTER COLUMN auth_provider DROP DEFAULT;
ALTER TABLE users ALTER COLUMN auth_provider TYPE auth_provider_enum
  USING auth_provider::text::auth_provider_enum;
ALTER TABLE users ALTER COLUMN auth_provider SET DEFAULT 'EMAIL'::auth_provider_enum;
DROP TYPE auth_provider_enum_old;
```

**Файлы**:
- `backend/app/models/user.py` (строки 16-19)
- Database migration (выполнено через psql)

---

### Проблема 8: Cached Statement Error

**Ошибка**:
```
InvalidCachedStatementError: cached statement plan is invalid
due to a database schema or configuration change
```

**Причина**: Backend connection pool кэшировал prepared statements до изменения enum в БД.

**Решение**: Перезапустить backend сервер:
```bash
# Убить процесс
kill <PID>

# Запустить заново
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Важно**: После изменения схемы БД всегда перезапускайте backend для сброса connection pool.

---

## 🧪 Тестирование

### Автоматическое E2E тестирование через Playwright MCP

**Метод**: Использовался Playwright через MCP интеграцию в Claude Code.

**Процесс**:

1. **Подготовка окружения**:
```bash
# PostgreSQL
docker-compose up -d postgres

# Миграции
cd backend && alembic upgrade head

# Backend
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend && npm run dev
```

2. **Тест регистрации**:
- Навигация: `http://localhost:5173/register`
- Заполнение формы:
  - First Name: John
  - Last Name: Doe
  - Email: johndoe@example.com
  - Password: SecurePass123!@#
- Клик на "Create account"
- Проверка: редирект на `/` и отображение "0 кредитов"

**Результат**: ✅ **200 OK**, пользователь создан с ID=1

**Backend лог**:
```
INSERT INTO users (email, email_verified, password_hash, auth_provider, ...)
VALUES ('johndoe@example.com', False, '$2b$12$90IQcuf6I6W36be9u8Y9we...', 'EMAIL', ...)
INFO: 127.0.0.1:60572 - "POST /api/v1/auth-web/register HTTP/1.1" 201 Created
```

3. **Тест входа**:
- Навигация: `http://localhost:5173/login`
- Заполнение формы:
  - Email: johndoe@example.com
  - Password: SecurePass123!@#
- Клик на "Sign in"
- Проверка: редирект на `/` и отображение "0 кредитов"

**Результат**: ✅ **200 OK**, пользователь авторизован

**Backend лог**:
```
SELECT users ... WHERE users.email = 'johndoe@example.com'
UPDATE users SET updated_at=... WHERE users.id = 1
INFO: 127.0.0.1:64198 - "POST /api/v1/auth-web/login HTTP/1.1" 200 OK
```

### Проверенные сценарии

- ✅ Email/Password регистрация
- ✅ Email/Password вход
- ✅ JWT токен сохраняется в localStorage
- ✅ Редирект на главную после успешной авторизации
- ✅ Отображение баланса кредитов
- ✅ Protected routes работают с JWT токенами
- ✅ Password hashing с bcrypt (12 rounds)
- ✅ Валидация силы пароля

---

## 📊 Измененные файлы

### Backend

| Файл | Изменения | Строки |
|------|-----------|--------|
| `app/api/v1/endpoints/auth_web.py` | Router prefix: `/auth` → `/auth-web` | 36 |
| `app/schemas/auth_web.py` | Добавлен `from __future__ import annotations`, перенесен `UserProfile` | 1, 21 |
| `app/models/user.py` | Enum values: lowercase → uppercase | 16-19 |
| `requirements.txt` | Добавлен `email-validator` | - |

### Frontend

| Файл | Изменения | Строки |
|------|-----------|--------|
| `src/App.tsx` | Добавлены auth routes | 3-4, 17-18 |
| `src/hooks/useAuth.ts` | Исправлены методы, добавлена логика dev режима | 18-25, 43-46 |
| `src/api/authWeb.ts` | Обновлены все 4 endpoint пути | все |

### Database

```sql
-- Migration: update auth_provider_enum to uppercase
ALTER TYPE auth_provider_enum ...
```

---

## 🔧 Конфигурация

### Backend `.env`

```bash
# JWT настройки
JWT_SECRET_KEY=<generated-secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Google OAuth (опционально)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ai_image_bot
```

### Frontend `.env`

```bash
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=  # опционально
```

---

## 🚀 Deployment Checklist

При деплое на production:

- [ ] Установить `email-validator` на production сервере
- [ ] Применить database migration для auth_provider_enum
- [ ] Обновить `.env` файлы с production credentials
- [ ] Проверить CORS настройки для production frontend URL
- [ ] Настроить HTTPS для безопасной передачи паролей
- [ ] Настроить Google OAuth credentials (если используется)
- [ ] Протестировать регистрацию и вход на production
- [ ] Проверить JWT токены в production
- [ ] Настроить rate limiting для auth endpoints

---

## 📚 Дополнительные ресурсы

### Документация

- [QUICK_START.md](../QUICK_START.md) - Быстрый запуск для тестирования
- [ENV_SETUP_GUIDE.md](../ENV_SETUP_GUIDE.md) - Настройка окружения
- [FRONTEND_COMPLETED_REPORT.md](../FRONTEND_COMPLETED_REPORT.md) - Детали frontend

### API Endpoints

**Swagger UI**: http://localhost:8000/docs

**ReDoc**: http://localhost:8000/redoc

---

## 🎓 Lessons Learned

### 1. Pydantic Forward References
При использовании класса до его определения в Pydantic:
```python
from __future__ import annotations
```

### 2. Enum Consistency
Database enum и Python enum должны иметь одинаковые значения (case-sensitive).

### 3. Backend Restart After Schema Changes
После изменения схемы БД всегда перезапускайте backend для сброса connection pool.

### 4. Router Prefix Convention
Используйте четкие naming conventions для router prefixes:
- `/auth` - только для Telegram auth
- `/auth-web` - для web authentication
- Всегда добавляйте API version: `/api/v1/`

### 5. Dev Mode Auto-Login
В dev режиме без Telegram WebApp - отключайте auto-login для тестирования manual login flow.

---

## 👥 Для других разработчиков (GPT Codex, Claude)

### Контекст проекта

Этот проект изначально был **Telegram WebApp** с авторизацией через Telegram `initData`. Теперь он преобразован в **полноценное веб-приложение** с собственной системой аутентификации.

### Ключевые точки

1. **Обратная совместимость**: Telegram авторизация сохранена для существующих пользователей (`AuthProvider.TELEGRAM`).

2. **Два способа авторизации**:
   - Telegram WebApp → автоматический вход через `loginWithTelegram()`
   - Веб-браузер → ручной вход через `/login` или `/register`

3. **Dev режим**: В development без Telegram - auto-login отключен, пользователь должен вручную зайти через `/login`.

4. **Database schema**: Таблица `users` поддерживает оба типа пользователей:
   - Telegram users: `telegram_id` NOT NULL, `email` NULL
   - Web users: `email` NOT NULL, `telegram_id` NULL

5. **JWT токены**: Используются для всех пользователей (и Telegram, и Web) для API запросов.

### Если нужно добавить новую функцию аутентификации

1. Добавьте новый `AuthProvider` в enum
2. Добавьте соответствующее поле в модель `User`
3. Создайте endpoint в `auth_web.py`
4. Обновите frontend store и API client
5. Обновите миграцию БД
6. Не забудьте перезапустить backend после изменения схемы!

---

## ✅ Checklist завершения

- [x] Backend auth endpoints реализованы
- [x] Frontend auth pages созданы
- [x] Zustand store настроен
- [x] JWT токены работают
- [x] Password hashing с bcrypt
- [x] Database migration применена
- [x] Enum values синхронизированы
- [x] E2E тестирование пройдено
- [x] Документация создана
- [x] Все баги исправлены

---

## 🎉 Статус

**Система веб-аутентификации полностью работоспособна и готова к использованию!**

---

**Автор**: Claude Code
**Дата**: 2025-11-18
**Версия документа**: 1.0
