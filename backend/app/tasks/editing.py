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
from app.utils.image_utils import (
    determine_image_size_for_editing,
    convert_iphone_format_to_png,
    ensure_upright_image,
    download_image_bytes,
    normalize_image_bytes,
)
from app.utils.runtime_config import get_generation_providers_for_worker

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
    attachments: list[dict] | None = None,
    primary_provider: str | None = None,
    fallback_provider: str | None = None,
    disable_fallback: bool | None = None,
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
        attachments: Дополнительные вложения (изображения-референсы)

    Returns:
        dict: Результат генерации
    """

    async def _run_generation():
        """Async функция для выполнения генерации"""
        base_image_url_local = base_image_url  # избегаем UnboundLocal при переопределении в блоках ниже
        attachment_items = attachments or []
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
                base_image_id = extract_file_id_from_url(base_image_url_local)
                base_image_path = get_file_by_id(base_image_id)
                if not base_image_path:
                    logger.warning(
                        "Base image %s not found locally for generation %s, trying to re-download",
                        base_image_url_local,
                        generation_id,
                    )
                    try:
                        download_url = to_public_url(base_image_url_local)
                        raw_bytes, ext, content_type = await download_image_bytes(download_url)
                        normalized_bytes, normalized_ext = normalize_image_bytes(raw_bytes, ext)

                        file_id, saved_url, _ = await save_upload_file_by_content(
                            content=normalized_bytes,
                            user_id=user_id,
                            filename=f"editing_base_{generation_id}.{normalized_ext}",
                            content_type=content_type or f"image/{normalized_ext}",
                        )
                        base_image_path = get_file_by_id(file_id)
                        base_image_url_local = saved_url

                        # Синхронизируем base_image_url в чат-сессии, чтобы следующие генерации использовали локальную копию
                        chat_record = await session.execute(
                            select(ChatHistory).where(
                                ChatHistory.session_id == session_id,
                                ChatHistory.user_id == user_id,
                            )
                        )
                        chat = chat_record.scalar_one_or_none()
                        if chat:
                            chat.base_image_url = saved_url
                            await session.commit()

                        logger.info(
                            "Re-saved base image for editing generation %s to %s",
                            generation_id,
                            base_image_url_local,
                        )
                    except Exception as fetch_err:
                        raise ValueError("Base image not found for editing and re-download failed") from fetch_err

                if not base_image_path:
                    raise ValueError("Base image not found for editing")

                # Конвертация iPhone форматов (MPO/HEIC/HEIF) в PNG если необходимо
                logger.info("Checking if iPhone format conversion is needed...")
                base_image_path = convert_iphone_format_to_png(base_image_path)
                base_image_path = ensure_upright_image(base_image_path)
                logger.info(f"Using base image: {base_image_path.name}")

                logger.info(
                    f"Starting image editing for generation {generation_id}, "
                    f"prompt: {prompt[:100]}..."
                )

                # Определение aspect_ratio для сохранения оригинального размера
                aspect_ratio = determine_image_size_for_editing(base_image_path)
                logger.info(f"Determined aspect ratio for editing: {aspect_ratio}")

                # Подготавливаем вложения: публичные URL и data URLs
                attachment_public_urls: list[str] = []
                attachment_data_urls: list[str] = []

                for attachment in attachment_items:
                    url = attachment.get("url")
                    if not url:
                        continue

                    public_url = to_public_url(url)
                    attachment_public_urls.append(public_url)

                    att_path = None
                    try:
                        att_id = extract_file_id_from_url(url)
                        att_path = get_file_by_id(att_id)
                    except Exception:
                        att_path = None

                    if not att_path:
                        try:
                            raw_bytes, ext, content_type = await download_image_bytes(public_url)
                            normalized_bytes, normalized_ext = normalize_image_bytes(raw_bytes, ext)
                            new_id, saved_url, _ = await save_upload_file_by_content(
                                content=normalized_bytes,
                                user_id=user_id,
                                filename=f"attachment_{generation_id}.{normalized_ext}",
                                content_type=content_type or f"image/{normalized_ext}",
                            )
                            att_path = get_file_by_id(new_id)
                            public_url = to_public_url(saved_url)
                            attachment_public_urls[-1] = public_url
                        except Exception as att_err:
                            logger.warning("Failed to cache attachment %s: %s", public_url, att_err)

                    if att_path:
                        try:
                            attachment_data_urls.append(image_to_base64_data_url(att_path))
                        except Exception as data_err:
                            logger.warning("Failed to convert attachment %s to data URL: %s", att_path, data_err)

                # Публичный URL для kie.ai (требуются HTTP ссылки, не base64)
                public_base_image_url = to_public_url(base_image_url_local or str(base_image_path))

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=50
                )

                # Генерация редактирования изображения
                # Порядок провайдеров: primary -> fallback (если задан)
                result_url = None
                service_used = None
                generation_errors: list[str] = []
                base_image_data = None

                resolved_primary, resolved_fallback, disable_from_store = get_generation_providers_for_worker()
                if primary_provider:
                    resolved_primary = primary_provider.lower()
                if fallback_provider:
                    resolved_fallback = fallback_provider.lower()
                if disable_fallback is True:
                    resolved_fallback = None
                elif disable_from_store:
                    resolved_fallback = None

                providers_chain = []
                for candidate in (resolved_primary, resolved_fallback):
                    if candidate and candidate not in providers_chain:
                        providers_chain.append(candidate)

                if not providers_chain:
                    providers_chain.append("openrouter")

                for provider in providers_chain:
                    if provider == "kie_ai":
                        if not settings.KIE_AI_API_KEY:
                            generation_errors.append("kie_ai: API ключ не задан, пропускаем")
                            continue

                        logger.info("Attempting image editing with kie.ai...")
                        try:
                            async def progress_callback(status: str, progress_pct: int):
                                # Mapping статусов kie.ai к прогрессу
                                actual_progress = 50 + int(progress_pct * 0.3)  # 50-80%
                                await update_generation_status(
                                    session,
                                    generation_id,
                                    "processing",
                                    progress=actual_progress
                                )

                            async with KieAIClient() as kie_ai_client:
                                await update_generation_status(session, generation_id, "processing", progress=55)

                                result_url = await kie_ai_client.generate_image_edit(
                                    base_image_url=public_base_image_url,
                                    prompt=prompt,
                                    image_size=aspect_ratio,
                                    attachments_urls=attachment_public_urls,
                                    progress_callback=progress_callback,
                                )

                            service_used = "kie_ai"
                            logger.info("kie.ai image editing successful")
                            break

                        except (KieAIError, KieAITimeoutError, KieAITaskFailedError, Exception) as kie_error:
                            error_text = f"{type(kie_error).__name__}: {kie_error}"
                            generation_errors.append(f"kie_ai: {error_text}")
                            logger.warning(
                                "kie.ai editing failed: %s. %s",
                                error_text,
                                "Fallback to next provider..." if fallback_provider else "No fallback configured",
                            )
                            result_url = None
                            continue

                    elif provider == "openrouter":
                        try:
                            if base_image_data is None:
                                base_image_data = image_to_base64_data_url(base_image_path)

                            async with OpenRouterClient() as openrouter_client:
                                await update_generation_status(session, generation_id, "processing", progress=60)

                                result_url = await openrouter_client.generate_image_edit(
                                    base_image_data=base_image_data,
                                    prompt=prompt,
                                    aspect_ratio=aspect_ratio,
                                    attachments_data=attachment_data_urls,
                                )

                            service_used = "openrouter"
                            logger.info("OpenRouter image editing successful")

                            if not result_url:
                                raise ValueError("OpenRouter returned empty image URL")
                            break

                        except OpenRouterError as or_error:
                            generation_errors.append(f"openrouter: {or_error}")
                            logger.error("OpenRouter editing failed: %s", or_error)
                            result_url = None
                            continue

                    else:
                        generation_errors.append(f"{provider}: unsupported provider")

                if not result_url:
                    details = "; ".join(generation_errors) if generation_errors else "no providers available"
                    raise ValueError(f"Image editing failed on all services: {details}")

                # Обновление прогресса
                await update_generation_status(
                    session,
                    generation_id,
                    "processing",
                    progress=80
                )

                # Сохранение результата локально (всегда re-host, чтобы устранить CORS/EXIF проблемы)
                image_url = result_url
                file_size = 0

                try:
                    if result_url.startswith("data:image"):
                        import re

                        match = re.match(r"data:image/(?P<fmt>[^;]+);base64,(?P<data>.+)", result_url)
                        if not match:
                            raise ValueError("Invalid data URL")

                        image_format = match.group("fmt")
                        base64_data = match.group("data")
                        raw_bytes = base64.b64decode(base64_data)
                        normalized_bytes, normalized_ext = normalize_image_bytes(raw_bytes, image_format)

                        _, saved_url, file_size = await save_upload_file_by_content(
                            content=normalized_bytes,
                            user_id=user_id,
                            filename=f"editing_{generation_id}.{normalized_ext}",
                            content_type=f"image/{normalized_ext}",
                        )
                        image_url = saved_url
                    else:
                        raw_bytes, ext, content_type = await download_image_bytes(result_url)
                        normalized_bytes, normalized_ext = normalize_image_bytes(raw_bytes, ext)
                        _, saved_url, file_size = await save_upload_file_by_content(
                            content=normalized_bytes,
                            user_id=user_id,
                            filename=f"editing_{generation_id}.{normalized_ext}",
                            content_type=content_type or f"image/{normalized_ext}",
                        )
                        image_url = saved_url
                except Exception as save_err:
                    logger.warning("Failed to normalize/save editing result, returning source URL: %s", save_err)

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
                        content="Изображение готово!",
                        image_url=image_url,
                        attachments=attachment_items or None,
                    )
                    await session.commit()
                    logger.info(f"Added result to chat history {session_id}")

                # ✅ СПИСЫВАЕМ КРЕДИТЫ ПОСЛЕ УСПЕШНОЙ ГЕНЕРАЦИИ
                generation_cost = settings.BILLING_GENERATION_COST_CREDITS
                billing_v5_enabled = settings.BILLING_V5_ENABLED

                try:
                    if billing_v5_enabled:
                        from app.services.billing_v5 import BillingV5Service
                        billing = BillingV5Service(session)
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
                        logger.info(f"Charged {generation_cost} credits for generation {generation_id} (Billing v5)")
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
