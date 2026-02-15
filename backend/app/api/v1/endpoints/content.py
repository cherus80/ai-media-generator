"""
Публичные endpoints для инструкций и примеров генераций.
"""

from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Query
import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.api.dependencies import DBSession
from app.models import Instruction, GenerationExample, GenerationExampleTag
from app.schemas.content import (
    InstructionPublicListResponse,
    InstructionPublicItem,
    InstructionType,
    GenerationExamplePublicListResponse,
    GenerationExamplePublicItem,
    GenerationExampleUseRequest,
    GenerationExampleUseResponse,
    ExampleTagListResponse,
    ExampleTagItem,
)
from app.services.example_analytics import (
    increment_variant_metric,
    normalize_source,
    normalize_variant_index,
)

router = APIRouter()


@router.get("/instructions", response_model=InstructionPublicListResponse)
async def list_instructions(
    db: DBSession,
    instruction_type: Optional[InstructionType] = Query(default=None, alias="type"),
) -> InstructionPublicListResponse:
    """
    Получить опубликованные инструкции (текстовые/видео).
    """
    stmt = sa.select(Instruction).where(Instruction.is_published.is_(True))
    if instruction_type:
        stmt = stmt.where(Instruction.type == instruction_type.value)
    stmt = stmt.order_by(Instruction.sort_order.asc(), Instruction.created_at.desc())
    result = await db.execute(stmt)
    items = result.scalars().all()

    return InstructionPublicListResponse(
        items=[
            InstructionPublicItem(
                id=item.id,
                type=InstructionType(item.type.value),
                title=item.title,
                description=item.description,
                content=item.content,
                sort_order=item.sort_order,
            )
            for item in items
        ],
        total=len(items),
    )


@router.get("/examples", response_model=GenerationExamplePublicListResponse)
async def list_examples(
    db: DBSession,
    tags: Optional[str] = Query(default=None, description="Метки через запятую"),
    sort: Literal["popular", "newest"] = Query(default="popular"),
    limit: Optional[int] = Query(default=None, ge=1, le=100),
) -> GenerationExamplePublicListResponse:
    """
    Получить опубликованные примеры генераций.
    """
    stmt = sa.select(GenerationExample).where(GenerationExample.is_published.is_(True))
    tag_list: list[str] = []
    if tags:
        tag_list = [tag.strip().lower() for tag in tags.split(",") if tag.strip()]
    if tag_list:
        stmt = (
            stmt.join(GenerationExampleTag)
            .where(GenerationExampleTag.tag.in_(tag_list))
            .distinct()
        )

    if sort == "newest":
        stmt = stmt.order_by(GenerationExample.created_at.desc())
    else:
        stmt = stmt.order_by(GenerationExample.uses_count.desc(), GenerationExample.created_at.desc())

    if limit:
        stmt = stmt.limit(limit)

    stmt = stmt.options(selectinload(GenerationExample.tags))
    result = await db.execute(stmt)
    items = result.scalars().all()

    return GenerationExamplePublicListResponse(
        items=[
            GenerationExamplePublicItem(
                id=item.id,
                slug=item.slug,
                seo_variant_index=item.seo_variant_index,
                title=item.title,
                description=item.description,
                prompt=item.prompt,
                image_url=item.image_url,
                seo_title=item.seo_title,
                seo_description=item.seo_description,
                uses_count=item.uses_count,
                tags=[tag.tag for tag in item.tags],
            )
            for item in items
        ],
        total=len(items),
    )


@router.get("/examples/by-slug/{slug}", response_model=GenerationExamplePublicItem)
async def get_example_by_slug(
    slug: str,
    db: DBSession,
) -> GenerationExamplePublicItem:
    """
    Получить опубликованный пример по slug.
    """
    stmt = (
        sa.select(GenerationExample)
        .where(
            GenerationExample.slug == slug,
            GenerationExample.is_published.is_(True),
        )
        .options(selectinload(GenerationExample.tags))
        .limit(1)
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Пример не найден")

    return GenerationExamplePublicItem(
        id=item.id,
        slug=item.slug,
        seo_variant_index=item.seo_variant_index,
        title=item.title,
        description=item.description,
        prompt=item.prompt,
        image_url=item.image_url,
        seo_title=item.seo_title,
        seo_description=item.seo_description,
        uses_count=item.uses_count,
        tags=[tag.tag for tag in item.tags],
    )


@router.post("/examples/{example_id}/use", response_model=GenerationExampleUseResponse)
async def increment_example_use(
    example_id: int,
    db: DBSession,
    payload: GenerationExampleUseRequest | None = None,
) -> GenerationExampleUseResponse:
    """
    Увеличить счётчик использования примера.
    """
    stmt = (
        sa.update(GenerationExample)
        .where(
            GenerationExample.id == example_id,
            GenerationExample.is_published.is_(True),
        )
        .values(uses_count=GenerationExample.uses_count + 1)
        .returning(GenerationExample.uses_count, GenerationExample.seo_variant_index)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Пример не найден")

    effective_variant = normalize_variant_index(
        payload.seo_variant_index if payload else None,
        fallback=row[1],
    )
    effective_source = normalize_source(payload.source if payload else None)
    await increment_variant_metric(
        db,
        example_id=example_id,
        source=effective_source,
        seo_variant_index=effective_variant,
        metric="starts",
    )

    await db.commit()
    return GenerationExampleUseResponse(success=True, uses_count=row[0])


@router.get("/example-tags", response_model=ExampleTagListResponse)
async def list_example_tags(
    db: DBSession,
) -> ExampleTagListResponse:
    """
    Получить список меток с количеством опубликованных примеров.
    """
    stmt = (
        sa.select(
            GenerationExampleTag.tag,
            sa.func.count(sa.distinct(GenerationExampleTag.example_id)),
        )
        .join(GenerationExample, GenerationExample.id == GenerationExampleTag.example_id)
        .where(GenerationExample.is_published.is_(True))
        .group_by(GenerationExampleTag.tag)
        .order_by(sa.func.count(sa.distinct(GenerationExampleTag.example_id)).desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return ExampleTagListResponse(
        items=[ExampleTagItem(tag=tag, count=count) for tag, count in rows],
        total=len(rows),
    )
