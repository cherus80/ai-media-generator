"""
VK ID OAuth utilities for validating VK ID tokens and getting user info.

VK ID is the modern authentication service from VK (ВКонтакте).
Supports silent token validation and user information retrieval.
"""

import requests
from typing import Optional
from jose import jwt
from app.core.config import settings


class VKOAuthError(Exception):
    """Exception raised for VK OAuth validation errors"""
    pass


_jwks_cache: dict = {}
_jwks_cache_etag: Optional[str] = None
_jwks_cache_ts: Optional[float] = None


def _get_vk_jwks() -> dict:
    """
    Fetch VK ID JWKS for id_token verification (with simple caching).
    """
    import time

    global _jwks_cache, _jwks_cache_etag, _jwks_cache_ts

    # 5 minute cache
    if _jwks_cache and _jwks_cache_ts and (time.time() - _jwks_cache_ts) < 300:
        return _jwks_cache

    headers = {"Accept": "application/json"}
    if _jwks_cache_etag:
        headers["If-None-Match"] = _jwks_cache_etag

    resp = requests.get(settings.VK_JWKS_URL, headers=headers, timeout=5)

    if resp.status_code == 304 and _jwks_cache:
        _jwks_cache_ts = time.time()
        return _jwks_cache

    if resp.status_code != 200:
        raise VKOAuthError(f"Failed to fetch VK JWKS: HTTP {resp.status_code}")

    data = resp.json()
    if "keys" not in data:
        raise VKOAuthError("VK JWKS response missing 'keys'")

    _jwks_cache = data
    _jwks_cache_etag = resp.headers.get("ETag")
    _jwks_cache_ts = time.time()

    return data


def verify_vk_id_token(id_token: str, expected_nonce: Optional[str] = None) -> dict:
    """
    Verify VK ID id_token using JWKS (signature + claims).
    """
    if not settings.VK_APP_ID:
        raise VKOAuthError("VK OAuth is not configured (missing VK_APP_ID)")

    jwks = _get_vk_jwks()

    try:
        claims = jwt.decode(
            id_token,
            jwks,
            algorithms=["RS256"],
            audience=settings.VK_APP_ID,
            issuer="https://id.vk.com",
            options={"require_exp": True, "require_iat": True},
        )
    except Exception as e:
        raise VKOAuthError(f"id_token verification failed: {str(e)}")

    if expected_nonce and claims.get("nonce") != expected_nonce:
        raise VKOAuthError("id_token nonce mismatch")

    return claims


