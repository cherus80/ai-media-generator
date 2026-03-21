from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


ActivationEventName = Literal[
    "register_success",
    "onboarding_start",
    "first_upload_success",
    "first_generate_click",
    "first_generate_success",
]


class ActivationEventIngestRequest(BaseModel):
    event_name: ActivationEventName
    anonymous_id: Optional[str] = Field(default=None, max_length=128)
    session_id: Optional[str] = Field(default=None, max_length=128)
    flow_id: Optional[str] = Field(default=None, max_length=128)
    route: Optional[str] = Field(default=None, max_length=255)
    entry_source: Optional[str] = Field(default=None, max_length=128)
    utm_source: Optional[str] = Field(default=None, max_length=128)
    utm_medium: Optional[str] = Field(default=None, max_length=128)
    utm_campaign: Optional[str] = Field(default=None, max_length=128)
    utm_content: Optional[str] = Field(default=None, max_length=128)
    utm_term: Optional[str] = Field(default=None, max_length=128)
    referral_code: Optional[str] = Field(default=None, max_length=64)
    timestamp: Optional[datetime] = None


class ActivationEventIngestResponse(BaseModel):
    recorded: bool
    deduplicated: bool = False


class ActivationStateResponse(BaseModel):
    feature_enabled: bool
    completed_generations_count: int
    is_activated: bool
    first_generate_success_at: Optional[datetime] = None


class ActivationMetricsWindow(BaseModel):
    p50_seconds: Optional[int] = None
    p95_seconds: Optional[int] = None


class ActivationMetricsResponse(BaseModel):
    register_success_count: int
    first_generate_success_count: int
    activation_rate: float
    time_to_first_generate: ActivationMetricsWindow

