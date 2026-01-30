"""
Telegram alerting for backend errors.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional, Dict, Any

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.user import User

logger = logging.getLogger(__name__)

_rate_lock = asyncio.Lock()
_rate_window_start = 0.0
_rate_sent = 0


async def _rate_limit_ok() -> bool:
    limit = settings.TELEGRAM_ALERTS_RATE_LIMIT_PER_MINUTE
    if not limit or limit <= 0:
        return True

    global _rate_window_start, _rate_sent
    now = time.time()
    async with _rate_lock:
        if now - _rate_window_start >= 60:
            _rate_window_start = now
            _rate_sent = 0
        if _rate_sent >= limit:
            return False
        _rate_sent += 1
        return True


async def send_telegram_message(text: str) -> None:
    if not settings.TELEGRAM_ALERTS_ENABLED:
        return

    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        logger.warning("Telegram alerts enabled but token/chat_id not configured")
        return

    if not await _rate_limit_ok():
        logger.warning("Telegram alerts rate limited")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                logger.warning(
                    "Telegram alert failed: %s %s",
                    response.status_code,
                    response.text[:200],
                )
    except Exception as exc:
        logger.warning("Telegram alert exception: %s", exc, exc_info=True)


async def fetch_user(user_id: Optional[int]) -> Optional[User]:
    if not user_id or not settings.TELEGRAM_ALERTS_INCLUDE_PII:
        return None
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("Failed to load user for telegram alert: %s", exc)
        return None


def _format_user_context(user: Optional[User], user_id: Optional[int]) -> list[str]:
    lines: list[str] = []
    if user_id is not None:
        lines.append(f"user_id: {user_id}")

    if settings.TELEGRAM_ALERTS_INCLUDE_PII and user:
        if user.email:
            lines.append(f"email: {user.email}")
        if user.username:
            lines.append(f"username: {user.username}")
        if user.telegram_id:
            lines.append(f"telegram_id: {user.telegram_id}")

    return lines


def build_alert_text(
    title: str,
    error: Exception | str,
    user: Optional[User] = None,
    user_id: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    lines = [f"🚨 {title}", f"env: {settings.ENVIRONMENT}"]
    lines.extend(_format_user_context(user, user_id))

    if extra:
        for key, value in extra.items():
            if value is None:
                continue
            lines.append(f"{key}: {value}")

    if isinstance(error, Exception):
        err_type = type(error).__name__
        err_msg = str(error) or repr(error)
    else:
        err_type = "Error"
        err_msg = str(error)

    if err_msg:
        trimmed = err_msg.replace("\n", " ")[:500]
        lines.append(f"error: {err_type}: {trimmed}")

    return "\n".join(lines)


async def notify_error(
    title: str,
    error: Exception | str,
    user: Optional[User] = None,
    user_id: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    if not settings.TELEGRAM_ALERTS_ENABLED:
        return

    user_obj = user
    if user_obj is None and user_id is not None:
        user_obj = await fetch_user(user_id)

    text = build_alert_text(
        title=title,
        error=error,
        user=user_obj,
        user_id=user_id,
        extra=extra,
    )
    await send_telegram_message(text)
