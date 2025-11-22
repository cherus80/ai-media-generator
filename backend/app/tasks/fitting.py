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
from app.tasks.celery_app import celery_app
from app.tasks.utils import (
    extract_file_id_from_url,
    should_add_watermark,
    update_generation_status,
    image_to_base64_data_url,
)

logger = logging.getLogger(__name__)


# Фиксированные промпты для примерки
FITTING_PROMPTS = {
    "clothing": (
        "A high-quality fashion photoshoot showing a person wearing the clothing item. "
        "Professional studio lighting, clean background, realistic fit and draping. "
        "Photorealistic, 8k, detailed fabric texture."
    ),
    "accessory_head": (
        "A professional portrait showing a person wearing the accessory on their head. "
        "Clear focus on the accessory, natural lighting, realistic placement. "
        "High detail, photorealistic, 8k quality."
    ),
    "accessory_face": (
        "A professional close-up portrait showing a person wearing the accessory on their face. "
        "Clear focus on glasses/mask, natural lighting, realistic fit and placement. "
        "High detail, photorealistic, 8k quality."
    ),
    "accessory_neck": (
        "A fashion portrait focusing on the neck area with the accessory. "
        "Professional lighting, elegant pose, realistic jewelry placement. "
        "Photorealistic, high detail, 8k quality."
    ),
    "accessory_hands": (
        "A close-up shot of hands wearing the accessory. "
        "Professional lighting, natural hand position, realistic fit. "
        "High detail, photorealistic, 8k quality."
    ),
    "accessory_legs": (
        "A fashion shot showing legs wearing the accessory. "
        "Professional lighting, natural pose, realistic placement. "
        "Photorealistic, high detail, 8k quality."
    ),
    "accessory_body": (
        "A full-body fashion photoshoot showing a person wearing the clothing item. "
        "Professional studio lighting, clean background, realistic fit and draping. "
        "Photorealistic, 8k, detailed fabric texture, full body view."
    ),
}


def _get_prompt_for_zone(zone: Optional[str]) -> str:
    """
    Получить промпт в зависимости от зоны аксессуара.

    Args:
        zone: Зона аксессуара (head, face, neck, hands, legs, body) или None для одежды

    Returns:
        str: Промпт для генерации
    """
    if not zone:
        return FITTING_PROMPTS["clothing"]

    zone_key = f"accessory_{zone.lower()}"
    return FITTING_PROMPTS.get(zone_key, FITTING_PROMPTS["clothing"])


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
                prompt = _get_prompt_for_zone(accessory_zone)

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

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=50
                )


                # Генерация изображения с виртуальной примеркой — теперь сразу через OpenRouter
                try:
                    user_photo_base64 = image_to_base64_data_url(user_photo_path)
                    item_photo_base64 = image_to_base64_data_url(item_photo_path)

                    openrouter_client = OpenRouterClient()
                    await update_generation_status(session, generation_id, "processing", progress=60)

                    generated_image_url = await openrouter_client.generate_virtual_tryon(
                        user_photo_data=user_photo_base64,
                        item_photo_data=item_photo_base64,
                        prompt=prompt,
                        aspect_ratio="1:1",
                    )

                    await openrouter_client.close()
                    logger.info("OpenRouter virtual try-on successful")

                except OpenRouterError as or_error:
                    logger.error(f"OpenRouter try-on failed: {or_error}")
                    raise ValueError(f"Virtual try-on failed: {or_error}")

                await update_generation_status(session, generation_id, "processing", progress=80)

                final_image_url = generated_image_url
                if generated_image_url.startswith("data:image"):
                    import re

                    match = re.match(r"data:image/(\w+);base64,(.+)", generated_image_url)
                    if match:
                        image_format = match.group(1)
                        base64_data = match.group(2)
                        image_bytes = base64.b64decode(base64_data)

                        _, saved_file_url, _ = await save_upload_file_by_content(
                            content=image_bytes,
                            filename=f"tryon_result_{generation_id}.{image_format}",
                            user_id=user_id,
                        )
                        final_image_url = saved_file_url
                        logger.info(f"Saved OpenRouter result to local storage: {saved_file_url}")

                generation = await session.get(Generation, generation_id)
                if generation:
                    generation.status = "completed"
                    generation.image_url = final_image_url
                    generation.has_watermark = has_watermark
                    generation.prompt = prompt
                    generation.credits_spent = credits_cost
                    await session.commit()

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

    # Запуск async функции
    return asyncio.run(_run_generation())
