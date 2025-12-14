"""
Pydantic схемы для платежей и монетизации.

Схемы для работы с ЮKassa API, создания платежей, webhook и истории.
"""

from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


# Типы платежей
PaymentType = Literal["subscription", "credits"]

# Типы подписок
SubscriptionType = Literal["basic", "standard", "premium", "pro"]


class PaymentCreateRequest(BaseModel):
    """Запрос на создание платежа"""

    payment_type: PaymentType = Field(
        ...,
        description="Тип платежа: subscription (подписка) или credits (кредиты)",
    )
    subscription_type: Optional[SubscriptionType] = Field(
        None,
        description="Тип подписки (только для payment_type=subscription)",
    )
    credits_amount: Optional[int] = Field(
        None,
        description="Количество кредитов (только для payment_type=credits)",
        ge=1,
        le=10000,
    )

    @field_validator("subscription_type")
    @classmethod
    def validate_subscription_type(
        cls, v: Optional[SubscriptionType], info
    ) -> Optional[SubscriptionType]:
        """Валидация типа подписки"""
        payment_type = info.data.get("payment_type")

        if payment_type == "subscription" and v is None:
            raise ValueError("subscription_type is required for subscription payments")

        if payment_type == "credits" and v is not None:
            raise ValueError("subscription_type should not be set for credits payments")

        return v

    @field_validator("credits_amount")
    @classmethod
    def validate_credits_amount(
        cls, v: Optional[int], info
    ) -> Optional[int]:
        """Валидация количества кредитов"""
        payment_type = info.data.get("payment_type")

        if payment_type == "credits" and v is None:
            raise ValueError("credits_amount is required for credits payments")

        if payment_type == "subscription" and v is not None:
            raise ValueError("credits_amount should not be set for subscription payments")

        return v


class PaymentCreateResponse(BaseModel):
    """Ответ на создание платежа"""

    payment_id: str = Field(
        ...,
        description="UUID платежа в ЮKassa",
    )
    confirmation_url: str = Field(
        ...,
        description="URL для редиректа пользователя на оплату",
    )
    amount: Decimal = Field(
        ...,
        description="Сумма платежа в рублях",
    )
    description: str = Field(
        ...,
        description="Описание платежа",
    )


class WebhookPayload(BaseModel):
    """Payload от ЮKassa webhook"""

    event: str = Field(
        ...,
        description="Тип события (payment.succeeded, payment.canceled, etc.)",
    )
    object: dict = Field(
        ...,
        description="Объект платежа от ЮKassa",
    )


class PaymentHistoryItem(BaseModel):
    """Элемент истории платежей"""

    id: int = Field(
        ...,
        description="ID платежа в БД",
    )
    payment_id: str = Field(
        ...,
        description="UUID платежа в ЮKassa",
    )
    amount: Decimal = Field(
        ...,
        description="Сумма платежа в рублях",
    )
    payment_type: str = Field(
        ...,
        description="Тип платежа (subscription или credits)",
    )
    status: str = Field(
        ...,
        description="Статус платежа (pending, succeeded, canceled, failed)",
    )
    subscription_type: Optional[str] = Field(
        None,
        description="Тип подписки (если payment_type=subscription)",
    )
    credits_amount: Optional[int] = Field(
        None,
        description="Количество кредитов (если payment_type=credits)",
    )
    created_at: datetime = Field(
        ...,
        description="Дата создания платежа",
    )
    completed_at: Optional[datetime] = Field(
        None,
        description="Дата завершения платежа",
    )

    model_config = {"from_attributes": True}


class PaymentHistoryResponse(BaseModel):
    """Ответ с историей платежей"""

    items: list[PaymentHistoryItem] = Field(
        default_factory=list,
        description="Список платежей",
    )
    total: int = Field(
        ...,
        description="Общее количество платежей",
    )
    page: int = Field(
        default=1,
        description="Номер страницы",
    )
    page_size: int = Field(
        default=20,
        description="Размер страницы",
    )


class PaymentHideRequest(BaseModel):
    """Запрос на скрытие платежей в истории."""

    payment_ids: list[int] = Field(
        ...,
        min_length=1,
        description="ID платежей, которые нужно скрыть из истории",
    )


class PaymentHideResponse(BaseModel):
    """Ответ после скрытия платежей."""

    deleted_count: int = Field(
        ...,
        description="Сколько платежей было скрыто",
    )


class TariffInfo(BaseModel):
    """Информация о тарифе"""

    tariff_id: str = Field(
        ...,
        description="ID тарифа (basic, premium, pro, credits_100, etc.)",
    )
    type: PaymentType = Field(
        ...,
        description="Тип тарифа (subscription или credits)",
    )
    name: str = Field(
        ...,
        description="Название тарифа",
    )
    description: str = Field(
        ...,
        description="Описание тарифа",
    )
    price: Decimal = Field(
        ...,
        description="Цена в рублях",
    )
    credits_amount: Optional[int] = Field(
        None,
        description="Количество кредитов/действий",
    )
    actions_limit: Optional[int] = Field(
        None,
        description="Количество действий по подписке (если subscription)",
    )
    duration_days: Optional[int] = Field(
        None,
        description="Длительность подписки в днях",
    )
    is_popular: bool = Field(
        default=False,
        description="Рекомендованный тариф",
    )


class TariffsListResponse(BaseModel):
    """Список доступных тарифов"""

    subscriptions: list[TariffInfo] = Field(
        default_factory=list,
        description="Доступные подписки",
    )
    credits_packages: list[TariffInfo] = Field(
        default_factory=list,
        description="Доступные пакеты кредитов",
    )


class PaymentStatusResponse(BaseModel):
    """Статус платежа"""

    payment_id: str = Field(
        ...,
        description="UUID платежа в ЮKassa",
    )
    status: str = Field(
        ...,
        description="Статус платежа (pending, succeeded, canceled, failed)",
    )
    amount: Decimal = Field(
        ...,
        description="Сумма платежа в рублях",
    )
    created_at: datetime = Field(
        ...,
        description="Дата создания платежа",
    )
    completed_at: Optional[datetime] = Field(
        None,
        description="Дата завершения платежа",
    )
