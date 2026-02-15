"""
Сервис аналитики вариантов SEO для карточек примеров.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GenerationExample, GenerationExampleVariantEvent, GenerationExampleVariantStat

MAX_VARIANT_INDEX = 99
MAX_SOURCE_LENGTH = 40
DEFAULT_SOURCE = "unknown"
REPORT_MAX_LIMIT = 500
EventType = Literal["view", "start"]


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


async def track_variant_event(
    db: AsyncSession,
    *,
    example_id: int,
    source: str,
    seo_variant_index: int,
    event_type: EventType,
) -> None:
    metric: Literal["views", "starts"] = "views" if event_type == "view" else "starts"
    db.add(
        GenerationExampleVariantEvent(
            example_id=example_id,
            source=source,
            seo_variant_index=seo_variant_index,
            event_type=event_type,
        )
    )
    await increment_variant_metric(
        db,
        example_id=example_id,
        source=source,
        seo_variant_index=seo_variant_index,
        metric=metric,
    )


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


def _to_utc_range(date_from: datetime | None, date_to: datetime | None) -> tuple[datetime | None, datetime | None]:
    start = date_from
    end = date_to
    if start and start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end and end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if end:
        end = end + timedelta(days=1)
    return start, end


async def get_variant_report_rows(
    db: AsyncSession,
    *,
    source: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 200,
) -> list[dict[str, object]]:
    safe_limit = min(max(limit, 1), REPORT_MAX_LIMIT)
    start_dt, end_dt = _to_utc_range(date_from, date_to)

    views_expr = sa.func.sum(
        sa.case((GenerationExampleVariantEvent.event_type == "view", 1), else_=0)
    ).label("views_count")
    starts_expr = sa.func.sum(
        sa.case((GenerationExampleVariantEvent.event_type == "start", 1), else_=0)
    ).label("starts_count")

    stmt = (
        sa.select(
            GenerationExample.id.label("example_id"),
            GenerationExample.slug.label("slug"),
            GenerationExample.title.label("title"),
            GenerationExampleVariantEvent.source.label("source"),
            GenerationExampleVariantEvent.seo_variant_index.label("seo_variant_index"),
            views_expr,
            starts_expr,
        )
        .join(GenerationExample, GenerationExample.id == GenerationExampleVariantEvent.example_id)
        .where(GenerationExample.is_published.is_(True))
        .group_by(
            GenerationExample.id,
            GenerationExample.slug,
            GenerationExample.title,
            GenerationExampleVariantEvent.source,
            GenerationExampleVariantEvent.seo_variant_index,
        )
        .order_by(starts_expr.desc(), views_expr.desc(), GenerationExample.id.asc())
        .limit(safe_limit)
    )

    if source:
        stmt = stmt.where(GenerationExampleVariantEvent.source == source)
    if start_dt:
        stmt = stmt.where(GenerationExampleVariantEvent.created_at >= start_dt)
    if end_dt:
        stmt = stmt.where(GenerationExampleVariantEvent.created_at < end_dt)

    rows = (await db.execute(stmt)).all()
    items: list[dict[str, object]] = []
    for row in rows:
        views_count = int(row.views_count or 0)
        starts_count = int(row.starts_count or 0)
        conversion_rate = float(starts_count / views_count) if views_count > 0 else 0.0
        items.append(
            {
                "example_id": row.example_id,
                "slug": row.slug,
                "title": row.title,
                "source": row.source,
                "seo_variant_index": int(row.seo_variant_index or 0),
                "views_count": views_count,
                "starts_count": starts_count,
                "conversion_rate": round(conversion_rate, 4),
            }
        )
    return items
