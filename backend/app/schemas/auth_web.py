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
        description="Authentication provider (email, google, vk, telegram)"
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
    balance_credits: int = Field(..., description="Credit balance")
    subscription_type: Optional[str] = Field(None, description="Subscription type (basic, pro, premium)")
    subscription_expires_at: Optional[datetime] = Field(None, description="Subscription expiration date")

    # Freemium
    freemium_actions_used: int = Field(..., description="Freemium actions used this month")
    freemium_reset_at: datetime = Field(..., description="Freemium counter reset date")
    can_use_freemium: bool = Field(..., description="Can use Freemium actions")

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

    first_name: Optional[str] = Field(
        None,
        max_length=255,
        description="First name",
        example="John"
    )

    last_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Last name",
        example="Doe"
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
# Google OAuth
# ============================================================================


class GoogleOAuthRequest(BaseModel):
    """Запрос на вход через Google OAuth"""

    id_token: str = Field(
        ...,
        description="Google ID token (JWT) from Google Sign-In",
        example="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
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
