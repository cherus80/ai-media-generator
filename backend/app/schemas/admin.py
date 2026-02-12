"""
Pydantic схемы для админки.

Содержит модели для:
- Общей статистики приложения
- Списка пользователей
- Экспорта платежей
"""

from datetime import datetime
from enum import Enum
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, Field, FieldValidationInfo, field_validator


# ============================================================================
# Общая статистика
# ============================================================================

class AdminStats(BaseModel):
    """Общая статистика приложения."""

    # Пользователи
    total_users: int = Field(..., description="Всего зарегистрированных пользователей")
    active_users_today: int = Field(..., description="Активных пользователей сегодня")
    active_users_week: int = Field(..., description="Активных пользователей за неделю")
    active_users_month: int = Field(..., description="Активных пользователей за месяц")
    new_users_today: int = Field(..., description="Новых пользователей сегодня")
    new_users_week: int = Field(..., description="Новых пользователей за неделю")
    new_users_month: int = Field(..., description="Новых пользователей за месяц")

    # Генерации
    total_generations: int = Field(..., description="Всего генераций")
    generations_today: int = Field(..., description="Генераций сегодня")
    generations_week: int = Field(..., description="Генераций за неделю")
    generations_month: int = Field(..., description="Генераций за месяц")
    fitting_generations: int = Field(..., description="Генераций примерки")
    editing_generations: int = Field(..., description="Генераций редактирования")

    # Платежи
    total_payments: int = Field(..., description="Всего платежей")
    successful_payments: int = Field(..., description="Успешных платежей")
    total_revenue: Decimal = Field(..., description="Общая выручка (₽)")
    revenue_today: Decimal = Field(..., description="Выручка сегодня (₽)")
    revenue_week: Decimal = Field(..., description="Выручка за неделю (₽)")
    revenue_month: Decimal = Field(..., description="Выручка за месяц (₽)")
    average_payment: Decimal = Field(..., description="Средний чек (₽)")

    # Подписки
    active_subscriptions_basic: int = Field(..., description="Активных подписок Basic")
    active_subscriptions_pro: int = Field(..., description="Активных подписок Pro")
    active_subscriptions_premium: int = Field(..., description="Активных подписок Premium")

    # Рефералы
    total_referrals: int = Field(..., description="Всего рефералов")
    active_referrals: int = Field(..., description="Активных рефералов")

    # Freemium
    freemium_users: int = Field(..., description="Пользователей с Freemium")
    freemium_generations_today: int = Field(..., description="Freemium генераций сегодня")

    class Config:
        json_schema_extra = {
            "example": {
                "total_users": 1250,
                "active_users_today": 85,
                "active_users_week": 420,
                "active_users_month": 890,
                "new_users_today": 12,
                "new_users_week": 78,
                "new_users_month": 234,
                "total_generations": 5680,
                "generations_today": 156,
                "generations_week": 890,
                "generations_month": 3210,
                "fitting_generations": 3400,
                "editing_generations": 2280,
                "total_payments": 345,
                "successful_payments": 312,
                "total_revenue": "156780.50",
                "revenue_today": "4500.00",
                "revenue_week": "23400.00",
                "revenue_month": "89650.00",
                "average_payment": "502.50",
                "active_subscriptions_basic": 45,
                "active_subscriptions_pro": 23,
                "active_subscriptions_premium": 8,
                "total_referrals": 156,
                "active_referrals": 89,
                "freemium_users": 678,
                "freemium_generations_today": 45
            }
        }


class ChartDataPoint(BaseModel):
    """Точка данных для графика."""
    date: str = Field(..., description="Дата (YYYY-MM-DD)")
    value: float = Field(..., description="Значение")

    class Config:
        json_schema_extra = {
            "example": {
                "date": "2025-01-15",
                "value": 4500.50
            }
        }


class AdminChartsData(BaseModel):
    """Данные для графиков."""
    revenue_chart: list[ChartDataPoint] = Field(..., description="График выручки (последние 30 дней)")
    users_chart: list[ChartDataPoint] = Field(..., description="График новых пользователей (последние 30 дней)")
    generations_chart: list[ChartDataPoint] = Field(..., description="График генераций (последние 30 дней)")


# ============================================================================
# Список пользователей
# ============================================================================

