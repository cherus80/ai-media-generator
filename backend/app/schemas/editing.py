"""
Pydantic схемы для редактирования изображений.

Схемы для работы с чат-сессиями и AI-ассистентом (GPT-4.1 Mini).
"""

from typing import Optional, List
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _normalize_output_format(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.lower()
    if normalized == "jpg":
        normalized = "jpeg"
    if normalized not in {"png", "jpeg", "webp"}:
        raise ValueError("Недопустимый формат вывода. Используйте png, jpg/jpeg или webp.")
    return normalized


class ChatAttachment(BaseModel):
    """Вложение (изображение), прикреплённое к сообщению"""

    id: str = Field(..., description="UUID файла")
    url: str = Field(..., description="Публичный или относительный URL файла")
    type: str = Field(..., description="Тип вложения (image и т.п.)", pattern="^(image)$")
    name: Optional[str] = Field(None, description="Имя файла")
    size: Optional[int] = Field(None, description="Размер файла в байтах")
    role: Optional[str] = Field(None, description="Роль вложения (reference/base-extra)")


class ChatSessionCreate(BaseModel):
    """Запрос на создание новой сессии чата"""

    base_image_url: str = Field(
        ...,
        description="URL базового изображения для редактирования",
        max_length=500,
    )


class ChatSessionResponse(BaseModel):
    """Ответ с созданной сессией чата"""

    session_id: str = Field(
        ...,
        description="UUID сессии чата",
    )
    base_image_url: str = Field(
        ...,
        description="URL базового изображения",
    )
    created_at: datetime = Field(
        ...,
        description="Время создания сессии",
    )

    model_config = {"from_attributes": True}


class ChatMessageRequest(BaseModel):
    """Запрос на отправку сообщения в чат"""

    session_id: str = Field(
        ...,
        description="UUID сессии чата",
    )
    message: str = Field(
        ...,
        description="Текст сообщения пользователя",
        min_length=1,
        max_length=4000,
    )
    attachments: Optional[List[ChatAttachment]] = Field(
        default=None,
        description="Список вложений (изображения)",
    )


class ChatMessageResponse(BaseModel):
    """Ответ от AI-ассистента"""

    role: str = Field(
        ...,
        description="Роль отправителя (user или assistant)",
    )
    content: str = Field(
        ...,
        description="Текст сообщения",
    )
    prompt: Optional[str] = Field(
        None,
        description="Единственный финальный промпт от ассистента",
    )
    attachments: Optional[List[ChatAttachment]] = Field(
        default=None,
        description="Вложения, связанные с сообщением (эхо для истории)",
    )
    timestamp: str = Field(
        ...,
        description="Время сообщения в ISO формате",
    )

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Валидация роли сообщения"""
        if v not in ("user", "assistant"):
            raise ValueError("role must be 'user' or 'assistant'")
        return v


class GenerateImageRequest(BaseModel):
    """Запрос на генерацию изображения по промпту"""

    session_id: str = Field(
        ...,
        description="UUID сессии чата",
    )
    prompt: str = Field(
        ...,
        description="Промпт для генерации изображения",
        min_length=1,
        max_length=4000,
    )
    attachments: Optional[List[ChatAttachment]] = Field(
        default=None,
        description="Вложения (дополнительные изображения-референсы)",
    )
    output_format: Optional[str] = Field(
        None,
        description="Формат вывода изображения: png, jpg/jpeg или webp",
    )

    @field_validator("output_format")
    @classmethod
    def validate_output_format(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_output_format(v)


class ExampleGenerateRequest(BaseModel):
    """Запрос на генерацию изображения по образцу без сохранения истории"""

    prompt: str = Field(
        ...,
        description="Промпт для генерации изображения",
        min_length=1,
        max_length=4000,
    )
    attachments: Optional[List[ChatAttachment]] = Field(
        default=None,
        description="Вложения (фото участников, используются вместе в одной генерации)",
    )
    output_format: Optional[str] = Field(
        None,
        description="Формат вывода изображения: png, jpg/jpeg или webp",
    )

    @field_validator("output_format")
    @classmethod
    def validate_output_format(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_output_format(v)


class GenerateImageResponse(BaseModel):
    """Ответ с запущенной задачей генерации"""

    task_id: str = Field(
        ...,
        description="UUID задачи Celery",
    )
    status: str = Field(
        default="pending",
        description="Статус задачи (pending)",
    )
    message: str = Field(
        default="Генерация запущена",
        description="Сообщение о статусе",
    )


class ChatHistoryMessage(BaseModel):
    """Сообщение из истории чата"""

    role: str = Field(
        ...,
        description="Роль отправителя (user или assistant)",
    )
    content: str = Field(
        ...,
        description="Текст сообщения",
    )
    prompt: Optional[str] = Field(
        None,
        description="Финальный промпт (для assistant)",
    )
    attachments: Optional[List[ChatAttachment]] = Field(
        default=None,
        description="Вложения, отправленные вместе с сообщением",
    )
    image_url: Optional[str] = Field(
        None,
        description="URL изображения (если есть)",
    )
    timestamp: str = Field(
        ...,
        description="Время сообщения в ISO формате",
    )


class ChatHistoryResponse(BaseModel):
    """Ответ с историей чата"""

    session_id: str = Field(
        ...,
        description="UUID сессии чата",
    )
    base_image_url: Optional[str] = Field(
        None,
        description="URL базового изображения",
    )
    messages: List[ChatHistoryMessage] = Field(
        default_factory=list,
        description="Список сообщений в хронологическом порядке",
    )
    message_count: int = Field(
        ...,
        description="Общее количество сообщений в сессии",
    )
    is_active: bool = Field(
        ...,
        description="Активна ли сессия",
    )

    model_config = {"from_attributes": True}


class ResetSessionResponse(BaseModel):
    """Ответ на сброс сессии"""

    session_id: str = Field(
        ...,
        description="UUID сессии чата",
    )
    message: str = Field(
        default="Сессия чата успешно сброшена",
        description="Сообщение о результате",
    )


class EditingError(BaseModel):
    """Ошибка при работе с редактированием"""

    detail: str = Field(
        ...,
        description="Описание ошибки",
    )
    error_code: Optional[str] = Field(
        None,
        description="Код ошибки",
    )
