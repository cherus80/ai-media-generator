"""
Вспомогательные функции rate limiting через Redis.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Request
import redis.asyncio as redis

from app.core.config import settings
from app.utils.jwt import verify_token, JWTTokenError

logger = logging.getLogger(__name__)

_redis_client: Optional[redis.Redis] = None


async def init_rate_limiter() -> None:
    """Инициализировать Redis-клиент для rate limiting."""
    global _redis_client
    if not settings.RATE_LIMITING_ENABLED or _redis_client:
        return
    try:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await _redis_client.ping()
    except Exception as exc:
        logger.warning("Rate limiter disabled: Redis is not available (%s)", exc)
        _redis_client = None


async def close_rate_limiter() -> None:
    """Закрыть Redis-клиент rate limiting."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


def rate_limiter_ready() -> bool:
    return settings.RATE_LIMITING_ENABLED and _redis_client is not None


def get_client_ip(request: Request) -> str:
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _extract_user_id(request: Request) -> Optional[int]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = verify_token(token)
    except JWTTokenError:
        return None
    if not payload:
        return None
    user_id = payload.get("user_id")
    return int(user_id) if user_id is not None else None


def resolve_identity(request: Request) -> str:
    user_id = _extract_user_id(request)
    if user_id is not None:
        return f"user:{user_id}"
    return f"ip:{get_client_ip(request)}"


async def is_rate_limited(key: str, limit: int, window_seconds: int) -> bool:
    if not rate_limiter_ready() or limit <= 0:
        return False
    try:
        pipeline = _redis_client.pipeline()
        pipeline.incr(key)
        pipeline.expire(key, window_seconds)
        count, _ = await pipeline.execute()
        return int(count) > limit
    except Exception as exc:
        logger.warning("Rate limiter failed for key %s: %s", key, exc)
        return False
