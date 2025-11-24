"""
Billing v4: Freemium + Subscription + Credits.

Приоритет списаний: подписка → freemium → кредиты. Администраторы пропускаются.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User, UserRole
from app.models.credits_ledger import (
    CreditsLedger,
    LedgerEntryType,
    LedgerSource,
)

logger = logging.getLogger(__name__)


class BillingV4Service:
    """Основные операции списания/учёта для v4."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def charge_generation(
        self,
        user_id: int,
        *,
        idempotency_key: Optional[str] = None,
        meta: Optional[dict] = None,
        cost_credits: Optional[int] = None,
    ) -> dict:
        """
        Списать генерацию (виртуальная примерка / итоговая генерация).
        Приоритет: подписка → freemium → кредиты.
        """
        cost = cost_credits or settings.BILLING_GENERATION_COST_CREDITS
        user = await self._lock_user(user_id)
        self._reset_limits_if_needed(user)

        # Admin bypass
        super_admin_role = getattr(UserRole, "SUPER_ADMIN", None)
        if user.role in [UserRole.ADMIN, super_admin_role]:
            logger.info("Billing v4: admin bypass for user %s", user.id)
            return self._response(user, "admin", cost, LedgerEntryType.TRYON, None)

        # Idempotency guard (optional)
        if idempotency_key and settings.BILLING_LEDGER_ENABLED:
            existing = await self.session.scalar(
                select(CreditsLedger).where(CreditsLedger.idempotency_key == idempotency_key)
            )
            if existing:
                logger.warning("Billing v4: duplicate charge_generation idempotency_key=%s", idempotency_key)
                return self._response(user, existing.source.value, cost, existing.type, existing.source)

        source: Optional[LedgerSource] = None
        entry_type = LedgerEntryType.TRYON

        if self._subscription_available(user):
            user.subscription_ops_used += 1
            source = LedgerSource.SUBSCRIPTION
        elif self._freemium_available(user):
            user.freemium_actions_used += 1
            source = LedgerSource.FREEMIUM
        elif user.balance_credits >= cost:
            user.balance_credits -= cost
            source = LedgerSource.CREDITS
        else:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "NOT_ENOUGH_CREDITS"},
            )

        if settings.BILLING_LEDGER_ENABLED and source:
            entry = CreditsLedger(
                user_id=user.id,
                type=entry_type,
                amount=-cost,
                source=source,
                meta=meta or {},
                idempotency_key=idempotency_key,
            )
            self.session.add(entry)

        await self.session.commit()
        await self.session.refresh(user)

        return self._response(user, source.value if source else "unknown", cost, entry_type, source)

    async def charge_assistant(
        self,
        user_id: int,
        *,
        idempotency_key: Optional[str] = None,
        meta: Optional[dict] = None,
        cost_credits: Optional[int] = None,
    ) -> dict:
        """
        Списать запрос к AI-ассистенту (только кредиты, без freemium/subscription).
        """
        cost = cost_credits or settings.BILLING_ASSISTANT_COST_CREDITS
        user = await self._lock_user(user_id)
        self._reset_limits_if_needed(user)

        super_admin_role = getattr(UserRole, "SUPER_ADMIN", None)
        if user.role in [UserRole.ADMIN, super_admin_role]:
            return self._response(user, "admin", cost, LedgerEntryType.ASSISTANT, None)

        if idempotency_key and settings.BILLING_LEDGER_ENABLED:
            existing = await self.session.scalar(
                select(CreditsLedger).where(CreditsLedger.idempotency_key == idempotency_key)
            )
            if existing:
                logger.warning("Billing v4: duplicate charge_assistant idempotency_key=%s", idempotency_key)
                return self._response(user, existing.source.value, cost, existing.type, existing.source)

        if user.balance_credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "NOT_ENOUGH_CREDITS"},
            )

        user.balance_credits -= cost

        if settings.BILLING_LEDGER_ENABLED:
            entry = CreditsLedger(
                user_id=user.id,
                type=LedgerEntryType.ASSISTANT,
                amount=-cost,
                source=LedgerSource.CREDITS,
                meta=meta or {},
                idempotency_key=idempotency_key,
            )
            self.session.add(entry)

        await self.session.commit()
        await self.session.refresh(user)

        return self._response(user, LedgerSource.CREDITS.value, cost, LedgerEntryType.ASSISTANT, LedgerSource.CREDITS)

    async def _lock_user(self, user_id: int) -> User:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        user = await self.session.scalar(stmt)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user

    def _subscription_available(self, user: User) -> bool:
        if not user.subscription_type or not user.subscription_end:
            return False
        if user.subscription_end <= datetime.now(timezone.utc):
            return False
        limit = self._ensure_subscription_limit(user)
        return user.subscription_ops_used < limit

    def _freemium_available(self, user: User) -> bool:
        return user.freemium_actions_used < settings.BILLING_FREEMIUM_OPS_LIMIT

    def _ensure_subscription_limit(self, user: User) -> int:
        """
        Подтянуть лимит подписки из конфига, если не установлен или устарел.
        """
        plan_key = user.subscription_type.value if hasattr(user.subscription_type, "value") else user.subscription_type
        tiers = settings.BILLING_SUBSCRIPTION_TIERS
        # alias: legacy "pro" → новый "standard"
        normalized_key = "standard" if plan_key == "pro" else plan_key
        tier = tiers.get(normalized_key)
        if not tier:
            return user.subscription_ops_limit or 0
        if user.subscription_ops_limit != tier["ops_limit"]:
            user.subscription_ops_limit = tier["ops_limit"]
        return user.subscription_ops_limit

    def _reset_limits_if_needed(self, user: User) -> None:
        now = datetime.now(timezone.utc)
        # Reset subscription usage monthly based on subscription_ops_reset_at
        if user.subscription_ops_reset_at is None:
            user.subscription_ops_reset_at = now
        else:
            if now - user.subscription_ops_reset_at >= timedelta(days=30):
                user.subscription_ops_used = 0
                user.subscription_ops_reset_at = now

        # Reset freemium monthly
        if user.freemium_reset_at is None:
            user.freemium_reset_at = now
        else:
            if (now - user.freemium_reset_at).days >= 30:
                user.freemium_actions_used = 0
                user.freemium_reset_at = now

    def _response(
        self,
        user: User,
        source: str,
        cost: int,
        entry_type: LedgerEntryType,
        ledger_source: Optional[LedgerSource],
    ) -> dict:
        return {
            "payment_source": source,
            "credits_spent": cost if source == LedgerSource.CREDITS.value else 0,
            "subscription_ops_used": user.subscription_ops_used,
            "subscription_ops_limit": user.subscription_ops_limit,
            "freemium_ops_used": user.freemium_actions_used,
            "freemium_ops_limit": settings.BILLING_FREEMIUM_OPS_LIMIT,
            "balance_credits": user.balance_credits,
            "ledger_type": entry_type.value,
            "ledger_source": ledger_source.value if ledger_source else None,
        }
