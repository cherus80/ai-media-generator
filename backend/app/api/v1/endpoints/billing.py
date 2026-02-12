"""
Billing v5 endpoints.

- GET /billing/state — текущее состояние лимитов/⭐️звезд
- GET /billing/ledger — история списаний/начислений
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user, get_db
from app.core.config import settings
from app.models.credits_ledger import CreditsLedger
from app.models.user import User
from app.schemas.billing import BillingState, LedgerResponse, LedgerItem
from app.services.billing_v5 import BillingV5Service

router = APIRouter()


@router.get(
    "/state",
    response_model=BillingState,
    summary="Текущее состояние биллинга",
    description="Возвращает баланс ⭐️звезд и остатки действий по подписке.",
)
async def get_billing_state(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BillingState:
    if not settings.BILLING_V5_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Платёжный модуль v5 отключён",
        )

    service = BillingV5Service(db)
    # Синхронизируем лимит с конфигом и проверяем истечение
    service._sync_plan_state(current_user)  # type: ignore[attr-defined]
    await db.commit()
    await db.refresh(current_user)

    plan_id = (
        current_user.subscription_type.value
        if hasattr(current_user.subscription_type, "value")
        else current_user.subscription_type
    )
    plan_active = service._has_active_plan(current_user)  # type: ignore[attr-defined]
    actions_limit = current_user.subscription_ops_limit if plan_active else 0
    actions_used = current_user.subscription_ops_used if plan_active else 0

    return BillingState(
        billing_v5_enabled=True,
        credits_balance=current_user.balance_credits,
        plan_id=plan_id,
        plan_active=plan_active,
        plan_started_at=current_user.subscription_started_at,
        plan_expires_at=current_user.subscription_end,
        actions_limit=actions_limit,
        actions_used=actions_used,
        actions_remaining=max(actions_limit - actions_used, 0),
    )


@router.get(
    "/ledger",
    response_model=LedgerResponse,
    summary="История операций биллинга",
    description="Возвращает список операций (credits_ledger) текущего пользователя.",
)
async def get_ledger(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> LedgerResponse:
    if not settings.BILLING_LEDGER_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Журнал операций отключён",
        )

    total_stmt = select(func.count(CreditsLedger.id)).where(CreditsLedger.user_id == current_user.id)
    total = await db.scalar(total_stmt)
    total_int = int(total or 0)

    stmt = (
        select(CreditsLedger)
        .where(CreditsLedger.user_id == current_user.id)
        .order_by(CreditsLedger.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()

    items = [
        LedgerItem(
            id=entry.id,
            type=entry.type,
            amount=entry.amount,
            unit=entry.unit,
            source=entry.source,
            meta=entry.meta,
            idempotency_key=entry.idempotency_key,
            created_at=entry.created_at,
        )
        for entry in entries
    ]

    return LedgerResponse(total=total_int, items=items)
