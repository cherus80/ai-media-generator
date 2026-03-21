from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import ceil
from typing import Optional

import sqlalchemy as sa
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activation_event import ActivationEvent
from app.models.generation import Generation

FIRST_ONLY_EVENT_NAMES = {
    "register_success",
    "onboarding_start",
    "first_upload_success",
    "first_generate_click",
    "first_generate_success",
}

ACTIVATION_HEADER_MAP = {
    "anonymous_id": "X-Activation-Anon-Id",
    "session_id": "X-Activation-Session-Id",
    "flow_id": "X-Activation-Flow-Id",
    "route": "X-Activation-Route",
    "entry_source": "X-Activation-Entry-Source",
    "utm_source": "X-Activation-Utm-Source",
    "utm_medium": "X-Activation-Utm-Medium",
    "utm_campaign": "X-Activation-Utm-Campaign",
    "utm_content": "X-Activation-Utm-Content",
    "utm_term": "X-Activation-Utm-Term",
    "referral_code": "X-Activation-Referral-Code",
}


@dataclass
class ActivationMetricsSnapshot:
    register_success_count: int
    first_generate_success_count: int
    activation_rate: float
    p50_seconds: Optional[int]
    p95_seconds: Optional[int]


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def extract_activation_context_from_request(request: Request) -> dict[str, str | None]:
    context: dict[str, str | None] = {}
    for field_name, header_name in ACTIVATION_HEADER_MAP.items():
        raw_value = (request.headers.get(header_name) or "").strip()
        context[field_name] = raw_value or None
    return context


async def _event_exists(
    db: AsyncSession,
    *,
    event_name: str,
    user_id: int | None,
    anonymous_id: str | None,
) -> bool:
    stmt = sa.select(ActivationEvent.id).where(ActivationEvent.event_name == event_name)
    if user_id is not None:
        stmt = stmt.where(ActivationEvent.user_id == user_id)
    elif anonymous_id:
        stmt = stmt.where(
            ActivationEvent.user_id.is_(None),
            ActivationEvent.anonymous_id == anonymous_id,
        )
    else:
        return False
    result = await db.execute(stmt.limit(1))
    return result.scalar_one_or_none() is not None


async def record_activation_event(
    db: AsyncSession,
    *,
    event_name: str,
    user_id: int | None = None,
    anonymous_id: str | None = None,
    session_id: str | None = None,
    flow_id: str | None = None,
    route: str | None = None,
    entry_source: str | None = None,
    utm_source: str | None = None,
    utm_medium: str | None = None,
    utm_campaign: str | None = None,
    utm_content: str | None = None,
    utm_term: str | None = None,
    referral_code: str | None = None,
    generation_id: int | None = None,
    timestamp: datetime | None = None,
) -> bool:
    if event_name in FIRST_ONLY_EVENT_NAMES:
        if await _event_exists(
            db,
            event_name=event_name,
            user_id=user_id,
            anonymous_id=anonymous_id,
        ):
            return False

    event = ActivationEvent(
        event_name=event_name,
        user_id=user_id,
        anonymous_id=anonymous_id,
        session_id=session_id,
        flow_id=flow_id,
        route=route,
        entry_source=entry_source,
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
        utm_content=utm_content,
        utm_term=utm_term,
        referral_code=referral_code,
        generation_id=generation_id,
        event_at=_normalize_datetime(timestamp),
    )
    if timestamp is not None:
        normalized = _normalize_datetime(timestamp)
        event.created_at = normalized
        event.updated_at = normalized
    db.add(event)
    await db.flush()
    return True


async def get_activation_state(db: AsyncSession, *, user_id: int) -> tuple[int, datetime | None]:
    first_success_stmt = (
        sa.select(ActivationEvent.created_at)
        .where(
            ActivationEvent.user_id == user_id,
            ActivationEvent.event_name == "first_generate_success",
        )
        .order_by(ActivationEvent.created_at.asc())
        .limit(1)
    )
    first_success = (await db.execute(first_success_stmt)).scalar_one_or_none()

    completed_stmt = (
        sa.select(sa.func.count())
        .select_from(Generation)
        .where(
            Generation.user_id == user_id,
            Generation.status == "completed",
        )
    )
    completed_count = int((await db.execute(completed_stmt)).scalar_one() or 0)
    return completed_count, first_success


