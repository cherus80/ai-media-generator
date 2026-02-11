"""
Web Authentication Schemas — Pydantic схемы для веб-авторизации.

Поддерживает:
- Email/Password регистрацию и вход
- Google OAuth авторизацию
- VK ID OAuth авторизацию
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole


# ============================================================================
# User Profile (defined first for use in response schemas)
# ============================================================================


class UserProfile(BaseModel):
    """Профиль пользователя (для всех типов авторизации)"""

    id: int = Field(..., description="User ID")

    # Auth method
    auth_provider: str = Field(
        ...,
        description="Authentication provider (email, google, vk, yandex, telegram, telegram_widget)"
    )

    # Email (for web users)
    email: Optional[str] = Field(
        None,
        description="Email address (null for legacy Telegram users)"
    )

    email_verified: bool = Field(
        default=False,
        description="Is email verified"
    )

    # Legacy Telegram (optional)
    telegram_id: Optional[int] = Field(
        None,
        description="Telegram ID (null for web-only users)"
    )

    # Profile
    username: Optional[str] = Field(None, description="Username")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")

    # Balance & Subscription
    balance_credits: int = Field(..., description="Stars balance")
    subscription_type: Optional[str] = Field(None, description="Subscription type (basic, standard, premium)")
    subscription_started_at: Optional[datetime] = Field(None, description="Subscription activation date")
    subscription_expires_at: Optional[datetime] = Field(None, description="Subscription expiration date")
    subscription_ops_limit: Optional[int] = Field(None, description="Actions limit for the plan")
    subscription_ops_used: Optional[int] = Field(None, description="Actions used from the plan")
    subscription_ops_remaining: Optional[int] = Field(None, description="Actions remaining in the plan")
    subscription_ops_reset_at: Optional[datetime] = Field(None, description="Last counter reset date")

    # Freemium
    freemium_actions_used: int = Field(..., description="Freemium actions used this month")
    freemium_reset_at: datetime = Field(..., description="Freemium counter reset date")
    can_use_freemium: bool = Field(..., description="Can use Freemium actions")
    freemium_actions_remaining: int = Field(default=0, description="Freemium remaining (v5: 0)")
    freemium_actions_limit: int = Field(default=0, description="Freemium limit (v5: 0)")
    free_trial_granted: bool = Field(default=False, description="Welcome stars already granted")

    # Status
    is_blocked: bool = Field(..., description="Is user blocked/banned")
    created_at: datetime = Field(..., description="Account creation date")
    last_activity_at: datetime = Field(..., description="Last activity timestamp")

    # Role
    role: UserRole = Field(default=UserRole.USER, description="User role (USER or ADMIN)")

    # Referral
    referral_code: str = Field(..., description="Unique referral code")
    referred_by_id: Optional[int] = Field(None, description="ID of user who referred this user")

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    """Ответ с профилем пользователя"""

    user: UserProfile


# ============================================================================
# Email/Password Registration & Login
# ============================================================================


class RegisterRequest(BaseModel):
    """Запрос на регистрацию через Email/Password"""

    email: EmailStr = Field(
        ...,
        description="Email address",
        example="user@example.com"
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=100,
        description="Password (min 8 characters, must contain uppercase, lowercase, digit, special char)",
        example="MySecurePass123!"
    )

    consent_version: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Версия формы согласия на обработку ПДн",
        example="v1",
    )

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password strength on client side as well"""
        from app.utils.password import is_strong_password

        is_valid, error_msg = is_strong_password(v)
        if not is_valid:
            raise ValueError(error_msg)
        return v


class LoginRequest(BaseModel):
    """Запрос на вход через Email/Password"""

    email: EmailStr = Field(
        ...,
        description="Email address",
        example="user@example.com"
    )

    password: str = Field(
        ...,
        description="Password",
        example="MySecurePass123!"
    )

    consent_version: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Версия формы согласия на обработку ПДн",
        example="v1",
    )


class LoginResponse(BaseModel):
    """Ответ при успешном входе"""

    access_token: str = Field(
        ...,
        description="JWT access token"
    )

    token_type: str = Field(
        default="bearer",
        description="Token type (always 'bearer')"
    )

    user: UserProfile = Field(
        ...,
        description="User profile data"
    )


# ============================================================================
# Password reset
# ============================================================================


class PasswordResetRequest(BaseModel):
    """Запрос на сброс пароля (отправка письма)"""

    email: EmailStr = Field(
        ...,
        description="Email address",
        example="user@example.com",
    )


class PasswordResetResponse(BaseModel):
    """Ответ на запрос сброса пароля"""

    message: str


class PasswordResetConfirmRequest(BaseModel):
    """Подтверждение сброса пароля"""

    token: str = Field(..., min_length=10)
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=100,
        description="New password",
        example="MySecurePass123!",
    )

    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        from app.utils.password import is_strong_password

        is_valid, error_msg = is_strong_password(v)
        if not is_valid:
            raise ValueError(error_msg)
        return v


class PasswordResetConfirmResponse(BaseModel):
    """Ответ после успешного сброса пароля"""

    message: str


# ============================================================================
# Google OAuth
# ============================================================================


class GoogleOAuthRequest(BaseModel):
    """Запрос на вход через Google OAuth"""

    id_token: str = Field(
        ...,
        description="Google ID token (JWT) from Google Sign-In",
        example="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
    )

    consent_version: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Версия формы согласия на обработку ПДн",
        example="v1",
    )


class GoogleOAuthResponse(BaseModel):
    """Ответ при успешном OAuth входе"""

    access_token: str = Field(
        ...,
        description="JWT access token"
    )

    token_type: str = Field(
        default="bearer",
        description="Token type (always 'bearer')"
    )

    user: UserProfile = Field(
        ...,
        description="User profile data"
    )

    is_new_user: bool = Field(
        ...,
        description="True if this is a new user registration"
    )


