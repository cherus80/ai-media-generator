"""
Admin notifications endpoints.

- POST /api/v1/admin/notifications — отправка уведомлений пользователям
"""

import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.dependencies import AdminUser, DBSession
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notifications import (
    AdminNotificationCreateRequest,
    AdminNotificationCreateResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/notifications", response_model=AdminNotificationCreateResponse, status_code=status.HTTP_201_CREATED)
async def send_notifications(
    payload: AdminNotificationCreateRequest,
    admin: AdminUser,
    db: DBSession,
) -> AdminNotificationCreateResponse:
    """Отправить уведомления выбранным пользователям или всем."""

    skipped_count = 0

    if payload.send_to_all:
        result = await db.execute(select(User.id))
        user_ids = [row[0] for row in result.all()]
    else:
        requested_ids = list({uid for uid in (payload.user_ids or [])})
        if not requested_ids:
            raise HTTPException(status_code=400, detail="Не переданы user_ids")
        result = await db.execute(select(User.id).where(User.id.in_(requested_ids)))
        existing_ids = set(result.scalars().all())
        skipped_count = len(requested_ids) - len(existing_ids)
        user_ids = list(existing_ids)

    if not user_ids:
        raise HTTPException(status_code=400, detail="Не найдено пользователей для уведомления")

    notifications = [
        Notification(
            user_id=user_id,
            title=payload.title,
            message=payload.message,
            created_by_user_id=admin.id,
        )
        for user_id in user_ids
    ]

    db.add_all(notifications)
    await db.commit()

    logger.info(
        "Admin %s sent notifications to %s users (skipped=%s)",
        admin.id,
        len(notifications),
        skipped_count,
    )

    return AdminNotificationCreateResponse(
        created_count=len(notifications),
        skipped_count=skipped_count,
    )
