"""
Сервис для управления чат-историей.

Логика работы с чат-сессиями для редактирования изображений с AI-ассистентом.
"""

import logging
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatHistory
from app.core.config import settings

logger = logging.getLogger(__name__)


class ChatServiceError(Exception):
    """Базовая ошибка сервиса чата"""
    pass


class ChatSessionNotFoundError(ChatServiceError):
    """Сессия чата не найдена"""
    pass


class ChatSessionInactiveError(ChatServiceError):
    """Сессия чата неактивна"""
    pass


async def create_chat_session(
    db: AsyncSession,
    user_id: int,
    base_image_url: str,
) -> ChatHistory:
    """
    Создание новой сессии чата.

    Args:
        db: Async database session
        user_id: ID пользователя
        base_image_url: URL базового изображения для редактирования

    Returns:
        Созданная ChatHistory instance

    Raises:
        ChatServiceError: Ошибка при создании сессии
    """
    try:
        session_id = str(uuid4())

        chat_session = ChatHistory(
            user_id=user_id,
            session_id=session_id,
            base_image_url=base_image_url,
            messages=[],
            is_active=True,
        )

        db.add(chat_session)
        await db.commit()
        await db.refresh(chat_session)

        logger.info(
            f"Created chat session {session_id} for user {user_id} "
            f"with base image {base_image_url}"
        )

        return chat_session

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create chat session: {e}")
        raise ChatServiceError(f"Failed to create chat session: {e}")


async def get_chat_session(
    db: AsyncSession,
    session_id: str,
    user_id: int,
    require_active: bool = True,
) -> ChatHistory:
    """
    Получение сессии чата.

    Args:
        db: Async database session
        session_id: UUID сессии
        user_id: ID пользователя (для проверки владения)
        require_active: Требовать активную сессию

    Returns:
        ChatHistory instance

    Raises:
        ChatSessionNotFoundError: Сессия не найдена
        ChatSessionInactiveError: Сессия неактивна (если require_active=True)
    """
    try:
        result = await db.execute(
            select(ChatHistory).where(
                ChatHistory.session_id == session_id,
                ChatHistory.user_id == user_id,
            )
        )
        chat_session = result.scalar_one_or_none()

        if not chat_session:
            raise ChatSessionNotFoundError(
                f"Chat session {session_id} not found for user {user_id}"
            )

        if require_active and not chat_session.is_active:
            raise ChatSessionInactiveError(
                f"Chat session {session_id} is inactive"
            )

        return chat_session

    except (ChatSessionNotFoundError, ChatSessionInactiveError):
        raise
    except Exception as e:
        logger.error(f"Failed to get chat session: {e}")
        raise ChatServiceError(f"Failed to get chat session: {e}")


async def add_message(
    db: AsyncSession,
    session_id: str,
    user_id: int,
    role: str,
    content: str,
    image_url: Optional[str] = None,
    attachments: Optional[list[dict[str, Any]]] = None,
    prompt: Optional[str] = None,
) -> ChatHistory:
    """
    Добавление сообщения в историю чата.

    Args:
        db: Async database session
        session_id: UUID сессии
        user_id: ID пользователя
        role: Роль отправителя ('user' или 'assistant')
        content: Текст сообщения
        image_url: URL изображения (опционально)
        attachments: Список вложений (опционально)
        prompt: Финальный промпт (опционально)

    Returns:
        Обновлённая ChatHistory instance

    Raises:
        ChatSessionNotFoundError: Сессия не найдена
        ChatSessionInactiveError: Сессия неактивна
        ChatServiceError: Ошибка при добавлении сообщения
    """
    try:
        # Получаем сессию
        chat_session = await get_chat_session(
            db=db,
            session_id=session_id,
            user_id=user_id,
            require_active=True,
        )

        # Добавляем сообщение через метод модели
        chat_session.add_message(
            role=role,
            content=content,
            image_url=image_url,
            attachments=attachments,
            prompt=prompt,
        )

        # Сохраняем изменения
        await db.commit()
        await db.refresh(chat_session)

        logger.info(
            f"Added {role} message to chat session {session_id} "
            f"(total messages: {chat_session.message_count})"
        )

        return chat_session

    except (ChatSessionNotFoundError, ChatSessionInactiveError):
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to add message to chat session: {e}")
        raise ChatServiceError(f"Failed to add message: {e}")


