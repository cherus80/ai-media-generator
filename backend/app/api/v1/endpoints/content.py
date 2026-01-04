"""
Публичные endpoints для инструкций и примеров генераций.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
import sqlalchemy as sa

from app.api.dependencies import DBSession
from app.models import Instruction, GenerationExample
from app.schemas.content import (
    InstructionPublicListResponse,
    InstructionPublicItem,
    InstructionType,
    GenerationExamplePublicListResponse,
    GenerationExamplePublicItem,
    GenerationExampleUseResponse,
)

router = APIRouter()


@router.get("/instructions", response_model=InstructionPublicListResponse)
async def list_instructions(
    instruction_type: Optional[InstructionType] = Query(default=None, alias="type"),
    db: DBSession,
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
) -> GenerationExamplePublicListResponse:
    """
    Получить опубликованные примеры генераций.
    """
    stmt = (
        sa.select(GenerationExample)
        .where(GenerationExample.is_published.is_(True))
        .order_by(GenerationExample.uses_count.desc(), GenerationExample.created_at.desc())
    )
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
