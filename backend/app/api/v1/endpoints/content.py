"""
Публичные endpoints для инструкций и примеров генераций.
"""

import time
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.api.dependencies import DBSession, OptionalUser
from app.models import Instruction, GenerationExample, GenerationExampleTag
from app.models.user import UserRole
from app.services.file_storage import resolve_thumbnail_url
from app.schemas.content import (
    InstructionPublicListResponse,
    InstructionPublicItem,
    InstructionType,
    GenerationExamplePublicListResponse,
    GenerationExamplePublicItem,
    GenerationExamplePublicCardListResponse,
    GenerationExamplePublicCardItem,
    GenerationExampleUseRequest,
    GenerationExampleUseResponse,
    ExampleTagListResponse,
    ExampleTagItem,
)
from app.services.example_analytics import (
    normalize_source,
    normalize_variant_index,
    track_variant_event,
)

router = APIRouter()
EXAMPLES_CACHE_TTL_SECONDS = 90
_examples_cache: dict[str, tuple[float, dict]] = {}


def build_examples_cache_key(
    *,
    tags: list[str],
    sort: str,
    limit: int | None,
    page: int | None,
    page_size: int | None,
    view: str,
) -> str:
    normalized_tags = ",".join(sorted({tag.strip().lower() for tag in tags if tag.strip()}))
    parts = [
        ("limit", str(limit) if limit is not None else ""),
        ("page", str(page) if page is not None else ""),
        ("page_size", str(page_size) if page_size is not None else ""),
        ("sort", sort),
        ("tags", normalized_tags),
        ("view", view),
    ]
    return "&".join(f"{key}={value}" for key, value in parts if value != "")


def _get_cached_examples_payload(cache_key: str) -> dict | None:
    cached = _examples_cache.get(cache_key)
    if not cached:
        return None
    expires_at, payload = cached
    if expires_at <= time.monotonic():
        _examples_cache.pop(cache_key, None)
        return None
    return payload


def _store_examples_payload(cache_key: str, payload: dict) -> None:
    _examples_cache[cache_key] = (time.monotonic() + EXAMPLES_CACHE_TTL_SECONDS, payload)


def _build_examples_response(payload: dict) -> JSONResponse:
    return JSONResponse(
        content=payload,
        headers={"Cache-Control": f"public, max-age={EXAMPLES_CACHE_TTL_SECONDS}"},
    )


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


@router.get(
    "/examples",
    response_model=GenerationExamplePublicListResponse | GenerationExamplePublicCardListResponse,
)
async def list_examples(
    db: DBSession,
    tags: Optional[str] = Query(default=None, description="Метки через запятую"),
    sort: Literal["popular", "newest"] = Query(default="popular"),
    limit: Optional[int] = Query(default=None, ge=1, le=100, description="Legacy limit parameter"),
    page: Optional[int] = Query(default=1, ge=1),
    page_size: Optional[int] = Query(default=20, ge=1, le=50),
    view: Literal["full", "card"] = Query(default="full"),
) -> GenerationExamplePublicListResponse | GenerationExamplePublicCardListResponse:
    """
    Получить опубликованные примеры генераций.
    """
    tag_list: list[str] = []
    if tags:
        tag_list = [tag.strip().lower() for tag in tags.split(",") if tag.strip()]

    cache_key = build_examples_cache_key(
        tags=tag_list,
        sort=sort,
        limit=limit,
        page=page,
        page_size=page_size,
        view=view,
    )
    cached_payload = _get_cached_examples_payload(cache_key)
    if cached_payload is not None:
        return _build_examples_response(cached_payload)

    id_stmt = sa.select(GenerationExample.id).where(GenerationExample.is_published.is_(True))
    if tag_list:
        id_stmt = (
            id_stmt.join(GenerationExampleTag)
            .where(GenerationExampleTag.tag.in_(tag_list))
            .distinct()
        )

    if sort == "newest":
        id_stmt = id_stmt.order_by(GenerationExample.created_at.desc())
    else:
        id_stmt = id_stmt.order_by(GenerationExample.uses_count.desc(), GenerationExample.created_at.desc())

    total_stmt = sa.select(sa.func.count()).select_from(id_stmt.subquery())
    total = int((await db.execute(total_stmt)).scalar_one() or 0)

    effective_limit = limit if limit is not None else page_size or 20
    effective_page = page or 1
    offset = 0 if limit is not None else (effective_page - 1) * effective_limit
    page_ids = (
        await db.execute(
            id_stmt.offset(offset).limit(effective_limit)
        )
    ).scalars().all()

    if not page_ids:
        payload = {"items": [], "total": total}
        _store_examples_payload(cache_key, payload)
        return _build_examples_response(payload)

    item_stmt = (
        sa.select(GenerationExample)
        .where(GenerationExample.id.in_(page_ids))
        .options(selectinload(GenerationExample.tags))
    )
    items = (await db.execute(item_stmt)).scalars().all()
    order_map = {example_id: index for index, example_id in enumerate(page_ids)}
    items.sort(key=lambda item: order_map.get(item.id, len(order_map)))

    if view == "card":
        payload = GenerationExamplePublicCardListResponse(
            items=[
                GenerationExamplePublicCardItem(
                    id=item.id,
                    slug=item.slug,
                    seo_variant_index=item.seo_variant_index,
                    title=item.title,
                    description=item.description,
                    image_url=item.image_url,
                    thumbnail_url=resolve_thumbnail_url(item.image_url),
                    uses_count=item.uses_count,
                    tags=[tag.tag for tag in item.tags],
                )
                for item in items
            ],
            total=total,
        ).model_dump(mode="json")
    else:
        payload = GenerationExamplePublicListResponse(
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
            total=total,
        ).model_dump(mode="json")

    _store_examples_payload(cache_key, payload)
    return _build_examples_response(payload)


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
    current_user: OptionalUser,
    payload: GenerationExampleUseRequest | None = None,
) -> GenerationExampleUseResponse:
    """
    Увеличить счётчик использования примера.
    """
    is_admin_actor = (
        current_user is not None
        and current_user.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}
    )

    if is_admin_actor:
        stmt = (
            sa.select(GenerationExample.uses_count, GenerationExample.seo_variant_index)
            .where(
                GenerationExample.id == example_id,
                GenerationExample.is_published.is_(True),
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.first()
    else:
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

    if not is_admin_actor:
        effective_variant = normalize_variant_index(
            payload.seo_variant_index if payload else None,
            fallback=row[1],
        )
        effective_source = normalize_source(payload.source if payload else None)
        await track_variant_event(
            db,
            example_id=example_id,
            source=effective_source,
            seo_variant_index=effective_variant,
            event_type="start",
            actor_user_id=current_user.id if current_user else None,
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
