"""
API endpoints для редактирования изображений с AI-ассистентом.

Endpoints:
- POST /editing/session - создание сессии чата
- POST /editing/chat - отправка сообщения AI
- POST /editing/generate - генерация по промпту
- POST /editing/example-generate - генерация по образцу без истории
- GET /editing/history/{session_id} - получение истории чата
- DELETE /editing/session/{session_id} - сброс сессии
"""

import logging
from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_verified_email, get_db
from app.core.config import settings
from app.models.generation import Generation
from app.models.user import User
from app.schemas.editing import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    ExampleGenerateRequest,
    ChatHistoryResponse,
    ResetSessionResponse,
    ChatHistoryMessage,
    ChatAttachment,
)
from app.services.credits import deduct_credits, check_user_can_perform_action
from app.services.billing_v5 import BillingV5Service
from app.services.chat import (
    create_chat_session,
    get_chat_session,
    add_message,
    get_last_messages,
    reset_session,
    ChatSessionNotFoundError,
    ChatSessionInactiveError,
)
from app.services.openrouter import get_openrouter_client, OpenRouterError
from app.services.file_validator import validate_image_file
from app.services.file_storage import save_upload_file
from app.tasks.editing import generate_editing_task
from app.utils.runtime_config import get_generation_providers_for_worker

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/upload",
    response_model=ChatSessionCreate,
    status_code=status.HTTP_201_CREATED,
    summary="Загрузить базовое изображение и создать сессию",
    description=(
        "Загружает базовое изображение для редактирования и создаёт новую сессию чата.\n\n"
        "Валидация:\n"
        "- Только JPEG/PNG\n"
        "- Максимум 5MB\n"
        "- Проверка magic bytes"
    )
)
async def upload_base_image(
    file: UploadFile = File(..., description="Базовое изображение (JPEG/PNG, max 5MB)"),
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionCreate:
    """
    Загрузить базовое изображение для редактирования.
    """
    # Валидация файла
    await validate_image_file(file)

    # Сохранение файла
    try:
        file_id, file_url, file_size = await save_upload_file(
            file,
            user_id=current_user.id
        )

        logger.info(
            f"Uploaded base image for user {current_user.id}: "
            f"{file_url} ({file_size} bytes)"
        )

        return ChatSessionCreate(base_image_url=file_url)

    except Exception as e:
        logger.error(f"Failed to save base image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )


@router.post(
    "/attachment",
    response_model=ChatAttachment,
    status_code=status.HTTP_201_CREATED,
    summary="Загрузить дополнительное изображение для чата",
    description="Загружает дополнительный файл (референс) для сообщения в чате редактирования.",
)
async def upload_attachment(
    file: UploadFile = File(..., description="Изображение (JPEG/PNG/WebP/HEIC, max 10MB)"),
    current_user: User = Depends(require_verified_email),
) -> ChatAttachment:
    """
    Загрузить дополнительное изображение (референс) для сообщения в чате.
    """
    await validate_image_file(file)

    try:
        file_id, file_url, file_size = await save_upload_file(
            file,
            user_id=current_user.id
        )

        logger.info(
            "Uploaded attachment for user %s: %s (%s bytes)",
            current_user.id,
            file_url,
            file_size,
        )

        return ChatAttachment(
            id=str(file_id),
            url=file_url,
            type="image",
            name=file.filename,
            size=file_size,
            role="reference",
        )
    except Exception as e:
        logger.error(f"Failed to save attachment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save attachment: {str(e)}"
        )


@router.post(
    "/session",
    response_model=ChatSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать новую сессию чата",
    description=(
        "Создаёт новую сессию чата для редактирования изображения.\n\n"
        "Возвращает session_id, который нужно использовать для всех последующих запросов."
    )
)
async def create_session(
    request: ChatSessionCreate,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionResponse:
    """
    Создать новую сессию чата для редактирования изображения.
    """
    try:
        chat_session = await create_chat_session(
            db=db,
            user_id=current_user.id,
            base_image_url=request.base_image_url,
        )

        logger.info(
            f"Created chat session {chat_session.session_id} "
            f"for user {current_user.id}"
        )

        return ChatSessionResponse(
            session_id=chat_session.session_id,
            base_image_url=chat_session.base_image_url,
            created_at=chat_session.created_at,
        )

    except Exception as e:
        logger.error(f"Failed to create chat session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create chat session: {str(e)}"
        )


@router.post(
    "/chat",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Отправить сообщение AI-ассистенту",
    description=(
        "Отправляет сообщение AI-ассистенту (GPT-4.1 Mini через OpenRouter).\n\n"
        "AI генерирует 3 варианта промптов для редактирования изображения:\n"
        "1. Короткий (1-2 предложения)\n"
        "2. Средний (2-3 предложения)\n"
        "3. Детальный (3-4 предложения)\n\n"
        "Стоимость: 1 ⭐️звезда\n\n"
        "Требуется подтверждённый email для доступа.\n\n"
        "История чата: отправляются последние 10 сообщений для контекста."
    )
)
async def send_message(
    request: ChatMessageRequest,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageResponse:
    """
    Отправить сообщение AI-ассистенту и получить 3 варианта промптов.
    """
    billing_v5_enabled = settings.BILLING_V5_ENABLED
    assistant_cost = settings.BILLING_ASSISTANT_COST_CREDITS if billing_v5_enabled else 1

    # Проверяем баланс, но НЕ списываем кредиты (списание будет после успешной генерации)
    if not billing_v5_enabled:
        # Только проверка баланса для старой модели
        can_perform, reason = await check_user_can_perform_action(
            user=current_user,
            credits_cost=assistant_cost,
        )

        if not can_perform:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=reason or "Insufficient stars"
            )
    else:
        # Для Billing v5 проверяем наличие кредитов
        if not getattr(current_user, "is_admin", False) and current_user.balance_credits < assistant_cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Insufficient stars for AI assistant"
            )

    try:
        # Проверка существования сессии
        chat_session = await get_chat_session(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            require_active=True,
        )

        # Подготовка вложений
        attachments_payload: Optional[List[dict]] = None
        if request.attachments:
            attachments_payload = [attachment.model_dump() for attachment in request.attachments]

        # Добавление сообщения пользователя в историю
        await add_message(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            role="user",
            content=request.message,
            attachments=attachments_payload,
        )

        # Получение истории для контекста
        from app.services.chat import get_messages_for_ai
        chat_history = await get_messages_for_ai(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            max_messages=10,
        )

        # Вложения для AI-контекста (добавляем базовое изображение как основной вход)
        ai_attachments = attachments_payload.copy() if attachments_payload else []
        if chat_session.base_image_url:
            ai_attachments.append({
                "id": "base-image",
                "url": chat_session.base_image_url,
                "type": "image",
                "role": "base",
            })

        # Вызов OpenRouter для генерации промптов
        openrouter_client = get_openrouter_client()

        try:
            prompt = await openrouter_client.generate_prompts(
                user_message=request.message,
                chat_history=chat_history,
                attachments=ai_attachments,
            )

            logger.info("Generated prompt for session %s", request.session_id)

            # ✅ СПИСЫВАЕМ КРЕДИТЫ ПОСЛЕ УСПЕШНОЙ ГЕНЕРАЦИИ ПРОМПТОВ
            if billing_v5_enabled:
                billing = BillingV5Service(db)
                await billing.charge_assistant(
                    current_user.id,
                    meta={"feature": "editing_assistant", "session_id": str(request.session_id)},
                )
                logger.info(f"Charged {assistant_cost} credits for AI assistant (Billing v5)")
            else:
                # Billing v3
                await deduct_credits(
                    session=db,
                    user=current_user,
                    credits_cost=assistant_cost,
                    generation_id=None,  # Не привязано к генерации
                )
                logger.info(f"Deducted {assistant_cost} credits for AI assistant (Billing v3)")

        except OpenRouterError as e:
            logger.error(f"OpenRouter error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"AI service error: {str(e)}"
            )

        # Формируем ответ assistant с промптами
        assistant_content = f"Готовый промпт для генерации:\n\n{prompt}"

        # Добавление ответа assistant в историю
        await add_message(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            role="assistant",
            content=assistant_content,
            attachments=attachments_payload,
            prompt=prompt,
        )

        from datetime import datetime
        return ChatMessageResponse(
            role="assistant",
            content=assistant_content,
            prompt=prompt,
            attachments=request.attachments,
            timestamp=datetime.now().isoformat(),
        )

    except ChatSessionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session {request.session_id} not found"
        )
    except ChatSessionInactiveError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chat session {request.session_id} is inactive"
        )
    except Exception as e:
        logger.error(f"Error in send_message: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process message: {str(e)}"
        )