async def get_last_messages(
    db: AsyncSession,
    session_id: str,
    user_id: int,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Получение последних N сообщений из чата.

    Args:
        db: Async database session
        session_id: UUID сессии
        user_id: ID пользователя
        limit: Количество сообщений (по умолчанию 10)

    Returns:
        Список последних сообщений

    Raises:
        ChatSessionNotFoundError: Сессия не найдена
    """
    chat_session = await get_chat_session(
        db=db,
        session_id=session_id,
        user_id=user_id,
        require_active=False,  # Можно читать историю неактивной сессии
    )

    return chat_session.get_last_n_messages(limit)


async def get_messages_for_ai(
    db: AsyncSession,
    session_id: str,
    user_id: int,
    max_messages: int = 10,
) -> List[Dict[str, Any]]:
    """
    Получение сообщений в формате для OpenRouter API.

    Args:
        db: Async database session
        session_id: UUID сессии
        user_id: ID пользователя
        max_messages: Максимальное количество сообщений

    Returns:
        Список сообщений в формате [{"role": "user", "content": "..."}]

    Raises:
        ChatSessionNotFoundError: Сессия не найдена
    """
    chat_session = await get_chat_session(
        db=db,
        session_id=session_id,
        user_id=user_id,
        require_active=True,
    )

    return chat_session.get_messages_for_ai(max_messages)


async def reset_session(
    db: AsyncSession,
    session_id: str,
    user_id: int,
) -> ChatHistory:
    """
    Сброс чат-сессии (очистка истории и деактивация).

    Args:
        db: Async database session
        session_id: UUID сессии
        user_id: ID пользователя

    Returns:
        Обновлённая ChatHistory instance

    Raises:
        ChatSessionNotFoundError: Сессия не найдена
        ChatServiceError: Ошибка при сбросе сессии
    """
    try:
        chat_session = await get_chat_session(
            db=db,
            session_id=session_id,
            user_id=user_id,
            require_active=False,  # Можно сбросить неактивную сессию
        )

        # Сбрасываем через метод модели
        chat_session.reset()

        await db.commit()
        await db.refresh(chat_session)

        logger.info(f"Reset chat session {session_id} for user {user_id}")

        return chat_session

    except ChatSessionNotFoundError:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to reset chat session: {e}")
        raise ChatServiceError(f"Failed to reset session: {e}")


async def cleanup_old_chat_histories(
    db: AsyncSession,
    retention_days: Optional[int] = None,
) -> int:
    """
    Удаление старых неактивных чат-историй (периодическая задача).

    Args:
        db: Async database session
        retention_days: Количество дней хранения (по умолчанию из settings)

    Returns:
        Количество удалённых сессий

    Raises:
        ChatServiceError: Ошибка при очистке
    """
    if retention_days is None:
        retention_days = settings.CHAT_HISTORY_RETENTION_DAYS

    try:
        # Вычисляем дату отсечения
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)

        # Удаляем старые неактивные сессии
        result = await db.execute(
            select(ChatHistory).where(
                ChatHistory.is_active == False,
                ChatHistory.updated_at < cutoff_date,
            )
        )
        old_sessions = result.scalars().all()

        count = len(old_sessions)

        for session in old_sessions:
            await db.delete(session)

        await db.commit()

        logger.info(
            f"Cleaned up {count} old chat histories "
            f"(older than {retention_days} days)"
        )

        return count

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to cleanup old chat histories: {e}")
        raise ChatServiceError(f"Failed to cleanup chat histories: {e}")


async def get_user_active_sessions(
    db: AsyncSession,
    user_id: int,
) -> List[ChatHistory]:
    """
    Получение всех активных сессий пользователя.

    Args:
        db: Async database session
        user_id: ID пользователя

    Returns:
        Список активных ChatHistory instances
    """
    try:
        result = await db.execute(
            select(ChatHistory).where(
                ChatHistory.user_id == user_id,
                ChatHistory.is_active == True,
            ).order_by(ChatHistory.updated_at.desc())
        )

        sessions = result.scalars().all()

        logger.info(f"Found {len(sessions)} active sessions for user {user_id}")

        return list(sessions)

    except Exception as e:
        logger.error(f"Failed to get user active sessions: {e}")
        raise ChatServiceError(f"Failed to get user sessions: {e}")
