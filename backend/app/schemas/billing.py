"""Pydantic схемы для Billing v4."""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class BillingState(BaseModel):
    billing_v4_enabled: bool = Field(..., description="Флаг включённого биллинга v4")
    balance_credits: int = Field(..., description="Текущий баланс кредитов")

    subscription_type: Optional[str] = Field(None, description="Активный тариф подписки")
    subscription_ops_limit: int = Field(..., description="Лимит операций по подписке за период")
    subscription_ops_used: int = Field(..., description="Использовано операций подписки")
    subscription_ops_remaining: int = Field(..., description="Остаток операций подписки")
    subscription_ops_reset_at: Optional[datetime] = Field(
        None,
        description="Дата последнего сброса лимита подписки",
    )

    freemium_ops_limit: int = Field(..., description="Лимит freemium операций в периоде")
    freemium_ops_used: int = Field(..., description="Использовано freemium операций")
    freemium_ops_remaining: int = Field(..., description="Остаток freemium операций")
    freemium_reset_at: Optional[datetime] = Field(
        None,
        description="Дата последнего сброса freemium лимита",
    )


class LedgerItem(BaseModel):
    id: int
    type: Literal["tryon", "edit", "assistant", "subscription", "credit_purchase"]
    amount: int
    source: Literal["subscription", "freemium", "credits"]
    meta: Optional[dict]
    idempotency_key: Optional[str]
    created_at: datetime


class LedgerResponse(BaseModel):
    total: int
    items: list[LedgerItem]
