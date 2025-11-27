"""
Модель для настраиваемых промптов примерки.
"""

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class FittingPrompt(Base, TimestampMixin):
    """
    Хранит промпты для зон примерки (одежда и аксессуары).
    """

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    zone: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by_user = relationship("User", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover - для отладки
        return f"<FittingPrompt zone={self.zone!r}>"
