from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.dependencies import CurrentUser, DBSession, require_admin_or_service_token
from app.core.config import settings
from app.schemas.activation import (
    ActivationEventIngestRequest,
    ActivationEventIngestResponse,
    ActivationMetricsResponse,
    ActivationStateResponse,
)
from app.services.activation_events import get_activation_metrics, get_activation_state, record_activation_event

router = APIRouter(prefix="/activation", tags=["activation"])


@router.get("/state", response_model=ActivationStateResponse)
async def get_my_activation_state(
    current_user: CurrentUser,
    db: DBSession,
) -> ActivationStateResponse:
    completed_generations_count, first_generate_success_at = await get_activation_state(
        db,
        user_id=current_user.id,
    )
    return ActivationStateResponse(
        feature_enabled=settings.ACTIVATION_ONBOARDING_V1,
        completed_generations_count=completed_generations_count,
        is_activated=completed_generations_count > 0,
        first_generate_success_at=first_generate_success_at,
    )


@router.post(
    "/events",
    response_model=ActivationEventIngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_activation_event(
    payload: ActivationEventIngestRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> ActivationEventIngestResponse:
    recorded = await record_activation_event(
        db,
        event_name=payload.event_name,
        user_id=current_user.id,
        anonymous_id=payload.anonymous_id,
        session_id=payload.session_id,
        flow_id=payload.flow_id,
        route=payload.route,
        entry_source=payload.entry_source,
        utm_source=payload.utm_source,
        utm_medium=payload.utm_medium,
        utm_campaign=payload.utm_campaign,
        utm_content=payload.utm_content,
        utm_term=payload.utm_term,
        referral_code=payload.referral_code,
        timestamp=payload.timestamp,
    )
    await db.commit()
    return ActivationEventIngestResponse(recorded=recorded, deduplicated=not recorded)


@router.get("/metrics", response_model=ActivationMetricsResponse)
async def get_activation_metrics_endpoint(
    db: DBSession,
    _admin: Annotated[object | None, Depends(require_admin_or_service_token)],
) -> ActivationMetricsResponse:
    metrics = await get_activation_metrics(db)
    return ActivationMetricsResponse(
        register_success_count=metrics.register_success_count,
        first_generate_success_count=metrics.first_generate_success_count,
        activation_rate=metrics.activation_rate,
        time_to_first_generate={
            "p50_seconds": metrics.p50_seconds,
            "p95_seconds": metrics.p95_seconds,
        },
    )
