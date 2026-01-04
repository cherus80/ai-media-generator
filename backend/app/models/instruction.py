"""
Модель инструкций для публичных страниц (текстовые и видео).
"""

from enum import Enum

from sqlalchemy import Boolean, Integer, String, Text, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class InstructionType(str, Enum):
    """Тип инструкции."""

    VIDEO = "video"
    TEXT = "text"


def _instruction_type_values(enum_cls: type[InstructionType]) -> list[str]:
    return [item.value for item in enum_cls]


class Instruction(Base, TimestampMixin):
    """
    Инструкции по использованию приложения (видео и текст).
    """

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    type: Mapped[InstructionType] = mapped_column(
        SqlEnum(
            InstructionType,
            name="instruction_type",
            values_callable=_instruction_type_values,
        ),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_by_user = relationship("User", foreign_keys=[created_by_user_id], lazy="joined")
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id], lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Instruction id={self.id} type={self.type}>"
