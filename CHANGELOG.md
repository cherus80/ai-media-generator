# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.12.6] - 2025-11-26

### Added - iPhone Photo Support (MPO/HEIC)

#### Backend
- **pillow-heif library**: Added support for iPhone HEIC/HEIF image formats
  - Added `pillow-heif==0.14.0` to requirements.txt
  - Installed `libheif-dev` in Dockerfile for HEIF codec support
  - Registered HEIC opener in main.py startup to enable automatic HEIC detection
  - File: [backend/requirements.txt](backend/requirements.txt), [backend/Dockerfile](backend/Dockerfile)

- **MPO format support**: Added support for Multi-Picture Object format (used by some cameras)
  - Updated `ALLOWED_EXTENSIONS` to include `heic,heif,mpo`
  - File: [backend/app/core/config.py:163](backend/app/core/config.py#L163)

- **Image conversion utility**: Created automatic converter for HEIC/MPO → JPEG
  - New function `convert_to_jpeg_if_needed()` in `image_utils.py`
  - Automatically converts HEIC/HEIF/MPO formats to JPEG before processing
  - Preserves EXIF data and image quality during conversion
  - File: [backend/app/utils/image_utils.py](backend/app/utils/image_utils.py)

- **File validation**: Enhanced image validator to support new formats
  - Added magic byte detection for HEIC (`ftyp`)
  - Added validation for MPO format (JPEG with APP2 marker)
  - Updated MIME type mapping to accept `image/heic` and `image/heif`
  - File: [backend/app/services/file_validator.py](backend/app/services/file_validator.py)

- **Task integration**: Integrated HEIC/MPO conversion in Celery tasks
  - Fitting task: Converts user and item photos before try-on generation
  - Editing task: Converts base images before AI editing
  - Files: [backend/app/tasks/fitting.py](backend/app/tasks/fitting.py), [backend/app/tasks/editing.py](backend/app/tasks/editing.py)

#### Frontend
- **FileUpload component**: Updated to accept HEIC/HEIF/MPO files
  - Added `.heic,.heif,.mpo` to accepted file types
  - Updated validation messages to mention iPhone photo support
  - File: [frontend/src/components/common/FileUpload.tsx](frontend/src/components/common/FileUpload.tsx)

### Added - Email Verification System

#### Backend
- **Email verification dependency**: Created `require_verified_email` dependency
  - Blocks access to premium features for unverified email users
  - Exempts admins and Google OAuth users from verification
  - Returns HTTP 403 with clear error message for unverified users
  - File: [backend/app/api/dependencies.py](backend/app/api/dependencies.py)

- **Protected endpoints**: Added email verification requirement to critical endpoints
  - Fitting generation: `/api/v1/fitting/generate` now requires verified email
  - Editing chat: `/api/v1/editing/chat` now requires verified email
  - Editing generation: `/api/v1/editing/generate` now requires verified email
  - Payment creation: `/api/v1/payments/create` now requires verified email
  - Files: [backend/app/api/v1/endpoints/fitting.py:99](backend/app/api/v1/endpoints/fitting.py#L99), [backend/app/api/v1/endpoints/editing.py:164](backend/app/api/v1/endpoints/editing.py#L164), [backend/app/api/v1/endpoints/payments.py:55](backend/app/api/v1/endpoints/payments.py#L55)

- **SMTP configuration**: Email service already implemented with Mail.ru SMTP support
  - Supports TLS (port 587) and SSL (port 465) connections
  - HTML and plain text email templates
  - Configurable via environment variables (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)
  - File: [backend/app/services/email.py](backend/app/services/email.py)

#### Frontend
- **Email verification banner**: Component already integrated in Layout
  - Shows warning to unverified users
  - Provides "Resend verification email" button
  - Dismissible with localStorage persistence
  - File: [frontend/src/components/common/EmailVerificationBanner.tsx](frontend/src/components/common/EmailVerificationBanner.tsx)

- **Profile page**: Already displays email verification status
  - Shows verified/unverified badge
  - Allows resending verification email
  - File: [frontend/src/pages/ProfilePage.tsx](frontend/src/pages/ProfilePage.tsx)

### Changed - Russian Localization

#### Frontend
- **LoginPage**: Fully translated to Russian
  - "Sign in to your account" → "Войдите в свой аккаунт"
  - "create a new account" → "создайте новый аккаунт"
  - "Or continue with email" → "Или продолжите с email"
  - All form labels and buttons translated
  - File: [frontend/src/pages/LoginPage.tsx](frontend/src/pages/LoginPage.tsx)

- **RegisterPage**: Fully translated to Russian
  - "Create your account" → "Создайте свой аккаунт"
  - "Already have an account?" → "Уже есть аккаунт?"
  - Referral invitation message translated
  - Password strength indicator translated
  - All form fields and validation messages in Russian
  - File: [frontend/src/pages/RegisterPage.tsx](frontend/src/pages/RegisterPage.tsx)

- **GoogleSignInButton**: Component comments and error messages translated
  - "Google Sign-In not configured" → "Google вход не настроен"
  - "Loading Google Sign-In..." → "Загрузка Google входа..."
  - "Google Sign-In failed" → "Google вход не удался"
  - File: [frontend/src/components/auth/GoogleSignInButton.tsx](frontend/src/components/auth/GoogleSignInButton.tsx)

- **MockPaymentEmulator**: Development tool fully translated
  - "Loading..." → "Загрузка..."
  - "Refresh" → "Обновить"
  - "Error" / "Success" → "Ошибка" / "Успех"
  - "No payments found" → "Платежи не найдены"
  - "Approve" / "Cancel" → "Подтвердить" / "Отменить"
  - All payment details and warnings in Russian
  - File: [frontend/src/pages/MockPaymentEmulator.tsx](frontend/src/pages/MockPaymentEmulator.tsx)

- **Verified existing translations**: Confirmed these pages already in Russian
  - HomePage, ProfilePage, EmailVerificationPage, ErrorPage, LoadingPage, AuthGuard
  - No changes needed

### Impact
- **iPhone users**: Can now upload photos directly from iPhone Camera (HEIC/HEIF format)
- **Security**: Unverified users cannot use premium features (fitting, editing, payments)
- **UX**: Entire authentication flow now in Russian for Russian-speaking users
- **Email verification**: Ready for production deployment (requires SMTP configuration)

### Configuration Required
- **SMTP Mail.ru setup**: Add to `backend/.env`:
  ```
  SMTP_HOST=smtp.mail.ru
  SMTP_PORT=465
  SMTP_USER=your-email@mail.ru
  SMTP_PASSWORD=your-app-password
  SMTP_USE_TLS=false
  EMAIL_FROM=your-email@mail.ru
  ```

---

## [0.12.5] - 2025-11-23

## [Unreleased]

### Changed - kie.ai integration
- Переписан клиент kie.ai под новый API (`/api/v1/jobs/createTask` + `/api/v1/gpt4o-image/record-info`), теперь передаются публичные URL вместо base64.
- Добавлен флаг `KIE_AI_DISABLE_FALLBACK` для отладки: при включении отключается fallback на OpenRouter и ошибки kie.ai видны сразу.
- Для работы kie.ai требуется, чтобы ссылки на `/uploads/*` были доступны извне (или через туннель), иначе сервис не сможет скачать изображения и задачи зависнут по таймауту.

### Changed - Web auth
- Убран принудительный баннер «Откройте через Telegram»: AuthGuard больше не блокирует доступ вне Telegram, а auto-login через Telegram выполняется только если приложение действительно запущено внутри Telegram WebApp.

### Fixed - Google OAuth Authentication

#### Backend
- **Critical fix: Missing UserRole import**: Added missing `UserRole` import in `auth_web.py:24`
  - Previously caused `NameError: name 'UserRole' is not defined` during user registration and login
  - This error resulted in 500 Internal Server Error when attempting Google OAuth or email registration
  - Auto-assignment of ADMIN role was failing silently
  - File: [backend/app/api/v1/endpoints/auth_web.py:24](backend/app/api/v1/endpoints/auth_web.py#L24)

### Changed - Admin Configuration

#### Backend
- **Admin email whitelist**: Updated `ADMIN_EMAIL_WHITELIST` to include both super-admin accounts
  - Added support for multiple admin emails: `cherus09@mail.ru,cherus09@gmail.com`
  - Auto-assignment of ADMIN role now works correctly for both accounts
  - File: [backend/.env:78](backend/.env#L78)

### Notes
- Backend container was restarted to apply environment variable changes
- Users with whitelisted emails will automatically receive ADMIN role upon next login
- Google Cloud Console origins have been verified and configured correctly

---

## [0.12.4] - 2025-11-22

### Changed - Editing Flow & UX
- **Registration bonus**: Email/Google регистрации теперь начисляют 100 кредитов для быстрого старта.
- **Base image preview**: превью базового изображения в чате использует полный `VITE_API_BASE_URL` и отображается уменьшенным (`object-contain`, `max-h-96`), чтобы не растягивать экран.
- **Prompt decision modal**: кнопки «Отправить без улучшений» / «Улучшить с AI» теперь надёжно отрабатывают (submit), тексты упрощены для новичков.
- **Prompt assistant model**: конфиг `OPENROUTER_PROMPT_MODEL` и UI подпись ассистента без упоминаний внутренних сервисов.
- **Upload → session**: фронт использует `base_image_url` из `/editing/upload`, что предотвращает пустой UI после загрузки.
- **OpenRouter ретраи**: для генерации редактирования отключены автоповторы Celery (max_retries=0), чтобы не слать запросы каждые 60с и не сжигать токены при ошибках.
- **refreshProfile**: фронт теперь берёт профиль из `response.user`, убирая циклические 401 и некорректное состояние баланса после логина/регистрации.
- **Новый E2E**: добавлен `e2e_editing_test.py` — полный сценарий редактирования (регистрация, загрузка фото, улучшение промпта, генерация, скриншот артефакта в `.playwright-mcp/`).
- **Auth hardening**: добавлен whitelist доменов (`ALLOWED_EMAIL_DOMAINS`) и rate-limit на регистрацию (`REGISTER_RATE_LIMIT_PER_MINUTE`), автоприсвоение роли ADMIN при Google-логине для email из whitelist.
- **CORS dev**: добавлены origin `127.0.0.1:5173/5174` для локального Vite.
- **Fitting prompts**: ужесточены промты для рук и обуви (запрет лишних конечностей, совпадение масштаба/фона, без белых полей).

### Notes
- После обновлений фронт нужно перезапустить dev-сервер; на некоторых окружениях может потребоваться ручной запуск Vite.

---

## [0.12.3] - 2025-11-20

### Fixed - Virtual Try-On Queue Stall

- **Celery worker queue binding**: the worker was consuming only the default `celery` queue, while all virtual try-on tasks were routed to the named queues `fitting`, `editing`, and `maintenance`. This left try-on tasks stuck in `pending` forever and the UI spinner never finished. All startup scripts, Docker Compose services, and documentation now launch Celery with `-Q fitting,editing,maintenance` so the worker actually processes those queues. Without this flag the try-on endpoint appeared broken even though the API request succeeded.

---

## [0.12.1] - 2025-11-18

### Fixed - Credits and Virtual Try-On

#### Backend
- **Initial credits bonus**: New users now receive 10 test credits upon registration
  - Email/Password registration: `balance_credits=10` ([auth_web.py:143](backend/app/api/v1/endpoints/auth_web.py#L143))
  - Google OAuth registration: `balance_credits=10` ([auth_web.py:334](backend/app/api/v1/endpoints/auth_web.py#L334))

#### Frontend
- **Virtual try-on zone logic**: Fixed "Skip" button behavior
  - When "Skip" is pressed, zone is now set to `'body'` instead of `null` ([Step3Zone.tsx:50](frontend/src/components/fitting/Step3Zone.tsx#L50))
  - Updated hint text to remove misleading "AI will determine automatically" phrase
  - New hint: "When 'Skip' is pressed, try-on will be applied to full body"

### Impact
- **New users benefit**: Each new user gets 10 credits (5 generations × 2 credits) + 10 Freemium actions
- **Better UX**: Clear and accurate guidance for virtual try-on zone selection
- **Consistent behavior**: "Skip" button now produces predictable results (full body try-on)

---

## [0.12.0] - 2025-11-18

### Added - Web Authentication System

#### Backend
- **New API endpoints** (`/api/v1/auth-web`):
  - `POST /register` - Email/Password registration
  - `POST /login` - Email/Password login
  - `POST /google` - Google OAuth (optional)
  - `GET /me` - Get current user profile
- **Enhanced User model** with web auth support:
  - `email` field (unique, indexed)
  - `email_verified` flag
  - `password_hash` (bcrypt with 12 rounds)
  - `auth_provider` enum (EMAIL, GOOGLE, TELEGRAM)
  - `oauth_provider_id` for external OAuth
- **Security enhancements**:
  - Password strength validation (8+ chars, uppercase, lowercase, digit, special char)
  - bcrypt password hashing
  - JWT tokens for web sessions
- **Pydantic schemas** (`auth_web.py`):
  - RegisterRequest, LoginRequest, LoginResponse
  - UserProfile, GoogleOAuthRequest/Response

#### Frontend
- **Authentication pages**:
  - LoginPage - Email/Password login form
  - RegisterPage - User registration form
- **Zustand store** (`authStore.ts`):
  - Email/Password registration
  - Email/Password login
  - Google OAuth integration
  - Persistent auth state (localStorage)
- **API client** (`authWeb.ts`):
  - Axios-based client with JWT interceptors
  - Type-safe API methods
- **Auth hook** (`useAuth.ts`):
  - Auto-login logic for Telegram WebApp
  - Dev mode support (manual login)
  - Computed values (hasCredits, canUseFreemium, hasActiveSubscription)

#### Database
- **Migration**: Updated `auth_provider_enum` to uppercase values
- **Backward compatibility**: Existing Telegram users preserved

### Fixed

1. **Missing email-validator package**
   - Installed `email-validator` for Pydantic EmailStr support

2. **Pydantic forward reference error**
   - Added `from __future__ import annotations`
   - Moved `UserProfile` class to top of file

3. **Missing auth routes (404)**
   - Added LoginPage and RegisterPage routes to App.tsx

4. **API endpoint mismatch**
   - Updated frontend API client to use `/api/v1/auth-web/` prefix

5. **Router prefix mismatch**
   - Changed backend router prefix from `/auth` to `/auth-web`

6. **AuthProvider enum mismatch**
   - Synchronized Python enum and database enum to uppercase
   - Updated database enum: `email` → `EMAIL`, etc.

7. **Cached statement error**
   - Added documentation about backend restart after schema changes

8. **useAuth hook errors**
   - Fixed method names: `login` → `loginWithEmail`, etc.
   - Added dev mode auto-login skip logic

### Tested
- ✅ E2E testing with Playwright MCP
- ✅ Email/Password registration flow
- ✅ Email/Password login flow
- ✅ JWT token persistence
- ✅ Protected routes with authentication
- ✅ Password hashing and validation

### Documentation
- Created comprehensive implementation report: `docs/WEB_AUTH_IMPLEMENTATION.md`
- Updated README.md with web auth information
- Added troubleshooting guide for common issues

---

## [0.11.3] - 2025-11-17

### Fixed - Cache Busting for Telegram WebApp

#### Frontend
- Implemented cache busting for production builds
- Added version query parameter to asset URLs
- Updated nginx configuration for proper cache control

#### Deployment
- Updated deployment scripts with cache busting support
- Added version tracking in deployment process

---

## [0.11.0] - 2025-11-15

### Added - Initial Release

#### Core Features
- Virtual clothing try-on with AI
- AI-powered image editing with chat assistant
- Freemium model (10 actions/month with watermark)
- Subscription system (Basic, Pro, Premium)
- Credit purchase system
- Referral program (+10 credits per referral)

#### Backend
- FastAPI async backend
- PostgreSQL database with SQLAlchemy ORM
- Celery + Redis for async tasks
- Alembic migrations
- kie.ai integration (Nano Banana)
- OpenRouter integration (Claude Haiku)
- YuKassa payment integration
- Telegram WebApp authentication

#### Frontend
- React 18 with TypeScript
- Vite build system
- Tailwind CSS styling
- Zustand state management
- Telegram WebApp SDK integration
- Responsive design
- Progressive Web App features

#### Security
- HMAC SHA-256 validation for Telegram initData
- JWT tokens for API sessions
- File validation (MIME + magic bytes)
- Rate limiting (10 req/min/user)
- SQL injection protection via ORM
- XSS sanitization
- GDPR compliance (auto-delete files)

---

## Version History

- **0.12.2** (2025-11-18) - Virtual Try-On Critical Bug Fix + E2E Testing
- **0.12.1** (2025-11-18) - Credits and Virtual Try-On Fixes
- **0.12.0** (2025-11-18) - Web Authentication System
- **0.11.3** (2025-11-17) - Cache Busting Fix
- **0.11.0** (2025-11-15) - Initial Release

---

**Note**: For detailed technical documentation of version 0.12.0, see [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md)
