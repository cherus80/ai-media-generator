"""
Утилиты для извлечения клиентских метаданных (IP + устройство) из HTTP-запроса.
"""

from __future__ import annotations

from datetime import datetime
import re

from fastapi import Request

from app.models.user import User


def extract_client_ip(request: Request) -> str | None:
    """
    Получить клиентский IP с учётом reverse proxy.
    Приоритет: X-Real-IP -> X-Forwarded-For -> request.client.host.
    """
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip.split(",")[0].strip()[:64]

    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()[:64]

    if request.client and request.client.host:
        return request.client.host[:64]

    return None


def _extract_version(pattern: str, user_agent: str) -> str | None:
    match = re.search(pattern, user_agent, flags=re.IGNORECASE)
    if not match:
        return None
    return match.group(1)


def _detect_device_type(user_agent_lower: str) -> str:
    if "ipad" in user_agent_lower or "tablet" in user_agent_lower:
        return "Tablet"
    if "mobile" in user_agent_lower or "android" in user_agent_lower or "iphone" in user_agent_lower:
        return "Mobile"
    return "Desktop"


def _detect_os(user_agent: str, user_agent_lower: str) -> str:
    if "windows" in user_agent_lower:
        version = _extract_version(r"windows nt ([0-9.]+)", user_agent)
        return f"Windows NT {version}" if version else "Windows"
    if "android" in user_agent_lower:
        version = _extract_version(r"android ([0-9.]+)", user_agent)
        return f"Android {version}" if version else "Android"
    if "iphone" in user_agent_lower or "ipad" in user_agent_lower or "ios" in user_agent_lower:
        version = _extract_version(r"os ([0-9_]+)", user_agent)
        if version:
            return f"iOS {version.replace('_', '.')}"
        return "iOS"
    if "mac os x" in user_agent_lower or "macintosh" in user_agent_lower:
        version = _extract_version(r"mac os x ([0-9_]+)", user_agent)
        if version:
            return f"macOS {version.replace('_', '.')}"
        return "macOS"
    if "linux" in user_agent_lower:
        return "Linux"
    return "Unknown OS"


def _detect_browser(user_agent: str, user_agent_lower: str) -> str:
    if "yabrowser/" in user_agent_lower:
        version = _extract_version(r"yabrowser/([0-9.]+)", user_agent)
        return f"Yandex Browser {version}" if version else "Yandex Browser"
    if "edg/" in user_agent_lower:
        version = _extract_version(r"edg/([0-9.]+)", user_agent)
        return f"Edge {version}" if version else "Edge"
    if "opr/" in user_agent_lower or "opera/" in user_agent_lower:
        version = _extract_version(r"(?:opr|opera)/([0-9.]+)", user_agent)
        return f"Opera {version}" if version else "Opera"
    if "firefox/" in user_agent_lower:
        version = _extract_version(r"firefox/([0-9.]+)", user_agent)
        return f"Firefox {version}" if version else "Firefox"
    if "chrome/" in user_agent_lower and "edg/" not in user_agent_lower and "opr/" not in user_agent_lower:
        version = _extract_version(r"chrome/([0-9.]+)", user_agent)
        return f"Chrome {version}" if version else "Chrome"
    if "safari/" in user_agent_lower and "chrome/" not in user_agent_lower:
        version = _extract_version(r"version/([0-9.]+)", user_agent)
        return f"Safari {version}" if version else "Safari"
    if "telegram" in user_agent_lower:
        return "Telegram In-App Browser"
    return "Unknown Browser"


def build_device_summary(user_agent: str | None) -> str | None:
    """
    Собрать читабельную сводку устройства из User-Agent.
    Формат: "<DeviceType> | <OS> | <Browser>".
    """
    if not user_agent:
        return None

    ua = user_agent.strip()
    if not ua:
        return None

    ua_lower = ua.lower()
    device_type = _detect_device_type(ua_lower)
    os_name = _detect_os(ua, ua_lower)
    browser = _detect_browser(ua, ua_lower)

    return f"{device_type} | {os_name} | {browser}"[:255]


def update_user_login_metadata(user: User, request: Request) -> None:
    """
    Обновить на пользователе метаданные последнего входа.
    """
    user_agent = request.headers.get("User-Agent")
    now = datetime.utcnow()

    user.last_login_ip = extract_client_ip(request)
    user.last_login_user_agent = user_agent[:1024] if user_agent else None
    user.last_login_device = build_device_summary(user_agent)
    user.last_login_at = now
    user.last_active_at = now
