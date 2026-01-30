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
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_verified_email, get_db
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
from app.services.billing_v5 import BillingV5Service
from app.services.file_validator import validate_image_file
from app.services.file_storage import save_upload_file, get_file_by_id
from app.tasks.fitting import generate_fitting_task
from app.utils.runtime_config import get_generation_providers_for_worker


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
    current_user: User = Depends(require_verified_email),
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
            detail=(
                "Не удалось сохранить файл на сервере. "
                "Попробуйте повторить загрузку позже."
            ),
        )


@router.post(
    "/generate",
    response_model=FittingResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Запустить генерацию примерки",
    description=(
        "Запускает генерацию примерки одежды/аксессуара.\n\n"
        "Стоимость: 1 действие по подписке или 2 ⭐️звезды\n\n"
        "Требуется подтверждённый email для доступа.\n\n"
        "Возвращает task_id для отслеживания прогресса через WebSocket или polling."
    )
)
async def generate_fitting(
    request: FittingRequest,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
) -> FittingResponse:
    """
    Запустить генерацию примерки.
    """
    billing_v5_enabled = settings.BILLING_V5_ENABLED
    credits_cost = settings.BILLING_GENERATION_COST_CREDITS if billing_v5_enabled else 2

    # Проверка существования файлов
    # Важно: проверяем, что файлы существуют и не истёк срок хранения (24 часа)
    try:
        user_photo_path = get_file_by_id(request.user_photo_id)
        if not user_photo_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Фото пользователя не найдено или устарело. Пожалуйста, загрузите его снова."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Фото пользователя не найдено: {str(e)}"
        )

    try:
        item_photo_path = get_file_by_id(request.item_photo_id)
        if not item_photo_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Фото вещи/аксессуара не найдено или устарело. Пожалуйста, загрузите его снова."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Фото вещи/аксессуара не найдено: {str(e)}"
        )

    if billing_v5_enabled:
        billing = BillingV5Service(db)
        can_use_actions = (
            billing._has_active_plan(current_user)
            and billing._actions_remaining(current_user) > 0
        )
        if not (
            getattr(current_user, "is_admin", False)
            or can_use_actions
            or current_user.balance_credits >= credits_cost
        ):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "NOT_ENOUGH_BALANCE"},
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
                detail="Недостаточно ⭐️звёзд"
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
        credits_spent=0,
    )

    db.add(generation)
    await db.commit()
    await db.refresh(generation)

    primary_provider, fallback_provider, disable_fallback = get_generation_providers_for_worker()

    # Запуск Celery задачи с передачей credits_cost
    task = generate_fitting_task.apply_async(
        kwargs={
            "generation_id": generation.id,
            "user_id": current_user.id,
            "user_photo_url": generation.user_photo_url,
            "item_photo_url": generation.item_photo_url,
            "accessory_zone": request.accessory_zone,
            "aspect_ratio": request.aspect_ratio,
            "credits_cost": credits_cost,  # Передаём стоимость в задачу
            "primary_provider": primary_provider,
            "fallback_provider": fallback_provider,
            "disable_fallback": disable_fallback,
        }
    )

    # Обновление task_id в БД
    generation.task_id = task.id
    await db.commit()

    return FittingResponse(
        task_id=task.id,
        status="pending",
        message="Генерация запущена. Используйте task_id для отслеживания прогресса.",
    )


@router.get(
    "/status/{task_id}",
    response_model=FittingStatusResponse,
    summary="Проверить статус генерации",
    description="Получить текущий статус задачи генерации."
)
async def get_fitting_status(
    task_id: str,
    current_user: User = Depends(require_verified_email),
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
            detail="Задача генерации не найдена"
        )

    # Получение прогресса из БД (если есть) или дефолтные значения
    progress = generation.progress if hasattr(generation, 'progress') and generation.progress is not None else {
        "pending": 0,
        "processing": 50,
        "completed": 100,
        "failed": 0,
    }.get(generation.status, 0)

    message_map = {
        "pending": "Задача ожидает в очереди",
        "processing": "Генерируем ваш образ...",
        "completed": "Генерация завершена!",
        "failed": "Генерация не удалась. Попробуйте ещё раз.",
    }

    message = message_map.get(generation.status, "Неизвестный статус")

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
    current_user: User = Depends(require_verified_email),
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
            detail="Задача генерации не найдена"
        )

    # Проверка статуса
    if generation.status == "pending" or generation.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="Генерация ещё выполняется. Пожалуйста, подождите."
        )

    if generation.status == "failed":
        return FittingResult(
            task_id=task_id,
            status="failed",
            image_url=None,
            has_watermark=False,
            error_message=generation.error_message or "Генерация не удалась. Попробуйте ещё раз.",
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
    summary="История генераций",
    description="Получить историю генераций текущего пользователя (примерка и редактирование)."
)
async def get_fitting_history(
    page: int = 1,
    page_size: int = 20,
    generation_type: Optional[str] = None,
    current_user: User = Depends(require_verified_email),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить историю генераций примерки/редактирования.
    """
    page = max(page, 1)
    page_size = max(1, min(page_size, 100))
    offset = (page - 1) * page_size

    valid_types = {"fitting", "editing"}
    generation_type = generation_type if generation_type in valid_types else None

    filters = [
        Generation.user_id == current_user.id,
    ]
    if generation_type:
        filters.append(Generation.type == generation_type)
    else:
        filters.append(Generation.type.in_(["fitting", "editing"]))

    total_stmt = (
        select(func.count())
        .select_from(Generation)
        .where(*filters)
    )
    total = await db.scalar(total_stmt) or 0

    stmt = (
        select(Generation)
        .where(*filters)
        .order_by(Generation.created_at.desc())
        .limit(page_size)
        .offset(offset)
    )

    result = await db.execute(stmt)
    generations = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": gen.id,
                "task_id": gen.task_id,
                "status": gen.status,
                "generation_type": gen.type,
                "image_url": gen.image_url,
                "has_watermark": gen.has_watermark,
                "credits_spent": gen.credits_spent,
                "created_at": gen.created_at.isoformat(),
            }
            for gen in generations
        ],
    }
