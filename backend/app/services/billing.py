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
from app.models.payment import Payment, PaymentStatus
from app.services.billing_v5 import BillingV5Service


logger = logging.getLogger(__name__)


DEFAULT_SUBSCRIPTION_TARIFFS = {
    "basic": {
        "name": "Basic",
        "price": Decimal("399.00"),
        "credits_amount": 30,
        "actions_limit": 30,
        "duration_days": 30,
        "description": "30 действий в месяц",
    },
    "standard": {
        "name": "Standard",
        "price": Decimal("699.00"),
        "credits_amount": 60,
        "actions_limit": 60,
        "duration_days": 30,
        "description": "60 действий в месяц",
        "is_popular": True,
    },
    "premium": {
        "name": "Premium",
        "price": Decimal("1290.00"),
        "credits_amount": 120,
        "actions_limit": 120,
        "duration_days": 30,
        "description": "120 действий в месяц",
    },
}

# Пакеты ⭐️звезд
DEFAULT_CREDITS_PACKAGES = {
    "small": {
        "name": "20 ⭐️звезд",
        "price": Decimal("199.00"),
        "credits_amount": 20,
        "description": "Разовая покупка ⭐️звезд",
    },
    "medium": {
        "name": "50 ⭐️звезд",
        "price": Decimal("449.00"),
        "credits_amount": 50,
        "description": "Разовая покупка ⭐️звезд",
    },
    "large": {
        "name": "100 ⭐️звезд",
        "price": Decimal("799.00"),
        "credits_amount": 100,
        "description": "Разовая покупка ⭐️звезд",
    },
    "pro": {
        "name": "250 ⭐️звезд",
        "price": Decimal("1690.00"),
        "credits_amount": 250,
        "description": "Разовая покупка ⭐️звезд",
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
        actions = data.get("ops_limit") or data.get("actions_limit") or data.get("credits_amount") or data.get("credits") or 0
        price = Decimal(str(data.get("price", 0)))
        is_alias = tariff_id == "pro"  # legacy alias, не показываем в списках тарифов
        tariffs[tariff_id] = {
            "name": data.get("name") or tariff_id.capitalize(),
            "price": price,
            "credits_amount": actions,
            "actions_limit": actions,
            "duration_days": data.get("duration_days", 30),
            "description": data.get("description") or f"{actions} действий на {data.get('duration_days', 30)} дней",
            "is_popular": data.get("is_popular", False) or tariff_id == "standard",
            "is_alias": is_alias,
        }
    return tariffs


def _build_credit_packages() -> dict:
    """
    Построить пакеты ⭐️звезд из настроек (fallback на дефолт).
    """
    config = settings.BILLING_CREDIT_PACKAGES or {}
    if not config:
        return DEFAULT_CREDITS_PACKAGES

    packages: dict = {}
    for package_id, data in config.items():
        credits = data.get("credits") or data.get("credits_amount") or 0
        price = Decimal(str(data.get("price", 0)))
        packages[package_id] = {
            "name": data.get("name") or f"{credits} ⭐️звезд",
            "price": price,
            "credits_amount": credits,
            "description": data.get("description") or "Разовая покупка ⭐️звезд",
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
    Рассчитать количество единиц для тарифа.

    Для подписки возвращает лимит действий, для пакета кредитов — количество кредитов.

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
    stmt = select(Payment).where(Payment.yookassa_id == payment_id)
    result = await session.execute(stmt)
    payment = result.scalar_one_or_none()

    if not payment:
        raise PaymentNotFoundError(f"Payment {payment_id} not found")

    # Проверка идемпотентности
    if payment.status == PaymentStatus.SUCCEEDED and payment.idempotency_key == idempotency_key:
        logger.warning(
            f"Payment {payment_id} already processed (idempotency key: {idempotency_key})"
        )
        raise IdempotencyViolationError(
            f"Payment {payment_id} already processed"
        )

    # Получение пользователя с блокировкой
    stmt = (
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise ValueError(f"User {user_id} not found")

    # Обновление платежа заранее, commit произойдёт внутри биллинга
    payment.status = PaymentStatus.SUCCEEDED
    payment.completed_at = datetime.utcnow()
    payment.idempotency_key = idempotency_key
    payment.credits_awarded = credits

    billing = BillingV5Service(session)
    await billing.award_credits(
        user,
        credits,
        idempotency_key=idempotency_key,
        meta={"payment_id": payment_id},
    )

    logger.info(
        "Awarded %s credits to user %s (payment: %s)", credits, user_id, payment_id
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
    stmt = select(Payment).where(Payment.yookassa_id == payment_id)
    result = await session.execute(stmt)
    payment = result.scalar_one_or_none()

    if not payment:
        raise PaymentNotFoundError(f"Payment {payment_id} not found")

    # Проверка идемпотентности
    if payment.status == PaymentStatus.SUCCEEDED and payment.idempotency_key == idempotency_key:
        logger.warning(
            f"Payment {payment_id} already processed (idempotency key: {idempotency_key})"
        )
        raise IdempotencyViolationError(
            f"Payment {payment_id} already processed"
        )

    # Получение пользователя с блокировкой
    stmt = (
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise ValueError(f"User {user_id} not found")

    payment.status = PaymentStatus.SUCCEEDED
    payment.completed_at = datetime.utcnow()
    payment.idempotency_key = idempotency_key
    payment.subscription_type_awarded = subscription_type
    payment.subscription_duration_days = duration_days

    billing = BillingV5Service(session)
    await billing.activate_subscription(
        user,
        subscription_type,
        duration_days=duration_days,
        idempotency_key=idempotency_key,
        meta={"payment_id": payment_id},
    )

    logger.info(
        "Activated subscription %s for user %s (payment: %s)",
        subscription_type,
        user_id,
        payment_id,
    )

    return user


def get_all_tariffs() -> dict:
    """
    Получить все доступные тарифы.

    Returns:
        dict: Словарь с подписками и пакетами кредитов
    """
    subscriptions_for_public = {
        key: value
        for key, value in SUBSCRIPTION_TARIFFS.items()
        if not value.get("is_alias")
    }

    return {
        "subscriptions": subscriptions_for_public,
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
