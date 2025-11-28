"""
User Model — Модель пользователя.

Хранит информацию о пользователях, балансе кредитов и подписках.
Поддерживает как веб-авторизацию (email/password, OAuth), так и legacy Telegram авторизацию.
"""

from datetime import datetime
from typing import Optional
import enum

from sqlalchemy import (
    BigInteger,
    Integer,
    String,
    Enum,
    DateTime,
    Index,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class SubscriptionType(str, enum.Enum):
    """Типы подписок"""
    BASIC = "basic"      # 299₽/месяц — 50 действий
    PRO = "pro"          # 499₽/месяц — 150 действий
    PREMIUM = "premium"  # 899₽/месяц — 500 действий


class AuthProvider(str, enum.Enum):
    """Способы авторизации"""
    email = "email"       # Email/Password
    google = "google"     # Google OAuth
    vk = "vk"             # VK ID OAuth
    telegram = "telegram" # Legacy Telegram (для обратной совместимости)


class UserRole(str, enum.Enum):
    """Роли пользователей"""
    USER = "USER"               # Обычный пользователь
    ADMIN = "ADMIN"             # Администратор
    SUPER_ADMIN = "SUPER_ADMIN" # Главный администратор


class User(Base, TimestampMixin):
    """
    Модель пользователя.

    Хранит данные о пользователе (веб или Telegram), балансе кредитов,
    подписке и использовании Freemium.
    """

    __tablename__ = "users"

    # Primary Key
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        index=True,
    )

    # === Веб-авторизация (новое) ===

    # Email (для Email/Password и OAuth)
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
        comment="Email address (unique, for web auth)",
    )

    # Email verification
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Is email verified",
    )

    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Дата и время подтверждения email",
    )

    # Password hash (для Email/Password авторизации)
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Bcrypt password hash (null for OAuth users)",
    )

    # OAuth provider
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider_enum"),
        default=AuthProvider.email,
        nullable=False,
        comment="Authentication provider (email, google, telegram)",
    )

    # OAuth provider ID (Google sub, etc.)
    oauth_provider_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="OAuth provider user ID (Google sub, etc.)",
    )

    # OAuth refresh token (server-side storage)
    oauth_refresh_token: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        comment="OAuth provider refresh token (stored server-side only)",
    )

    # OAuth access token expiry (from provider)
    oauth_access_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Access token expiry (from OAuth provider)",
    )

    # === Telegram авторизация (legacy, для обратной совместимости) ===

    # Telegram ID (опционально для веб-пользователей)
    telegram_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        unique=True,
        nullable=True,
        index=True,
        comment="Telegram user ID (optional, for legacy users)",
    )

    # === Профиль пользователя ===

    username: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Username (Telegram username or custom)",
    )

    first_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="First name",
    )

    last_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Last name",
    )

    # Баланс кредитов
    balance_credits: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Количество кредитов (1 кредит = 1 действие)",
    )

    # Подписка
    subscription_type: Mapped[Optional[SubscriptionType]] = mapped_column(
        Enum(SubscriptionType, name="subscription_type_enum"),
        nullable=True,
        comment="Тип активной подписки",
    )

    subscription_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Дата окончания подписки",
    )

    # Лимиты подписки (Billing v4)
    subscription_ops_limit: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Месячный лимит операций по подписке",
    )
    subscription_ops_used: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Сколько операций потрачено в текущем периоде подписки",
    )
    subscription_ops_reset_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Дата последнего сброса лимита подписки",
    )

    # Freemium счётчик
    freemium_actions_used: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Количество использованных Freemium действий в текущем месяце",
    )

    freemium_reset_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Дата последнего сброса Freemium счётчика",
    )

    # Активность
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Активен ли пользователь",
    )

    is_banned: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="Забанен ли пользователь",
    )

    # Роль пользователя
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum"),
        default=UserRole.USER,
        nullable=False,
        comment="Роль пользователя (user, admin)",
    )

    # Последняя активность
    last_active_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Дата и время последней активности",
    )

    # Relationships
    generations: Mapped[list["Generation"]] = relationship(
        "Generation",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    chat_histories: Mapped[list["ChatHistory"]] = relationship(
        "ChatHistory",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    payments: Mapped[list["Payment"]] = relationship(
        "Payment",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    ledger_entries: Mapped[list["CreditsLedger"]] = relationship(
        "CreditsLedger",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Рефералы (где пользователь — реферер)
    referrals_given: Mapped[list["Referral"]] = relationship(
        "Referral",
        foreign_keys="[Referral.referrer_id]",
        back_populates="referrer",
        cascade="all, delete-orphan",
    )

    # Рефералы (где пользователь — приглашённый)
    referrals_received: Mapped[list["Referral"]] = relationship(
        "Referral",
        foreign_keys="[Referral.referred_id]",
        back_populates="referred",
        cascade="all, delete-orphan",
    )

    # Email verification tokens
    email_verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship(
        "EmailVerificationToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Индексы
    __table_args__ = (
        Index("idx_email", "email"),
        Index("idx_telegram_id", "telegram_id"),
        Index("idx_oauth_provider_id", "oauth_provider_id"),
        Index("idx_subscription_end", "subscription_end"),
        Index("idx_is_active", "is_active"),
        Index("idx_auth_provider", "auth_provider"),
        Index("idx_role", "role"),
        Index("idx_last_active_at", "last_active_at"),
    )

    def __repr__(self) -> str:
        identifier = self.email or self.telegram_id or self.username or self.id
        return (
            f"<User(id={self.id}, identifier={identifier}, "
            f"auth={self.auth_provider.value}, balance={self.balance_credits})>"
        )

    @property
    def has_active_subscription(self) -> bool:
        """Проверка активности подписки"""
        if not self.subscription_type or not self.subscription_end:
            return False
        # Используем UTC для корректного сравнения с timezone-aware datetime
        from datetime import timezone
        return self.subscription_end > datetime.now(timezone.utc)

    @property
    def can_use_freemium(self) -> bool:
        """Проверка доступности Freemium"""
        from app.core.config import settings
        return self.freemium_actions_used < settings.FREEMIUM_ACTIONS_PER_MONTH

    def reset_freemium_if_needed(self) -> None:
        """Сброс Freemium счётчика, если прошёл месяц"""
        from datetime import timezone

        if not self.freemium_reset_at:
            # Используем UTC для согласованности с БД (DateTime(timezone=True))
            self.freemium_reset_at = datetime.now(timezone.utc)
            return

        # Проверка, прошёл ли месяц
        now = datetime.now(timezone.utc)
        if (now - self.freemium_reset_at).days >= 30:
            self.freemium_actions_used = 0
            self.freemium_reset_at = now
