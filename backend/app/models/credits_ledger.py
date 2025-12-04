"""
Ledger записей по кредитам и лимитам.
"""

import enum
from typing import Optional

from sqlalchemy import (
    Integer,
    ForeignKey,
    JSON,
    Index,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class LedgerEntryType(str, enum.Enum):
    """Тип операции в журнале (v5)."""

    TRYON_GENERATION = "tryon_generation"
    EDIT_GENERATION = "edit_generation"
    ASSISTANT_CALL = "assistant_call"
    SUBSCRIPTION_ACTIONS_SPENT = "subscription_actions_spent"
    SUBSCRIPTION_PURCHASE = "subscription_purchase"
    SUBSCRIPTION_RENEW = "subscription_renew"
    CREDIT_PACK_PURCHASE = "credit_pack_purchase"
    FREE_TRIAL_GRANT = "free_trial_grant"


class LedgerUnit(str, enum.Enum):
    """Единица учёта операции: действия или кредиты."""

    CREDITS = "credits"
    ACTIONS = "actions"


class LedgerSource(str, enum.Enum):
    """Источник операции."""

    SUBSCRIPTION = "subscription"
    CREDITS = "credits"
    FREE_TRIAL = "free_trial"
    ADMIN = "admin"


class CreditsLedger(Base, TimestampMixin):
    """
    Запись в журнале кредитов/лимитов.
    """

    __tablename__ = "credits_ledger"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Положительное число для начисления, отрицательное для списания",
    )
    unit: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        comment="Единица: credits или actions",
    )
    source: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="Источник операции: подписка, кредиты, free_trial, admin",
    )
    meta: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
        comment="Дополнительные данные (payment_id, generation_id и т.д.)",
    )
    idempotency_key: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        comment="Ключ идемпотентности для платежей/вебхуков",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="ledger_entries",
    )

    __table_args__ = (
        Index("idx_credits_ledger_user_created", "user_id", "created_at"),
    )
