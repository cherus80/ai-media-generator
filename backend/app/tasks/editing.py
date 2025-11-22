"""
Celery задачи для генерации редактирования изображений.
"""

import asyncio
import logging
import base64

from celery import Task
from sqlalchemy import select

from app.db.session import async_session
from app.models.user import User
from app.models.chat import ChatHistory
from app.services.file_storage import save_upload_file_by_content, get_file_by_id
from app.services.openrouter import OpenRouterClient, OpenRouterError
from app.tasks.celery_app import celery_app
from app.tasks.utils import (
    should_add_watermark,
    update_generation_status,
    extract_file_id_from_url,
    image_to_base64_data_url,
)

logger = logging.getLogger(__name__)


class EditingTask(Task):
    """
    Базовый класс для задач редактирования с поддержкой прогресса.
    """

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Обработка ошибок задачи"""
        logger.error(
            f"Editing task {task_id} failed: {exc}",
            exc_info=einfo
        )

    def on_success(self, retval, task_id, args, kwargs):
        """Обработка успешного выполнения"""
        logger.info(f"Editing task {task_id} completed successfully")


@celery_app.task(
    bind=True,
    base=EditingTask,
    max_retries=3,
    default_retry_delay=60,  # 1 минута между попытками
    name="app.tasks.editing.generate_editing_task"
)
def generate_editing_task(
    self,
    generation_id: int,
    user_id: int,
    session_id: str,
    base_image_url: str,
    prompt: str,
) -> dict:
    """
    Celery задача для генерации редактирования изображения.

    Args:
        self: Celery task instance
        generation_id: ID записи Generation в БД
        user_id: ID пользователя
        session_id: UUID сессии чата
        base_image_url: URL базового изображения
        prompt: Промпт для редактирования

    Returns:
        dict: Результат генерации
    """

    async def _run_generation():
        """Async функция для выполнения генерации"""
        async with async_session() as session:
            try:
                # Обновление статуса: processing
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=10
                )

                # Получение информации о пользователе
                user = await session.get(User, user_id)
                if not user:
                    raise ValueError(f"User {user_id} not found")

                # Определение, нужен ли водяной знак
                has_watermark = should_add_watermark(user)

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=30
                )

                # Подготовка исходного изображения
                base_image_id = extract_file_id_from_url(base_image_url)
                base_image_path = get_file_by_id(base_image_id)
                if not base_image_path:
                    raise ValueError("Base image not found for editing")

                base_image_data = image_to_base64_data_url(base_image_path)

                logger.info(
                    f"Starting image editing for generation {generation_id}, "
                    f"prompt: {prompt[:100]}..."
                )

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=50
                )

                # Генерация через OpenRouter (Gemini image model)
                try:
                    openrouter_client = OpenRouterClient()
                    result_url = await openrouter_client.generate_image_edit(
                        base_image_data=base_image_data,
                        prompt=prompt,
                        aspect_ratio="1:1",
                    )
                    await openrouter_client.close()

                    if not result_url:
                        raise ValueError("OpenRouter returned empty image URL")

                    # Обновление прогресса
                    await update_generation_status(
                        session,
                        generation_id,
                        "processing",
                        progress=80
                    )

                    # Сохранение результата локально
                    if result_url.startswith("data:image"):
                        import re

                        match = re.match(r"data:image/(?P<fmt>[^;]+);base64,(?P<data>.+)", result_url)
                        if not match:
                            raise ValueError("Invalid data URL from OpenRouter")

                        image_format = match.group("fmt")
                        base64_data = match.group("data")
                        image_bytes = base64.b64decode(base64_data)

                        file_id, image_url, file_size = await save_upload_file_by_content(
                            content=image_bytes,
                            user_id=user_id,
                            filename=f"editing_{generation_id}.{image_format}",
                        )
                    else:
                        image_url = result_url
                        file_size = 0

                    if image_url and image_url.startswith("/"):
                        image_url = f"{settings.BACKEND_URL}{image_url}"

                    logger.info(
                        f"Saved edited image: {image_url} "
                        f"(size: {file_size} bytes, watermark: {has_watermark})"
                    )

                    # Обновление Generation с результатом
                    await update_generation_status(
                        session,
                        generation_id,
                        "completed",
                        progress=100,
                        image_url=image_url,
                    )

                    # Добавление результата в историю чата
                    chat_history = await session.execute(
                        select(ChatHistory).where(
                            ChatHistory.session_id == session_id,
                            ChatHistory.user_id == user_id,
                        )
                    )
                    chat = chat_history.scalar_one_or_none()

                    if chat:
                        chat.add_message(
                            role="assistant",
                            content=f"Image edited successfully with prompt: {prompt}",
                            image_url=image_url,
                        )
                        await session.commit()
                        logger.info(f"Added result to chat history {session_id}")

                    return {
                        "status": "completed",
                        "image_url": image_url,
                        "has_watermark": has_watermark,
                        "generation_id": generation_id,
                    }

                except OpenRouterError as api_error:
                    logger.error(f"OpenRouter API error: {api_error}")
                    raise

            except Exception as e:
                logger.error(
                    f"Error in editing generation {generation_id}: {e}",
                    exc_info=True
                )

                # Обновление статуса: failed
                await update_generation_status(
                    session,
                    generation_id,
                    "failed",
                    error_message=str(e),
                )

                # Попытка retry
                try:
                    raise self.retry(exc=e, countdown=60)
                except self.MaxRetriesExceededError:
                    logger.error(
                        f"Max retries exceeded for generation {generation_id}"
                    )
                    return {
                        "status": "failed",
                        "error": str(e),
                        "generation_id": generation_id,
                    }

    # Запуск async функции
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(_run_generation())
