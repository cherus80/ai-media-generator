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
from app.services.grsai import GrsAIClient, GrsAIError, GrsAITimeoutError, GrsAITaskFailedError
from app.tasks.celery_app import celery_app
from app.tasks.utils import (
    extract_file_id_from_url,
    should_add_watermark,
    to_public_url,
    update_generation_status,
    image_to_base64_data_url,
)
from app.utils.image_utils import (
    determine_image_size_for_fitting,
    convert_iphone_format_to_png,
    ensure_upright_image,
    pad_image_to_match_reference,
    download_image_bytes,
    normalize_image_bytes,
)
from app.utils.runtime_config import get_generation_providers_for_worker
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
    credits_cost: int = 2,  # Стоимость в кредитах (передаётся из endpoint)
    primary_provider: str | None = None,
    fallback_provider: str | None = None,
    disable_fallback: bool | None = None,
    aspect_ratio: str | None = None,
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

    async def _run_generation(requested_aspect_ratio: str | None = aspect_ratio):
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
                user_photo_path = ensure_upright_image(user_photo_path)
                item_photo_path = ensure_upright_image(item_photo_path)
                logger.info(f"Using photos: user={user_photo_path.name}, item={item_photo_path.name}")

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=50
                )

                # Определение aspect_ratio: если выбрано auto, берём пропорции user photo
                resolved_aspect_ratio = (requested_aspect_ratio or "auto").lower()
                if resolved_aspect_ratio == "auto":
                    resolved_aspect_ratio = determine_image_size_for_fitting(user_photo_path)
                    logger.info("Determined aspect ratio for fitting: %s", resolved_aspect_ratio)
                else:
                    logger.info("Using requested aspect ratio for fitting: %s", resolved_aspect_ratio)

                # Паддинг item-фото под геометрию user-фото (без искажений)
                try:
                    padded_item_photo_path = pad_image_to_match_reference(
                        reference_path=user_photo_path,
                        image_path=item_photo_path,
                    )
                    item_photo_path = padded_item_photo_path
                    logger.info("Padded item photo to match user geometry: %s", item_photo_path.name)
                except Exception as e:
                    logger.warning("Failed to pad item photo to user geometry, continue with original: %s", e)

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
                # Порядок провайдеров: primary -> fallback (если задан)
                generated_image_url = None
                service_used = None
                generation_errors: list[str] = []
                user_photo_base64 = None
                item_photo_base64 = None

                resolved_primary, resolved_fallback, disable_from_store = get_generation_providers_for_worker()
                if primary_provider:
                    resolved_primary = primary_provider.lower()
                if fallback_provider:
                    resolved_fallback = fallback_provider.lower()
                if disable_fallback is True or disable_from_store:
                    resolved_fallback = None

                providers_chain = []
                for candidate in (resolved_primary, resolved_fallback):
                    if candidate and candidate not in providers_chain:
                        providers_chain.append(candidate)

                if not providers_chain:
                    providers_chain.append("grsai")

                for provider in providers_chain:
                    if provider == "grsai":
                        if not settings.GRS_AI_API_KEY:
                            generation_errors.append("grsai: API ключ не задан, пропускаем")
                            continue

                        logger.info("Attempting virtual try-on with GrsAI...")
                        try:
                            async def progress_callback(status: str, progress_pct: int):
                                actual_progress = 50 + int(progress_pct * 0.3)  # 50-80%
                                await update_generation_status(
                                    session,
                                    generation_id,
                                    "processing",
                                    progress=actual_progress
                                )

                            async with GrsAIClient() as grs_client:
                                await update_generation_status(session, generation_id, "processing", progress=55)

                                generated_image_url = await grs_client.generate_image(
                                    prompt=prompt,
                                    urls=[public_user_photo_url, public_item_photo_url],
                                    aspect_ratio=resolved_aspect_ratio,
                                    image_size=settings.GRS_AI_IMAGE_SIZE,
                                    progress_callback=progress_callback,
                                )

                            service_used = "grsai"
                            logger.info("GrsAI virtual try-on successful")
                            break

                        except (GrsAIError, GrsAITimeoutError, GrsAITaskFailedError, Exception) as grs_error:
                            error_text = f"{type(grs_error).__name__}: {grs_error}"
                            generation_errors.append(f"grsai: {error_text}")
                            logger.warning(
                                "GrsAI try-on failed: %s. %s",
                                error_text,
                                "Fallback to next provider..." if fallback_provider else "No fallback configured",
                            )
                            generated_image_url = None
                            continue

                    elif provider == "kie_ai":
                        if not settings.KIE_AI_API_KEY:
                            generation_errors.append("kie_ai: API ключ не задан, пропускаем")
                            continue

                        logger.info("Attempting virtual try-on with kie.ai...")
                        try:
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

                            async with KieAIClient() as kie_ai_client:
                                await update_generation_status(session, generation_id, "processing", progress=55)

                                generated_image_url = await kie_ai_client.generate_virtual_tryon(
                                    user_photo_url=public_user_photo_url,
                                    item_photo_url=public_item_photo_url,
                                    prompt=prompt,
                                    image_size=resolved_aspect_ratio,
                                    progress_callback=progress_callback,
                                )

                            service_used = "kie_ai"
                            logger.info("kie.ai virtual try-on successful")
                            break

                        except (KieAIError, KieAITimeoutError, KieAITaskFailedError, Exception) as kie_error:
                            error_text = f"{type(kie_error).__name__}: {kie_error}"
                            generation_errors.append(f"kie_ai: {error_text}")
                            logger.warning(
                                "kie.ai try-on failed: %s. %s",
                                error_text,
                                "Fallback to next provider..." if fallback_provider else "No fallback configured",
                            )
                            generated_image_url = None
                            continue

                    elif provider == "openrouter":
                        try:
                            if user_photo_base64 is None or item_photo_base64 is None:
                                user_photo_base64 = image_to_base64_data_url(user_photo_path)
                                item_photo_base64 = image_to_base64_data_url(item_photo_path)

                            async with OpenRouterClient() as openrouter_client:
                                await update_generation_status(session, generation_id, "processing", progress=60)

                                generated_image_url = await openrouter_client.generate_virtual_tryon(
                                    user_photo_data=user_photo_base64,
                                    item_photo_data=item_photo_base64,
                                    prompt=prompt,
                                    aspect_ratio=resolved_aspect_ratio,
                                )
                            service_used = "openrouter"
                            logger.info("OpenRouter virtual try-on successful")
                            break

                        except OpenRouterError as or_error:
                            generation_errors.append(f"openrouter: {or_error}")
                            logger.error("OpenRouter try-on failed: %s", or_error)
                            generated_image_url = None
                            continue

                    else:
                        generation_errors.append(f"{provider}: unsupported provider")

                if not generated_image_url:
                    details = "; ".join(generation_errors) if generation_errors else "no providers available"
                    raise ValueError(f"Virtual try-on failed on all services: {details}")

                if not generated_image_url:
                    raise ValueError("Virtual try-on failed: no image URL generated")

                await update_generation_status(session, generation_id, "processing", progress=80)

                final_image_url = generated_image_url
                try:
                    # Скачиваем/декодируем результат, нормализуем ориентацию и сохраняем локально,
                    # чтобы избежать проблем с CORS и EXIF.
                    if generated_image_url.startswith("data:image"):
                        import re

                        match = re.match(r"data:image/(?P<fmt>[^;]+);base64,(?P<data>.+)", generated_image_url)
                        if not match:
                            raise ValueError("Invalid data URL")

                        image_format = match.group("fmt")
                        base64_data = match.group("data")
                        raw_bytes = base64.b64decode(base64_data)
                        normalized_bytes, normalized_ext = normalize_image_bytes(
                            raw_bytes,
                            image_format,
                        )
                        normalized_content_type = (
                            "image/jpeg" if normalized_ext in {"jpg", "jpeg"} else f"image/{normalized_ext}"
                        )
                        _, saved_file_url, _ = await save_upload_file_by_content(
                            content=normalized_bytes,
                            filename=f"tryon_result_{generation_id}.{normalized_ext}",
                            content_type=normalized_content_type,
                            user_id=user_id,
                        )
                        final_image_url = saved_file_url
                    else:
                        raw_bytes, ext, content_type = await download_image_bytes(generated_image_url)
                        normalized_bytes, normalized_ext = normalize_image_bytes(
                            raw_bytes,
                            ext,
                        )
                        normalized_content_type = content_type or (
                            "image/jpeg" if normalized_ext in {"jpg", "jpeg"} else f"image/{normalized_ext}"
                        )
                        _, saved_file_url, _ = await save_upload_file_by_content(
                            content=normalized_bytes,
                            filename=f"tryon_result_{generation_id}.{normalized_ext}",
                            content_type=normalized_content_type,
                            user_id=user_id,
                        )
                        final_image_url = saved_file_url

                    logger.info(f"Saved try-on result to local storage: {final_image_url}")
                except Exception as save_err:
                    logger.warning("Failed to normalize/save try-on result, returning source URL: %s", save_err)

                # Нормализуем URL для фронтенда (добавляем backend host если путь относительный)
                if final_image_url and final_image_url.startswith("/"):
                    final_image_url = to_public_url(final_image_url)

                generation = await session.get(Generation, generation_id)
                if generation:
                    generation.status = "completed"
                    generation.image_url = final_image_url
                    generation.has_watermark = has_watermark
                    generation.prompt = prompt
                    generation.credits_spent = credits_cost
                    await session.commit()

                logger.info(
                    f"Fitting generation completed: generation_id={generation_id}, "
                    f"service={service_used}, aspect_ratio={resolved_aspect_ratio}"
                )

                if not settings.BILLING_V5_ENABLED:
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
