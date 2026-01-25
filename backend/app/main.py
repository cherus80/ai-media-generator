"""
FastAPI Main Application.

Точка входа для AI Generator backend.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.db import init_db, close_db
from app.services.openrouter import close_openrouter_client
from app.services.yukassa import close_yukassa_client
from app.utils.rate_limit import (
    init_rate_limiter,
    close_rate_limiter,
    is_rate_limited,
    resolve_identity,
    rate_limiter_ready,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Lifespan events для FastAPI.

    Startup:
    - Инициализация БД (создание таблиц)
    - Логирование в Sentry (опционально)

    Shutdown:
    - Закрытие соединений с БД
    - Закрытие HTTP клиентов
    """
    # Startup
    print("🚀 Starting AI Generator backend...")

    # Регистрация HEIC/HEIF поддержки для iPhone фото
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
        print("📸 HEIC/HEIF image support registered (iPhone photos)")
    except ImportError:
        print("⚠️  pillow-heif not installed, HEIC/HEIF formats not supported")

    # Инициализация БД
    if not settings.is_production:
        print("📊 Initializing database...")
        await init_db()

    # Инициализация rate limiting (Redis)
    await init_rate_limiter()

    # Инициализация Sentry (опционально)
    if settings.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1 if settings.is_production else 1.0,
        )
        print("📡 Sentry initialized")

    print(f"✅ Backend started in {settings.ENVIRONMENT} mode")

    yield

    # Shutdown
    print("🛑 Shutting down backend...")

    # Закрытие БД
    await close_db()

    # Закрытие HTTP клиентов
    await close_openrouter_client()
    await close_yukassa_client()
    await close_rate_limiter()

    print("✅ Backend shutdown complete")


# Создание FastAPI приложения
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.12.2",
    description="AI Generator — Web App с Email/Password, Google OAuth и виртуальной примеркой",
    docs_url="/docs" if settings.is_debug else None,
    redoc_url="/redoc" if settings.is_debug else None,
    openapi_url="/openapi.json" if settings.is_debug else None,
    lifespan=lifespan,
)


# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend dev
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # fallback Vite port
        "http://127.0.0.1:5174",
        "https://ai-bot-media.mix4.ru",  # Production frontend
        "https://api.ai-bot-media.mix4.ru",  # Production API
        "https://ai-generator.mix4.ru",  # New production frontend
        "https://api.ai-generator.mix4.ru",  # New production API
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# GZip Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Middleware для rate limiting
@app.middleware("http")
async def rate_limit_requests(request: Request, call_next):
    path = request.url.path

    if not path.startswith("/api/"):
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    if not rate_limiter_ready():
        return await call_next(request)

    scope = "api"
    limit_per_minute = settings.API_RATE_LIMIT_PER_MINUTE
    limit_per_second = settings.API_RATE_LIMIT_BURST_PER_SECOND

    if path.startswith("/api/v1/auth-web"):
        scope = "auth"
        limit_per_minute = settings.API_RATE_LIMIT_AUTH_PER_MINUTE
    elif path.startswith("/api/v1/editing/chat"):
        scope = "editing_chat"
        limit_per_minute = settings.API_RATE_LIMIT_EDITING_CHAT_PER_MINUTE
    elif path.startswith("/api/v1/editing/generate"):
        scope = "editing_generate"
        limit_per_minute = settings.API_RATE_LIMIT_EDITING_GENERATE_PER_MINUTE
    elif path.startswith("/api/v1/fitting/generate"):
        scope = "fitting_generate"
        limit_per_minute = settings.API_RATE_LIMIT_FITTING_GENERATE_PER_MINUTE

    identity = resolve_identity(request)

    if await is_rate_limited(f"rl:{scope}:m:{identity}", limit_per_minute, 60):
        return JSONResponse(
            status_code=429,
            content={"detail": "Слишком много запросов. Попробуйте позже."},
            headers={"Retry-After": "60"},
        )

    if await is_rate_limited(f"rl:{scope}:s:{identity}", limit_per_second, 1):
        return JSONResponse(
            status_code=429,
            content={"detail": "Слишком много запросов. Попробуйте позже."},
            headers={"Retry-After": "1"},
        )

    return await call_next(request)


