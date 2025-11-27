"""
Celery задачи для генерации примерки одежды/аксессуаров.
"""

import asyncio
import logging
import base64
from pathlib import Path
from typing import Optional

from celery import Task

from app.core.config import settings
from app.db.session import async_session
from app.models.generation import Generation
from app.models.user import User
from app.services.file_storage import save_upload_file_by_content, get_file_by_id
from app.services.openrouter import OpenRouterClient, OpenRouterError
from app.services.kie_ai import KieAIClient, KieAIError, KieAITimeoutError, KieAITaskFailedError
from app.tasks.celery_app import celery_app
from app.tasks.utils import (
    extract_file_id_from_url,
    should_add_watermark,
    to_public_url,
    update_generation_status,
    image_to_base64_data_url,
)
from app.utils.image_utils import determine_image_size_for_fitting, convert_iphone_format_to_png
from app.services.fitting_prompts import get_prompt_for_zone

logger = logging.getLogger(__name__)


class FittingTask(Task):
    """
    Базовый класс для задач генерации с поддержкой прогресса.
    """

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Обработка ошибок задачи"""
        # Здесь можно добавить логику отправки уведомлений об ошибке
        pass

    def on_success(self, retval, task_id, args, kwargs):
        """Обработка успешного выполнения"""
        # Здесь можно добавить логику отправки уведомлений об успехе
        pass


@celery_app.task(
    bind=True,
    base=FittingTask,
    max_retries=3,
    default_retry_delay=60,  # 1 минута между попытками
    name="app.tasks.fitting.generate_fitting_task"
)
def generate_fitting_task(
    self,
    generation_id: int,
    user_id: int,
    user_photo_url: str,
    item_photo_url: str,
    accessory_zone: Optional[str] = None,
    credits_cost: int = 2  # Стоимость в кредитах (передаётся из endpoint)
) -> dict:
    """
    Celery задача для генерации примерки.

    Args:
        self: Celery task instance
        generation_id: ID записи Generation в БД
        user_id: ID пользователя
        user_photo_url: URL фото пользователя
        item_photo_url: URL фото одежды/аксессуара
        accessory_zone: Зона аксессуара (опционально)

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

                # Получение промпта
                prompt = await get_prompt_for_zone(session, accessory_zone)

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=30
                )

                # Получение путей к файлам
                user_photo_id = extract_file_id_from_url(user_photo_url)
                item_photo_id = extract_file_id_from_url(item_photo_url)

                user_photo_path = get_file_by_id(user_photo_id)
                item_photo_path = get_file_by_id(item_photo_id)

                if not user_photo_path or not item_photo_path:
                    raise ValueError("Photo files not found")

                # Конвертация iPhone форматов (MPO/HEIC/HEIF) в PNG если необходимо
                logger.info("Checking if iPhone format conversion is needed...")
                user_photo_path = convert_iphone_format_to_png(user_photo_path)
                item_photo_path = convert_iphone_format_to_png(item_photo_path)
                logger.info(f"Using photos: user={user_photo_path.name}, item={item_photo_path.name}")

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=50
                )

                # Определение aspect_ratio из user photo
                aspect_ratio = determine_image_size_for_fitting(user_photo_path)
                logger.info(f"Determined aspect ratio for fitting: {aspect_ratio}")

                # Формирование публичных URL для kie.ai API
                # ВАЖНО: После конвертации iPhone форматов (строки 181-182), файлы могут иметь новые имена
                # с суффиксом "_converted.png" (например: "abc123_converted.png").
                # kie.ai API требует, чтобы URL содержали расширения файлов (.jpg, .png),
                # иначе возвращает ошибку "image_urls file type not supported".
                # Поэтому мы используем user_photo_path.name и item_photo_path.name,
                # которые содержат актуальные имена файлов с расширениями после конвертации.
                # Пример:
                #   До конвертации: user_photo_path = "d9d7de38-...-474ecea0bdeb.jpg" (MPO формат)
                #   После конвертации: user_photo_path = "d9d7de38-...-474ecea0bdeb_converted.png"
                #   Результат URL: "https://ai-generator.mix4.ru/uploads/d9d7de38-...-474ecea0bdeb_converted.png"
                public_user_photo_url = to_public_url(f"uploads/{user_photo_path.name}")
                public_item_photo_url = to_public_url(f"uploads/{item_photo_path.name}")

                # Генерация изображения с виртуальной примеркой
                # Используем kie.ai как primary, OpenRouter как fallback
                generated_image_url = None
                service_used = None

                # Попытка 1: kie.ai (если включен feature flag)
                if settings.USE_KIE_AI and settings.KIE_AI_API_KEY:
                    logger.info("Attempting virtual try-on with kie.ai...")
                    try:
                        # Progress callback для обновления прогресса во время polling
                        async def progress_callback(status: str, progress_pct: int):
                            # Mapping статусов kie.ai к прогрессу
                            # waiting=10%, queuing=30%, generating=60%, success=80%
                            actual_progress = 50 + int(progress_pct * 0.3)  # 50-80%
                            await update_generation_status(
                                session,
                                generation_id,
                                "processing",
                                progress=actual_progress
                            )

                        kie_ai_client = KieAIClient()
                        await update_generation_status(session, generation_id, "processing", progress=55)

                        generated_image_url = await kie_ai_client.generate_virtual_tryon(
                            user_photo_url=public_user_photo_url,
                            item_photo_url=public_item_photo_url,
                            prompt=prompt,
                            image_size=aspect_ratio,
                            progress_callback=progress_callback,
                        )

                        await kie_ai_client.close()
                        service_used = "kie_ai"
                        logger.info("kie.ai virtual try-on successful")

                    except (KieAIError, KieAITimeoutError, KieAITaskFailedError, Exception) as kie_error:
                        logger.warning(
                            f"kie.ai try-on failed: {type(kie_error).__name__}: {kie_error}. "
                            f"Falling back to OpenRouter..."
                        )
                        if settings.KIE_AI_DISABLE_FALLBACK:
                            # Прерываемся, чтобы протестировать kie.ai без OpenRouter
                            raise
                        generated_image_url = None  # Reset для fallback

                # Попытка 2: OpenRouter (fallback или primary если kie.ai отключен)
                if service_used == "kie_ai" and settings.KIE_AI_DISABLE_FALLBACK and not generated_image_url:
                    raise ValueError("kie.ai failed and fallback is disabled")

                if not generated_image_url:
                    if service_used is None:
                        logger.info("Using OpenRouter as primary service (kie.ai disabled or not configured)")
                    else:
                        logger.info("Falling back to OpenRouter after kie.ai failure")

                    try:
                        user_photo_base64 = image_to_base64_data_url(user_photo_path)
                        item_photo_base64 = image_to_base64_data_url(item_photo_path)

                        openrouter_client = OpenRouterClient()
                        await update_generation_status(session, generation_id, "processing", progress=60)

                        generated_image_url = await openrouter_client.generate_virtual_tryon(
                            user_photo_data=user_photo_base64,
                            item_photo_data=item_photo_base64,
                            prompt=prompt,
                            aspect_ratio=aspect_ratio,
                        )

                        await openrouter_client.close()
                        service_used = "openrouter"
                        logger.info("OpenRouter virtual try-on successful")

                    except OpenRouterError as or_error:
                        logger.error(f"OpenRouter try-on failed: {or_error}")
                        raise ValueError(f"Virtual try-on failed on all services: {or_error}")

                if not generated_image_url:
                    raise ValueError("Virtual try-on failed: no image URL generated")

                await update_generation_status(session, generation_id, "processing", progress=80)

                final_image_url = generated_image_url
                if generated_image_url.startswith("data:image"):
                    import re

                    match = re.match(r"data:image/(?P<fmt>[^;]+);base64,(?P<data>.+)", generated_image_url)
                    if match:
                        image_format = match.group("fmt")
                        base64_data = match.group("data")
                        image_bytes = base64.b64decode(base64_data)

                        _, saved_file_url, _ = await save_upload_file_by_content(
                            content=image_bytes,
                            filename=f"tryon_result_{generation_id}.{image_format}",
                            user_id=user_id,
                        )
                        final_image_url = saved_file_url
                        logger.info(f"Saved OpenRouter result to local storage: {saved_file_url}")

                # Нормализуем URL для фронтенда (добавляем backend host если путь относительный)
                if final_image_url and final_image_url.startswith("/"):
                    final_image_url = to_public_url(final_image_url)

                generation = await session.get(Generation, generation_id)
                if generation:
                    generation.status = "completed"
                    generation.image_url = final_image_url
                    generation.has_watermark = has_watermark
                    generation.prompt = prompt
                    if not settings.BILLING_V4_ENABLED:
                        generation.credits_spent = credits_cost
                    await session.commit()

                logger.info(
                    f"Fitting generation completed: generation_id={generation_id}, "
                    f"service={service_used}, aspect_ratio={aspect_ratio}"
                )

                if not settings.BILLING_V4_ENABLED:
                    user = await session.get(User, user_id)
                    if user:
                        from app.services.credits import deduct_credits
                        await deduct_credits(session, user, credits_cost, generation_id=generation_id)
                        logger.info(f"Credits deducted after successful generation: {credits_cost}")

                await update_generation_status(session, generation_id, "completed", progress=100)

                return {
                    "status": "completed",
                    "image_url": final_image_url,
                    "has_watermark": has_watermark,
                }

            except Exception as e:
                # Обработка ошибки
                await update_generation_status(
                    session,
                    generation_id,
                    "failed",
                    error_message=str(e)
                )

                # Retry при определенных ошибках
                if "API" in str(e) or "timeout" in str(e).lower():
                    raise self.retry(exc=e)

                raise

    # Запуск async функции на одном event loop, чтобы избежать "Future attached to a different loop"
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(_run_generation())
