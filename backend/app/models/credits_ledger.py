"""
Ledger записей по кредитам и лимитам.
"""

import enum
from typing import Optional

from sqlalchemy import (
    Integer,
    ForeignKey,
    Enum,
    JSON,
    Index,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class LedgerEntryType(str, enum.Enum):
    """Тип операции в журнале."""

    TRYON = "tryon"
    EDIT = "edit"
    ASSISTANT = "assistant"
    SUBSCRIPTION = "subscription"
    CREDIT_PURCHASE = "credit_purchase"


class LedgerSource(str, enum.Enum):
    """Источник списания/начисления."""

    SUBSCRIPTION = "subscription"
    FREEMIUM = "freemium"
    CREDITS = "credits"


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
    type: Mapped[LedgerEntryType] = mapped_column(
        Enum(LedgerEntryType, name="ledger_entry_type_enum"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Положительное число для начисления, отрицательное для списания",
    )
    source: Mapped[LedgerSource] = mapped_column(
        Enum(LedgerSource, name="ledger_source_enum"),
        nullable=False,
        comment="Источник операции: подписка, freemium или кредиты",
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
