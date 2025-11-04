"""
Celery задачи для генерации примерки одежды/аксессуаров.
"""

import asyncio
from datetime import datetime
from typing import Optional

from celery import Task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import async_session
from app.models.generation import Generation
from app.models.user import User
from app.services.file_storage import save_upload_file_by_content, get_file_by_id
from app.services.kie_ai import KieAIClient
from app.tasks.celery_app import celery_app


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
    accessory_zone: Optional[str] = None
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
                await _update_generation_status(
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
                has_watermark = _should_add_watermark(user)

                # Получение промпта
                prompt = _get_prompt_for_zone(accessory_zone)

                # Обновление прогресса
                await _update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=30
                )

                # Вызов kie.ai API
                kie_client = KieAIClient(
                    api_key=settings.KIE_AI_API_KEY,
                    base_url=settings.KIE_AI_BASE_URL
                )

                # Получение путей к файлам
                user_photo_id = user_photo_url.split("/")[-1].split(".")[0]
                item_photo_id = item_photo_url.split("/")[-1].split(".")[0]

                user_photo_path = get_file_by_id(user_photo_id)
                item_photo_path = get_file_by_id(item_photo_id)

                if not user_photo_path or not item_photo_path:
                    raise ValueError("Photo files not found")

                # Обновление прогресса
                await _update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=50
                )

                # Генерация изображения
                result = await kie_client.generate_image(
                    prompt=prompt,
                    model=settings.KIE_AI_MODEL,
                    num_images=1,
                    width=1024,
                    height=1024,
                )

                if not result or "images" not in result or not result["images"]:
                    raise ValueError("No images generated")

                # Получение URL сгенерированного изображения
                generated_image_url = result["images"][0]

                # Обновление прогресса
                await _update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=80
                )

                # TODO: Скачать изображение и сохранить локально
                # TODO: Добавить водяной знак если has_watermark=True

                # Обновление Generation в БД
                generation = await session.get(Generation, generation_id)
                if generation:
                    generation.status = "completed"
                    generation.image_url = generated_image_url
                    generation.has_watermark = has_watermark
                    generation.prompt = prompt
                    await session.commit()

                # Обновление прогресса
                await _update_generation_status(
                    session,
                    generation_id,
                    "completed",
                    progress=100
                )

                return {
                    "status": "completed",
                    "image_url": generated_image_url,
                    "has_watermark": has_watermark,
                }

            except Exception as e:
                # Обработка ошибки
                await _update_generation_status(
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


async def _update_generation_status(
    session: AsyncSession,
    generation_id: int,
    status: str,
    progress: Optional[int] = None,
    error_message: Optional[str] = None
):
    """
    Обновить статус генерации в БД.

    Args:
        session: SQLAlchemy async session
        generation_id: ID генерации
        status: Новый статус
        progress: Прогресс в процентах (опционально)
        error_message: Сообщение об ошибке (опционально)
    """
    generation = await session.get(Generation, generation_id)

    if generation:
        generation.status = status

        if error_message:
            # TODO: Добавить поле error_message в модель Generation если нужно
            pass

        await session.commit()

    # TODO: Отправить обновление через WebSocket/Redis для real-time уведомлений


def _should_add_watermark(user: User) -> bool:
    """
    Определить, нужно ли добавлять водяной знак.

    Args:
        user: Объект пользователя

    Returns:
        bool: True если нужен водяной знак
    """
    # Водяной знак для Freemium пользователей
    if user.balance_credits > 0:
        return False

    if user.subscription_type and user.subscription_end:
        if user.subscription_end > datetime.utcnow():
            return False

    # Freemium пользователи получают водяной знак
    return True
