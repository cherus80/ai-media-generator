"""
Pydantic схемы для авторизации и работы с пользователями.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# Request схемы
class TelegramAuthRequest(BaseModel):
    """Запрос на авторизацию через Telegram WebApp"""

    init_data: str = Field(
        ...,
        description="initData строка из Telegram WebApp SDK",
        min_length=1
    )


# Response схемы
class TokenResponse(BaseModel):
    """Ответ с JWT токеном"""

    access_token: str = Field(..., description="JWT access токен")
    token_type: str = Field(default="bearer", description="Тип токена")


class UserProfile(BaseModel):
    """Профиль пользователя"""

    id: int = Field(..., description="ID пользователя в БД")
    telegram_id: int = Field(..., description="Telegram ID пользователя")
    username: Optional[str] = Field(None, description="Telegram username")
    first_name: Optional[str] = Field(None, description="Имя")
    last_name: Optional[str] = Field(None, description="Фамилия")
    language_code: Optional[str] = Field(None, description="Код языка")

    # Баланс и подписка
    balance_credits: int = Field(..., description="Баланс кредитов")
    subscription_type: Optional[str] = Field(None, description="Тип подписки")
    subscription_expires_at: Optional[datetime] = Field(
        None,
        description="Дата окончания подписки"
    )
    subscription_started_at: Optional[datetime] = Field(
        None,
        description="Дата активации подписки"
    )
    subscription_ops_limit: Optional[int] = Field(
        None,
        description="Лимит действий по подписке",
    )
    subscription_ops_used: Optional[int] = Field(
        None,
        description="Использовано действий по подписке",
    )
    subscription_ops_remaining: Optional[int] = Field(
        None,
        description="Остаток действий по подписке",
    )
    subscription_ops_reset_at: Optional[datetime] = Field(
        None,
        description="Дата последнего сброса счётчика действий",
    )

    # Freemium
    freemium_actions_used: int = Field(
        ...,
        description="Использовано бесплатных действий"
    )
    freemium_reset_at: datetime = Field(
        ...,
        description="Дата сброса бесплатных действий"
    )
    freemium_actions_remaining: int = Field(
        default=0,
        description="Остаток бесплатных действий (v5: 0)",
    )
    freemium_actions_limit: int = Field(
        default=0,
        description="Лимит бесплатных действий (v5: 0)",
    )
    can_use_freemium: bool = Field(
        ...,
        description="Может ли использовать бесплатные действия"
    )
    free_trial_granted: bool = Field(
        default=False,
        description="Выдан ли приветственный бонус кредитов",
    )

    # Метаданные
    is_premium: bool = Field(
        default=False,
        description="Telegram Premium пользователь"
    )
    is_blocked: bool = Field(
        default=False,
        description="Заблокирован ли пользователь"
    )
    created_at: datetime = Field(..., description="Дата регистрации")
    last_activity_at: datetime = Field(..., description="Последняя активность")

    # Реферальная программа
    referral_code: str = Field(..., description="Реферальный код")
    referred_by_id: Optional[int] = Field(
        None,
        description="ID пригласившего пользователя"
    )

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    """Ответ с профилем пользователя"""

    user: UserProfile


class LoginResponse(BaseModel):
    """Ответ при успешной авторизации"""

    access_token: str = Field(..., description="JWT access токен")
    token_type: str = Field(default="bearer", description="Тип токена")
    user: UserProfile = Field(..., description="Профиль пользователя")
