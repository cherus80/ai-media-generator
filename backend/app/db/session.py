"""
Async Database Session для SQLAlchemy.

Создание и управление асинхронными сессиями БД.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings


# Создание async engine
engine_kwargs = {
    "echo": settings.is_debug,  # Логирование SQL запросов в debug режиме
    "future": True,
    "pool_pre_ping": True,  # Проверка соединения перед использованием
    "poolclass": NullPool if settings.ENVIRONMENT == "testing" else None,
}

if settings.ENVIRONMENT != "testing":
    engine_kwargs.update(
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
    )

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

# Создание session maker
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Alias для использования в Celery задачах
async_session = AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency для получения async database session.

    Usage:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Инициализация базы данных.

    Создает все таблицы, если они не существуют.
    В production использовать Alembic миграции!
    """
    from app.db.base import Base  # noqa
    # Импорт всех моделей для регистрации в metadata
    from app.models import user, generation, chat, payment, referral, user_consent, instruction, generation_example  # noqa

    async with engine.begin() as conn:
        # Создание всех таблиц
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """
    Закрытие соединения с БД.

    Вызывается при shutdown приложения.
    """
    await engine.dispose()
