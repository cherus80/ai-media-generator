"""
Billing v4 endpoints.

- GET /billing/state — текущее состояние лимитов/кредитов
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
from app.services.billing_v4 import BillingV4Service

router = APIRouter()


@router.get(
    "/state",
    response_model=BillingState,
    summary="Текущее состояние биллинга",
    description="Возвращает баланс кредитов, остатки подписки и freemium лимитов.",
)
async def get_billing_state(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BillingState:
    if not settings.BILLING_V4_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Billing v4 is disabled",
        )

    service = BillingV4Service(db)
    # Обновляем лимиты при необходимости (сброс по времени)
    service._reset_limits_if_needed(current_user)  # type: ignore[attr-defined]
    await db.commit()
    await db.refresh(current_user)

    subscription_type = (
        current_user.subscription_type.value
        if hasattr(current_user.subscription_type, "value")
        else current_user.subscription_type
    )

    return BillingState(
        billing_v4_enabled=True,
        balance_credits=current_user.balance_credits,
        subscription_type=subscription_type,
        subscription_ops_limit=current_user.subscription_ops_limit,
        subscription_ops_used=current_user.subscription_ops_used,
        subscription_ops_remaining=max(
            current_user.subscription_ops_limit - current_user.subscription_ops_used,
            0,
        ),
        subscription_ops_reset_at=current_user.subscription_ops_reset_at,
        freemium_ops_limit=settings.BILLING_FREEMIUM_OPS_LIMIT,
        freemium_ops_used=current_user.freemium_actions_used,
        freemium_ops_remaining=max(
            settings.BILLING_FREEMIUM_OPS_LIMIT - current_user.freemium_actions_used,
            0,
        ),
        freemium_reset_at=current_user.freemium_reset_at,
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
            detail="Ledger is disabled",
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
            type=entry.type.value,
            amount=entry.amount,
            source=entry.source.value,
            meta=entry.meta,
            idempotency_key=entry.idempotency_key,
            created_at=entry.created_at,
        )
        for entry in entries
    ]

    return LedgerResponse(total=total_int, items=items)
