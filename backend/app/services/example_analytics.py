"""
Сервис аналитики вариантов SEO для карточек примеров.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Literal

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GenerationExampleVariantStat

MAX_VARIANT_INDEX = 99
MAX_SOURCE_LENGTH = 40
DEFAULT_SOURCE = "unknown"


def normalize_variant_index(value: int | None, fallback: int = 0) -> int:
    try:
        normalized = int(value) if value is not None else fallback
    except (TypeError, ValueError):
        normalized = fallback
    return min(max(normalized, 0), MAX_VARIANT_INDEX)


def normalize_source(value: str | None, fallback: str = DEFAULT_SOURCE) -> str:
    source = (value or "").strip().lower()
    if not source:
        source = fallback
    source = "".join(ch if ch.isalnum() or ch in {"_", "-", "."} else "_" for ch in source)
    return source[:MAX_SOURCE_LENGTH] or fallback


async def increment_variant_metric(
    db: AsyncSession,
    *,
    example_id: int,
    source: str,
    seo_variant_index: int,
    metric: Literal["views", "starts"],
) -> None:
    update_values: dict[str, object]
    if metric == "views":
        update_values = {
            "views_count": GenerationExampleVariantStat.views_count + 1,
            "updated_at": sa.func.now(),
        }
        insert_values = {"views_count": 1, "starts_count": 0}
    else:
        update_values = {
            "starts_count": GenerationExampleVariantStat.starts_count + 1,
            "updated_at": sa.func.now(),
        }
        insert_values = {"views_count": 0, "starts_count": 1}

    update_stmt = (
        sa.update(GenerationExampleVariantStat)
        .where(
            GenerationExampleVariantStat.example_id == example_id,
            GenerationExampleVariantStat.source == source,
            GenerationExampleVariantStat.seo_variant_index == seo_variant_index,
        )
        .values(**update_values)
    )
    update_result = await db.execute(update_stmt)
    if update_result.rowcount and update_result.rowcount > 0:
        return

    record = GenerationExampleVariantStat(
        example_id=example_id,
        source=source,
        seo_variant_index=seo_variant_index,
        **insert_values,
    )
    try:
        async with db.begin_nested():
            db.add(record)
            await db.flush()
        return
    except IntegrityError:
        pass

    await db.execute(update_stmt)


async def load_variant_stats_map(
    db: AsyncSession,
    example_ids: list[int],
) -> dict[int, list[GenerationExampleVariantStat]]:
    if not example_ids:
        return {}
    stmt = (
        sa.select(GenerationExampleVariantStat)
        .where(GenerationExampleVariantStat.example_id.in_(example_ids))
        .order_by(
            GenerationExampleVariantStat.example_id.asc(),
            GenerationExampleVariantStat.source.asc(),
            GenerationExampleVariantStat.seo_variant_index.asc(),
        )
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    grouped: dict[int, list[GenerationExampleVariantStat]] = defaultdict(list)
    for row in rows:
        grouped[row.example_id].append(row)
    return dict(grouped)