class AdminUserItem(BaseModel):
    """Информация о пользователе для админки."""
    id: int
    email: str | None = Field(None, description="Email (для веб-пользователей)")
    telegram_id: int | None = Field(None, description="Telegram ID (legacy)")
    username: str | None
    first_name: str | None
    last_name: str | None
    balance_credits: int
    subscription_type: str | None
    subscription_expires_at: datetime | None
    freemium_actions_remaining: int
    freemium_reset_at: datetime | None
    created_at: datetime
    last_active_at: datetime | None
    role: str = Field(..., description="Роль пользователя (user/admin)")
    total_generations: int = Field(..., description="Всего генераций этого пользователя")
    total_spent: Decimal = Field(..., description="Всего потрачено (₽)")
    referrals_count: int = Field(..., description="Количество приглашённых друзей")
    is_active: bool = Field(..., description="Был ли активен за последние 30 дней")
    is_blocked: bool = Field(..., description="Заблокирован ли пользователь")
    last_login_at: datetime | None = Field(None, description="Время последнего входа")
    last_login_ip: str | None = Field(None, description="IP последнего входа")
    last_login_device: str | None = Field(None, description="Сводка устройства последнего входа")
    last_login_user_agent: str | None = Field(None, description="Raw User-Agent последнего входа")
    ip_shared_accounts: int = Field(default=0, description="Сколько аккаунтов имеют тот же IP последнего входа")
    device_shared_accounts: int = Field(default=0, description="Сколько аккаунтов имеют ту же связку IP+устройство")
    suspicion_score: int = Field(default=0, ge=0, le=100, description="Оценка риска мультиаккаунтинга")
    is_suspicious: bool = Field(default=False, description="Флаг подозрения на мультиаккаунтинг")
    suspicion_reason: str | None = Field(default=None, description="Пояснение причины подозрения")


