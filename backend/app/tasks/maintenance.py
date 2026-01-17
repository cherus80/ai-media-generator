"""
Celery задачи для обслуживания системы.

Периодические задачи для очистки старых файлов и сброса Freemium счетчиков.
"""

import asyncio
import re
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import async_session
from app.models.user import User
from app.models.generation_example import GenerationExample
from app.models.instruction import Instruction
from app.services.file_storage import delete_old_files
from app.tasks.celery_app import celery_app

UPLOAD_REF_RE = re.compile(r"/uploads/(?P<file_id>[0-9a-fA-F-]{36})\.[a-zA-Z0-9]+")
_TASK_LOOP: asyncio.AbstractEventLoop | None = None


def _run_async(coro):
    global _TASK_LOOP
    if _TASK_LOOP is None or _TASK_LOOP.is_closed():
        _TASK_LOOP = asyncio.new_event_loop()
        asyncio.set_event_loop(_TASK_LOOP)

    if _TASK_LOOP.is_running():
        return asyncio.run_coroutine_threadsafe(coro, _TASK_LOOP).result()

    return _TASK_LOOP.run_until_complete(coro)


def _extract_upload_ids(source: str | None) -> set[str]:
    if not source:
        return set()
    return {match.group("file_id") for match in UPLOAD_REF_RE.finditer(source)}


@celery_app.task(name="app.tasks.maintenance.delete_old_files_task")
def delete_old_files_task() -> dict:
    """
    Периодическая задача для удаления старых файлов.

    Удаляет файлы старше FILE_RETENTION_HOURS часов.

    Returns:
        dict: Результат выполнения
    """
    try:
        retention_hours = getattr(
            settings,
            "FILE_RETENTION_HOURS",
            24
        )

        async def _collect_protected_ids() -> set[str]:
            protected: set[str] = set()
            async with async_session() as session:
                example_rows = await session.execute(select(GenerationExample.image_url))
                for image_url in example_rows.scalars().all():
                    protected.update(_extract_upload_ids(image_url))

                instruction_rows = await session.execute(select(Instruction.content))
                for content in instruction_rows.scalars().all():
                    protected.update(_extract_upload_ids(content))

            return protected

        protected_ids = _run_async(_collect_protected_ids())
        deleted_count = delete_old_files(
            hours=retention_hours,
            protected_file_ids=protected_ids,
        )

        return {
            "status": "success",
            "deleted_count": deleted_count,
            "retention_hours": retention_hours,
        }

    except Exception as e:
        return {
            "status": "failed",
            "error": str(e),
        }


@celery_app.task(name="app.tasks.maintenance.reset_freemium_counters_task")
def reset_freemium_counters_task() -> dict:
    """
    Периодическая задача для сброса Freemium счетчиков.

    Сбрасывает счетчики пользователей, у которых прошло 30 дней с последнего сброса.

    Returns:
        dict: Результат выполнения
    """

    async def _reset_counters():
        """Async функция для сброса счетчиков"""
        async with async_session() as session:
            try:
                # Получение пользователей, которым нужен сброс
                cutoff_date = datetime.utcnow() - timedelta(days=30)

                stmt = select(User).where(
                    (User.freemium_reset_at < cutoff_date) |
                    (User.freemium_reset_at.is_(None))
                )

                result = await session.execute(stmt)
                users = result.scalars().all()

                reset_count = 0

                for user in users:
                    # Сброс счетчика
                    user.freemium_actions_used = 0
                    user.freemium_reset_at = datetime.utcnow()
                    reset_count += 1

                await session.commit()

                return {
                    "status": "success",
                    "reset_count": reset_count,
                }

            except Exception as e:
                await session.rollback()
                return {
                    "status": "failed",
                    "error": str(e),
                }

    return _run_async(_reset_counters())


@celery_app.task(name="app.tasks.maintenance.cleanup_old_chat_histories_task")
def cleanup_old_chat_histories_task() -> dict:
    """
    Периодическая задача для удаления старых чат-историй.

    Удаляет чат-истории старше 30 дней.

    Returns:
        dict: Результат выполнения
    """

    async def _cleanup_histories():
        """Async функция для очистки историй"""
        async with async_session() as session:
            try:
                from app.models.chat import ChatHistory

                cutoff_date = datetime.utcnow() - timedelta(days=30)

                # Получение старых историй
                stmt = select(ChatHistory).where(
                    ChatHistory.updated_at < cutoff_date
                )

                result = await session.execute(stmt)
                old_histories = result.scalars().all()

                deleted_count = 0

                for history in old_histories:
                    await session.delete(history)
                    deleted_count += 1

                await session.commit()

                return {
                    "status": "success",
                    "deleted_count": deleted_count,
                }

            except Exception as e:
                await session.rollback()
                return {
                    "status": "failed",
                    "error": str(e),
                }

    return _run_async(_cleanup_histories())
