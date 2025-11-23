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
        "Place the accessory on the existing head without changing the face or hairstyle. "
        "Keep the original head shape and pose, no extra heads or body parts. "
        "Professional portrait lighting, realistic placement, photorealistic 8k."
    ),
    "accessory_face": (
        "Overlay the accessory on the existing face (e.g., glasses/mask) keeping facial features intact. "
        "Do not add extra faces or heads, match perspective and scale to the current face. "
        "Natural lighting, realistic fit, photorealistic 8k."
    ),
    "accessory_neck": (
        "Place the accessory on the current neck/collarbone area, preserving the person’s pose and skin. "
        "No extra necks or bodies. Realistic jewelry placement, elegant portrait lighting, photorealistic 8k."
    ),
    "accessory_hands": (
        "Place the accessory precisely on the existing wrist of the person in the photo. "
        "Do not add or replace arms or hands; preserve the original arm shape, pose, and skin. "
        "Match scale, angle, and perspective to the current wrist; keep lighting and skin tone consistent. "
        "Avoid oversized accessories and avoid covering the body. Photorealistic, high detail, 8k quality."
    ),
    "accessory_legs": (
        "Place the footwear on the existing feet of the person. "
        "Do not add extra legs or change the body/pose. "
        "Match scale, angle, and perspective to the current feet and floor; keep background unchanged and original framing/aspect ratio. "
        "Preserve skin, ankles, and original lighting; avoid oversized or floating shoes. "
        "Do not add white or blank margins; do not extend canvas. Photorealistic, high detail, 8k quality."
    ),
    "accessory_body": (
        "Replace clothing on the existing body while keeping the person’s pose, proportions, and skin visible. "
        "No extra limbs or duplicated body parts. Realistic fit and draping, studio lighting, photorealistic 8k."
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
                    final_image_url = f"{settings.BACKEND_URL}{final_image_url}"

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
