"""
Сервис для управления кредитами пользователей.

Логика списания/начисления кредитов, проверка баланса и Freemium лимитов.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.user import User, UserRole
from app.models.payment import Payment
import logging

logger = logging.getLogger(__name__)


class InsufficientCreditsError(Exception):
    """Недостаточно кредитов для операции"""
    pass


class FreemiumLimitExceededError(Exception):
    """Превышен лимит Freemium"""
    pass


async def check_user_can_perform_action(
    user: User,
    credits_cost: int
) -> tuple[bool, str]:
    """
    Проверить, может ли пользователь выполнить действие.

    Args:
        user: Объект пользователя
        credits_cost: Стоимость действия в кредитах

    Returns:
        tuple[bool, str]: (can_perform, payment_method)
            - can_perform: True если может выполнить
            - payment_method: "credits", "subscription", "freemium", "admin"

    Raises:
        HTTPException: Если пользователь не может выполнить действие
    """
    # 0. Админы имеют безлимитный доступ (учитываем возможное отсутствие SUPER_ADMIN в старых сборках)
    super_admin_role = getattr(UserRole, "SUPER_ADMIN", None)
    if user.role in [UserRole.ADMIN, super_admin_role]:
        logger.info(f"✅ Admin bypass for user {user.id} (role={user.role.value})")
        return True, "admin"

    # 1. Проверка подписки (1 действие)
    if user.subscription_type and user.subscription_end:
        if user.subscription_end > datetime.utcnow():
            if user.subscription_ops_used < user.subscription_ops_limit:
                return True, "subscription"

    # 2. Проверка кредитов
    if user.balance_credits >= credits_cost:
        return True, "credits"

    # Пользователь не может выполнить действие
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "error": "NOT_ENOUGH_BALANCE",
            "message": "Недостаточно ⭐️звёзд/действий. Пополните баланс или оформите подписку.",
            "balance_credits": user.balance_credits,
            "credits_required": credits_cost,
        }
    )


async def deduct_credits(
    session: AsyncSession,
    user: User,
    credits_cost: int,
    generation_id: Optional[int] = None
) -> dict:
    """
    Списать кредиты с баланса пользователя.

    Функция автоматически определяет способ оплаты (кредиты, подписка, Freemium)
    и выполняет соответствующее списание.

    Args:
        session: SQLAlchemy async session
        user: Объект пользователя
        credits_cost: Стоимость в кредитах
        generation_id: ID генерации (опционально, для логирования)

    Returns:
        dict: Информация о списании

    Raises:
        HTTPException: Если не удалось списать кредиты
    """
    # Проверка возможности выполнения
    can_perform, payment_method = await check_user_can_perform_action(
        user,
        credits_cost
    )

    if not can_perform:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Недостаточно ⭐️звёзд"
        )

    # Списание в зависимости от метода оплаты
    if payment_method == "admin":
        # Админы не тратят кредиты - безлимитный доступ
        logger.info(
            f"💳 Credits NOT deducted for admin {user.id} "
            f"(role={user.role.value}, generation_id={generation_id})"
        )
        pass

    elif payment_method == "credits":
        user.balance_credits -= credits_cost

    elif payment_method == "subscription":
        user.subscription_ops_used += 1

    await session.commit()
    await session.refresh(user)

    return {
        "payment_method": payment_method,
        "credits_spent": credits_cost if payment_method == "credits" else 0,
        "balance_credits": user.balance_credits,
        "freemium_actions_used": user.freemium_actions_used,
        "freemium_actions_remaining": (
            getattr(settings, "FREEMIUM_ACTIONS_PER_MONTH", 10) -
            user.freemium_actions_used
        ),
    }


async def award_credits(
    session: AsyncSession,
    user_id: int,
    credits: int,
    payment_id: str,
    idempotency_key: str
) -> dict:
    """
    Начислить кредиты пользователю.

    Функция использует idempotency_key для предотвращения дублирования начислений.

    Args:
        session: SQLAlchemy async session
        user_id: ID пользователя
        credits: Количество кредитов для начисления
        payment_id: ID платежа (yookassa_id)
        idempotency_key: Ключ идемпотентности

    Returns:
        dict: Информация о начислении

    Raises:
        HTTPException: Если начисление уже было выполнено
    """
    # Проверка идемпотентности
    stmt = select(Payment).where(
        Payment.idempotency_key == idempotency_key
    )
    result = await session.execute(stmt)
    existing_payment = result.scalar_one_or_none()

    if existing_payment:
        if existing_payment.status == "succeeded":
            # Платеж уже был обработан
            return {
                "status": "already_processed",
                "credits_awarded": 0,
                "message": "⭐️Звёзды по этому платежу уже начислены"
            }

    # Получение пользователя
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    # Начисление кредитов
    user.balance_credits += credits

    await session.commit()
    await session.refresh(user)

    return {
        "status": "success",
        "credits_awarded": credits,
        "balance_credits": user.balance_credits,
    }


async def award_subscription(
    session: AsyncSession,
    user_id: int,
    subscription_type: str,
    duration_days: int,
    payment_id: str
) -> dict:
    """
    Начислить подписку пользователю.

    Args:
        session: SQLAlchemy async session
        user_id: ID пользователя
        subscription_type: Тип подписки (basic, pro, premium)
        duration_days: Длительность в днях
        payment_id: ID платежа

    Returns:
        dict: Информация о начислении
    """
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    # Установка подписки
    plan_key = "standard" if subscription_type == "pro" else subscription_type
    tiers = settings.BILLING_SUBSCRIPTION_TIERS or {}
    plan = tiers.get(plan_key, {})
    ops_limit = plan.get("ops_limit") or plan.get("actions_limit") or user.subscription_ops_limit

    user.subscription_type = plan_key
    user.subscription_ops_limit = ops_limit
    user.subscription_ops_used = 0
    user.subscription_ops_reset_at = datetime.utcnow()
    user.subscription_started_at = datetime.utcnow()
    user.subscription_end = datetime.utcnow() + timedelta(days=duration_days)

    await session.commit()
    await session.refresh(user)

    return {
        "status": "success",
        "subscription_type": subscription_type,
        "subscription_end": user.subscription_end.isoformat(),
    }


def calculate_credits_for_tariff(tariff: str) -> int:
    """
    Рассчитать количество кредитов для тарифа.

    Args:
        tariff: Название тарифа

    Returns:
        int: Количество кредитов
    """
    tariffs = {
        "basic": 30,
        "standard": 60,
        "pro": 60,
        "premium": 120,
        "credits_20": 20,
        "credits_50": 50,
        "credits_100": 100,
        "credits_250": 250,
    }

    return tariffs.get(tariff, 0)


def calculate_price_for_tariff(tariff: str) -> Decimal:
    """
    Рассчитать цену для тарифа.

    Args:
        tariff: Название тарифа

    Returns:
        Decimal: Цена в рублях
    """
    prices = {
        "basic": Decimal("399.00"),
        "standard": Decimal("699.00"),
        "pro": Decimal("699.00"),
        "premium": Decimal("1290.00"),
        "credits_20": Decimal("199.00"),
        "credits_50": Decimal("449.00"),
        "credits_100": Decimal("799.00"),
        "credits_250": Decimal("1690.00"),
    }

    return prices.get(tariff, Decimal("0.00"))
