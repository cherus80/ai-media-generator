"""
Web Authentication API endpoints.

Endpoints:
- POST /auth/register - Регистрация через Email/Password
- POST /auth/login - Вход через Email/Password
- POST /auth/google - Вход через Google OAuth
- GET /auth/me - Получение текущего профиля пользователя
- POST /auth/logout - Выход (для будущего расширения)
"""

import secrets
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, DBSession
from app.core.config import settings
from app.models.user import User, AuthProvider
from app.schemas.auth_web import (
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    GoogleOAuthRequest,
    GoogleOAuthResponse,
    UserProfile,
    UserProfileResponse,
)
from app.utils.jwt import create_user_access_token
from app.utils.password import hash_password, verify_password, is_strong_password
from app.utils.google_oauth import verify_google_id_token, GoogleOAuthError

router = APIRouter(prefix="/auth-web", tags=["Web Authentication"])


def generate_referral_code(user_id: int) -> str:
    """
    Генерация уникального реферального кода.

    Args:
        user_id: User ID

    Returns:
        str: Уникальный реферальный код (8 символов)
    """
    random_part = secrets.token_urlsafe(6)[:6]
    return f"{user_id % 1000:03d}{random_part}".upper()


def user_to_profile(user: User) -> UserProfile:
    """
    Конвертация User модели в UserProfile schema.

    Args:
        user: Объект пользователя из БД

    Returns:
        UserProfile: Pydantic модель профиля
    """
    referral_code = generate_referral_code(user.id)

    return UserProfile(
        id=user.id,
        auth_provider=user.auth_provider.value,
        email=user.email,
        email_verified=user.email_verified,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        balance_credits=user.balance_credits,
        subscription_type=user.subscription_type.value if user.subscription_type else None,
        subscription_expires_at=user.subscription_end,
        freemium_actions_used=user.freemium_actions_used,
        freemium_reset_at=user.freemium_reset_at or datetime.utcnow(),
        can_use_freemium=user.can_use_freemium,
        is_blocked=user.is_banned,
        created_at=user.created_at,
        last_activity_at=user.updated_at,
        referral_code=referral_code,
        referred_by_id=None,  # TODO: Add через relationship позже
    )


# ============================================================================
# Email/Password Registration & Login
# ============================================================================


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register_with_email(
    request: RegisterRequest,
    db: DBSession,
) -> LoginResponse:
    """
    Регистрация нового пользователя через Email/Password.

    Args:
        request: Данные для регистрации
        db: Database session

    Returns:
        LoginResponse: JWT токен и профиль пользователя

    Raises:
        HTTPException 400: Если email уже занят или пароль слабый
    """
    # Проверка, что email не занят
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Дополнительная проверка силы пароля (уже есть в схеме, но на всякий случай)
    is_valid, error_msg = is_strong_password(request.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    # Хешируем пароль
    password_hash = hash_password(request.password)

    # Создаём нового пользователя
    user = User(
        email=request.email,
        email_verified=False,  # TODO: Добавить email verification позже
        password_hash=password_hash,
        auth_provider=AuthProvider.EMAIL,
        first_name=request.first_name,
        last_name=request.last_name,
        username=request.email.split('@')[0],  # Временный username из email
        balance_credits=100,  # 100 тестовых кредитов при регистрации
        freemium_actions_used=0,
        freemium_reset_at=datetime.utcnow(),
        is_active=True,
        is_banned=False,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Гарантируем бонус 100 кредитов (на случай сбоя установки значения по умолчанию)
    if user.balance_credits < 100:
        user.balance_credits = 100
        await db.commit()
        await db.refresh(user)

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        email=user.email,
    )

    # Формируем ответ
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
    )


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login_with_email(
    request: LoginRequest,
    db: DBSession,
) -> LoginResponse:
    """
    Вход через Email/Password.

    Args:
        request: Данные для входа
        db: Database session

    Returns:
        LoginResponse: JWT токен и профиль пользователя

    Raises:
        HTTPException 401: Если email не найден или пароль неверный
        HTTPException 403: Если пользователь забанен
    """
    # Ищем пользователя по email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()

    # Проверка существования пользователя и правильности пароля
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Проверка, что пользователь не забанен
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked",
        )

    # Обновляем время активности
    user.updated_at = datetime.utcnow()

    # Сбрасываем Freemium счётчик, если нужно
    user.reset_freemium_if_needed()

    await db.commit()
    await db.refresh(user)

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        email=user.email,
    )

    # Формируем ответ
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
    )


