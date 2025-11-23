"""
API endpoints для реферальной программы
"""

import hashlib
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.referral import Referral
from app.models.user import User
from app.schemas.referral import (
    ReferralLinkResponse,
    ReferralRegisterRequest,
    ReferralRegisterResponse,
    ReferralStatsResponse,
    ReferralItem,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def generate_referral_code(user_id: int) -> str:
    """
    Генерация уникального реферального кода для пользователя

    Args:
        user_id: ID пользователя

    Returns:
        Реферальный код (хеш от user_id + секретный ключ)
    """
    secret = settings.SECRET_KEY
    raw = f"{user_id}:{secret}"
    hash_obj = hashlib.sha256(raw.encode())
    # Берём первые 8 символов хеша для краткости
    return hash_obj.hexdigest()[:8].upper()


def get_referral_link(referral_code: str) -> str:
    """
    Получить полную реферальную ссылку

    Args:
        referral_code: Реферальный код

    Returns:
        Полная ссылка для приглашения
    """
    # Веб-ссылка на страницу регистрации с реферальным кодом
    frontend_url = settings.FRONTEND_URL
    return f"{frontend_url}/register?ref={referral_code}"


@router.get("/link", response_model=ReferralLinkResponse)
async def get_referral_link_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReferralLinkResponse:
    """
    Получить реферальную ссылку текущего пользователя

    Returns:
        Реферальная ссылка, код и статистика
    """
    try:
        # Генерируем реферальный код
        referral_code = generate_referral_code(current_user.id)

        # Получаем статистику рефералов
        stmt = select(func.count(Referral.id), func.sum(Referral.credits_awarded)).where(
            Referral.referrer_id == current_user.id
        )
        result = await db.execute(stmt)
        total_referrals, total_earned = result.one()

        # Если нет рефералов, total_earned может быть None
        total_earned = total_earned or 0

        return ReferralLinkResponse(
            referral_link=get_referral_link(referral_code),
            referral_code=referral_code,
            total_referrals=total_referrals or 0,
            total_earned=int(total_earned),
        )

    except Exception as e:
        logger.error(f"Failed to generate referral link for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить реферальную ссылку",
        )


@router.post("/register", response_model=ReferralRegisterResponse)
async def register_referral(
    request: ReferralRegisterRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReferralRegisterResponse:
    """
    Зарегистрировать нового пользователя по реферальной ссылке

    Args:
        request: Реферальный код пригласившего пользователя

    Returns:
        Результат регистрации
    """
    try:
        # Найти пользователя по реферальному коду
        # Нужно перебрать всех пользователей и проверить код (не оптимально, но работает)
        # В production лучше хранить referral_code в таблице users
        stmt = select(User)
        result = await db.execute(stmt)
        all_users = result.scalars().all()

        referrer = None
        for user in all_users:
            if generate_referral_code(user.id) == request.referral_code.upper():
                referrer = user
                break

        if not referrer:
            return ReferralRegisterResponse(
                success=False,
                message="Неверный реферальный код",
                bonus_credits=0,
            )

        # Проверка: нельзя пригласить самого себя
        if referrer.id == current_user.id:
            return ReferralRegisterResponse(
                success=False,
                message="Нельзя использовать свой собственный реферальный код",
                bonus_credits=0,
            )

        # Проверка: пользователь уже был приглашён кем-то другим
        stmt = select(Referral).where(Referral.referred_id == current_user.id)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return ReferralRegisterResponse(
                success=False,
                message="Вы уже зарегистрированы по реферальной ссылке",
                bonus_credits=0,
            )

        # Создаём реферальную запись
        referral = Referral(
            referrer_id=referrer.id,
            referred_id=current_user.id,
            credits_awarded=10,  # Бонус за реферала
            is_awarded=False,  # Начислится после первого действия реферала
        )

        db.add(referral)
        await db.commit()

        logger.info(
            f"User {current_user.id} registered via referral from user {referrer.id}"
        )

        return ReferralRegisterResponse(
            success=True,
            message="Вы успешно зарегистрированы по реферальной ссылке! "
            "Совершите первое действие, чтобы ваш друг получил бонус.",
            bonus_credits=0,  # Бонус получит реферер после первого действия
        )

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to register referral for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось зарегистрировать реферала",
        )


@router.get("/stats", response_model=ReferralStatsResponse)
async def get_referral_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReferralStatsResponse:
    """
    Получить статистику по рефералам текущего пользователя

    Returns:
        Статистика: количество рефералов, заработанные кредиты, список рефералов
    """
    try:
        # Генерируем реферальный код и ссылку
        referral_code = generate_referral_code(current_user.id)
        referral_link = get_referral_link(referral_code)

        # Получаем список рефералов
        stmt = (
            select(Referral, User)
            .join(User, Referral.referred_id == User.id)
            .where(Referral.referrer_id == current_user.id)
            .order_by(Referral.created_at.desc())
        )
        result = await db.execute(stmt)
        referrals_data = result.all()

        # Формируем список рефералов
        referrals = []
        total_earned = 0
        active_count = 0
        pending_count = 0

        for referral, referred_user in referrals_data:
            referrals.append(
                ReferralItem(
                    id=referral.id,
                    telegram_id=referred_user.telegram_id,
                    username=referred_user.username,
                    credits_awarded=referral.credits_awarded,
                    is_awarded=referral.is_awarded,
                    created_at=referral.created_at,
                )
            )

            if referral.is_awarded:
                total_earned += referral.credits_awarded
                active_count += 1
            else:
                pending_count += 1

        return ReferralStatsResponse(
            total_referrals=len(referrals),
            active_referrals=active_count,
            pending_referrals=pending_count,
            total_earned=total_earned,
            referrals=referrals,
            referral_link=referral_link,
            referral_code=referral_code,
        )

    except Exception as e:
        logger.error(f"Failed to get referral stats for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить статистику рефералов",
        )