def verify_vk_silent_token(silent_token: str, uuid: str) -> dict:
    """
    Verify a VK ID silent token and extract user information.

    VK ID SDK provides a silent token after successful authentication.
    This function validates the token and retrieves user data from VK API.

    Args:
        silent_token: The silent token from VK ID SDK
        uuid: Device UUID from VK ID SDK (used for additional security)

    Returns:
        dict: User information from VK
            {
                'user_id': 123456789,  # VK user ID (unique)
                'first_name': 'Ivan',
                'last_name': 'Petrov',
                'email': 'user@example.com',  # Optional, may be None
                'photo': 'https://...',  # Profile photo URL
            }

    Raises:
        VKOAuthError: If token is invalid or verification fails

    Example:
        >>> user_info = verify_vk_silent_token(token, uuid)
        >>> print(user_info['user_id'])
        123456789
    """
    if not settings.VK_APP_ID or not settings.VK_CLIENT_SECRET:
        raise VKOAuthError("VK OAuth is not configured. Please set VK_APP_ID and VK_CLIENT_SECRET.")

    try:
        # VK ID OAuth2 user info endpoint
        # Docs: https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-integration/api-description
        url = "https://id.vk.com/oauth2/user_info"

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = {
            "client_id": settings.VK_APP_ID,
            "client_secret": settings.VK_CLIENT_SECRET,
            "access_token": silent_token,
        }

        response = requests.post(url, headers=headers, data=data, timeout=10)

        # Check for HTTP errors
        if response.status_code != 200:
            error_data = response.json() if response.headers.get("Content-Type", "").startswith("application/json") else {}
            error_message = error_data.get("error_description", f"HTTP {response.status_code}")
            raise VKOAuthError(f"VK API error: {error_message}")

        # Parse user info from response
        user_data = response.json()

        # VK ID response structure:
        # {
        #   "user": {
        #     "user_id": 123456789,
        #     "first_name": "Ivan",
        #     "last_name": "Petrov",
        #     "email": "user@example.com",  # Optional
        #     "avatar": "https://...",
        #     "phone": "+79001234567"  # Optional
        #   }
        # }

        if "user" not in user_data:
            raise VKOAuthError("Invalid VK API response: missing 'user' field")

        vk_user = user_data["user"]

        # Extract user information
        return {
            "user_id": vk_user.get("user_id"),
            "first_name": vk_user.get("first_name"),
            "last_name": vk_user.get("last_name"),
            "email": vk_user.get("email"),  # May be None if user didn't grant access
            "photo": vk_user.get("avatar"),
            "phone": vk_user.get("phone"),  # May be None
        }

    except requests.exceptions.Timeout:
        raise VKOAuthError("VK API request timeout")

    except requests.exceptions.RequestException as e:
        raise VKOAuthError(f"VK API request failed: {str(e)}")

    except (KeyError, ValueError) as e:
        raise VKOAuthError(f"Invalid VK API response format: {str(e)}")

    except Exception as e:
        raise VKOAuthError(f"VK OAuth verification failed: {str(e)}")


def get_vk_user_by_access_token(access_token: str) -> dict:
    """
    Get VK user info using VK API access token.

    This is an alternative method for getting user info when you have
    a VK API access token (from OAuth 2.0 authorization code flow).

    Args:
        access_token: VK API access token

    Returns:
        dict: User information from VK API
            {
                'user_id': 123456789,
                'first_name': 'Ivan',
                'last_name': 'Petrov',
                'photo': 'https://...',
            }

    Raises:
        VKOAuthError: If request fails

    Example:
        >>> user_info = get_vk_user_by_access_token(token)
        >>> print(f"{user_info['first_name']} {user_info['last_name']}")
        'Ivan Petrov'
    """
    try:
        # VK API method: users.get
        # Docs: https://dev.vk.com/method/users.get
        url = "https://api.vk.com/method/users.get"

        params = {
            "access_token": access_token,
            "v": "5.131",  # VK API version
            "fields": "photo_200",  # Request profile photo
        }

        response = requests.get(url, params=params, timeout=10)

        if response.status_code != 200:
            raise VKOAuthError(f"VK API error: HTTP {response.status_code}")

        data = response.json()

        # Check for VK API error
        if "error" in data:
            error_msg = data["error"].get("error_msg", "Unknown error")
            raise VKOAuthError(f"VK API error: {error_msg}")

        # Extract user info
        if "response" not in data or not data["response"]:
            raise VKOAuthError("Invalid VK API response: missing user data")

        vk_user = data["response"][0]

        return {
            "user_id": vk_user.get("id"),
            "first_name": vk_user.get("first_name"),
            "last_name": vk_user.get("last_name"),
            "photo": vk_user.get("photo_200"),
        }

    except requests.exceptions.RequestException as e:
        raise VKOAuthError(f"VK API request failed: {str(e)}")

    except Exception as e:
        raise VKOAuthError(f"Failed to get VK user info: {str(e)}")


def get_vk_user_info(silent_token: str, uuid: str) -> Optional[dict]:
    """
    Safely get VK user info, returning None on error.

    Args:
        silent_token: The silent token from VK ID SDK
        uuid: Device UUID from VK ID SDK

    Returns:
        dict | None: User information or None if verification fails

    Example:
        >>> user_info = get_vk_user_info(token, uuid)
        >>> if user_info:
        ...     print(f"User: {user_info['first_name']} {user_info['last_name']}")
    """
    try:
        return verify_vk_silent_token(silent_token, uuid)
    except VKOAuthError:
        return None