# ============================================================================
# Google OAuth
# ============================================================================


@router.post("/google", response_model=GoogleOAuthResponse, status_code=status.HTTP_200_OK)
async def login_with_google(
    request: GoogleOAuthRequest,
    db: DBSession,
) -> GoogleOAuthResponse:
    """
    Вход/Регистрация через Google OAuth.

    Args:
        request: Google ID token
        db: Database session

    Returns:
        GoogleOAuthResponse: JWT токен, профиль пользователя, флаг is_new_user

    Raises:
        HTTPException 401: Если Google ID token невалидный
        HTTPException 403: Если пользователь забанен
        HTTPException 503: Если Google OAuth не настроен
    """
    # Проверка настройки Google OAuth
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured. Please use email/password authentication.",
        )

    # Валидация Google ID token
    try:
        google_user_info = verify_google_id_token(request.id_token)
    except GoogleOAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google ID token: {str(e)}",
        )

    # Извлекаем данные из Google
    google_sub = google_user_info['sub']
    email = google_user_info.get('email')
    email_verified = google_user_info.get('email_verified', False)
    first_name = google_user_info.get('given_name')
    last_name = google_user_info.get('family_name')
    full_name = google_user_info.get('name')

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Google. Please allow email access.",
        )

    # Ищем существующего пользователя по Google ID или email
    result = await db.execute(
        select(User).where(
            (User.oauth_provider_id == google_sub) |
            (User.email == email)
        )
    )
    user = result.scalar_one_or_none()

    is_new_user = False

    if user:
        # Обновляем существующего пользователя
        # Если пользователь был с email/password, переключаем на Google OAuth
        if user.auth_provider == AuthProvider.EMAIL:
            user.auth_provider = AuthProvider.GOOGLE
            user.oauth_provider_id = google_sub

        # Обновляем данные профиля
        user.email = email
        user.email_verified = email_verified
        user.first_name = first_name or user.first_name
        user.last_name = last_name or user.last_name
        user.updated_at = datetime.utcnow()

        # Сбрасываем Freemium счётчик, если нужно
        user.reset_freemium_if_needed()

        await db.commit()
        await db.refresh(user)

    else:
        # Создаём нового пользователя
        is_new_user = True

        user = User(
            email=email,
            email_verified=email_verified,
            auth_provider=AuthProvider.GOOGLE,
            oauth_provider_id=google_sub,
            first_name=first_name,
            last_name=last_name,
            username=email.split('@')[0],  # Временный username из email
            balance_credits=100,  # 100 тестовых кредитов при регистрации
            freemium_actions_used=0,
            freemium_reset_at=datetime.utcnow(),
            is_active=True,
            is_banned=False,
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        if user.balance_credits < 100:
            user.balance_credits = 100
            await db.commit()
            await db.refresh(user)

    # Проверка, что пользователь не забанен
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked",
        )

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        email=user.email,
    )

    # Формируем ответ
    return GoogleOAuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
        is_new_user=is_new_user,
    )


# ============================================================================
# Current User Profile
# ============================================================================


@router.get("/me", response_model=UserProfileResponse, status_code=status.HTTP_200_OK)
async def get_current_user_profile(
    current_user: CurrentUser,
) -> UserProfileResponse:
    """
    Получение профиля текущего авторизованного пользователя.

    Args:
        current_user: Текущий пользователь из JWT токена

    Returns:
        UserProfileResponse: Профиль пользователя
    """
    return UserProfileResponse(
        user=user_to_profile(current_user)
    )