class AdminUsersResponse(BaseModel):
    """Ответ со списком пользователей."""
    users: list[AdminUserItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# Экспорт платежей
# ============================================================================

class PaymentExportItem(BaseModel):
    """Платёж для экспорта в CSV."""
    payment_id: str
    user_id: int
    telegram_id: int
    username: str | None
    payment_type: str
    amount: Decimal
    status: str
    created_at: datetime
    paid_at: datetime | None
    subscription_type: str | None
    credits_amount: int | None
    yukassa_payment_id: str | None
    npd_tax: Decimal = Field(..., description="НПД 4%")
    yukassa_commission: Decimal = Field(..., description="Комиссия ЮKassa 2.8%")
    net_amount: Decimal = Field(..., description="Чистая сумма")


class PaymentExportResponse(BaseModel):
    """Ответ с экспортом платежей."""
    payments: list[PaymentExportItem]
    total_count: int
    total_amount: Decimal
    total_npd_tax: Decimal
    total_yukassa_commission: Decimal
    total_net_amount: Decimal
    date_from: datetime | None
    date_to: datetime | None


# ============================================================================
# Экспорт согласий на ПДн
# ============================================================================


class ConsentExportItem(BaseModel):
    """Запись о согласии на обработку ПДн."""

    id: int = Field(..., description="ID записи о согласии")
    user_id: int
    email: str | None = Field(None, description="Email пользователя")
    consent_version: str = Field(..., description="Версия согласия")
    source: str = Field(..., description="Источник (register/login)")
    ip_address: str | None = Field(None, description="IP-адрес клиента")
    user_agent: str | None = Field(None, description="User-Agent клиента")
    granted_at: datetime = Field(..., description="Время фиксации согласия (UTC)")


class ConsentExportResponse(BaseModel):
    """Ответ для выгрузки согласий."""

    consents: list[ConsentExportItem]
    total_count: int
    date_from: datetime | None
    date_to: datetime | None
    version: str | None


# ============================================================================
# Запросы
# ============================================================================

class ConsentExportRequest(BaseModel):
    date_from: datetime | None = Field(default=None, description="Начальная дата")
    date_to: datetime | None = Field(default=None, description="Конечная дата")
    version: str | None = Field(default=None, description="Фильтр по версии согласия")
    format: Literal["csv", "json"] = Field(default="csv", description="Формат экспорта")


class DeleteConsentsRequest(BaseModel):
    """Запрос на удаление выбранных согласий."""

    consent_ids: list[int] = Field(
        ...,
        min_length=1,
        description="Список ID согласий для удаления",
    )


class DeleteConsentsResponse(BaseModel):
    """Результат удаления согласий."""

    deleted_count: int = Field(..., description="Сколько записей удалено")


class AdminUsersRequest(BaseModel):
    """Параметры для получения списка пользователей."""
    page: int = Field(default=1, ge=1, description="Номер страницы")
    page_size: int = Field(default=50, ge=1, le=200, description="Размер страницы")
    sort_by: str = Field(default="created_at", description="Поле для сортировки")
    order: str = Field(default="desc", description="Порядок сортировки (asc/desc)")
    search: str | None = Field(default=None, description="Поиск по username/telegram_id")
    filter_subscription: str | None = Field(default=None, description="Фильтр по подписке")
    filter_active: bool | None = Field(default=None, description="Фильтр по активности")


# ============================================================================
# Настройки fallback (GrsAI / kie.ai / OpenRouter)
# ============================================================================

class GenerationProvider(str, Enum):
    """Доступные провайдеры генерации изображений."""

    GRS_AI = "grsai"
    KIE_AI = "kie_ai"
    OPENROUTER = "openrouter"


class FallbackSettingsResponse(BaseModel):
    """Текущие настройки fallback для генерации."""

    primary_provider: GenerationProvider = Field(..., description="Основной провайдер генерации")
    fallback_provider: Optional[GenerationProvider] = Field(
        default=None,
        description="Запасной провайдер (None — без автоматического переключения)",
    )
    available_providers: list[GenerationProvider] = Field(
        default_factory=lambda: [GenerationProvider.GRS_AI, GenerationProvider.KIE_AI, GenerationProvider.OPENROUTER],
        description="Список поддерживаемых провайдеров",
    )
    # Поля для обратной совместимости (старый UI)
    use_kie_ai: bool = Field(..., description="Использовать kie.ai как основной сервис")
    disable_fallback: bool = Field(..., description="Запретить fallback на резервный провайдер")


class UpdateFallbackSettingsRequest(BaseModel):
    """Запрос на обновление настроек fallback (частичное обновление)."""

    primary_provider: Optional[GenerationProvider] = Field(
        default=None, description="Установить основной провайдер генерации"
    )
    fallback_provider: Optional[GenerationProvider] = Field(
        default=None,
        description="Установить запасной провайдер (null — отключить fallback)",
    )
    # Legacy-флаги для совместимости
    use_kie_ai: Optional[bool] = Field(default=None, description="Переключить использование kie.ai")
    disable_fallback: Optional[bool] = Field(default=None, description="Запретить fallback на OpenRouter")


class PaymentExportRequest(BaseModel):
    """Параметры для экспорта платежей."""
    date_from: datetime | None = Field(default=None, description="Начальная дата")
    date_to: datetime | None = Field(default=None, description="Конечная дата")
    status: str | None = Field(default="succeeded", description="Статус платежа")
    format: str = Field(default="csv", description="Формат экспорта (csv/json)")


# ============================================================================
# Промпты примерки
# ============================================================================

class FittingPromptItem(BaseModel):
    """Промпт для конкретной зоны примерки."""
    zone: str
    prompt: str
    is_default: bool
    updated_at: Optional[datetime] = None
    updated_by_user_id: Optional[int] = None


class FittingPromptListResponse(BaseModel):
    """Ответ со списком промптов."""
    items: list[FittingPromptItem]
    total: int


class UpdateFittingPromptRequest(BaseModel):
    """Запрос на обновление промпта."""
    prompt: Optional[str] = None
    use_default: bool = Field(default=False, description="Сбросить на дефолт")

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: Optional[str], info: FieldValidationInfo):
        use_default = info.data.get("use_default", False)
        if not use_default:
            if v is None or not v.strip():
                raise ValueError("prompt обязателен, если не выбран сброс")
        return v


# ============================================================================
# Динамика регистраций
# ============================================================================

class UserRegistrationData(BaseModel):
    """Данные о регистрациях пользователей по дням."""
    date: str = Field(..., description="Дата (YYYY-MM-DD)")
    count: int = Field(..., description="Количество регистраций")

    class Config:
        json_schema_extra = {
            "example": {
                "date": "2025-01-15",
                "count": 12
            }
        }


# ============================================================================
# Активность пользователей
# ============================================================================

class TopUserByGenerations(BaseModel):
    """Топ пользователь по генерациям."""
    id: int
    email: str | None
    username: str | None
    generations_count: int