@router.post(
    "/generate",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Сгенерировать изображение по промпту",
    description=(
        "Запускает генерацию отредактированного изображения через OpenRouter API.\n\n"
        "Стоимость: 1 действие по подписке или 2 ⭐️звезды (списываются после успешной генерации)\n\n"
        "Требуется подтверждённый email для доступа.\n\n"
        "Процесс:\n"
        "1. Проверка баланса ⭐️звезд\n"
        "2. Создание записи Generation\n"
        "3. Запуск Celery задачи\n"
        "4. Списание 1 действия или 2 ⭐️звезд после успешной генерации\n"
        "5. Возврат task_id для отслеживания прогресса\n\n"
        "Используйте /fitting/status/{task_id} для проверки статуса."
    )
)
async def generate_image(
    request: GenerateImageRequest,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> GenerateImageResponse:
    """
    Сгенерировать отредактированное изображение по промпту.
    """
    billing_v5_enabled = settings.BILLING_V5_ENABLED
    generation_cost = settings.BILLING_GENERATION_COST_CREDITS if billing_v5_enabled else 2

    # Проверяем баланс, но НЕ списываем кредиты (списание будет в Celery task после успеха)
    if not billing_v5_enabled:
        # Только проверка баланса для старой модели
        can_perform, reason = await check_user_can_perform_action(
            user=current_user,
            credits_cost=generation_cost,
        )

        if not can_perform:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=reason or "Insufficient stars"
            )
    else:
        billing = BillingV5Service(db)
        can_use_actions = billing._has_active_plan(current_user) and billing._actions_remaining(current_user) > 0  # type: ignore[attr-defined]
        if not (getattr(current_user, "is_admin", False) or can_use_actions or current_user.balance_credits >= generation_cost):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "NOT_ENOUGH_BALANCE"},
            )

    try:
        # Проверка существования сессии
        chat_session = await get_chat_session(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            require_active=True,
        )

        attachments_payload: list[dict] = []
        if request.attachments:
            attachments_payload = [att.model_dump() for att in request.attachments]

        # Добавляем сообщение пользователя в историю (для сохранения истории генераций)
        try:
            await add_message(
                db=db,
                session_id=request.session_id,
                user_id=current_user.id,
                role="user",
                content=request.prompt,
                attachments=attachments_payload or None,
            )
        except Exception as e:
            logger.warning("Failed to add user prompt to chat history: %s", e)

        # Создание записи Generation
        # credits_spent будет установлено в Celery task после успешной генерации
        generation = Generation(
            user_id=current_user.id,
            type="editing",
            prompt=request.prompt,
            status="pending",
            progress=0,
            credits_spent=0,  # ⭐️Звезды будут списаны в task после успеха
        )

        db.add(generation)
        await db.commit()
        await db.refresh(generation)

        logger.info(
            f"Created generation {generation.id} for user {current_user.id}"
        )

        primary_provider, fallback_provider, disable_fallback = get_generation_providers_for_worker()

        # Запуск Celery задачи
        task = generate_editing_task.apply_async(
            args=[
                generation.id,
                current_user.id,
                request.session_id,
                chat_session.base_image_url,
                request.prompt,
                attachments_payload,
            ],
            kwargs={
                "primary_provider": primary_provider,
                "fallback_provider": fallback_provider,
                "disable_fallback": disable_fallback,
            },
            task_id=str(generation.id),
        )

        # Обновление task_id
        generation.task_id = task.id
        await db.commit()

        logger.info(
            f"Started editing task {task.id} for generation {generation.id}"
        )

        return GenerateImageResponse(
            task_id=task.id,
            status="pending",
            message="Image generation started",
        )

    except ChatSessionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session {request.session_id} not found"
        )
    except ChatSessionInactiveError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chat session {request.session_id} is inactive"
        )
    except Exception as e:
        logger.error(f"Error in generate_image: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start generation: {str(e)}"
        )


