"""
Authentication API endpoints.

Endpoints:
- POST /auth/telegram - Авторизация через Telegram WebApp initData
- GET /auth/me - Получение текущего профиля пользователя
"""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, DBSession
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import (
    LoginResponse,
    TelegramAuthRequest,
    UserProfile,
    UserProfileResponse,
)
from app.utils.jwt import create_user_access_token
from app.utils.referrals import generate_referral_code
from app.utils.telegram import TelegramInitDataError, validate_telegram_init_data
from app.services.billing_v5 import BillingV5Service

router = APIRouter(prefix="/auth", tags=["Authentication"])


def user_to_profile(user: User) -> UserProfile:
    """
    Конвертация User модели в UserProfile schema.

    Args:
        user: Объект пользователя из БД

    Returns:
        UserProfile: Pydantic модель профиля
    """
    # Генерируем временный реферальный код (позже добавим в БД)
    referral_code = generate_referral_code(user.id)

    return UserProfile(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        language_code=None,  # Добавим в модель позже
        balance_credits=user.balance_credits,
        subscription_type=user.subscription_type.value if user.subscription_type else None,
        subscription_started_at=user.subscription_started_at,
        subscription_expires_at=user.subscription_end,
        subscription_ops_limit=user.subscription_ops_limit,
        subscription_ops_used=user.subscription_ops_used,
        subscription_ops_remaining=user.actions_remaining,
        subscription_ops_reset_at=user.subscription_ops_reset_at,
        freemium_actions_used=user.freemium_actions_used,
        freemium_reset_at=user.freemium_reset_at or datetime.utcnow(),
        freemium_actions_remaining=0,
        freemium_actions_limit=0,
        can_use_freemium=False,
        free_trial_granted=user.free_trial_granted,
        is_premium=False,  # Добавим в модель позже
        is_blocked=user.is_banned,
        created_at=user.created_at,
        last_activity_at=user.updated_at,  # Пока используем updated_at
        referral_code=referral_code,
        referred_by_id=None,  # Добавим через relationship позже
    )


@router.post("/telegram", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login_with_telegram(
    request: TelegramAuthRequest,
    db: DBSession,
) -> LoginResponse:
    """
    Авторизация через Telegram WebApp.

    Проверяет initData от Telegram, создаёт или обновляет пользователя,
    и возвращает JWT токен.

    Args:
        request: Запрос с initData
        db: Database session

    Returns:
        LoginResponse: JWT токен и профиль пользователя

    Raises:
        HTTPException 401: Если initData невалидный
    """
    # Валидация initData
    try:
        telegram_data = validate_telegram_init_data(
            request.init_data,
            settings.TELEGRAM_BOT_TOKEN,
        )
    except TelegramInitDataError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Telegram initData: {str(e)}",
        )

    created_new_user = False

    # Ищем существующего пользователя
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_data["telegram_id"])
    )
    user = result.scalar_one_or_none()

    if user:
        # Обновляем данные существующего пользователя
        user.username = telegram_data.get("username")
        user.first_name = telegram_data.get("first_name")
        user.last_name = telegram_data.get("last_name")
        user.updated_at = datetime.utcnow()

        # Сбрасываем Freemium счётчик, если нужно
        user.reset_freemium_if_needed()

        await db.commit()
        await db.refresh(user)

    else:
        # Создаём нового пользователя
        user = User(
            telegram_id=telegram_data["telegram_id"],
            username=telegram_data.get("username"),
            first_name=telegram_data.get("first_name"),
            last_name=telegram_data.get("last_name"),
            balance_credits=0,
            freemium_actions_used=0,
            freemium_reset_at=datetime.utcnow(),
            is_active=True,
            is_banned=False,
        )

        created_new_user = True
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Free trial при регистрации (однократно)
    if created_new_user:
        billing = BillingV5Service(db)
        try:
            await billing.grant_free_trial(
                user,
                meta={"reason": "telegram_signup"},
            )
        except Exception as e:  # не блокируем вход из-за бонуса
            logger = logging.getLogger(__name__)
            logger.error("Failed to grant free trial for user %s: %s", user.id, e)

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        telegram_id=user.telegram_id,
    )

    # Формируем ответ
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
    )


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
