"""
Celery задачи для генерации редактирования изображений.
"""

import asyncio
import logging
import base64
import ipaddress
from urllib.parse import urlparse

from celery import Task
import httpx
from sqlalchemy import select

from app.core.config import settings
from app.db.session import async_session
from app.models.user import User
from app.models.generation import Generation
from app.models.chat import ChatHistory
from app.services.file_storage import save_upload_file_by_content, get_file_by_id
from app.services.kie_ai import KieAIClient, KieAIError, KieAITimeoutError, KieAITaskFailedError
from app.services.telegram_alerts import notify_error
from app.services.grsai import (
    GrsAIClient,
    GrsAIError,
    GrsAITimeoutError,
    GrsAITaskFailedError,
    GrsAIRateLimitError,
    GrsAIServerError,
)
from app.tasks.celery_app import celery_app
from app.tasks.utils import (
    should_add_watermark,
    to_public_url,
    update_generation_status,
    extract_file_id_from_url,
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
USER_ERROR_MESSAGE = "Произошла ошибка, повторите запрос еще раз или зайдите позже"


def _is_private_or_local_host(hostname: str | None) -> bool:
    if not hostname:
        return True
    normalized = hostname.strip().lower()
    if normalized in {"localhost", "127.0.0.1", "::1"}:
        return True
    try:
        parsed_ip = ipaddress.ip_address(normalized)
        return (
            parsed_ip.is_private
            or parsed_ip.is_loopback
            or parsed_ip.is_link_local
            or parsed_ip.is_reserved
        )
    except ValueError:
        return False


def _url_is_publicly_reachable_candidate(url: str | None) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    return not _is_private_or_local_host(parsed.hostname)


async def _probe_remote_image_url(url: str) -> bool:
    """
    Лёгкий preflight на доступность изображения по URL.
    Нужен для URL-only провайдеров (GrsAI/kie.ai), чтобы не отправлять им мёртвые ссылки.
    """
    if not _url_is_publicly_reachable_candidate(url):
        return False

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0), follow_redirects=True) as client:
            response = await client.get(url, headers={"Range": "bytes=0-2048"})
            return response.status_code < 400
    except Exception:
        return False


