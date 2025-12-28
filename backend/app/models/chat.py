"""
ChatHistory Model — Модель истории чата.

Хранит историю переписки с AI-ассистентом для редактирования изображений.
Использует JSONB для эффективного хранения сообщений.
"""

from typing import Optional, List, Dict, Any
from uuid import uuid4

from sqlalchemy import (
    Integer,
    String,
    ForeignKey,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ChatHistory(Base, TimestampMixin):
    """
    Модель истории чата с AI-ассистентом.

    Хранит переписку пользователя с AI для редактирования изображений.
    Сообщения хранятся в JSONB формате для эффективного поиска и обновления.

    Структура сообщения в JSONB:
    {
        "role": "user|assistant",
        "content": "текст сообщения",
        "image_url": "URL изображения" (опционально),
        "timestamp": "2025-01-28T12:00:00Z"
    }
    """

    __tablename__ = "chat_histories"

    # Primary Key
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        index=True,
    )

    # Foreign Key to User
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="ID пользователя",
    )

    # Session ID (уникальный для каждой сессии чата)
    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        default=lambda: str(uuid4()),
        unique=True,
        nullable=False,
        index=True,
        comment="Уникальный ID сессии чата",
    )

    # Изображение, с которым работает чат
    base_image_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="URL базового изображения для редактирования",
    )

    # История сообщений (JSONB)
    messages: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="История сообщений в формате JSONB",
    )

    # Метаданные
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Активна ли сессия чата",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="chat_histories",
    )

    # Индексы
    __table_args__ = (
        Index("idx_chat_user_id_created", "user_id", "created_at"),
        Index("idx_chat_session_id", "session_id"),
        Index("idx_chat_is_active", "is_active"),
        # GIN index для JSONB поиска (создаётся в миграции)
    )

    def __repr__(self) -> str:
        return (
            f"<ChatHistory(id={self.id}, session_id={self.session_id}, "
            f"user_id={self.user_id}, messages_count={len(self.messages or [])})>"
        )

    def add_message(
        self,
        role: str,
        content: str,
        image_url: Optional[str] = None,
        attachments: Optional[list[dict[str, str | int | None]]] = None,
        prompt: Optional[str] = None,
    ) -> None:
        """
        Добавление сообщения в историю.

        Args:
            role: Роль отправителя ('user' или 'assistant')
            content: Текст сообщения
            image_url: URL изображения (опционально)
            attachments: Список вложений (опционально)
            prompt: Финальный промпт ассистента (опционально)
        """
        from datetime import datetime

        messages = list(self.messages) if self.messages else []

        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        }

        if image_url:
            message["image_url"] = image_url

        if attachments:
            message["attachments"] = attachments

        if prompt:
            message["prompt"] = prompt

        messages.append(message)
        self.messages = messages

    def get_last_n_messages(self, n: int = 10) -> List[Dict[str, Any]]:
        """
        Получение последних N сообщений.

        Args:
            n: Количество сообщений (по умолчанию 10 для OpenRouter)

        Returns:
            Список последних N сообщений
        """
        if not self.messages:
            return []

        return self.messages[-n:]

    def get_messages_for_ai(self, max_messages: int = 10) -> List[Dict[str, Any]]:
        """
        Получение сообщений в формате для OpenRouter API.

        Args:
            max_messages: Максимальное количество сообщений

        Returns:
            Список сообщений в формате [{"role": "user", "content": "..."}]
        """
        messages = self.get_last_n_messages(max_messages)

        # Форматирование для OpenRouter
        formatted = []
        for msg in messages:
            formatted_msg: Dict[str, Any] = {
                "role": msg["role"],
                "content": msg["content"],
            }
            if msg.get("attachments"):
                formatted_msg["attachments"] = msg["attachments"]
            formatted.append(formatted_msg)

        return formatted

    def reset(self) -> None:
        """Сброс истории чата"""
        self.messages = []
        self.is_active = False

    @property
    def message_count(self) -> int:
        """Количество сообщений в чате"""
        return len(self.messages) if self.messages else 0
