"""
Конфигурация приложения через Pydantic Settings.

Все настройки загружаются из переменных окружения (.env файл).
"""

from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Окружение
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)

    # FastAPI
    API_V1_PREFIX: str = Field(default="/api/v1")
    PROJECT_NAME: str = Field(default="AI Image Generator")
    SECRET_KEY: str = Field(..., description="Secret key for JWT and other crypto operations")
    BACKEND_URL: str = Field(default="http://localhost:8000", description="Backend URL for file access")
    FRONTEND_URL: str = Field(default="http://localhost:5173", description="Frontend URL for redirects")

    # База данных PostgreSQL
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="postgres")
    POSTGRES_DB: str = Field(default="ai_image_bot")
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)

    @property
    def DATABASE_URL(self) -> str:
        """Формирование Database URL для SQLAlchemy"""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis для Celery
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # Telegram Bot (Legacy, опционально для обратной совместимости)
    TELEGRAM_BOT_TOKEN: Optional[str] = Field(default=None, description="Telegram Bot API token (optional)")
    TELEGRAM_BOT_SECRET: Optional[str] = Field(default=None, description="Secret for Telegram WebApp validation (optional)")
    BOT_USERNAME: Optional[str] = Field(default=None, description="Telegram Bot username for referral links (optional)")

    # Google OAuth (опционально для локального тестирования)
    GOOGLE_CLIENT_ID: Optional[str] = Field(default=None, description="Google OAuth Client ID (optional)")
    GOOGLE_CLIENT_SECRET: Optional[str] = Field(default=None, description="Google OAuth Client Secret (optional)")

    # VK ID OAuth (опционально для локального тестирования)
    VK_APP_ID: Optional[str] = Field(default=None, description="VK ID Application ID (optional)")
    VK_CLIENT_SECRET: Optional[str] = Field(default=None, description="VK ID Client Secret (optional)")
    VK_JWKS_URL: str = Field(
        default="https://id.vk.com/.well-known/jwks",
        description="JWKS endpoint for VK ID id_token verification",
    )

    # JWT настройки
    JWT_SECRET_KEY: str = Field(..., description="Secret key for JWT tokens")
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)

    # OpenRouter API (GPT-4.1 Mini для промптов, Nano Banana для генерации)
    OPENROUTER_API_KEY: Optional[str] = Field(default=None, description="API key for OpenRouter (optional)")
    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")
    OPENROUTER_MODEL: str = Field(default="anthropic/claude-3-haiku-20240307")
    OPENROUTER_PROMPT_MODEL: Optional[str] = Field(
        default="openai/gpt-4.1-mini",
        description="Модель OpenRouter для улучшения промптов (GPT-4.1 Mini, по умолчанию)",
    )

    # kie.ai Nano Banana API (Primary service for image generation)
    USE_KIE_AI: bool = Field(
        default=True,
        description="Использовать kie.ai как основной сервис (fallback на OpenRouter при ошибках)",
    )
    KIE_AI_API_KEY: Optional[str] = Field(default=None, description="API key for kie.ai (optional)")
    KIE_AI_BASE_URL: str = Field(default="https://api.kie.ai/v1")
    KIE_AI_TIMEOUT: int = Field(
        default=90,
        description="Timeout для kie.ai запросов в секундах (среднее время обработки ~80s)",
    )
    KIE_AI_POLL_INTERVAL: int = Field(
        default=5,
        description="Интервал polling статуса задачи в секундах",
    )
    KIE_AI_DISABLE_FALLBACK: bool = Field(
        default=False,
        description="Если true — не делать fallback на OpenRouter при ошибках kie.ai (для тестов)",
    )

    # ЮKassa (опционально - только для платежей)
    YUKASSA_SHOP_ID: Optional[str] = Field(default=None, description="ЮKassa shop ID (optional)")
    YUKASSA_SECRET_KEY: Optional[str] = Field(default=None, description="ЮKassa secret key (optional)")
    YUKASSA_WEBHOOK_SECRET: Optional[str] = Field(default=None, description="ЮKassa webhook secret (optional)")

    # Mock режим для платежей (локальное тестирование)
    PAYMENT_MOCK_MODE: bool = Field(default=False, description="Enable payment mock mode for local testing")

    # Монетизация
    BILLING_V4_ENABLED: bool = Field(
        default=False,
        description="Включить новую систему биллинга (Freemium + Subscription + Credits)",
    )
    BILLING_GENERATION_COST_CREDITS: int = Field(
        default=2,
        description="Стоимость одной генерации в кредитах",
    )
    BILLING_ASSISTANT_COST_CREDITS: int = Field(
        default=1,
        description="Стоимость запроса к AI-ассистенту в кредитах",
    )
    BILLING_FREEMIUM_OPS_LIMIT: int = Field(
        default=5,
        description="Лимит бесплатных операций в месяц для freemium",
    )
    BILLING_FREE_TRIAL_CREDITS: int = Field(
        default=10,
        description="Кредиты, выдаваемые при регистрации",
    )
    BILLING_SUBSCRIPTION_TIERS: dict = Field(
        default_factory=lambda: {
            "basic": {"price": 299, "ops_limit": 80},
            "standard": {"price": 499, "ops_limit": 130},
            "pro": {"price": 499, "ops_limit": 130},  # alias для старого enum значения
            "premium": {"price": 899, "ops_limit": 250},
        },
        description="Тарифы подписок: цена в рублях и лимит операций",
    )
    BILLING_CREDIT_PACKAGES: dict = Field(
        default_factory=lambda: {
            "small": {"price": 100, "credits": 20},
            "medium": {"price": 230, "credits": 50},
            "large": {"price": 400, "credits": 100},
            "pro": {"price": 900, "credits": 250},
        },
        description="Пакеты разовой покупки кредитов",
    )
    BILLING_LEDGER_ENABLED: bool = Field(
        default=True,
        description="Вести журнал списаний/начислений в credits_ledger",
    )
    BILLING_MUTEX_TIMEOUT_MS: int = Field(
        default=2000,
        description="Таймаут блокировки при конкурентных списаниях",
    )
    YOOKASSA_IDEMPOTENCY_HEADER: str = Field(
        default="Idempotence-Key",
        description="Заголовок для идемпотентности ЮKassa",
    )
    FREEMIUM_ACTIONS_PER_MONTH: int = Field(default=10)
    FREEMIUM_WATERMARK_TEXT: str = Field(default="AI Image Generator")

    # Налоги и комиссии
    NPD_TAX_RATE: float = Field(default=0.04, description="НПД налог 4%")
    YUKASSA_COMMISSION_RATE: float = Field(default=0.028, description="ЮKassa комиссия 2.8%")

    # Хранение файлов
    UPLOAD_DIR: str = Field(default="./uploads")
    MAX_FILE_SIZE_MB: int = Field(default=10)
    ALLOWED_EXTENSIONS: str = Field(default="jpg,jpeg,png,webp,heic,heif,mpo")
    PHOTO_RETENTION_HOURS: int = Field(default=24, description="Хранение фото для примерки")
    CHAT_HISTORY_RETENTION_DAYS: int = Field(default=30, description="Хранение истории чата")

    @property
    def ALLOWED_EXTENSIONS_LIST(self) -> list[str]:
        """Список разрешённых расширений файлов"""
        return [ext.strip().lower() for ext in self.ALLOWED_EXTENSIONS.split(",")]

    @property
    def MAX_FILE_SIZE_BYTES(self) -> int:
        """Максимальный размер файла в байтах"""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = Field(default=10)

    # Sentry (опционально)
    SENTRY_DSN: Optional[str] = Field(default=None)

    # Admin
    ADMIN_SECRET_KEY: Optional[str] = Field(default=None, description="Secret key for admin access (optional)")
    ADMIN_EMAIL_WHITELIST: str = Field(
        default="",
        description="Список email через запятую, которым автоматически присваивается роль ADMIN",
    )
    ALLOWED_EMAIL_DOMAINS: str = Field(
        default="",
        description="Список разрешённых доменов через запятую для регистрации (пусто — разрешены все)",
    )
    REGISTER_RATE_LIMIT_PER_MINUTE: int = Field(
        default=10,
        description="Сколько регистраций в минуту разрешено с одного IP",
    )

    # Email Verification
    EMAIL_VERIFICATION_ENABLED: bool = Field(
        default=True,
        description="Enable email verification (disable for local testing)",
    )
    SMTP_HOST: Optional[str] = Field(
        default=None,
        description="SMTP server host (e.g., smtp.gmail.com)",
    )
    SMTP_PORT: int = Field(
        default=587,
        description="SMTP server port (587 for TLS, 465 for SSL)",
    )
    SMTP_USER: Optional[str] = Field(
        default=None,
        description="SMTP username (email address)",
    )
    SMTP_PASSWORD: Optional[str] = Field(
        default=None,
        description="SMTP password or app-specific password",
    )
    SMTP_USE_TLS: bool = Field(
        default=True,
        description="Use TLS for SMTP connection",
    )
    EMAIL_FROM: Optional[str] = Field(
        default=None,
        description="Email address to send from (defaults to SMTP_USER)",
    )
    EMAIL_FROM_NAME: str = Field(
        default="AI Image Generator",
        description="Name to display in 'From' field",
    )
    EMAIL_VERIFICATION_TOKEN_TTL_MIN: int = Field(
        default=30,
        description="Email verification token validity in minutes",
    )
    EMAIL_VERIFICATION_RESEND_LIMIT: int = Field(
        default=3,
        description="Max verification emails per user per hour",
    )
    EMAIL_VERIFICATION_RESEND_PER_IP_PER_HOUR: int = Field(
        default=10,
        description="Max verification emails per IP per hour",
    )

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Валидация окружения"""
        allowed = {"development", "staging", "production", "testing"}
        if v not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of: {allowed}")
        return v

    @field_validator("NPD_TAX_RATE", "YUKASSA_COMMISSION_RATE")
    @classmethod
    def validate_rate(cls, v: float) -> float:
        """Валидация процентных ставок"""
        if not 0 <= v <= 1:
            raise ValueError("Rate must be between 0 and 1")
        return v

    @property
    def admin_email_list(self) -> list[str]:
        """Список админских email в нижнем регистре."""
        return [email.strip().lower() for email in self.ADMIN_EMAIL_WHITELIST.split(",") if email.strip()]

    @property
    def allowed_email_domains(self) -> list[str]:
        """Список разрешённых доменов (в нижнем регистре). Пусто — без ограничений."""
        return [d.strip().lower() for d in self.ALLOWED_EMAIL_DOMAINS.split(",") if d.strip()]

    @property
    def is_production(self) -> bool:
        """Проверка production окружения"""
        return self.ENVIRONMENT == "production"

    @property
    def is_debug(self) -> bool:
        """Проверка debug режима"""
        return self.DEBUG and not self.is_production


# Singleton instance настроек
settings = Settings()