def _select_fallback_base_attachment_url(attachments: list[dict] | None) -> str | None:
    """
    Выбрать URL вложения, которое можно использовать как fallback базового изображения.

    Приоритет:
    1. attachment с role=base/base-extra/source/original
    2. первый attachment с валидным url
    """
    if not attachments:
        return None

    preferred_roles = {"base", "base-extra", "source", "original"}
    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue
        url = attachment.get("url")
        if not url:
            continue
        role = str(attachment.get("role") or "").strip().lower()
        if role in preferred_roles:
            return str(url)

    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue
        url = attachment.get("url")
        if url:
            return str(url)

    return None


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
    max_retries=0,  # избегаем автоповторов, чтобы не сжигать лимиты внешних провайдеров
    name="app.tasks.editing.generate_editing_task"
)
def generate_editing_task(
    self,
    generation_id: int,
    user_id: int,
    session_id: str,
    base_image_url: str | None,
    prompt: str,
    attachments: list[dict] | None = None,
    primary_provider: str | None = None,
    fallback_provider: str | None = None,
    disable_fallback: bool | None = None,
    aspect_ratio: str | None = None,
) -> dict:
    """
    Celery задача для генерации редактирования изображения.

    Args:
        self: Celery task instance
        generation_id: ID записи Generation в БД
        user_id: ID пользователя
        session_id: UUID сессии чата
        base_image_url: URL базового изображения (опционально для text-to-image)
        prompt: Промпт для редактирования
        attachments: Дополнительные вложения (изображения-референсы)

    Returns:
        dict: Результат генерации
    """

    async def _run_generation(requested_aspect_ratio: str | None = aspect_ratio):
        """Async функция для выполнения генерации"""
        user = None
        service_used = None
        base_image_url_local = base_image_url  # избегаем UnboundLocal при переопределении в блоках ниже
        base_image_path = None
        attachment_items = attachments or []
        async with async_session() as session:
            try:
                async def _sync_chat_base_image_url(new_url: str) -> None:
                    chat_record = await session.execute(
                        select(ChatHistory).where(
                            ChatHistory.session_id == session_id,
                            ChatHistory.user_id == user_id,
                        )
                    )
                    chat = chat_record.scalar_one_or_none()
                    if chat and chat.base_image_url != new_url:
                        chat.base_image_url = new_url
                        await session.commit()

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

                # Подготовка исходного изображения (опционально)
                if base_image_url_local:
                    original_base_image_url = base_image_url_local
                    candidate_base_urls: list[str] = [base_image_url_local]
                    fallback_attachment_base_url = _select_fallback_base_attachment_url(attachment_items)
                    if (
                        fallback_attachment_base_url
                        and fallback_attachment_base_url not in candidate_base_urls
                    ):
                        candidate_base_urls.append(fallback_attachment_base_url)

                    last_fetch_error: Exception | None = None
                    for candidate_base_url in candidate_base_urls:
                        base_image_id = extract_file_id_from_url(candidate_base_url)
                        base_image_path = get_file_by_id(base_image_id)
                        if base_image_path:
                            if candidate_base_url != original_base_image_url:
                                logger.warning(
                                    "Base image %s missing for generation %s, using attachment fallback %s",
                                    original_base_image_url,
                                    generation_id,
                                    candidate_base_url,
                                )
                                base_image_url_local = candidate_base_url
                                await _sync_chat_base_image_url(base_image_url_local)
                            break

                        logger.warning(
                            "Base image %s not found locally for generation %s, trying to re-download",
                            candidate_base_url,
                            generation_id,
                        )
                        try:
                            download_url = to_public_url(candidate_base_url)
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
                            await _sync_chat_base_image_url(saved_url)

                            logger.info(
                                "Re-saved base image for editing generation %s to %s",
                                generation_id,
                                base_image_url_local,
                            )
                            break
                        except Exception as fetch_err:
                            last_fetch_error = fetch_err
                            logger.warning(
                                "Failed to fetch base image candidate %s for generation %s: %s",
                                candidate_base_url,
                                generation_id,
                                fetch_err,
                            )
                            base_image_path = None
                            continue

                    if not base_image_path:
                        if last_fetch_error is not None:
                            raise ValueError("Base image not found for editing and re-download failed") from last_fetch_error
                        raise ValueError("Base image not found for editing")

                    # Конвертация iPhone форматов (MPO/HEIC/HEIF) в PNG если необходимо
                    logger.info("Checking if iPhone format conversion is needed...")
                    base_image_path = convert_iphone_format_to_png(base_image_path)
                    base_image_path = ensure_upright_image(base_image_path)
                    logger.info(f"Using base image: {base_image_path.name}")
                else:
                    logger.info("No base image provided for generation %s (text-to-image mode)", generation_id)

                logger.info(
                    f"Starting image editing for generation {generation_id}, "
                    f"prompt: {prompt[:100]}..."
                )

                # Определение aspect_ratio: если base image есть и выбрано auto, берём его пропорции
                resolved_aspect_ratio = (requested_aspect_ratio or "auto").lower()
                if resolved_aspect_ratio == "auto" and base_image_path is not None:
                    resolved_aspect_ratio = determine_image_size_for_editing(base_image_path)
                    logger.info("Determined aspect ratio for editing: %s", resolved_aspect_ratio)
                else:
                    logger.info("Using requested aspect ratio for editing: %s", resolved_aspect_ratio)

                # Подготавливаем вложения: публичные URL
                attachment_public_urls: list[str] = []

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

                # Публичный URL для kie.ai (требуются HTTP ссылки, не base64)
                public_base_image_url = (
                    to_public_url(base_image_url_local)
                    if base_image_url_local
                    else None
                )

                # Проверяем, что URL референсов реально доступны для внешних провайдеров.
                # Иначе GrsAI/kie.ai могут silently сгенерировать почти text-to-image без лица пользователя.
                reference_urls_for_url_providers: list[str] = []
                if public_base_image_url:
                    reference_urls_for_url_providers.append(public_base_image_url)
                if attachment_public_urls:
                    reference_urls_for_url_providers.extend(attachment_public_urls)

                url_provider_refs_are_reachable = True
                if reference_urls_for_url_providers:
                    probe_results = await asyncio.gather(
                        *[_probe_remote_image_url(url) for url in reference_urls_for_url_providers],
                        return_exceptions=False,
                    )
                    url_provider_refs_are_reachable = all(probe_results)
                    if not url_provider_refs_are_reachable:
                        logger.warning(
                            "Some reference URLs are not publicly reachable for generation %s. "
                            "External providers may not be able to use these references.",
                            generation_id,
                        )

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
                    providers_chain.append("grsai")

                for provider in providers_chain:
                    if provider == "grsai":
                        if not settings.GRS_AI_API_KEY:
                            generation_errors.append("grsai: API ключ не задан, пропускаем")
                            continue

                        logger.info("Attempting image editing with GrsAI...")
                        try:
                            async def progress_callback(status: str, progress_pct: int):
                                actual_progress = 50 + int(progress_pct * 0.3)  # 50-80%
                                await update_generation_status(
                                    session,
                                    generation_id,
                                    "processing",
                                    progress=actual_progress
                                )

                            urls: list[str] = []
                            if public_base_image_url:
                                urls.append(public_base_image_url)
                            if attachment_public_urls:
                                urls.extend(attachment_public_urls)
                            urls_payload = urls or None

                            primary_model = settings.GRS_AI_MODEL
                            fallback_model = settings.GRS_AI_FALLBACK_MODEL
                            retryable_grs_errors = (
                                GrsAIServerError,
                                GrsAIRateLimitError,
                                GrsAITimeoutError,
                                GrsAITaskFailedError,
                            )

                            async with GrsAIClient() as grs_client:
                                await update_generation_status(session, generation_id, "processing", progress=55)

                                try:
                                    result_url = await grs_client.generate_image(
                                        prompt=prompt,
                                        urls=urls_payload,
                                        aspect_ratio=resolved_aspect_ratio,
                                        image_size=settings.GRS_AI_IMAGE_SIZE,
                                        model=primary_model,
                                        progress_callback=progress_callback,
                                    )
                                except retryable_grs_errors as grs_retry_err:
                                    should_retry_with_fallback_model = (
                                        bool(fallback_model) and fallback_model != primary_model
                                    )
                                    if not should_retry_with_fallback_model:
                                        raise
                                    logger.warning(
                                        "GrsAI primary model failed (%s). Retrying with fallback model %s",
                                        grs_retry_err,
                                        fallback_model,
                                    )
                                    result_url = await grs_client.generate_image(
                                        prompt=prompt,
                                        urls=urls_payload,
                                        aspect_ratio=resolved_aspect_ratio,
                                        image_size=settings.GRS_AI_IMAGE_SIZE,
                                        model=fallback_model,
                                        progress_callback=progress_callback,
                                    )

                            service_used = "grsai"
                            logger.info("GrsAI image editing successful")
                            break

                        except (GrsAIError, GrsAITimeoutError, GrsAITaskFailedError, Exception) as grs_error:
                            error_text = f"{type(grs_error).__name__}: {grs_error}"
                            generation_errors.append(f"grsai: {error_text}")
                            logger.warning(
                                "GrsAI editing failed: %s. %s",
                                error_text,
                                "Fallback to next provider..." if resolved_fallback else "No fallback configured",
                            )
                            result_url = None
                            continue

                    elif provider == "kie_ai":
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

                                if public_base_image_url or attachment_public_urls:
                                    result_url = await kie_ai_client.generate_image_edit(
                                        base_image_url=public_base_image_url,
                                        prompt=prompt,
                                        image_size=resolved_aspect_ratio,
                                        attachments_urls=attachment_public_urls,
                                        progress_callback=progress_callback,
                                    )
                                else:
                                    result_url = await kie_ai_client.generate_image_text(
                                        prompt=prompt,
                                        image_size=resolved_aspect_ratio,
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

                    else:
                        generation_errors.append(f"{provider}: unsupported provider")

                if not result_url:
                    details = "; ".join(generation_errors) if generation_errors else "no providers available"
                    if reference_urls_for_url_providers and not url_provider_refs_are_reachable:
                        details = (
                            f"{details}; референсы могут быть недоступны внешним сервисам: "
                            "проверьте публичный BACKEND_URL/доступность /uploads"
                        )
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
                        normalized_bytes, normalized_ext = normalize_image_bytes(
                            raw_bytes,
                            image_format,
                        )
                        normalized_content_type = (
                            "image/jpeg" if normalized_ext in {"jpg", "jpeg"} else f"image/{normalized_ext}"
                        )

                        _, saved_url, file_size = await save_upload_file_by_content(
                            content=normalized_bytes,
                            user_id=user_id,
                            filename=f"editing_{generation_id}.{normalized_ext}",
                            content_type=normalized_content_type,
                        )
                        image_url = saved_url
                    else:
                        raw_bytes, ext, content_type = await download_image_bytes(result_url)
                        normalized_bytes, normalized_ext = normalize_image_bytes(
                            raw_bytes,
                            ext,
                        )
                        normalized_content_type = content_type or (
                            "image/jpeg" if normalized_ext in {"jpg", "jpeg"} else f"image/{normalized_ext}"
                        )
                        _, saved_url, file_size = await save_upload_file_by_content(
                            content=normalized_bytes,
                            user_id=user_id,
                            filename=f"editing_{generation_id}.{normalized_ext}",
                            content_type=normalized_content_type,
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
                    f"service={service_used}, aspect_ratio={resolved_aspect_ratio}"
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
                    "Error in editing generation %s: %s",
                    generation_id,
                    e,
                    exc_info=True,
                )

                # Обновление статуса: failed
                await update_generation_status(
                    session,
                    generation_id,
                    "failed",
                    error_message=USER_ERROR_MESSAGE,
                )

                try:
                    await notify_error(
                        title="Editing generation failed",
                        error=e,
                        user=user,
                        user_id=user_id,
                        extra={
                            "generation_id": generation_id,
                            "session_id": session_id,
                            "provider": service_used,
                        },
                    )
                except Exception:
                    logger.warning("Failed to send Telegram alert for editing error", exc_info=True)

                return {
                    "status": "failed",
                    "error": USER_ERROR_MESSAGE,
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
