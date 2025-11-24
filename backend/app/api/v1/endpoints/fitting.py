"""
API endpoints для примерки одежды/аксессуаров.

Endpoints:
- POST /fitting/upload - загрузка фото
- POST /fitting/generate - запуск генерации
- GET /fitting/status/{task_id} - проверка статуса
- GET /fitting/result/{task_id} - получение результата
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user, get_db
from app.core.config import settings
from app.models.generation import Generation
from app.models.user import User
from app.schemas.fitting import (
    FittingUploadResponse,
    FittingRequest,
    FittingResponse,
    FittingStatusResponse,
    FittingResult,
)
from app.services.credits import deduct_credits, check_user_can_perform_action
from app.services.billing_v4 import BillingV4Service
from app.services.file_validator import validate_image_file
from app.services.file_storage import save_upload_file, get_file_by_id
from app.tasks.fitting import generate_fitting_task


router = APIRouter()


@router.post(
    "/upload",
    response_model=FittingUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Загрузить фото для примерки",
    description=(
        "Загружает фото пользователя или одежды/аксессуара.\n\n"
        "Валидация:\n"
        "- Только JPEG/PNG\n"
        "- Максимум 5MB\n"
        "- Проверка magic bytes\n\n"
        "Файл сохраняется с UUID именем и автоматически удаляется через 24 часа."
    )
)
async def upload_photo(
    file: UploadFile = File(..., description="Фото (JPEG/PNG, max 5MB)"),
    current_user: User = Depends(get_current_active_user),
) -> FittingUploadResponse:
    """
    Загрузить фото для примерки.
    """
    # Валидация файла
    await validate_image_file(file)

    # Сохранение файла
    try:
        file_id, file_url, file_size = await save_upload_file(
            file,
            user_id=current_user.id
        )

        return FittingUploadResponse(
            file_id=file_id,
            file_url=file_url,
            file_size=file_size,
            mime_type=file.content_type or "image/jpeg",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )


@router.post(
    "/generate",
    response_model=FittingResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Запустить генерацию примерки",
    description=(
        "Запускает генерацию примерки одежды/аксессуара.\n\n"
        "Стоимость: 2 кредита\n\n"
        "Возвращает task_id для отслеживания прогресса через WebSocket или polling."
    )
)
async def generate_fitting(
    request: FittingRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FittingResponse:
    """
    Запустить генерацию примерки.
    """
    billing_v4_enabled = settings.BILLING_V4_ENABLED
    credits_cost = settings.BILLING_GENERATION_COST_CREDITS if billing_v4_enabled else 2
    charge_info = None

    # Проверка существования файлов
    # Важно: проверяем, что файлы существуют и не истёк срок хранения (24 часа)
    try:
        user_photo_path = get_file_by_id(request.user_photo_id)
        if not user_photo_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User photo not found or expired. Please upload it again."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User photo not found: {str(e)}"
        )

    try:
        item_photo_path = get_file_by_id(request.item_photo_id)
        if not item_photo_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item photo not found or expired. Please upload it again."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item photo not found: {str(e)}"
        )

    if billing_v4_enabled:
        billing = BillingV4Service(db)
        charge_info = await billing.charge_generation(
            current_user.id,
            meta={
                "feature": "fitting",
                "user_photo_id": str(request.user_photo_id),
                "item_photo_id": str(request.item_photo_id),
            },
        )
    else:
        # Проверка баланса для старой модели
        try:
            can_perform, _ = await check_user_can_perform_action(
                current_user,
                credits_cost
            )
        except HTTPException as e:
            raise e

        if not can_perform:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Insufficient credits"
            )

    # Создание записи Generation в БД
    generation = Generation(
        user_id=current_user.id,
        type="fitting",
        user_photo_url=f"/uploads/{request.user_photo_id}",
        item_photo_url=f"/uploads/{request.item_photo_id}",
        accessory_zone=request.accessory_zone,
        prompt="Virtual try-on generation",  # Placeholder prompt for database
        status="pending",
        credits_spent=(
            credits_cost
            if billing_v4_enabled and charge_info and charge_info.get("payment_source") == "credits"
            else 0
        ),
    )

    db.add(generation)
    await db.commit()
    await db.refresh(generation)

    # Запуск Celery задачи с передачей credits_cost
    task = generate_fitting_task.delay(
        generation_id=generation.id,
        user_id=current_user.id,
        user_photo_url=generation.user_photo_url,
        item_photo_url=generation.item_photo_url,
        accessory_zone=request.accessory_zone,
        credits_cost=credits_cost,  # Передаём стоимость в задачу
    )

    # Обновление task_id в БД
    generation.task_id = task.id
    await db.commit()

    return FittingResponse(
        task_id=task.id,
        status="pending",
        message="Fitting generation started. Use task_id to track progress.",
    )


@router.get(
    "/status/{task_id}",
    response_model=FittingStatusResponse,
    summary="Проверить статус генерации",
    description="Получить текущий статус задачи генерации."
)
async def get_fitting_status(
    task_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FittingStatusResponse:
    """
    Получить статус генерации примерки.
    """
    # Получение Generation из БД
    stmt = select(Generation).where(
        Generation.task_id == task_id,
        Generation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    generation = result.scalar_one_or_none()

    if not generation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation task not found"
        )

    # Получение прогресса из БД (если есть) или дефолтные значения
    progress = generation.progress if hasattr(generation, 'progress') and generation.progress is not None else {
        "pending": 0,
        "processing": 50,
        "completed": 100,
        "failed": 0,
    }.get(generation.status, 0)

    message_map = {
        "pending": "Task is waiting in queue",
        "processing": "Generating your fitting...",
        "completed": "Fitting generation completed!",
        "failed": "Generation failed. Please try again.",
    }

    message = message_map.get(generation.status, "Unknown status")

    return FittingStatusResponse(
        task_id=task_id,
        status=generation.status,
        progress=progress,
        message=message,
    )


@router.get(
    "/result/{task_id}",
    response_model=FittingResult,
    summary="Получить результат генерации",
    description="Получить результат генерации примерки (доступно после завершения)."
)
async def get_fitting_result(
    task_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FittingResult:
    """
    Получить результат генерации примерки.
    """
    # Получение Generation из БД
    stmt = select(Generation).where(
        Generation.task_id == task_id,
        Generation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    generation = result.scalar_one_or_none()

    if not generation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation task not found"
        )

    # Проверка статуса
    if generation.status == "pending" or generation.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="Generation is still in progress. Please wait."
        )

    if generation.status == "failed":
        return FittingResult(
            task_id=task_id,
            status="failed",
            image_url=None,
            has_watermark=False,
            error_message="Generation failed. Please try again.",
            credits_spent=generation.credits_spent,
            created_at=generation.created_at.isoformat(),
        )

    # Возврат результата
    return FittingResult(
        task_id=task_id,
        status="completed",
        image_url=generation.image_url,
        has_watermark=generation.has_watermark,
        error_message=None,
        credits_spent=generation.credits_spent,
        created_at=generation.created_at.isoformat(),
    )


@router.get(
    "/history",
    summary="История генераций примерки",
    description="Получить историю всех генераций примерки текущего пользователя."
)
async def get_fitting_history(
    limit: int = 10,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить историю генераций примерки.
    """
    stmt = (
        select(Generation)
        .where(
            Generation.user_id == current_user.id,
            Generation.type == "fitting"
        )
        .order_by(Generation.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    generations = result.scalars().all()

    return {
        "total": len(generations),
        "items": [
            {
                "id": gen.id,
                "task_id": gen.task_id,
                "status": gen.status,
                "image_url": gen.image_url,
                "has_watermark": gen.has_watermark,
                "credits_spent": gen.credits_spent,
                "created_at": gen.created_at.isoformat(),
            }
            for gen in generations
        ]
    }
