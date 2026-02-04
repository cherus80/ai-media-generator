from unittest.mock import AsyncMock, Mock

import pytest

from app.models.notification import Notification
from app.services.notifications import (
    WELCOME_NOTIFICATION_MESSAGE,
    WELCOME_NOTIFICATION_TITLE,
    create_new_user_welcome_notification,
)


@pytest.mark.asyncio
async def test_create_new_user_welcome_notification_creates_record(mock_db_session):
    mock_db_session.scalar = AsyncMock(return_value=None)
    mock_db_session.add = Mock()

    created = await create_new_user_welcome_notification(mock_db_session, user_id=101)

    assert created is True
    mock_db_session.add.assert_called_once()
    mock_db_session.commit.assert_awaited_once()
    mock_db_session.rollback.assert_not_awaited()

    notification = mock_db_session.add.call_args.args[0]
    assert isinstance(notification, Notification)
    assert notification.user_id == 101
    assert notification.title == WELCOME_NOTIFICATION_TITLE
    assert notification.message == WELCOME_NOTIFICATION_MESSAGE
    assert notification.created_by_user_id is None


@pytest.mark.asyncio
async def test_create_new_user_welcome_notification_skips_duplicate(mock_db_session):
    mock_db_session.scalar = AsyncMock(return_value=55)
    mock_db_session.add = Mock()

    created = await create_new_user_welcome_notification(mock_db_session, user_id=101)

    assert created is False
    mock_db_session.add.assert_not_called()
    mock_db_session.commit.assert_not_awaited()
    mock_db_session.rollback.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_new_user_welcome_notification_rolls_back_on_commit_error(mock_db_session):
    mock_db_session.scalar = AsyncMock(return_value=None)
    mock_db_session.add = Mock()
    mock_db_session.commit = AsyncMock(side_effect=RuntimeError("db down"))

    created = await create_new_user_welcome_notification(mock_db_session, user_id=101)

    assert created is False
    mock_db_session.add.assert_called_once()
    mock_db_session.rollback.assert_awaited_once()
