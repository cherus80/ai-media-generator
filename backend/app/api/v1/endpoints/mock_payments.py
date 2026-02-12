"""
API endpoints для эмулятора платежей (Mock Payment Emulator).

ВНИМАНИЕ: Используется только в режиме разработки (PAYMENT_MOCK_MODE=true).
НЕ ДОСТУПНО В PRODUCTION!

Endpoints:
- GET /mock-payments/list — список всех платежей в эмуляторе
- POST /mock-payments/{payment_id}/approve — подтвердить платёж
- POST /mock-payments/{payment_id}/cancel — отменить платёж
- POST /mock-payments/webhook/{payment_id} — отправить webhook вручную
"""

import logging
import json
from typing import List
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
import httpx

from app.core.config import settings
from app.services.yukassa_mock import MockYuKassaClient


logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic models
class MockPaymentInfo(BaseModel):
    """Информация о mock-платеже"""
    payment_id: str
    status: str
    amount: str
    currency: str
    description: str
    metadata: dict
    confirmation_url: str
    created_at: str
    paid: bool
    test: bool


class MockPaymentListResponse(BaseModel):
    """Список mock-платежей"""
    payments: List[MockPaymentInfo]
    total: int


class MockPaymentActionResponse(BaseModel):
    """Результат действия над платежом"""
    success: bool
    payment_id: str
    new_status: str
    message: str


def check_mock_mode():
    """Проверка, что mock-режим включён"""
    if not settings.PAYMENT_MOCK_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эндпоинты тестовых платежей доступны только в режиме PAYMENT_MOCK_MODE",
        )


@router.get("/list", response_model=MockPaymentListResponse)
async def list_mock_payments(_=Depends(check_mock_mode)):
    """
    Получение списка всех платежей в эмуляторе.

    Возвращает все созданные через mock-клиент платежи.
    """
    payments_data = MockYuKassaClient._payments

    payments = []
    for payment_id, payment_data in payments_data.items():
        payments.append(
            MockPaymentInfo(
                payment_id=payment_id,
                status=payment_data["status"],
                amount=payment_data["amount"]["value"],
                currency=payment_data["amount"]["currency"],
                description=payment_data["description"],
                metadata=payment_data["metadata"],
                confirmation_url=payment_data["confirmation"]["confirmation_url"],
                created_at=payment_data["created_at"],
                paid=payment_data["paid"],
                test=payment_data["test"],
            )
        )

    logger.info(f"🔧 MOCK: Listed {len(payments)} payments")

    return MockPaymentListResponse(
        payments=payments,
        total=len(payments),
    )


@router.post("/{payment_id}/approve", response_model=MockPaymentActionResponse)
async def approve_mock_payment(
    payment_id: str,
    _=Depends(check_mock_mode),
):
    """
    Подтвердить (approve) платёж в эмуляторе.

    Изменяет статус на 'succeeded' и отправляет webhook на backend.

    Args:
        payment_id: UUID платежа
    """
    payment = MockYuKassaClient.get_payment(payment_id)

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Платёж {payment_id} не найден",
        )

    # Обновляем статус
    MockYuKassaClient.update_payment_status(payment_id, "succeeded", paid=True)

    # Отправляем webhook на backend
    await send_mock_webhook(payment_id, "payment.succeeded")

    logger.info(f"🔧 MOCK: Payment {payment_id} approved")

    return MockPaymentActionResponse(
        success=True,
        payment_id=payment_id,
        new_status="succeeded",
        message="Платёж подтверждён, webhook отправлен",
    )


@router.post("/{payment_id}/cancel", response_model=MockPaymentActionResponse)
async def cancel_mock_payment(
    payment_id: str,
    _=Depends(check_mock_mode),
):
    """
    Отменить платёж в эмуляторе.

    Изменяет статус на 'canceled' и отправляет webhook на backend.

    Args:
        payment_id: UUID платежа
    """
    payment = MockYuKassaClient.get_payment(payment_id)

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Платёж {payment_id} не найден",
        )

    # Обновляем статус
    MockYuKassaClient.update_payment_status(payment_id, "canceled", paid=False)

    # Отправляем webhook на backend
    await send_mock_webhook(payment_id, "payment.canceled")

    logger.info(f"🔧 MOCK: Payment {payment_id} canceled")

    return MockPaymentActionResponse(
        success=True,
        payment_id=payment_id,
        new_status="canceled",
        message="Платёж отменён, webhook отправлен",
    )


@router.post("/webhook/{payment_id}", response_model=MockPaymentActionResponse)
async def send_mock_webhook_endpoint(
    payment_id: str,
    event: str = "payment.succeeded",
    _=Depends(check_mock_mode),
):
    """
    Отправить webhook вручную.

    Args:
        payment_id: UUID платежа
        event: Тип события (payment.succeeded, payment.canceled)
    """
    payment = MockYuKassaClient.get_payment(payment_id)

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Платёж {payment_id} не найден",
        )

    await send_mock_webhook(payment_id, event)

    logger.info(f"🔧 MOCK: Webhook sent for payment {payment_id}, event={event}")

    return MockPaymentActionResponse(
        success=True,
        payment_id=payment_id,
        new_status=payment["status"],
        message=f"Webhook отправлен с событием {event}",
    )


async def send_mock_webhook(payment_id: str, event: str):
    """
    Внутренняя функция для отправки webhook на backend.

    Args:
        payment_id: UUID платежа
        event: Тип события
    """
    payment = MockYuKassaClient.get_payment(payment_id)

    if not payment:
        logger.error(f"🔧 MOCK: Payment {payment_id} not found for webhook")
        return

    # Формируем webhook payload по формату ЮKassa
    webhook_payload = {
        "type": "notification",
        "event": event,
        "object": {
            "id": payment_id,
            "status": payment["status"],
            "paid": payment["paid"],
            "amount": payment["amount"],
            "description": payment["description"],
            "metadata": payment["metadata"],
            "created_at": payment["created_at"],
            "test": True,
        },
    }

    # Отправляем POST запрос на webhook endpoint
    webhook_url = f"http://localhost:8000/api/v1/payments/webhook"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=webhook_payload,
                headers={
                    "Content-Type": "application/json",
                    # В mock-режиме не отправляем подпись (она пропускается)
                },
                timeout=10.0,
            )

            if response.status_code == 200:
                logger.info(f"🔧 MOCK: Webhook sent successfully to {webhook_url}")
            else:
                logger.error(
                    f"🔧 MOCK: Webhook failed with status {response.status_code}: "
                    f"{response.text}"
                )

    except Exception as e:
        logger.error(f"🔧 MOCK: Failed to send webhook: {e}")