# Middleware для отслеживания активности пользователей
@app.middleware("http")
async def track_user_activity(request: Request, call_next):
    """
    Middleware для обновления last_active_at у авторизованных пользователей.

    Обновляет время последней активности при каждом запросе с валидным JWT токеном.
    """
    response = await call_next(request)

    # Проверяем, есть ли Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from app.utils.jwt import verify_token
            from app.db.session import AsyncSessionLocal
            from app.models.user import User
            from sqlalchemy import select

            # Извлекаем и проверяем токен
            token = auth_header.split(" ")[1]
            payload = verify_token(token)

            if payload and "user_id" in payload:
                user_id = payload["user_id"]

                # Обновляем last_active_at в БД
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(User).where(User.id == user_id)
                    )
                    user = result.scalar_one_or_none()

                    if user:
                        user.last_active_at = datetime.now(timezone.utc)
                        await db.commit()
        except Exception:
            # Игнорируем ошибки в middleware, чтобы не нарушать основной запрос
            pass

    return response


# Static files для uploads (необходимо для виртуальной примерки)
# Создаём директорию uploads если её нет
uploads_path = Path(settings.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


# Health check endpoint
@app.get("/")
async def root():
    """Root endpoint — health check"""
    return {
        "status": "ok",
        "service": "AI Generator API",
        "version": "0.12.0",
        "environment": settings.ENVIRONMENT,
        "auth_methods": ["email", "google", "telegram_legacy"],
    }


@app.get("/health")
async def health_check():
    """Health check endpoint для мониторинга"""
    return {
        "status": "healthy",
        "version": "0.12.0",
        "database": "connected",  # TODO: добавить реальную проверку
        "redis": "connected",      # TODO: добавить реальную проверку
    }


# Подключение API роутеров
from app.api.v1.endpoints import (
    auth,
    auth_web,
    fitting,
    editing,
    payments,
    referrals,
    admin,
    billing,
    content,
    admin_content,
    notifications,
    admin_notifications,
)

# Legacy Telegram auth (для обратной совместимости)
app.include_router(
    auth.router,
    prefix=settings.API_V1_PREFIX,
)

# Web auth (Email/Password + Google OAuth)
app.include_router(
    auth_web.router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    fitting.router,
    prefix=f"{settings.API_V1_PREFIX}/fitting",
    tags=["fitting"],
)

app.include_router(
    editing.router,
    prefix=f"{settings.API_V1_PREFIX}/editing",
    tags=["editing"],
)

app.include_router(
    payments.router,
    prefix=f"{settings.API_V1_PREFIX}/payments",
    tags=["payments"],
)

app.include_router(
    referrals.router,
    prefix=f"{settings.API_V1_PREFIX}/referrals",
    tags=["referrals"],
)

app.include_router(
    content.router,
    prefix=f"{settings.API_V1_PREFIX}/content",
    tags=["content"],
)

app.include_router(
    notifications.router,
    prefix=f"{settings.API_V1_PREFIX}/notifications",
    tags=["notifications"],
)

app.include_router(
    admin.router,
    prefix=f"{settings.API_V1_PREFIX}/admin",
    tags=["admin"],
)

app.include_router(
    admin_content.router,
    prefix=f"{settings.API_V1_PREFIX}/admin",
    tags=["admin"],
)

app.include_router(
    admin_notifications.router,
    prefix=f"{settings.API_V1_PREFIX}/admin",
    tags=["admin"],
)

app.include_router(
    billing.router,
    prefix=f"{settings.API_V1_PREFIX}/billing",
    tags=["billing"],
)

# Mock Payment Emulator (только для разработки)
if settings.PAYMENT_MOCK_MODE:
    from app.api.v1.endpoints import mock_payments
    app.include_router(
        mock_payments.router,
        prefix=f"{settings.API_V1_PREFIX}/mock-payments",
        tags=["mock-payments"],
    )
    print("🔧 Mock Payment Emulator enabled")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_debug,
        log_level="info" if settings.is_debug else "warning",
    )