async def _load_latest_activation_context(db: AsyncSession, *, user_id: int) -> ActivationEvent | None:
    stmt = (
        sa.select(ActivationEvent)
        .where(
            ActivationEvent.user_id == user_id,
            ActivationEvent.event_name.in_(
                ["first_generate_click", "first_upload_success", "onboarding_start"]
            ),
        )
        .order_by(ActivationEvent.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def record_first_generate_success(db: AsyncSession, *, generation: Generation) -> bool:
    context = await _load_latest_activation_context(db, user_id=generation.user_id)
    default_route = "/fitting" if generation.type.value == "fitting" else "/editing"
    return await record_activation_event(
        db,
        event_name="first_generate_success",
        user_id=generation.user_id,
        session_id=context.session_id if context else None,
        flow_id=context.flow_id if context else None,
        route=context.route if context and context.route else default_route,
        entry_source=context.entry_source if context else generation.type.value,
        utm_source=context.utm_source if context else None,
        utm_medium=context.utm_medium if context else None,
        utm_campaign=context.utm_campaign if context else None,
        utm_content=context.utm_content if context else None,
        utm_term=context.utm_term if context else None,
        referral_code=context.referral_code if context else None,
        generation_id=generation.id,
        timestamp=datetime.now(timezone.utc),
    )


def _percentile(sorted_values: list[int], percentile: float) -> int | None:
    if not sorted_values:
        return None
    if len(sorted_values) == 1:
        return sorted_values[0]
    index = max(0, ceil((percentile / 100) * len(sorted_values)) - 1)
    return sorted_values[index]


async def get_activation_metrics(db: AsyncSession) -> ActivationMetricsSnapshot:
    register_count_stmt = (
        sa.select(sa.func.count())
        .select_from(ActivationEvent)
        .where(ActivationEvent.event_name == "register_success")
    )
    success_count_stmt = (
        sa.select(sa.func.count())
        .select_from(ActivationEvent)
        .where(ActivationEvent.event_name == "first_generate_success")
    )

    register_success_count = int((await db.execute(register_count_stmt)).scalar_one() or 0)
    first_generate_success_count = int((await db.execute(success_count_stmt)).scalar_one() or 0)
    activation_rate = (
        round(first_generate_success_count / register_success_count, 4)
        if register_success_count > 0
        else 0.0
    )

    ttfg_stmt = (
        sa.select(
            ActivationEvent.user_id,
            ActivationEvent.created_at.label("success_at"),
            sa.func.min(ActivationEvent.created_at)
            .over(partition_by=ActivationEvent.user_id)
            .label("first_success_at"),
        )
        .where(
            ActivationEvent.event_name == "first_generate_success",
            ActivationEvent.user_id.is_not(None),
        )
    )
    success_rows = (await db.execute(ttfg_stmt)).all()
    first_success_by_user: dict[int, datetime] = {}
    for row in success_rows:
        if row.user_id not in first_success_by_user:
            first_success_by_user[row.user_id] = _normalize_datetime(row.first_success_at)  # type: ignore[arg-type]

    if first_success_by_user:
        users_stmt = sa.select(ActivationEvent.user_id, ActivationEvent.created_at).where(
            ActivationEvent.event_name == "register_success",
            ActivationEvent.user_id.in_(list(first_success_by_user.keys())),
        )
        register_rows = (await db.execute(users_stmt)).all()
        register_by_user = {
            row.user_id: _normalize_datetime(row.created_at)
            for row in register_rows
            if row.user_id is not None
        }
        deltas: list[int] = []
        for user_id, success_at in first_success_by_user.items():
            register_at = register_by_user.get(user_id)
            if register_at is None or success_at is None:
                continue
            delta_seconds = int(max((success_at - register_at).total_seconds(), 0))
            deltas.append(delta_seconds)
        deltas.sort()
    else:
        deltas = []

    return ActivationMetricsSnapshot(
        register_success_count=register_success_count,
        first_generate_success_count=first_generate_success_count,
        activation_rate=activation_rate,
        p50_seconds=_percentile(deltas, 50),
        p95_seconds=_percentile(deltas, 95),
    )