def exchange_vk_authorization_code_pkce(code: str, code_verifier: str, redirect_uri: str, device_id: Optional[str] = None) -> dict:
    """
    Exchange VK OAuth 2.1 authorization code for tokens using PKCE.

    Args:
        code: Authorization code from VK ID
        code_verifier: PKCE code_verifier generated on frontend
        redirect_uri: Redirect URI used in the authorize request
        device_id: Optional device identifier from VK ID SDK

    Returns:
        dict: Token payload from VK ID (access_token, refresh_token, id_token, user_id, scope, state, expires_in)
    """
    if not settings.VK_APP_ID:
        raise VKOAuthError("VK OAuth is not configured (missing VK_APP_ID)")

    try:
        url = "https://id.vk.ru/oauth2/auth"
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": settings.VK_APP_ID,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
        }

        # device_id is recommended for additional binding
        if device_id:
            data["device_id"] = device_id

        # client_secret is optional for PKCE, but we include it for server-side exchange
        if settings.VK_CLIENT_SECRET:
            data["client_secret"] = settings.VK_CLIENT_SECRET

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        response = requests.post(url, data=data, headers=headers, timeout=10)

        if response.status_code != 200:
            error_data = response.json() if response.headers.get("Content-Type", "").startswith("application/json") else {}
            error_message = error_data.get("error_description", f"HTTP {response.status_code}")
            raise VKOAuthError(f"VK OAuth error: {error_message}")

        token_data = response.json()

        if "access_token" not in token_data:
            raise VKOAuthError("VK OAuth response missing access_token")

        return token_data

    except requests.exceptions.Timeout:
        raise VKOAuthError("VK OAuth request timeout")
    except requests.exceptions.RequestException as e:
        raise VKOAuthError(f"VK OAuth request failed: {str(e)}")
    except Exception as e:
        raise VKOAuthError(f"Failed to exchange VK authorization code: {str(e)}")


def exchange_vk_code_for_token(code: str, redirect_uri: str) -> dict:
    """
    Exchange VK OAuth authorization code for access token.

    This is used for traditional OAuth 2.0 authorization code flow.
    VK ID SDK uses silent tokens instead, so this function is optional.

    Args:
        code: Authorization code from VK OAuth callback
        redirect_uri: Redirect URI used in authorization request

    Returns:
        dict: Token information
            {
                'access_token': 'token_string',
                'user_id': 123456789,
                'email': 'user@example.com',  # Optional
            }

    Raises:
        VKOAuthError: If token exchange fails

    Example:
        >>> token_data = exchange_vk_code_for_token(code, redirect_uri)
        >>> access_token = token_data['access_token']
    """
    if not settings.VK_APP_ID or not settings.VK_CLIENT_SECRET:
        raise VKOAuthError("VK OAuth is not configured")

    try:
        # VK OAuth access token endpoint
        # Docs: https://dev.vk.com/api/access-token/getting-started
        url = "https://oauth.vk.com/access_token"

        params = {
            "client_id": settings.VK_APP_ID,
            "client_secret": settings.VK_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "code": code,
        }

        response = requests.get(url, params=params, timeout=10)

        if response.status_code != 200:
            raise VKOAuthError(f"VK OAuth error: HTTP {response.status_code}")

        data = response.json()

        # Check for error
        if "error" in data:
            error_msg = data.get("error_description", data.get("error"))
            raise VKOAuthError(f"VK OAuth error: {error_msg}")

        # Extract token data
        # Response: { "access_token": "...", "user_id": 123, "email": "..." }
        return {
            "access_token": data.get("access_token"),
            "user_id": data.get("user_id"),
            "email": data.get("email"),  # Optional, may not be present
        }

    except requests.exceptions.RequestException as e:
        raise VKOAuthError(f"VK OAuth request failed: {str(e)}")

    except Exception as e:
        raise VKOAuthError(f"Failed to exchange VK code for token: {str(e)}")