class UserActivityStats(BaseModel):
    """Статистика активности пользователей."""
    active_today: int = Field(..., description="Активных сегодня")
    active_this_week: int = Field(..., description="Активных за неделю")
    active_this_month: int = Field(..., description="Активных за месяц")
    top_users: list[TopUserByGenerations] = Field(..., description="Топ 10 пользователей по генерациям")
    avg_generations_per_user: float = Field(..., description="Среднее количество генераций на пользователя")
    total_credits_spent: int = Field(..., description="Всего потрачено ⭐️звезд")


# ============================================================================
# Редактирование баланса кредитов
# ============================================================================

class UpdateCreditsRequest(BaseModel):
    """Запрос на установку нового баланса ⭐️звезд пользователю."""
    new_balance: int = Field(..., ge=0, description="Итоговый баланс ⭐️звезд")
    reason: str | None = Field(
        default=None,
        min_length=3,
        max_length=200,
        description="Причина изменения баланса (опционально)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "new_balance": 120,
                "reason": "Коррекция баланса после возврата"
            }
        }


class UpdateCreditsResponse(BaseModel):
    """Ответ на редактирование баланса ⭐️звезд."""
    success: bool
    user_id: int
    previous_balance: int = Field(..., description="Баланс до изменений")
    new_balance: int = Field(..., description="Новый баланс пользователя")
    message: str


# ============================================================================
# Блокировка пользователей
# ============================================================================

class UpdateUserBlockRequest(BaseModel):
    """Запрос на блокировку/разблокировку пользователя."""
    is_blocked: bool = Field(..., description="Заблокировать пользователя (true) или разблокировать (false)")
    reason: str | None = Field(
        default=None,
        min_length=3,
        max_length=200,
        description="Причина блокировки/разблокировки (опционально)",
    )


class UpdateUserBlockResponse(BaseModel):
    """Ответ на блокировку/разблокировку пользователя."""
    success: bool = Field(..., description="Успешность операции")
    user_id: int = Field(..., description="ID пользователя")
    previous_is_blocked: bool = Field(..., description="Статус блокировки до изменения")
    is_blocked: bool = Field(..., description="Текущий статус блокировки")
    message: str = Field(..., description="Сообщение о результате")


# ============================================================================
# Детали пользователя
# ============================================================================

class UserDetailsResponse(BaseModel):
    """Детальная информация о пользователе."""
    user: AdminUserItem
    recent_generations: list = Field(..., description="Последние 10 генераций")
    recent_payments: list = Field(..., description="Последние 10 платежей")
    referrals: list[dict] = Field(..., description="Список приглашенных пользователей")


# ============================================================================
# Статистика рефералов
# ============================================================================

class ReferralStatsItem(BaseModel):
    """Статистика рефералов по пользователю."""
    user_id: int
    email: str | None
    username: str | None
    referrals_count: int = Field(..., description="Количество приглашенных")
    active_referrals: int = Field(..., description="Активных рефералов")
    credits_earned: int = Field(..., description="Заработано ⭐️звезд")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 42,
                "email": "user@example.com",
                "username": "user123",
                "referrals_count": 15,
                "active_referrals": 8,
                "credits_earned": 150
            }
        }


class ReferralStatsResponse(BaseModel):
    """Ответ со статистикой рефералов."""
    stats: list[ReferralStatsItem]
    total_referrals: int = Field(..., description="Всего рефералов в системе")
    total_credits_earned: int = Field(..., description="Всего заработано ⭐️звезд")


# ============================================================================
# Управление правами пользователей
# ============================================================================

class MakeAdminRequest(BaseModel):
    """Запрос на назначение пользователя администратором."""
    email: str = Field(..., description="Email пользователя для назначения админом")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "newadmin@example.com"
            }
        }


class MakeAdminResponse(BaseModel):
    """Ответ на назначение администратора."""
    success: bool = Field(..., description="Успешность операции")
    user_id: int = Field(..., description="ID пользователя")
    email: str = Field(..., description="Email пользователя")
    role: str = Field(..., description="Новая роль пользователя")
    message: str = Field(..., description="Сообщение о результате")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user_id": 42,
                "email": "newadmin@example.com",
                "role": "ADMIN",
                "message": "User newadmin@example.com is now an admin"
            }
        }


class DeleteUserResponse(BaseModel):
    """Ответ на удаление пользователя."""
    success: bool = Field(..., description="Успешность операции")
    user_id: int = Field(..., description="ID удаленного пользователя")
    message: str = Field(..., description="Сообщение о результате")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user_id": 42,
                "message": "User with ID 42 has been deleted"
            }
        }
