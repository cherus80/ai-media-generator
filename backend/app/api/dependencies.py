"""
API Dependencies — зависимости для FastAPI endpoints.

Содержит dependency functions для:
- Получение текущего пользователя из JWT токена
- Проверка авторизации
- Получение DB сессии
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, UserRole, AuthProvider
from app.utils.jwt import JWTTokenError, verify_token

# HTTP Bearer схема для Authorization header
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Dependency для получения текущего авторизованного пользователя.

    Проверяет JWT токен из Authorization header и загружает пользователя из БД.

    Args:
        credentials: HTTP Bearer credentials (из Authorization header)
        db: Async database session

    Returns:
        User: Объект текущего пользователя

    Raises:
        HTTPException 401: Если токен невалидный или пользователь не найден
        HTTPException 403: Если пользователь заблокирован
    """
    # Извлекаем токен
    token = credentials.credentials

    try:
        # Проверяем и декодируем токен
        payload = verify_token(token)

        if not payload or "user_id" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = payload["user_id"]

    except JWTTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Загружаем пользователя из БД
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Проверяем, не заблокирован ли пользователь
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned",
        )

    # Обновляем время последней активности
    # (это будет делаться через middleware или другую логику)
    # user.last_activity_at = datetime.utcnow()
    # await db.commit()

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Dependency для получения только активных пользователей.

    Args:
        current_user: Текущий пользователь из get_current_user

    Returns:
        User: Объект активного пользователя

    Raises:
        HTTPException 403: Если пользователь не активен
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not active",
        )

    return current_user


async def get_current_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency для получения только администраторов.

    Проверяет, что текущий пользователь имеет роль ADMIN или SUPER_ADMIN.

    Args:
        current_user: Текущий активный пользователь из get_current_active_user

    Returns:
        User: Объект пользователя с ролью администратора

    Raises:
        HTTPException 403: Если у пользователя нет прав администратора
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. Insufficient permissions.",
        )

    return current_user


async def get_current_super_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency для получения только главных администраторов (SUPER_ADMIN).

    Используется для операций, доступных только super admin:
    - Назначение других администраторов
    - Управление правами доступа

    Args:
        current_user: Текущий активный пользователь из get_current_active_user

    Returns:
        User: Объект пользователя с ролью SUPER_ADMIN

    Raises:
        HTTPException 403: Если у пользователя нет прав главного администратора
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required. Only the main administrator can perform this action.",
        )

    return current_user


async def require_verified_email(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency для проверки, что email пользователя подтверждён.

    Блокирует доступ к функциям приложения (примерка, редактирование, платежи)
    для пользователей с неподтверждённым email.

    Args:
        current_user: Текущий активный пользователь из get_current_active_user

    Returns:
        User: Объект пользователя с подтверждённым email

    Raises:
        HTTPException 403: Если email пользователя не подтверждён
    """
    # Администраторы освобождены от проверки email
    if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        return current_user

    # OAuth пользователи (Google) считаются верифицированными автоматически
    if current_user.auth_provider == AuthProvider.google:
        return current_user

    # Проверка email_verified для обычных пользователей
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Email verification required. "
                "Please verify your email address to use this feature. "
                "Check your inbox for the verification link or request a new one."
            ),
        )

    return current_user


# Type aliases для удобства
CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
VerifiedUser = Annotated[User, Depends(require_verified_email)]
AdminUser = Annotated[User, Depends(get_current_admin)]
SuperAdminUser = Annotated[User, Depends(get_current_super_admin)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
