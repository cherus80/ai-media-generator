"""Pydantic схемы для Billing v4."""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class BillingState(BaseModel):
    billing_v5_enabled: bool = Field(..., description="Флаг включённого биллинга v5")
    credits_balance: int = Field(..., description="Баланс кредитов")

    plan_id: Optional[str] = Field(None, description="Активный план подписки")
    plan_active: bool = Field(..., description="Подписка активна")
    plan_started_at: Optional[datetime] = Field(None, description="Дата активации плана")
    plan_expires_at: Optional[datetime] = Field(None, description="Дата окончания плана")

    actions_limit: int = Field(..., description="Доступно действий по подписке")
    actions_used: int = Field(..., description="Сколько действий израсходовано")
    actions_remaining: int = Field(..., description="Сколько действий осталось")


class LedgerItem(BaseModel):
    id: int
    type: Literal[
        "tryon_generation",
        "edit_generation",
        "assistant_call",
        "subscription_actions_spent",
        "subscription_purchase",
        "subscription_renew",
        "credit_pack_purchase",
        "free_trial_grant",
    ]
    amount: int
    unit: Literal["credits", "actions"]
    source: Literal["subscription", "credits", "free_trial", "admin"]
    meta: Optional[dict]
    idempotency_key: Optional[str]
    created_at: datetime


class LedgerResponse(BaseModel):
    total: int
    items: list[LedgerItem]
