"""
Celery задачи для генерации редактирования изображений.
"""

import asyncio
import logging
import base64

from celery import Task
from sqlalchemy import select

from app.core.config import settings
from app.db.session import async_session
from app.models.user import User
from app.models.generation import Generation
from app.models.chat import ChatHistory
from app.services.file_storage import save_upload_file_by_content, get_file_by_id
from app.services.openrouter import OpenRouterClient, OpenRouterError
from app.services.kie_ai import KieAIClient, KieAIError, KieAITimeoutError, KieAITaskFailedError
from app.tasks.celery_app import celery_app
from app.tasks.utils import (
    should_add_watermark,
    to_public_url,
    update_generation_status,
    extract_file_id_from_url,
    image_to_base64_data_url,
)
from app.utils.image_utils import determine_image_size_for_editing, convert_iphone_format_to_png

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
    max_retries=0,  # избегаем автоповторов, чтобы не сжигать токены на OpenRouter
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

                # Конвертация iPhone форматов (MPO/HEIC/HEIF) в PNG если необходимо
                logger.info("Checking if iPhone format conversion is needed...")
                base_image_path = convert_iphone_format_to_png(base_image_path)
                logger.info(f"Using base image: {base_image_path.name}")

                logger.info(
                    f"Starting image editing for generation {generation_id}, "
                    f"prompt: {prompt[:100]}..."
                )

                # Определение aspect_ratio для сохранения оригинального размера
                aspect_ratio = determine_image_size_for_editing(base_image_path)
                logger.info(f"Determined aspect ratio for editing: {aspect_ratio}")

                # Публичный URL для kie.ai (требуются HTTP ссылки, не base64)
                public_base_image_url = to_public_url(base_image_url or str(base_image_path))

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=50
                )

                # Генерация редактирования изображения
                # Используем kie.ai как primary, OpenRouter как fallback
                result_url = None
                service_used = None

                # Попытка 1: kie.ai (если включен feature flag)
                if settings.USE_KIE_AI and settings.KIE_AI_API_KEY:
                    logger.info("Attempting image editing with kie.ai...")
                    try:
                        # Progress callback для обновления прогресса во время polling
                        async def progress_callback(status: str, progress_pct: int):
                            # Mapping статусов kie.ai к прогрессу
                            actual_progress = 50 + int(progress_pct * 0.3)  # 50-80%
                            await update_generation_status(
                                session,
                                generation_id,
                                "processing",
                                progress=actual_progress
                            )

                        kie_ai_client = KieAIClient()
                        await update_generation_status(session, generation_id, "processing", progress=55)

                        result_url = await kie_ai_client.generate_image_edit(
                            base_image_url=public_base_image_url,
                            prompt=prompt,
                            image_size=aspect_ratio,
                            progress_callback=progress_callback,
                        )

                        await kie_ai_client.close()
                        service_used = "kie_ai"
                        logger.info("kie.ai image editing successful")

                    except (KieAIError, KieAITimeoutError, KieAITaskFailedError, Exception) as kie_error:
                        logger.warning(
                            f"kie.ai editing failed: {type(kie_error).__name__}: {kie_error}. "
                            f"Falling back to OpenRouter..."
                        )
                        if settings.KIE_AI_DISABLE_FALLBACK:
                            # Прерываемся, чтобы увидеть ошибку kie.ai во время тестов
                            raise
                        result_url = None  # Reset для fallback

                # Попытка 2: OpenRouter (fallback или primary если kie.ai отключен)
                if service_used == "kie_ai" and settings.KIE_AI_DISABLE_FALLBACK and not result_url:
                    raise ValueError("kie.ai failed and fallback is disabled")

                if not result_url:
                    if service_used is None:
                        logger.info("Using OpenRouter as primary service (kie.ai disabled or not configured)")
                    else:
                        logger.info("Falling back to OpenRouter after kie.ai failure")

                    try:
                        base_image_data = image_to_base64_data_url(base_image_path)

                        openrouter_client = OpenRouterClient()
                        await update_generation_status(session, generation_id, "processing", progress=60)

                        result_url = await openrouter_client.generate_image_edit(
                            base_image_data=base_image_data,
                            prompt=prompt,
                            aspect_ratio=aspect_ratio,
                        )

                        await openrouter_client.close()
                        service_used = "openrouter"
                        logger.info("OpenRouter image editing successful")

                        if not result_url:
                            raise ValueError("OpenRouter returned empty image URL")

                    except OpenRouterError as or_error:
                        logger.error(f"OpenRouter editing failed: {or_error}")
                        raise ValueError(f"Image editing failed on all services: {or_error}")

                if not result_url:
                    raise ValueError("Image editing failed: no image URL generated")

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
                        raise ValueError("Invalid data URL")

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
                    image_url = to_public_url(image_url)

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

                logger.info(
                    f"Editing generation completed: generation_id={generation_id}, "
                    f"service={service_used}, aspect_ratio={aspect_ratio}"
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
                    # Обновляем базовое изображение для следующих запросов
                    chat.base_image_url = image_url
                    chat.add_message(
                        role="assistant",
                        content=f"Image edited successfully with prompt: {prompt}",
                        image_url=image_url,
                    )
                    await session.commit()
                    logger.info(f"Added result to chat history {session_id}")

                # ✅ СПИСЫВАЕМ КРЕДИТЫ ПОСЛЕ УСПЕШНОЙ ГЕНЕРАЦИИ
                generation_cost = settings.BILLING_GENERATION_COST_CREDITS
                billing_v4_enabled = settings.BILLING_V4_ENABLED

                try:
                    if billing_v4_enabled:
                        from app.services.billing_v4 import BillingV4Service
                        billing = BillingV4Service(session)
                        charge_info = await billing.charge_generation(
                            user_id,
                            kind="edit",
                            meta={
                                "generation_id": generation_id,
                                "feature": "editing_generation",
                                "session_id": session_id,
                            },
                            cost_credits=generation_cost,
                        )
                        generation_record = await session.get(Generation, generation_id)
                        if generation_record:
                            generation_record.credits_spent = (
                                generation_cost
                                if charge_info and charge_info.get("payment_source") == "credits"
                                else 0
                            )
                            await session.commit()
                        logger.info(f"Charged {generation_cost} credits for generation {generation_id} (Billing v4)")
                    else:
                        # Billing v3
                        from app.services.credits import deduct_credits

                        # Получаем User и Generation для обновления
                        user = await session.get(User, user_id)
                        generation = await session.get(Generation, generation_id)

                        if user and generation:
                            await deduct_credits(
                                session=session,
                                user=user,
                                credits_cost=generation_cost,
                                generation_id=generation_id,
                            )
                            # Обновляем credits_spent в Generation
                            generation.credits_spent = generation_cost
                            await session.commit()
                            logger.info(f"Deducted {generation_cost} credits for generation {generation_id} (Billing v3)")
                except Exception as credit_error:
                    logger.error(f"Failed to charge credits for generation {generation_id}: {credit_error}", exc_info=True)
                    # НЕ прерываем выполнение — изображение уже сгенерировано

                return {
                    "status": "completed",
                    "image_url": image_url,
                    "has_watermark": has_watermark,
                    "generation_id": generation_id,
                }

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
