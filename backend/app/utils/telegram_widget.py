"""
Telegram Login Widget verification utilities.

Проверяет HMAC-подпись данных, отправляемых Telegram Login Widget.
Docs: https://core.telegram.org/widgets/login#checking-authorization

Алгоритм:
1. SHA256(bot_token) → secret_key
2. HMAC-SHA256(secret_key, data_check_string) → hash
3. Сравнение hash с переданным
"""

import hashlib
import hmac
import logging
import time
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Максимальный возраст auth_date (24 часа)
MAX_AUTH_AGE_SECONDS = 86400


class TelegramWidgetError(Exception):
    """Exception raised for Telegram Widget verification errors."""
    pass


def verify_telegram_widget_data(data: dict) -> dict:
    """
    Проверить HMAC-подпись данных Telegram Login Widget.

    Args:
        data: Данные от Telegram Login Widget, содержащие:
            - id: int — Telegram user ID
            - first_name: str — Имя пользователя
            - last_name: str | None — Фамилия
            - username: str | None — Username
            - photo_url: str | None — URL аватара
            - auth_date: int — UNIX timestamp авторизации
            - hash: str — HMAC подпись для верификации

    Returns:
        dict: Verified user data (без hash)
            {
                'telegram_id': 123456789,
                'first_name': 'Ivan',
                'last_name': 'Petrov',
                'username': 'ivanpetrov',
                'photo_url': 'https://...',
                'auth_date': 1234567890,
            }

    Raises:
        TelegramWidgetError: Если верификация не прошла
    """
    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        raise TelegramWidgetError(
            "Telegram Login Widget is not configured. "
            "Please set TELEGRAM_BOT_TOKEN."
        )

    # Извлекаем hash из данных
    received_hash = data.get("hash")
    if not received_hash:
        raise TelegramWidgetError("Missing 'hash' in Telegram widget data")

    # Проверяем обязательные поля
    telegram_id = data.get("id")
    if not telegram_id:
        raise TelegramWidgetError("Missing 'id' in Telegram widget data")

    auth_date = data.get("auth_date")
    if not auth_date:
        raise TelegramWidgetError(
            "Missing 'auth_date' in Telegram widget data"
        )

    # Проверяем возраст auth_date (не старше 24 часов)
    try:
        auth_date_int = int(auth_date)
    except (ValueError, TypeError):
        raise TelegramWidgetError("Invalid 'auth_date' format")

    current_time = int(time.time())
    if current_time - auth_date_int > MAX_AUTH_AGE_SECONDS:
        raise TelegramWidgetError(
            "Telegram auth_date is too old "
            f"(age: {current_time - auth_date_int}s, max: {MAX_AUTH_AGE_SECONDS}s)"
        )

    # Формируем data_check_string:
    # все поля кроме hash, отсортированные по алфавиту, через \n
    check_fields = {
        k: v for k, v in data.items()
        if k != "hash" and v is not None
    }
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(check_fields.items())
    )

    # Вычисляем HMAC
    # secret_key = SHA256(bot_token)
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()

    # hash = HMAC-SHA256(secret_key, data_check_string)
    calculated_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    # Сравниваем hash (timing-safe comparison)
    if not hmac.compare_digest(calculated_hash, received_hash):
        raise TelegramWidgetError("Invalid Telegram widget hash signature")

    # Возвращаем верифицированные данные
    return {
        "telegram_id": int(telegram_id),
        "first_name": data.get("first_name", ""),
        "last_name": data.get("last_name"),
        "username": data.get("username"),
        "photo_url": data.get("photo_url"),
        "auth_date": auth_date_int,
    }


def verify_telegram_widget_safe(data: dict) -> Optional[dict]:
    """
    Safely verify Telegram widget data, returning None on error.

    Args:
        data: Данные от Telegram Login Widget

    Returns:
        dict | None: Verified user data or None if verification fails
    """
    try:
        return verify_telegram_widget_data(data)
    except TelegramWidgetError as e:
        logger.error("Telegram widget verification failed: %s", e)
        return None
