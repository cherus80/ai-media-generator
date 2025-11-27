"""
Сервис для биллинга и начисления кредитов/подписок.

Логика начисления после успешной оплаты через ЮKassa.
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.payment import Payment


logger = logging.getLogger(__name__)


DEFAULT_SUBSCRIPTION_TARIFFS = {
    "basic": {
        "name": "Basic",
        "price": Decimal("299.00"),
        "credits_amount": 50,
        "duration_days": 30,
        "description": "50 действий в месяц",
    },
    "premium": {
        "name": "Premium",
        "price": Decimal("499.00"),
        "credits_amount": 150,
        "duration_days": 30,
        "description": "150 действий в месяц",
        "is_popular": True,
    },
    "pro": {
        "name": "Pro",
        "price": Decimal("899.00"),
        "credits_amount": 500,
        "duration_days": 30,
        "description": "500 действий в месяц",
    },
}

# Пакеты кредитов
DEFAULT_CREDITS_PACKAGES = {
    "credits_100": {
        "name": "100 кредитов",
        "price": Decimal("199.00"),
        "credits_amount": 100,
        "description": "Разовая покупка кредитов",
    },
    "credits_300": {
        "name": "300 кредитов",
        "price": Decimal("499.00"),
        "credits_amount": 300,
        "description": "Разовая покупка кредитов",
    },
    "credits_1000": {
        "name": "1000 кредитов",
        "price": Decimal("1499.00"),
        "credits_amount": 1000,
        "description": "Разовая покупка кредитов",
        "is_popular": True,
    },
}


def _build_subscription_tariffs() -> dict:
    """
    Построить тарифы подписок из настроек (fallback на дефолт).
    """
    config = settings.BILLING_SUBSCRIPTION_TIERS or {}
    if not config:
        return DEFAULT_SUBSCRIPTION_TARIFFS

    tariffs: dict = {}
    for tariff_id, data in config.items():
        actions = data.get("ops_limit") or data.get("credits_amount") or data.get("credits") or 0
        price = Decimal(str(data.get("price", 0)))
        tariffs[tariff_id] = {
            "name": data.get("name") or tariff_id.capitalize(),
            "price": price,
            "credits_amount": actions,
            "duration_days": data.get("duration_days", 30),
            "description": data.get("description") or f"{actions} действий на {data.get('duration_days', 30)} дней",
            "is_popular": data.get("is_popular", False),
        }
    return tariffs


def _build_credit_packages() -> dict:
    """
    Построить пакеты кредитов из настроек (fallback на дефолт).
    """
    config = settings.BILLING_CREDIT_PACKAGES or {}
    if not config:
        return DEFAULT_CREDITS_PACKAGES

    packages: dict = {}
    for package_id, data in config.items():
        credits = data.get("credits") or data.get("credits_amount") or 0
        price = Decimal(str(data.get("price", 0)))
        packages[package_id] = {
            "name": data.get("name") or f"{credits} кредитов",
            "price": price,
            "credits_amount": credits,
            "description": data.get("description") or "Разовая покупка кредитов",
            "is_popular": data.get("is_popular", False),
        }
    return packages


# Тарифы подписок и пакеты кредитов (инициализация при импорте)
SUBSCRIPTION_TARIFFS = _build_subscription_tariffs()
CREDITS_PACKAGES = _build_credit_packages()


class BillingError(Exception):
    """Ошибка биллинга"""
    pass


class PaymentNotFoundError(BillingError):
    """Платёж не найден"""
    pass


class IdempotencyViolationError(BillingError):
    """Нарушение идемпотентности (платёж уже обработан)"""
    pass


def calculate_credits_for_tariff(
    payment_type: str,
    tariff_id: str
) -> int:
    """
    Рассчитать количество кредитов для тарифа.

    Args:
        payment_type: Тип платежа ("subscription" или "credits")
        tariff_id: ID тарифа

    Returns:
        int: Количество кредитов

    Raises:
        ValueError: Если тариф не найден
    """
    if payment_type == "subscription":
        if tariff_id not in SUBSCRIPTION_TARIFFS:
            raise ValueError(f"Unknown subscription tariff: {tariff_id}")
        return SUBSCRIPTION_TARIFFS[tariff_id]["credits_amount"]

    elif payment_type == "credits":
        if tariff_id not in CREDITS_PACKAGES:
            raise ValueError(f"Unknown credits package: {tariff_id}")
        return CREDITS_PACKAGES[tariff_id]["credits_amount"]

    else:
        raise ValueError(f"Unknown payment type: {payment_type}")


def calculate_price_for_tariff(
    payment_type: str,
    tariff_id: str
) -> Decimal:
    """
    Рассчитать стоимость тарифа.

    Args:
        payment_type: Тип платежа ("subscription" или "credits")
        tariff_id: ID тарифа

    Returns:
        Decimal: Стоимость в рублях

    Raises:
        ValueError: Если тариф не найден
    """
    if payment_type == "subscription":
        if tariff_id not in SUBSCRIPTION_TARIFFS:
            raise ValueError(f"Unknown subscription tariff: {tariff_id}")
        return SUBSCRIPTION_TARIFFS[tariff_id]["price"]

    elif payment_type == "credits":
        if tariff_id not in CREDITS_PACKAGES:
            raise ValueError(f"Unknown credits package: {tariff_id}")
        return CREDITS_PACKAGES[tariff_id]["price"]

    else:
        raise ValueError(f"Unknown payment type: {payment_type}")


async def award_credits(
    session: AsyncSession,
    user_id: int,
    credits: int,
    payment_id: str,
    idempotency_key: str
) -> User:
    """
    Начислить кредиты пользователю.

    Функция идемпотентна: повторный вызов с тем же idempotency_key не начислит кредиты дважды.

    Args:
        session: SQLAlchemy async session
        user_id: ID пользователя
        credits: Количество кредитов для начисления
        payment_id: UUID платежа в ЮKassa
        idempotency_key: Ключ идемпотентности

    Returns:
        User: Обновлённый пользователь

    Raises:
        PaymentNotFoundError: Если платёж не найден
        IdempotencyViolationError: Если платёж уже обработан
    """
    # Проверка существования платежа
    stmt = select(Payment).where(Payment.payment_id == payment_id)
    result = await session.execute(stmt)
    payment = result.scalar_one_or_none()

    if not payment:
        raise PaymentNotFoundError(f"Payment {payment_id} not found")

    # Проверка идемпотентности
    if payment.status == "succeeded" and payment.idempotency_key == idempotency_key:
        logger.warning(
            f"Payment {payment_id} already processed (idempotency key: {idempotency_key})"
        )
        raise IdempotencyViolationError(
            f"Payment {payment_id} already processed"
        )

    # Получение пользователя
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise ValueError(f"User {user_id} not found")

    # Начисление кредитов
    user.balance_credits += credits
    payment.status = "succeeded"
    payment.completed_at = datetime.utcnow()
    payment.idempotency_key = idempotency_key

    await session.commit()
    await session.refresh(user)

    logger.info(
        f"Awarded {credits} credits to user {user_id} (payment: {payment_id})"
    )

    return user


async def award_subscription(
    session: AsyncSession,
    user_id: int,
    subscription_type: str,
    duration_days: int,
    payment_id: str,
    idempotency_key: str
) -> User:
    """
    Начислить подписку пользователю.

    Функция идемпотентна: повторный вызов с тем же idempotency_key не начислит подписку дважды.

    Args:
        session: SQLAlchemy async session
        user_id: ID пользователя
        subscription_type: Тип подписки (basic, premium, pro)
        duration_days: Длительность подписки в днях
        payment_id: UUID платежа в ЮKassa
        idempotency_key: Ключ идемпотентности

    Returns:
        User: Обновлённый пользователь

    Raises:
        PaymentNotFoundError: Если платёж не найден
        IdempotencyViolationError: Если платёж уже обработан
    """
    # Проверка существования платежа
    stmt = select(Payment).where(Payment.payment_id == payment_id)
    result = await session.execute(stmt)
    payment = result.scalar_one_or_none()

    if not payment:
        raise PaymentNotFoundError(f"Payment {payment_id} not found")

    # Проверка идемпотентности
    if payment.status == "succeeded" and payment.idempotency_key == idempotency_key:
        logger.warning(
            f"Payment {payment_id} already processed (idempotency key: {idempotency_key})"
        )
        raise IdempotencyViolationError(
            f"Payment {payment_id} already processed"
        )

    # Получение пользователя
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise ValueError(f"User {user_id} not found")

    # Начисление подписки
    user.subscription_type = subscription_type

    # Продление подписки (если уже есть активная)
    if user.subscription_end and user.subscription_end > datetime.utcnow():
        user.subscription_end += timedelta(days=duration_days)
    else:
        user.subscription_end = datetime.utcnow() + timedelta(days=duration_days)

    # Начисление кредитов по подписке
    credits = calculate_credits_for_tariff("subscription", subscription_type)
    user.balance_credits += credits

    payment.status = "succeeded"
    payment.completed_at = datetime.utcnow()
    payment.idempotency_key = idempotency_key

    await session.commit()
    await session.refresh(user)

    logger.info(
        f"Awarded subscription {subscription_type} ({duration_days} days) "
        f"and {credits} credits to user {user_id} (payment: {payment_id})"
    )

    return user


def get_all_tariffs() -> dict:
    """
    Получить все доступные тарифы.

    Returns:
        dict: Словарь с подписками и пакетами кредитов
    """
    return {
        "subscriptions": SUBSCRIPTION_TARIFFS,
        "credits_packages": CREDITS_PACKAGES,
    }


def get_tariff_info(payment_type: str, tariff_id: str) -> Optional[dict]:
    """
    Получить информацию о конкретном тарифе.

    Args:
        payment_type: Тип платежа ("subscription" или "credits")
        tariff_id: ID тарифа

    Returns:
        Optional[dict]: Информация о тарифе или None
    """
    if payment_type == "subscription":
        return SUBSCRIPTION_TARIFFS.get(tariff_id)
    elif payment_type == "credits":
        return CREDITS_PACKAGES.get(tariff_id)
    return None
