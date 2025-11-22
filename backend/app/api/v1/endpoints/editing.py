"""
API endpoints для редактирования изображений с AI-ассистентом.

Endpoints:
- POST /editing/session - создание сессии чата
- POST /editing/chat - отправка сообщения AI
- POST /editing/generate - генерация по промпту
- GET /editing/history/{session_id} - получение истории чата
- DELETE /editing/session/{session_id} - сброс сессии
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user, get_db
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
    ChatHistoryResponse,
    ResetSessionResponse,
    ChatHistoryMessage,
)
from app.services.credits import deduct_credits, check_user_can_perform_action
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
        "Отправляет сообщение AI-ассистенту (Claude Haiku через OpenRouter).\n\n"
        "AI генерирует 3 варианта промптов для редактирования изображения:\n"
        "1. Короткий (1-2 предложения)\n"
        "2. Средний (2-3 предложения)\n"
        "3. Детальный (3-4 предложения)\n\n"
        "Стоимость: 1 кредит (или Freemium)\n\n"
        "История чата: отправляются последние 10 сообщений для контекста."
    )
)
async def send_message(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageResponse:
    """
    Отправить сообщение AI-ассистенту и получить 3 варианта промптов.
    """
    # Проверка баланса
    can_perform, reason = await check_user_can_perform_action(
        db=db,
        user=current_user,
        cost=1,  # Стоимость запроса к AI
    )

    if not can_perform:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=reason or "Insufficient credits"
        )

    try:
        # Проверка существования сессии
        chat_session = await get_chat_session(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            require_active=True,
        )

        # Списание 1 кредита
        await deduct_credits(
            db=db,
            user=current_user,
            cost=1,
            generation_id=None,  # Не привязано к генерации
        )

        # Добавление сообщения пользователя в историю
        await add_message(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            role="user",
            content=request.message,
        )

        # Получение истории для контекста
        from app.services.chat import get_messages_for_ai
        chat_history = await get_messages_for_ai(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            max_messages=10,
        )

        # Вызов OpenRouter для генерации промптов
        openrouter_client = get_openrouter_client()

        try:
            prompts = await openrouter_client.generate_prompts(
                user_message=request.message,
                chat_history=chat_history,
            )

            logger.info(
                f"Generated {len(prompts)} prompts for session {request.session_id}"
            )

        except OpenRouterError as e:
            logger.error(f"OpenRouter error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"AI service error: {str(e)}"
            )

        # Формируем ответ assistant с промптами
        assistant_content = (
            "Here are 3 prompt variations for your image editing request:\n\n"
            f"1. Short: {prompts[0]}\n\n"
            f"2. Medium: {prompts[1]}\n\n"
            f"3. Detailed: {prompts[2]}"
        )

        # Добавление ответа assistant в историю
        await add_message(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            role="assistant",
            content=assistant_content,
        )

        from datetime import datetime
        return ChatMessageResponse(
            role="assistant",
            content=assistant_content,
            prompts=prompts,
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
        "Стоимость: 1 кредит (или Freemium)\n\n"
        "Процесс:\n"
        "1. Списание 1 кредита\n"
        "2. Создание записи Generation\n"
        "3. Запуск Celery задачи\n"
        "4. Возврат task_id для отслеживания прогресса\n\n"
        "Используйте /fitting/status/{task_id} для проверки статуса."
    )
)
async def generate_image(
    request: GenerateImageRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateImageResponse:
    """
    Сгенерировать отредактированное изображение по промпту.
    """
    # Проверка баланса
    can_perform, reason = await check_user_can_perform_action(
        db=db,
        user=current_user,
        cost=1,  # Стоимость генерации
    )

    if not can_perform:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=reason or "Insufficient credits"
        )

    try:
        # Проверка существования сессии
        chat_session = await get_chat_session(
            db=db,
            session_id=request.session_id,
            user_id=current_user.id,
            require_active=True,
        )

        # Списание 1 кредита
        await deduct_credits(
            db=db,
            user=current_user,
            cost=1,
            generation_id=None,  # Будет установлено позже
        )

        # Создание записи Generation
        generation = Generation(
            user_id=current_user.id,
            type="editing",
            prompt=request.prompt,
            status="pending",
            progress=0,
            credits_spent=1,
        )

        db.add(generation)
        await db.commit()
        await db.refresh(generation)

        logger.info(
            f"Created generation {generation.id} for user {current_user.id}"
        )

        # Запуск Celery задачи
        task = generate_editing_task.apply_async(
            args=[
                generation.id,
                current_user.id,
                request.session_id,
                chat_session.base_image_url,
                request.prompt,
            ],
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


@router.get(
    "/history/{session_id}",
    response_model=ChatHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Получить историю чата",
    description="Возвращает всю историю сообщений для указанной сессии чата."
)
async def get_history(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
