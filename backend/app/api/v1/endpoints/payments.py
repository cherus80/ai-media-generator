"""
API endpoints для платежей и монетизации.

Endpoints:
- POST /payments/create — создание платежа
- POST /payments/webhook — webhook от ЮKassa
- GET /payments/history — история платежей
- GET /payments/tariffs — список доступных тарифов
- GET /payments/status/{payment_id} — статус платежа
"""

import logging
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.dependencies import get_current_user, require_verified_email
from app.models.user import User
from app.models.payment import Payment
from app.schemas.payment import (
    PaymentCreateRequest,
    PaymentCreateResponse,
    PaymentHistoryResponse,
    PaymentHistoryItem,
    TariffsListResponse,
    TariffInfo,
    PaymentStatusResponse,
)
from app.services.yukassa import get_yukassa_client, YuKassaError
from app.services.billing import (
    get_all_tariffs,
    calculate_price_for_tariff,
    calculate_credits_for_tariff,
    award_credits,
    award_subscription,
    BillingError,
    SUBSCRIPTION_TARIFFS,
    CREDITS_PACKAGES,
)


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/create", response_model=PaymentCreateResponse)
async def create_payment(
    request: PaymentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_email),
):
    """
    Создание платежа через ЮKassa.

    Требуется подтверждённый email для доступа к платежам.

    Процесс:
    1. Валидация тарифа
    2. Расчёт суммы
    3. Создание записи Payment в БД
    4. Создание платежа в ЮKassa
    5. Возврат confirmation_url для редиректа

    Стоимость:
    - Подписки: от 299₽ (basic) до 899₽ (premium)
    - Кредиты: пакеты 20 / 50 / 100 / 250 кредитов
    """
    try:
        # Определяем tariff_id
        if request.payment_type == "subscription":
            tariff_id = request.subscription_type
        else:
            # Находим пакет по количеству кредитов
            tariff_id = None
            for pkg_id, pkg in CREDITS_PACKAGES.items():
                if pkg.get("credits_amount") == request.credits_amount:
                    tariff_id = pkg_id
                    break

            if not tariff_id:
                available_amounts = sorted({pkg.get("credits_amount", 0) for pkg in CREDITS_PACKAGES.values()})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid credits amount. Available: {available_amounts}",
                )

        # Расчёт стоимости
        amount = calculate_price_for_tariff(request.payment_type, tariff_id)

        # Формирование описания
        if request.payment_type == "subscription":
            tariff_info = SUBSCRIPTION_TARIFFS[tariff_id]
            description = f"Подписка {tariff_info['name']} — {tariff_info['description']}"
        else:
            tariff_info = CREDITS_PACKAGES[tariff_id]
            description = f"Покупка кредитов — {tariff_info['name']}"

        # Генерация idempotency_key
        idempotency_key = str(uuid4())

        # Создание записи в БД
        payment = Payment(
            user_id=current_user.id,
            payment_id="",  # Будет заполнен после ответа ЮKassa
            amount=amount,
            payment_type=request.payment_type,
            subscription_type=request.subscription_type,
            credits_amount=request.credits_amount if request.payment_type == "credits" else None,
            status="pending",
            idempotency_key=idempotency_key,
        )
        db.add(payment)
        await db.flush()

        # Метаданные для ЮKassa (для webhook)
        metadata = {
            "user_id": str(current_user.id),
            "payment_db_id": str(payment.id),
            "payment_type": request.payment_type,
            "tariff_id": tariff_id,
        }

        # Создание платежа в ЮKassa
        yukassa_client = get_yukassa_client()
        yukassa_payment = await yukassa_client.create_payment(
            amount=amount,
            description=description,
            idempotency_key=idempotency_key,
            metadata=metadata,
        )

        # Обновление payment_id
        payment.payment_id = yukassa_payment["id"]
        await db.commit()
        await db.refresh(payment)

        # Получение confirmation URL
        confirmation_url = yukassa_payment.get("confirmation", {}).get("confirmation_url")

        if not confirmation_url:
            logger.error(f"No confirmation_url in YuKassa response: {yukassa_payment}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get payment confirmation URL",
            )

        logger.info(
            f"Payment created: {payment.payment_id} for user {current_user.id} "
            f"({request.payment_type}, {amount} RUB)"
        )

        return PaymentCreateResponse(
            payment_id=payment.payment_id,
            confirmation_url=confirmation_url,
            amount=amount,
            description=description,
        )

    except YuKassaError as e:
        logger.error(f"YuKassa error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Payment service error: {str(e)}",
        )
    except ValueError as e:
        logger.error(f"Invalid tariff: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def yukassa_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_yookassa_signature: Optional[str] = Header(None),
):
    """
    Webhook от ЮKassa для обработки событий платежей.

    События:
    - payment.succeeded — платёж успешно завершён
    - payment.canceled — платёж отменён
    - payment.waiting_for_capture — ожидает подтверждения

    Процесс:
    1. Верификация подписи
    2. Парсинг payload
    3. Обработка события (начисление кредитов/подписки)
    """
    try:
        # Получение body
        body = await request.body()
        body_str = body.decode("utf-8")

        # Верификация подписи
        yukassa_client = get_yukassa_client()
        if x_yookassa_signature:
            is_valid = yukassa_client.verify_webhook_signature(
                payload=body_str,
                signature=x_yookassa_signature,
            )
            if not is_valid:
                logger.warning("Invalid YuKassa webhook signature")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid signature",
                )

        # Парсинг JSON
        import json
        payload = json.loads(body_str)

        event = payload.get("event")
        payment_object = payload.get("object", {})
        payment_id = payment_object.get("id")
        payment_status = payment_object.get("status")
        metadata = payment_object.get("metadata", {})

        logger.info(f"YuKassa webhook: event={event}, payment_id={payment_id}, status={payment_status}")

        # Обработка события payment.succeeded
        if event == "payment.succeeded":
            # Получаем данные из metadata
            user_id = int(metadata.get("user_id"))
            payment_type = metadata.get("payment_type")
            tariff_id = metadata.get("tariff_id")

            # Генерация idempotency_key из webhook
            idempotency_key = f"webhook_{payment_id}"

            # Начисление кредитов или подписки
            if payment_type == "credits":
                credits = calculate_credits_for_tariff(payment_type, tariff_id)
                await award_credits(
                    session=db,
                    user_id=user_id,
                    credits=credits,
                    payment_id=payment_id,
                    idempotency_key=idempotency_key,
                )
                logger.info(f"Credits awarded: {credits} to user {user_id}")

            elif payment_type == "subscription":
                tariff_info = SUBSCRIPTION_TARIFFS[tariff_id]
                await award_subscription(
                    session=db,
                    user_id=user_id,
                    subscription_type=tariff_id,
                    duration_days=tariff_info["duration_days"],
                    payment_id=payment_id,
                    idempotency_key=idempotency_key,
                )
                logger.info(f"Subscription awarded: {tariff_id} to user {user_id}")

        # Обработка других событий (опционально)
        elif event == "payment.canceled":
            # Обновляем статус в БД
            stmt = select(Payment).where(Payment.payment_id == payment_id)
            result = await db.execute(stmt)
            payment = result.scalar_one_or_none()

            if payment:
                payment.status = "canceled"
                await db.commit()
                logger.info(f"Payment canceled: {payment_id}")

        return {"status": "ok"}

    except BillingError as e:
        logger.error(f"Billing error in webhook: {e}")
        # Возвращаем 200, чтобы ЮKassa не повторял webhook
        return {"status": "error", "message": str(e)}

    except Exception as e:
        logger.error(f"Webhook processing error: {e}", exc_info=True)
        # Возвращаем 200, чтобы ЮKassa не повторял webhook
        return {"status": "error", "message": "Internal server error"}


