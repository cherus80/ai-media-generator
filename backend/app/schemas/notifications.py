"""
Notification schemas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class NotificationItem(BaseModel):
    """Уведомление пользователя."""

    id: int
    title: Optional[str] = None
    message: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationsResponse(BaseModel):
    """Список уведомлений пользователя."""

    items: list[NotificationItem]
    unread_count: int = Field(..., description="Количество непрочитанных уведомлений")


class UnreadCountResponse(BaseModel):
    """Количество непрочитанных уведомлений."""

    count: int


class MarkNotificationsReadRequest(BaseModel):
    """Запрос на пометку уведомлений как прочитанных."""

    notification_ids: Optional[list[int]] = None
    mark_all: bool = False

    @model_validator(mode="after")
    def _validate_payload(self):
        if not self.mark_all and not self.notification_ids:
            raise ValueError("Provide notification_ids or set mark_all=true")
        return self


class MarkNotificationsReadResponse(BaseModel):
    """Ответ на пометку уведомлений как прочитанных."""

    updated_count: int


class AdminNotificationCreateRequest(BaseModel):
    """Запрос на отправку уведомлений из админки."""

    title: Optional[str] = Field(None, max_length=200)
    message: str = Field(..., min_length=1)
    user_ids: Optional[list[int]] = None
    send_to_all: bool = False

    @model_validator(mode="after")
    def _validate_targets(self):
        if not self.send_to_all and not self.user_ids:
            raise ValueError("Provide user_ids or set send_to_all=true")
        return self


class AdminNotificationCreateResponse(BaseModel):
    """Ответ на отправку уведомлений из админки."""

    created_count: int
    skipped_count: int = 0