@router.post(
    "/example-generate",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Сгенерировать изображение по образцу без истории",
    description=(
        "Запускает одну генерацию изображения по промпту с несколькими фото.\n\n"
        "История чата не сохраняется.\n\n"
        "Стоимость: 1 действие по подписке или 2 ⭐️звезды (списываются после успешной генерации)\n\n"
        "Требуется подтверждённый email для доступа."
    ),
)
async def generate_image_from_example(
    request: ExampleGenerateRequest,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> GenerateImageResponse:
    """
    Сгенерировать изображение по образцу без сохранения истории чата.
    """
    attachments_payload: list[dict] = []
    if request.attachments:
        attachments_payload = [att.model_dump() for att in request.attachments]

    base_image_urls = [
        att.get("url")
        for att in attachments_payload
        if att.get("url")
    ]

    if not base_image_urls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо прикрепить хотя бы одно фото для генерации.",
        )

    # Удаляем дубликаты, сохраняя порядок
    seen_urls: set[str] = set()
    unique_base_urls: list[str] = []
    for url in base_image_urls:
        if url in seen_urls:
            continue
        seen_urls.add(url)
        unique_base_urls.append(url)

    base_image_url = unique_base_urls[0]
    attachments_payload = [
        att for att in attachments_payload
        if att.get("url") and att.get("url") != base_image_url
    ]

    billing_v5_enabled = settings.BILLING_V5_ENABLED
    generation_cost = settings.BILLING_GENERATION_COST_CREDITS if billing_v5_enabled else 2

    # Проверяем баланс, но НЕ списываем кредиты (списание будет в Celery task после успеха)
    if not billing_v5_enabled:
        can_perform, reason = await check_user_can_perform_action(
            user=current_user,
            credits_cost=generation_cost,
        )
        if not can_perform:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=reason or "Insufficient stars"
            )
    else:
        billing = BillingV5Service(db)
        can_use_actions = billing._has_active_plan(current_user) and billing._actions_remaining(current_user) > 0  # type: ignore[attr-defined]
        if not (getattr(current_user, "is_admin", False) or can_use_actions or current_user.balance_credits >= generation_cost):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "NOT_ENOUGH_BALANCE"},
            )

    try:
        primary_provider, fallback_provider, disable_fallback = get_generation_providers_for_worker()

        generation = Generation(
            user_id=current_user.id,
            type="editing",
            prompt=request.prompt.strip(),
            status="pending",
            progress=0,
            credits_spent=0,
        )

        db.add(generation)
        await db.commit()
        await db.refresh(generation)

        session_id = str(uuid4())
        task = generate_editing_task.apply_async(
            args=[
                generation.id,
                current_user.id,
                session_id,
                base_image_url,
                request.prompt.strip(),
                attachments_payload or None,
            ],
            kwargs={
                "primary_provider": primary_provider,
                "fallback_provider": fallback_provider,
                "disable_fallback": disable_fallback,
            },
            task_id=str(generation.id),
        )

        generation.task_id = task.id
        await db.commit()

        logger.info(
            "Started example-based editing task %s for user %s",
            task.id,
            current_user.id,
        )

        return GenerateImageResponse(
            task_id=task.id,
            status="pending",
            message="Image generation started",
        )

    except Exception as e:
        logger.error("Error in generate_image_from_example: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start generation: {str(e)}"
        )


