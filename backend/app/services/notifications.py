"""
Вспомогательные функции для пользовательских уведомлений.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)

WELCOME_NOTIFICATION_TITLE = "Подпишитесь на наш Telegram-канал"
WELCOME_NOTIFICATION_MESSAGE = (
    "Рекомендуем подписаться на "
    "[Telegram-канал](https://t.me/+Fj-R8QqIEEg5OTE6) сообщества.\n\n"
    "Там мы регулярно публикуем новые пресеты для генераций, "
    "инструкции по оптимальной работе с приложением и отвечаем на вопросы пользователей."
)


async def create_new_user_welcome_notification(
    db: AsyncSession,
    user_id: int,
) -> bool:
    """
    Создать одноразовое welcome-уведомление для нового пользователя.

    Возвращает True, если уведомление было создано, иначе False.
    """

    existing_notification_id = await db.scalar(
        select(Notification.id)
        .where(
            Notification.user_id == user_id,
            Notification.title == WELCOME_NOTIFICATION_TITLE,
            Notification.created_by_user_id.is_(None),
        )
        .limit(1)
    )
    if existing_notification_id:
        return False

    db.add(
        Notification(
            user_id=user_id,
            title=WELCOME_NOTIFICATION_TITLE,
            message=WELCOME_NOTIFICATION_MESSAGE,
            created_by_user_id=None,
        )
    )

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning(
            "Failed to create welcome notification for user %s",
            user_id,
            exc_info=True,
        )
        return False

    return True
