"""
Yandex ID OAuth utilities for validating Yandex OAuth authorization codes
and getting user info.

Yandex ID использует стандартный OAuth 2.0 authorization code flow.
Docs: https://yandex.ru/dev/id/doc/dg/oauth/reference/auto-code-client.html
"""

import logging
from typing import Optional

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


class YandexOAuthError(Exception):
    """Exception raised for Yandex OAuth validation errors."""
    pass


def exchange_code_for_token(code: str) -> dict:
    """
    Обменять authorization code на access_token через Yandex OAuth.

    Args:
        code: Authorization code из redirect URI

    Returns:
        dict: Ответ Yandex OAuth с access_token
            {
                'access_token': '...',
                'token_type': 'bearer',
                'expires_in': 31536000,
            }

    Raises:
        YandexOAuthError: Если обмен не удался
    """
    if not settings.YANDEX_CLIENT_ID or not settings.YANDEX_CLIENT_SECRET:
        raise YandexOAuthError(
            "Yandex OAuth is not configured. "
            "Please set YANDEX_CLIENT_ID and YANDEX_CLIENT_SECRET."
        )

    try:
        url = "https://oauth.yandex.ru/token"
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": settings.YANDEX_CLIENT_ID,
            "client_secret": settings.YANDEX_CLIENT_SECRET,
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        response = requests.post(url, data=data, headers=headers, timeout=10)

        if response.status_code != 200:
            error_data = (
                response.json()
                if "application/json" in response.headers.get("Content-Type", "")
                else {}
            )
            error_desc = error_data.get(
                "error_description", f"HTTP {response.status_code}"
            )
            error_code = error_data.get("error", "unknown")
            raise YandexOAuthError(
                f"Yandex OAuth token exchange failed: "
                f"{error_code} — {error_desc}"
            )

        token_data = response.json()

        if "access_token" not in token_data:
            raise YandexOAuthError("Yandex OAuth response missing access_token")

        return token_data

    except requests.exceptions.Timeout:
        raise YandexOAuthError("Yandex OAuth request timeout")
    except requests.exceptions.RequestException as e:
        raise YandexOAuthError(f"Yandex OAuth request failed: {str(e)}")
    except YandexOAuthError:
        raise
    except Exception as e:
        raise YandexOAuthError(
            f"Failed to exchange Yandex authorization code: {str(e)}"
        )


def get_user_info(access_token: str) -> dict:
    """
    Получить информацию о пользователе через Yandex Login API.

    Docs: https://yandex.ru/dev/id/doc/dg/api-id/reference/response.html

    Args:
        access_token: Access token от Yandex OAuth

    Returns:
        dict: Информация о пользователе
            {
                'yandex_id': '123456789',
                'email': 'user@yandex.ru',
                'first_name': 'Иван',
                'last_name': 'Петров',
                'display_name': 'ivan.petrov',
                'avatar_url': 'https://avatars.yandex.net/...',
            }

    Raises:
        YandexOAuthError: Если запрос не удался
    """
    try:
        url = "https://login.yandex.ru/info"
        headers = {
            "Authorization": f"OAuth {access_token}",
        }
        params = {
            "format": "json",
        }

        response = requests.get(
            url, headers=headers, params=params, timeout=10
        )

        if response.status_code != 200:
            raise YandexOAuthError(
                f"Yandex API error: HTTP {response.status_code}"
            )

        user_data = response.json()

        yandex_id = user_data.get("id")
        if not yandex_id:
            raise YandexOAuthError("Yandex API response missing user ID")

        # Формируем URL аватара из avatar_id
        avatar_id = user_data.get("default_avatar_id")
        avatar_url = None
        if avatar_id:
            avatar_url = (
                f"https://avatars.yandex.net/get-yapic/"
                f"{avatar_id}/islands-200"
            )

        return {
            "yandex_id": str(yandex_id),
            "email": user_data.get("default_email"),
            "first_name": user_data.get("first_name"),
            "last_name": user_data.get("last_name"),
            "display_name": user_data.get("display_name"),
            "login": user_data.get("login"),
            "avatar_url": avatar_url,
        }

    except requests.exceptions.Timeout:
        raise YandexOAuthError("Yandex API request timeout")
    except requests.exceptions.RequestException as e:
        raise YandexOAuthError(f"Yandex API request failed: {str(e)}")
    except YandexOAuthError:
        raise
    except Exception as e:
        raise YandexOAuthError(
            f"Failed to get Yandex user info: {str(e)}"
        )


def verify_yandex_auth_code(code: str) -> dict:
    """
    Полный цикл: обмен code → получение userinfo.

    Args:
        code: Authorization code из redirect URI

    Returns:
        dict: Информация о пользователе (yandex_id, email, first_name, etc.)

    Raises:
        YandexOAuthError: Если авторизация не удалась

    Example:
        >>> user_info = verify_yandex_auth_code(code)
        >>> print(user_info['yandex_id'])
        '123456789'
    """
    token_data = exchange_code_for_token(code)
    access_token = token_data["access_token"]
    return get_user_info(access_token)


def get_yandex_user_info_safe(code: str) -> Optional[dict]:
    """
    Safely get Yandex user info, returning None on error.

    Args:
        code: Authorization code из redirect URI

    Returns:
        dict | None: Информация о пользователе или None при ошибке
    """
    try:
        return verify_yandex_auth_code(code)
    except YandexOAuthError as e:
        logger.error("Yandex OAuth verification failed: %s", e)
        return None
