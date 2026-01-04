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
    GenerationExampleUseResponse,
    ExampleTagListResponse,
    ExampleTagItem,
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
                title=item.title,
                prompt=item.prompt,
                image_url=item.image_url,
                uses_count=item.uses_count,
                tags=[tag.tag for tag in item.tags],
            )
            for item in items
        ],
        total=len(items),
    )


@router.post("/examples/{example_id}/use", response_model=GenerationExampleUseResponse)
async def increment_example_use(
    example_id: int,
    db: DBSession,
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
        .returning(GenerationExample.uses_count)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Пример не найден")
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
