"""
Billing v5: действия по подписке + кредиты, без freemium.

Приоритет списаний: активная подписка (1 действие) → кредиты (2 или 1) → ошибка.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Literal
import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.credits_ledger import (
    CreditsLedger,
    LedgerEntryType,
    LedgerUnit,
    LedgerSource,
)

logger = logging.getLogger(__name__)


GenerationKind = Literal["tryon", "edit", "tryon_generation", "edit_generation"]


class BillingV5Service:
    """Основные операции списания/учёта для биллинга v5."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def charge_generation(
        self,
        user_id: int,
        *,
        kind: GenerationKind = "tryon",
        idempotency_key: Optional[str] = None,
        meta: Optional[dict] = None,
        cost_credits: Optional[int] = None,
    ) -> dict:
        """Списать генерацию (примерка/редакт).

        Приоритет: 1 действие по подписке → 2 кредита → ошибка.
        """

        cost = cost_credits or settings.BILLING_GENERATION_COST_CREDITS
        user = await self._lock_user(user_id)
        self._sync_plan_state(user)

        ledger_type = self._resolve_generation_type(kind)
        meta = meta or {}
        meta.setdefault("kind", ledger_type)

        if idempotency_key:
            existing = await self._find_by_idempotency(idempotency_key)
            if existing:
                logger.warning("Billing v5: duplicate generation charge, idempotency=%s", idempotency_key)
                return self._response_from_entry(user, existing)

        if user.is_admin:
            logger.info("Billing v5: admin bypass for generation user=%s", user.id)
            return self._response(user, "admin_free", ledger_type, LedgerUnit.CREDITS.value, 0)

        payment_source = None
        ledger_unit = None
        ledger_entry_type = None
        amount = 0

        if self._has_active_plan(user) and self._actions_remaining(user) > 0:
            user.subscription_ops_used += 1
            payment_source = "action"
            ledger_unit = LedgerUnit.ACTIONS.value
            ledger_entry_type = LedgerEntryType.SUBSCRIPTION_ACTIONS_SPENT.value
            amount = -1
            meta.setdefault("charge_via", "subscription")
        elif user.balance_credits >= cost:
            user.balance_credits -= cost
            payment_source = "credits"
            ledger_unit = LedgerUnit.CREDITS.value
            ledger_entry_type = ledger_type
            amount = -cost
            meta.setdefault("charge_via", "credits")
        else:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "NOT_ENOUGH_BALANCE"},
            )

        await self._log_entry(
            user_id=user.id,
            entry_type=ledger_entry_type,
            amount=amount,
            unit=ledger_unit,
            source=self._source_for_unit(ledger_unit),
            meta=meta,
            idempotency_key=idempotency_key,
        )

        await self.session.commit()
        await self.session.refresh(user)

        return self._response(user, payment_source, ledger_entry_type, ledger_unit, abs(amount))

    async def charge_assistant(
        self,
        user_id: int,
        *,
        idempotency_key: Optional[str] = None,
        meta: Optional[dict] = None,
        cost_credits: Optional[int] = None,
    ) -> dict:
        """Списать обращение к ассистенту (только кредиты)."""

        cost = cost_credits or settings.BILLING_ASSISTANT_COST_CREDITS
        user = await self._lock_user(user_id)
        self._sync_plan_state(user)
        meta = meta or {}

        if idempotency_key:
            existing = await self._find_by_idempotency(idempotency_key)
            if existing:
                logger.warning("Billing v5: duplicate assistant charge, idempotency=%s", idempotency_key)
                return self._response_from_entry(user, existing)

        if user.is_admin:
            return self._response(user, "admin_free", LedgerEntryType.ASSISTANT_CALL.value, LedgerUnit.CREDITS.value, 0)

        if user.balance_credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "NOT_ENOUGH_CREDITS_FOR_ASSISTANT"},
            )

        user.balance_credits -= cost

        await self._log_entry(
            user_id=user.id,
            entry_type=LedgerEntryType.ASSISTANT_CALL.value,
            amount=-cost,
            unit=LedgerUnit.CREDITS.value,
            source=LedgerSource.CREDITS.value,
            meta=meta,
            idempotency_key=idempotency_key,
        )

        await self.session.commit()
        await self.session.refresh(user)

        return self._response(
            user,
            "credits",
            LedgerEntryType.ASSISTANT_CALL.value,
            LedgerUnit.CREDITS.value,
            cost,
        )

    async def grant_free_trial(
        self,
        user: User,
        *,
        amount: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        meta: Optional[dict] = None,
    ) -> bool:
        """Выдать welcome-кредиты, если ещё не выдавались."""

        if user.free_trial_granted:
            return False

        credit_amount = amount or settings.BILLING_FREE_TRIAL_CREDITS
        user.balance_credits += credit_amount
        user.free_trial_granted = True

        await self._log_entry(
            user_id=user.id,
            entry_type=LedgerEntryType.FREE_TRIAL_GRANT.value,
            amount=credit_amount,
            unit=LedgerUnit.CREDITS.value,
            source=LedgerSource.FREE_TRIAL.value,
            meta=meta or {},
            idempotency_key=idempotency_key,
        )

        await self.session.commit()
        await self.session.refresh(user)
        return True

    async def activate_subscription(
        self,
        user: User,
        plan_id: str,
        *,
        duration_days: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        meta: Optional[dict] = None,
    ) -> None:
        """Установить/продлить подписку и сбросить счётчики действий."""

        plan_key = self._normalize_plan(plan_id)
        plan = self._get_plan(plan_key)
        now = datetime.now(timezone.utc)
        period_days = duration_days or plan.get("period_days") or 30

        # Renewal vs new purchase
        is_renew = user.subscription_end and user.subscription_end > now

        user.subscription_type = plan_key
        user.subscription_started_at = now
        user.subscription_end = now + timedelta(days=period_days)
        user.subscription_ops_limit = plan.get("ops_limit", 0)
        user.subscription_ops_used = 0
        user.subscription_ops_reset_at = now

        await self._log_entry(
            user_id=user.id,
            entry_type=(
                LedgerEntryType.SUBSCRIPTION_RENEW.value
                if is_renew
                else LedgerEntryType.SUBSCRIPTION_PURCHASE.value
            ),
            amount=plan.get("ops_limit", 0),
            unit=LedgerUnit.ACTIONS.value,
            source=LedgerSource.SUBSCRIPTION.value,
            meta={"plan_id": plan_key, **(meta or {})},
            idempotency_key=idempotency_key,
        )

        await self.session.commit()
        await self.session.refresh(user)

    async def award_credits(
        self,
        user: User,
        credits: int,
        *,
        idempotency_key: Optional[str] = None,
        meta: Optional[dict] = None,
    ) -> None:
        """Начислить кредиты (например, пакет)."""

        user.balance_credits += credits

        await self._log_entry(
            user_id=user.id,
            entry_type=LedgerEntryType.CREDIT_PACK_PURCHASE.value,
            amount=credits,
            unit=LedgerUnit.CREDITS.value,
            source=LedgerSource.CREDITS.value,
            meta=meta or {},
            idempotency_key=idempotency_key,
        )

        await self.session.commit()
        await self.session.refresh(user)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
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

    def _has_active_plan(self, user: User) -> bool:
        if not user.subscription_type or not user.subscription_end:
            return False
        return user.subscription_end > datetime.now(timezone.utc)

    def _actions_remaining(self, user: User) -> int:
        if not self._has_active_plan(user):
            return 0
        return max(user.subscription_ops_limit - user.subscription_ops_used, 0)

    def _ensure_subscription_limit(self, user: User) -> None:
        if not user.subscription_type:
            return
        plan_key = self._normalize_plan(
            user.subscription_type.value if hasattr(user.subscription_type, "value") else user.subscription_type
        )
        plan = self._get_plan(plan_key, fail_silently=True)
        if not plan:
            return
        desired_limit = plan.get("ops_limit", user.subscription_ops_limit)
        if desired_limit != user.subscription_ops_limit:
            user.subscription_ops_limit = desired_limit
            if user.subscription_ops_used > desired_limit:
                user.subscription_ops_used = desired_limit

    def _sync_plan_state(self, user: User) -> None:
        if not user.subscription_type:
            return
        if not self._has_active_plan(user):
            return
        self._ensure_subscription_limit(user)
        if user.subscription_ops_used < 0:
            user.subscription_ops_used = 0

    def _resolve_generation_type(self, kind: GenerationKind) -> str:
        if str(kind).startswith("edit"):
            return LedgerEntryType.EDIT_GENERATION.value
        return LedgerEntryType.TRYON_GENERATION.value

    async def _find_by_idempotency(self, idempotency_key: str) -> Optional[CreditsLedger]:
        stmt = select(CreditsLedger).where(CreditsLedger.idempotency_key == idempotency_key)
        return await self.session.scalar(stmt)

    async def _log_entry(
        self,
        *,
        user_id: int,
        entry_type: Optional[str],
        amount: int,
        unit: Optional[str],
        source: Optional[str],
        meta: Optional[dict],
        idempotency_key: Optional[str],
    ) -> Optional[CreditsLedger]:
        if not settings.BILLING_LEDGER_ENABLED or not entry_type or not unit:
            return None
        entry = CreditsLedger(
            user_id=user_id,
            type=entry_type,
            amount=amount,
            unit=unit,
            source=source or LedgerSource.CREDITS.value,
            meta=meta or {},
            idempotency_key=idempotency_key,
        )
        self.session.add(entry)
        return entry

    def _response(
        self,
        user: User,
        payment_source: str,
        ledger_type: Optional[str],
        ledger_unit: Optional[str],
        spent_amount: int,
    ) -> dict:
        subscription_type = (
            user.subscription_type.value
            if hasattr(user.subscription_type, "value")
            else user.subscription_type
        )
        return {
            "payment_source": payment_source,
            "credits_spent": spent_amount if payment_source == "credits" else 0,
            "actions_used": user.subscription_ops_used,
            "actions_limit": user.subscription_ops_limit,
            "actions_remaining": self._actions_remaining(user),
            "balance_credits": user.balance_credits,
            "ledger_type": ledger_type,
            "ledger_unit": ledger_unit,
            "subscription_type": subscription_type,
            "subscription_expires_at": user.subscription_end,
        }

    def _response_from_entry(self, user: User, entry: CreditsLedger) -> dict:
        payment_source = "credits" if entry.unit == LedgerUnit.CREDITS.value else "action"
        spent_amount = abs(entry.amount) if entry.amount < 0 else 0
        return self._response(user, payment_source, entry.type, entry.unit, spent_amount)

    def _source_for_unit(self, unit: Optional[str]) -> str:
        if unit == LedgerUnit.ACTIONS.value:
            return LedgerSource.SUBSCRIPTION.value
        if unit == LedgerUnit.CREDITS.value:
            return LedgerSource.CREDITS.value
        return LedgerSource.CREDITS.value

    def _normalize_plan(self, plan_id: str) -> str:
        return "standard" if plan_id == "pro" else plan_id

    def _get_plan(self, plan_id: str, fail_silently: bool = False) -> Optional[dict]:
        plan = settings.BILLING_SUBSCRIPTION_TIERS.get(plan_id)
        if not plan and not fail_silently:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown subscription plan: {plan_id}",
            )
        return plan


# Обратная совместимость для существующих импортов
BillingV4Service = BillingV5Service
