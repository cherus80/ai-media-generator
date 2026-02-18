"""
Runtime-config helpers for sharing mutable settings across app and workers.

Используется для передачи выбранных провайдеров генерации (primary/fallback)
между API и Celery воркерами через Redis.
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import redis
import redis.asyncio as redis_async

from app.core.config import settings

logger = logging.getLogger(__name__)

REDIS_KEY_PROVIDERS = "runtime:generation_providers"


def _normalize_provider(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    value = value.lower()
    if value not in {"grsai", "kie_ai"}:
        return None
    return value


def _default_fallback_for(primary: str) -> Optional[str]:
    if primary == "grsai":
        return "kie_ai"
    if primary == "kie_ai":
        return "grsai"
    return None


async def set_generation_providers(
    primary: Optional[str],
    fallback: Optional[str],
    disable_fallback: bool,
) -> None:
    """
    Асинхронно сохраняет выбор primary/fallback провайдера в Redis.
    """
    primary_norm = _normalize_provider(primary)
    fallback_norm = _normalize_provider(fallback)

    if fallback_norm == primary_norm:
        fallback_norm = None

    payload = {
        "primary": primary_norm or "",
        "fallback": fallback_norm or "",
        "disable_fallback": "1" if disable_fallback else "0",
    }

    try:
        client = redis_async.from_url(settings.REDIS_URL, decode_responses=True)
        await client.hset(REDIS_KEY_PROVIDERS, mapping=payload)
    except Exception as e:
        logger.warning("Failed to save generation providers to Redis: %s", e)


def get_generation_providers_for_worker() -> Tuple[str, Optional[str], bool]:
    """
    Синхронно читает выбор провайдеров из Redis для Celery воркера.

    Returns:
        (primary, fallback, disable_fallback)
    """
    primary_raw = settings.GENERATION_PRIMARY_PROVIDER or ("kie_ai" if settings.USE_KIE_AI else "grsai")
    primary = _normalize_provider(primary_raw) or "grsai"

    fallback = _normalize_provider(settings.GENERATION_FALLBACK_PROVIDER)
    disable_fallback = bool(settings.KIE_AI_DISABLE_FALLBACK)

    # Самовосстановление при рассинхроне env: fallback задан, но disable=true.
    if disable_fallback and fallback:
        logger.warning(
            "Inconsistent provider settings detected (disable_fallback=true with fallback=%s). "
            "Using configured fallback provider.",
            fallback,
        )
        disable_fallback = False

    if disable_fallback:
        fallback = None
    elif fallback is None:
        fallback = _default_fallback_for(primary)

    try:
        client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        data = client.hgetall(REDIS_KEY_PROVIDERS) or {}

        stored_primary = _normalize_provider(data.get("primary"))
        stored_fallback = _normalize_provider(data.get("fallback"))
        stored_disable_raw = data.get("disable_fallback")
        stored_disable: Optional[bool] = None
        if stored_disable_raw is not None:
            stored_disable = stored_disable_raw == "1"

        if stored_primary:
            primary = stored_primary
        if "fallback" in data:
            fallback = stored_fallback
        if stored_disable is True:
            fallback = None
            disable_fallback = True
        elif stored_disable is False:
            disable_fallback = False

        if fallback == primary:
            fallback = None
        if not disable_fallback and fallback is None:
            fallback = _default_fallback_for(primary)
    except Exception as e:
        logger.warning("Failed to load generation providers from Redis: %s", e)

    return primary, fallback, disable_fallback
