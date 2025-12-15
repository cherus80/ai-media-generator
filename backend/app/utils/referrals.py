"""
Utilities for referral codes and links.

Коды генерируются детерминированно от user_id и SECRET_KEY, чтобы ссылки
оставались стабильными между сессиями и на всех эндпоинтах.
"""

import hashlib

from app.core.config import settings


def generate_referral_code(user_id: int) -> str:
    """
    Вернуть стабильный реферальный код для пользователя.

    Комбинация user_id и SECRET_KEY исключает коллизии и привязана к окружению.
    """
    raw = f"{user_id}:{settings.SECRET_KEY}"
    return hashlib.sha256(raw.encode()).hexdigest()[:8].upper()


def get_referral_link(referral_code: str) -> str:
    """
    Построить ссылку на регистрацию с реферальным кодом.
    """
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    return f"{frontend_url}/register?ref={referral_code}"
