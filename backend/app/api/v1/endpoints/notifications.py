"""
User notifications endpoints.

- GET /api/v1/notifications — список уведомлений
- GET /api/v1/notifications/unread-count — количество непрочитанных
- POST /api/v1/notifications/read — пометить уведомления как прочитанные
"""

from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import func, select, update

from app.api.dependencies import CurrentUser, DBSession
from app.models.notification import Notification
from app.schemas.notifications import (
    NotificationsResponse,
    UnreadCountResponse,
    MarkNotificationsReadRequest,
    MarkNotificationsReadResponse,
)

router = APIRouter()


@router.get("", response_model=NotificationsResponse)
async def list_notifications(
    current_user: CurrentUser,
    db: DBSession,
) -> NotificationsResponse:
    """Получить список уведомлений пользователя."""

    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    unread_count = sum(1 for item in items if not item.is_read)

    return NotificationsResponse(items=items, unread_count=unread_count)


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: CurrentUser,
    db: DBSession,
) -> UnreadCountResponse:
    """Получить количество непрочитанных уведомлений."""

    stmt = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False),
    )
    result = await db.execute(stmt)
    count = result.scalar_one() or 0
    return UnreadCountResponse(count=count)


@router.post("/read", response_model=MarkNotificationsReadResponse)
async def mark_notifications_read(
    payload: MarkNotificationsReadRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> MarkNotificationsReadResponse:
    """Пометить уведомления как прочитанные."""

    now = datetime.now(timezone.utc)

    if payload.mark_all:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now, updated_at=now)
        )
    else:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.id.in_(payload.notification_ids or []),
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now, updated_at=now)
        )

    result = await db.execute(stmt)
    await db.commit()

    return MarkNotificationsReadResponse(updated_count=result.rowcount or 0)