# ============================================================================
# VK ID OAuth
# ============================================================================


class VKOAuthRequest(BaseModel):
    """Запрос на вход через VK ID OAuth"""

    token: str = Field(
        ...,
        description="VK ID silent token from VK ID SDK",
        example="vk1.a.AbCdEf123..."
    )

    uuid: str = Field(
        ...,
        description="Device UUID from VK ID SDK (for additional security)",
        example="550e8400-e29b-41d4-a716-446655440000"
    )

    consent_version: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Версия формы согласия на обработку ПДн",
        example="v1",
    )


# VKOAuthResponse is identical to GoogleOAuthResponse, so we reuse it
VKOAuthResponse = GoogleOAuthResponse


class VKOAuthPKCERequest(BaseModel):
    """Запрос на вход через VK ID OAuth 2.1 с PKCE"""

    code: str = Field(
        ...,
        description="Authorization code from VK ID after redirect",
        example="auth_code_from_vk"
    )

    code_verifier: str = Field(
        ...,
        description="PKCE code_verifier generated on client",
        example="s3cure_random_verifier"
    )

    state: Optional[str] = Field(
        default=None,
        description="State parameter for CSRF protection (must match the value sent in authorize request)",
    )

    nonce: Optional[str] = Field(
        default=None,
        description="Nonce used when requesting id_token (optional)",
    )

    redirect_uri: str = Field(
        ...,
        description="Redirect URI used in VK ID authorize request",
        example="https://example.com/auth/vk/callback"
    )

    device_id: Optional[str] = Field(
        default=None,
        description="Device identifier from VK ID SDK",
        example="550e8400-e29b-41d4-a716-446655440000"
    )

    consent_version: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Версия формы согласия на обработку ПДн",
        example="v1",
    )


# ============================================================================
# Yandex ID OAuth
# ============================================================================


class YandexOAuthRequest(BaseModel):
    """Запрос на вход через Yandex ID OAuth"""

    code: str = Field(
        ...,
        description="Authorization code from Yandex OAuth redirect",
        example="auth_code_from_yandex"
    )

    consent_version: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Версия формы согласия на обработку ПДн",
        example="v1",
    )


# YandexOAuthResponse is identical to GoogleOAuthResponse
YandexOAuthResponse = GoogleOAuthResponse


# ============================================================================
# Telegram Login Widget
# ============================================================================


class TelegramWidgetRequest(BaseModel):
    """Запрос на вход через Telegram Login Widget"""

    id: int = Field(
        ...,
        description="Telegram user ID",
        example=123456789
    )

    first_name: str = Field(
        ...,
        description="User's first name from Telegram",
        example="Иван"
    )

    last_name: Optional[str] = Field(
        default=None,
        description="User's last name from Telegram",
        example="Петров"
    )

    username: Optional[str] = Field(
        default=None,
        description="Telegram username (without @)",
        example="ivanpetrov"
    )

    photo_url: Optional[str] = Field(
        default=None,
        description="URL of user's profile photo",
        example="https://t.me/i/userpic/320/username.jpg"
    )

    auth_date: int = Field(
        ...,
        description="UNIX timestamp of the authentication",
        example=1234567890
    )

    hash: str = Field(
        ...,
        description="HMAC-SHA256 hash for data verification",
        example="abc123def456..."
    )

    consent_version: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Версия формы согласия на обработку ПДн",
        example="v1",
    )


# TelegramWidgetResponse is identical to GoogleOAuthResponse
TelegramWidgetResponse = GoogleOAuthResponse


# ============================================================================
# Email Verification
# ============================================================================


class SendVerificationEmailResponse(BaseModel):
    """Ответ на запрос отправки письма верификации"""

    message: str = Field(
        ...,
        description="Success message",
        example="Письмо для подтверждения отправлено на ваш email"
    )


class VerifyEmailRequest(BaseModel):
    """Запрос на верификацию email"""

    token: str = Field(
        ...,
        description="Verification token from email",
        example="abc123def456..."
    )


class VerifyEmailResponse(BaseModel):
    """Ответ на успешную верификацию email"""

    message: str = Field(
        ...,
        description="Success message",
        example="Email успешно подтверждён"
    )

    user: UserProfile = Field(
        ...,
        description="Updated user profile"
    )

    access_token: Optional[str] = Field(
        default=None,
        description="JWT access token (present on first-time successful verification)"
    )

    token_type: Optional[str] = Field(
        default=None,
        description="Token type (always 'bearer' when access_token is present)"
    )


# ============================================================================
# Password Reset (будущее расширение)
# ============================================================================


class PasswordResetRequest(BaseModel):
    """Запрос на сброс пароля"""

    email: EmailStr = Field(
        ...,
        description="Email address to send reset link",
        example="user@example.com"
    )


class PasswordResetConfirm(BaseModel):
    """Подтверждение сброса пароля"""

    token: str = Field(
        ...,
        description="Password reset token from email"
    )

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=100,
        description="New password"
    )

    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate new password strength"""
        from app.utils.password import is_strong_password

        is_valid, error_msg = is_strong_password(v)
        if not is_valid:
            raise ValueError(error_msg)
        return v


class PasswordChangeRequest(BaseModel):
    """Смена пароля (для авторизованных пользователей)"""

    old_password: str = Field(
        ...,
        description="Current password"
    )

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=100,
        description="New password"
    )

    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate new password strength"""
        from app.utils.password import is_strong_password

        is_valid, error_msg = is_strong_password(v)
        if not is_valid:
            raise ValueError(error_msg)
        return v
