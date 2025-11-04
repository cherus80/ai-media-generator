"""
Pydantic схемы для примерки одежды/аксессуаров.
"""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class FittingUploadResponse(BaseModel):
    """Ответ при успешной загрузке фото"""

    file_id: UUID = Field(..., description="UUID загруженного файла")
    file_url: str = Field(..., description="URL для доступа к файлу")
    file_size: int = Field(..., description="Размер файла в байтах")
    mime_type: str = Field(..., description="MIME-тип файла")


class FittingRequest(BaseModel):
    """Запрос на генерацию примерки"""

    user_photo_id: UUID = Field(..., description="UUID фото пользователя")
    item_photo_id: UUID = Field(..., description="UUID фото одежды/аксессуара")
    accessory_zone: Optional[str] = Field(
        None,
        description="Зона для аксессуара: head, face, neck, hands, legs, body"
    )

    @field_validator("accessory_zone")
    @classmethod
    def validate_accessory_zone(cls, v: Optional[str]) -> Optional[str]:
        """Валидация зоны аксессуара"""
        if v is None:
            return None

        valid_zones = {"head", "face", "neck", "hands", "legs", "body"}
        if v.lower() not in valid_zones:
            raise ValueError(
                f"Invalid accessory_zone. Must be one of: {', '.join(valid_zones)}"
            )

        return v.lower()


class FittingResponse(BaseModel):
    """Ответ при запуске генерации примерки"""

    task_id: str = Field(..., description="ID задачи Celery")
    status: str = Field(default="pending", description="Статус задачи")
    message: str = Field(
        default="Fitting generation started",
        description="Сообщение о статусе"
    )


class FittingStatusResponse(BaseModel):
    """Ответ при проверке статуса генерации"""

    task_id: str = Field(..., description="ID задачи")
    status: str = Field(..., description="Статус: pending, processing, completed, failed")
    progress: Optional[int] = Field(None, description="Прогресс в процентах (0-100)")
    message: Optional[str] = Field(None, description="Сообщение о статусе")


class FittingResult(BaseModel):
    """Результат генерации примерки"""

    task_id: str = Field(..., description="ID задачи")
    status: str = Field(..., description="Статус генерации")
    image_url: Optional[str] = Field(None, description="URL сгенерированного изображения")
    has_watermark: bool = Field(
        default=False,
        description="Есть ли водяной знак (для Freemium)"
    )
    error_message: Optional[str] = Field(None, description="Сообщение об ошибке")
    credits_spent: int = Field(default=2, description="Потрачено кредитов")
    created_at: str = Field(..., description="Дата создания")


class FittingError(BaseModel):
    """Ошибка при генерации примерки"""

    detail: str = Field(..., description="Описание ошибки")
    error_code: Optional[str] = Field(None, description="Код ошибки")
