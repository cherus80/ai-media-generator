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
    description: Optional[str] = None
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
    description: Optional[str] = Field(default=None, max_length=300)
    content: str = Field(..., min_length=1)
    sort_order: int = Field(default=0, ge=0, description="Порядок сортировки")
    is_published: bool = Field(default=True, description="Публиковать сразу")


class InstructionUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=300)
    content: Optional[str] = Field(default=None, min_length=1)
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_published: Optional[bool] = None


class InstructionUploadResponse(BaseModel):
    file_id: str
    file_url: str
    file_size: int


class GenerationExamplePublicItem(BaseModel):
    id: int
    slug: str
    seo_variant_index: int = Field(default=0, ge=0)
    title: Optional[str] = None
    description: Optional[str] = None
    prompt: str
    image_url: str
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    uses_count: int
    tags: list[str] = Field(default_factory=list)


class GenerationExamplePublicListResponse(BaseModel):
    items: list[GenerationExamplePublicItem]
    total: int


class GenerationExampleVariantStatItem(BaseModel):
    source: str
    seo_variant_index: int
    views_count: int = 0
    starts_count: int = 0
    conversion_rate: float = 0.0


class GenerationExampleAdminItem(GenerationExamplePublicItem):
    variant_stats: list[GenerationExampleVariantStatItem] = Field(default_factory=list)
    is_published: bool
    created_at: datetime
    updated_at: datetime
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None


class GenerationExampleAdminListResponse(BaseModel):
    items: list[GenerationExampleAdminItem]
    total: int


class GenerationExampleCreateRequest(BaseModel):
    slug: Optional[str] = Field(default=None, min_length=1, max_length=240)
    seo_variant_index: int = Field(default=0, ge=0, le=99)
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    prompt: str = Field(..., min_length=1)
    image_url: str = Field(..., min_length=1, max_length=500)
    seo_title: Optional[str] = Field(default=None, max_length=120)
    seo_description: Optional[str] = Field(default=None, max_length=200)
    tags: list[str] = Field(default_factory=list)
    is_published: bool = Field(default=True)


class GenerationExampleUpdateRequest(BaseModel):
    slug: Optional[str] = Field(default=None, min_length=1, max_length=240)
    seo_variant_index: Optional[int] = Field(default=None, ge=0, le=99)
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    prompt: Optional[str] = Field(default=None, min_length=1)
    image_url: Optional[str] = Field(default=None, min_length=1, max_length=500)
    seo_title: Optional[str] = Field(default=None, max_length=120)
    seo_description: Optional[str] = Field(default=None, max_length=200)
    tags: Optional[list[str]] = None
    is_published: Optional[bool] = None


class GenerationExampleSeoFaqItem(BaseModel):
    question: str = Field(..., min_length=1, max_length=180)
    answer: str = Field(..., min_length=1, max_length=400)


class GenerationExampleSeoSuggestionRequest(BaseModel):
    slug: Optional[str] = Field(default=None, max_length=240)
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    prompt: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)
    seo_title: Optional[str] = Field(default=None, max_length=120)
    seo_description: Optional[str] = Field(default=None, max_length=200)


class GenerationExampleSeoSuggestionVariant(BaseModel):
    slug: str
    title: str
    description: str
    seo_title: str
    seo_description: str
    faq: list[GenerationExampleSeoFaqItem] = Field(default_factory=list)


class GenerationExampleSeoSuggestionResponse(BaseModel):
    slug: str
    title: str
    description: str
    seo_title: str
    seo_description: str
    faq: list[GenerationExampleSeoFaqItem] = Field(default_factory=list)
    selected_index: int = Field(default=0, ge=0)
    variants: list[GenerationExampleSeoSuggestionVariant] = Field(default_factory=list)


class GenerationExampleVariantReportItem(BaseModel):
    example_id: int
    slug: str
    title: Optional[str] = None
    source: str
    seo_variant_index: int
    views_count: int = 0
    starts_count: int = 0
    conversion_rate: float = 0.0


class GenerationExampleVariantReportResponse(BaseModel):
    items: list[GenerationExampleVariantReportItem]
    total: int
    source: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    total_views: int = 0
    total_starts: int = 0
    average_conversion_rate: float = 0.0


class GenerationExampleUseRequest(BaseModel):
    seo_variant_index: Optional[int] = Field(default=None, ge=0, le=99)
    source: Optional[str] = Field(default=None, max_length=40)


class GenerationExampleUseResponse(BaseModel):
    success: bool
    uses_count: int


class ExampleTagItem(BaseModel):
    tag: str
    count: int


class ExampleTagListResponse(BaseModel):
    items: list[ExampleTagItem]
    total: int
