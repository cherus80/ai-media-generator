"""
Activation event model.

Хранит ключевые события activation funnel для аналитики и rollout onboarding-first.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ActivationEvent(Base, TimestampMixin):
    __tablename__ = "activation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)

    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    event_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    anonymous_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    flow_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    route: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    entry_source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    utm_source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    utm_content: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    utm_term: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    referral_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    generation_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    event_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[Optional["User"]] = relationship("User", lazy="joined")

    __table_args__ = (
        Index("idx_activation_event_user_name_created", "user_id", "event_name", "created_at"),
        Index("idx_activation_event_anon_name_created", "anonymous_id", "event_name", "created_at"),
    )