@router.get("/history", response_model=PaymentHistoryResponse)
async def get_payment_history(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получение истории платежей пользователя.

    Параметры:
    - page: Номер страницы (начиная с 1)
    - page_size: Размер страницы (по умолчанию 20)

    Возвращает список платежей с пагинацией.
    """
    # Подсчёт общего количества
    count_stmt = select(Payment).where(Payment.user_id == current_user.id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())

    # Получение страницы
    offset = (page - 1) * page_size
    stmt = (
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(desc(Payment.created_at))
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    payments = result.scalars().all()

    # Преобразование в Pydantic модели
    items = [PaymentHistoryItem.model_validate(payment) for payment in payments]

    return PaymentHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tariffs", response_model=TariffsListResponse)
async def get_tariffs():
    """
    Получение списка доступных тарифов.

    Возвращает:
    - Подписки (basic, standard, premium)
    - Пакеты кредитов (20, 50, 100, 250)

    Включает информацию о ценах, количестве кредитов и налогах.
    """
    all_tariffs = get_all_tariffs()

    # Формируем список подписок
    subscriptions = []
    for tariff_id, tariff_data in all_tariffs["subscriptions"].items():
        subscriptions.append(
            TariffInfo(
                tariff_id=tariff_id,
                type="subscription",
                name=tariff_data["name"],
                description=tariff_data["description"],
                price=tariff_data["price"],
                credits_amount=tariff_data["credits_amount"],
                actions_limit=tariff_data.get("actions_limit"),
                duration_days=tariff_data["duration_days"],
                is_popular=tariff_data.get("is_popular", False),
            )
        )

    # Формируем список пакетов кредитов
    credits_packages = []
    for tariff_id, tariff_data in all_tariffs["credits_packages"].items():
        credits_packages.append(
            TariffInfo(
                tariff_id=tariff_id,
                type="credits",
                name=tariff_data["name"],
                description=tariff_data["description"],
                price=tariff_data["price"],
                credits_amount=tariff_data["credits_amount"],
                actions_limit=None,
                duration_days=None,
                is_popular=tariff_data.get("is_popular", False),
            )
        )

    return TariffsListResponse(
        subscriptions=subscriptions,
        credits_packages=credits_packages,
    )


@router.get("/status/{payment_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Проверка статуса платежа.

    Args:
        payment_id: UUID платежа в ЮKassa

    Возвращает статус платежа из БД.
    """
    stmt = select(Payment).where(
        Payment.payment_id == payment_id,
        Payment.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    return PaymentStatusResponse(
        payment_id=payment.payment_id,
        status=payment.status,
        amount=payment.amount,
        created_at=payment.created_at,
        completed_at=payment.completed_at,
    )