@router.get(
    "/history/{session_id}",
    response_model=ChatHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Получить историю чата",
    description="Возвращает всю историю сообщений для указанной сессии чата."
)
async def get_history(
    session_id: str,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> ChatHistoryResponse:
    """
    Получить историю чата.
    """
    try:
        chat_session = await get_chat_session(
            db=db,
            session_id=session_id,
            user_id=current_user.id,
            require_active=False,  # Можно читать историю неактивной сессии
        )

        # Преобразуем сообщения в Pydantic модели
        messages = [
            ChatHistoryMessage(**msg)
            for msg in (chat_session.messages or [])
        ]

        return ChatHistoryResponse(
            session_id=chat_session.session_id,
            base_image_url=chat_session.base_image_url,
            messages=messages,
            message_count=chat_session.message_count,
            is_active=chat_session.is_active,
        )

    except ChatSessionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session {session_id} not found"
        )
    except Exception as e:
        logger.error(f"Error in get_history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history: {str(e)}"
        )


@router.delete(
    "/session/{session_id}",
    response_model=ResetSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Сбросить сессию чата",
    description=(
        "Сбрасывает сессию чата (очищает историю и деактивирует).\n\n"
        "После сброса сессию нельзя будет использовать для новых сообщений."
    )
)
async def delete_session(
    session_id: str,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> ResetSessionResponse:
    """
    Сбросить сессию чата.
    """
    try:
        await reset_session(
            db=db,
            session_id=session_id,
            user_id=current_user.id,
        )

        logger.info(f"Reset chat session {session_id} for user {current_user.id}")

        return ResetSessionResponse(
            session_id=session_id,
            message="Chat session reset successfully",
        )

    except ChatSessionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session {session_id} not found"
        )
    except Exception as e:
        logger.error(f"Error in delete_session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset session: {str(e)}"
        )
