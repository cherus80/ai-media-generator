"""
Схемы для публичных инструкций и примеров генераций.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class InstructionType(str, Enum):
    """Тип инструкции."""

    VIDEO = "video"
    TEXT = "text"


class InstructionPublicItem(BaseModel):
    id: int
    type: InstructionType
    title: str
    content: str
    sort_order: int = Field(..., description="Порядок сортировки")


class InstructionPublicListResponse(BaseModel):
    items: list[InstructionPublicItem]
    total: int


class InstructionAdminItem(InstructionPublicItem):
    is_published: bool
    created_at: datetime
    updated_at: datetime
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None


class InstructionAdminListResponse(BaseModel):
    items: list[InstructionAdminItem]
    total: int


class InstructionCreateRequest(BaseModel):
    type: InstructionType
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    sort_order: int = Field(default=0, ge=0, description="Порядок сортировки")
    is_published: bool = Field(default=True, description="Публиковать сразу")


class InstructionUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = Field(default=None, min_length=1)
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_published: Optional[bool] = None


class GenerationExamplePublicItem(BaseModel):
    id: int
    title: Optional[str] = None
    prompt: str
    image_url: str
    uses_count: int


class GenerationExamplePublicListResponse(BaseModel):
    items: list[GenerationExamplePublicItem]
    total: int


class GenerationExampleAdminItem(GenerationExamplePublicItem):
    is_published: bool
    created_at: datetime
    updated_at: datetime
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None


class GenerationExampleAdminListResponse(BaseModel):
    items: list[GenerationExampleAdminItem]
    total: int


class GenerationExampleCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    prompt: str = Field(..., min_length=1)
    image_url: str = Field(..., min_length=1, max_length=500)
    is_published: bool = Field(default=True)


class GenerationExampleUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    prompt: Optional[str] = Field(default=None, min_length=1)
    image_url: Optional[str] = Field(default=None, min_length=1, max_length=500)
    is_published: Optional[bool] = None


class GenerationExampleUseResponse(BaseModel):
    success: bool
    uses_count: int
