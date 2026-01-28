"""
Payment Model — Модель платежей.

Хранит историю платежей через ЮKassa с учётом налогов и комиссий.
"""

from typing import Optional
import enum
from decimal import Decimal

from sqlalchemy import (
    Integer,
    String,
    Enum,
    ForeignKey,
    Numeric,
    Index,
    Text,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PaymentStatus(str, enum.Enum):
    """Статусы платежа"""
    PENDING = "pending"          # Ожидает оплаты
    PROCESSING = "processing"    # Обрабатывается
    SUCCEEDED = "succeeded"      # Успешно
    CANCELLED = "cancelled"      # Отменён
    REFUNDED = "refunded"        # Возвращён


class PaymentType(str, enum.Enum):
    """Типы платежей"""
    SUBSCRIPTION = "subscription"  # Подписка
    CREDITS = "credits"            # Покупка кредитов


class Payment(Base, TimestampMixin):
    """
    Модель платежа.

    Хранит информацию о платежах через ЮKassa:
    - Подписки (399₽/30, 699₽/60, 1290₽/120 действий)
    - Покупка кредитов (199₽/20, 449₽/50, 799₽/100, 1690₽/250 ⭐️звезд)
    - Учёт налогов НПД 4% и комиссии ЮKassa 2.8%
    """

    __tablename__ = "payments"

    # Primary Key
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        index=True,
    )

    # Foreign Key to User
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="ID пользователя",
    )

    # ЮKassa данные
    yookassa_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="ID платежа в ЮKassa",
    )

    # Идемпотентность
    idempotency_key: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Ключ идемпотентности для предотвращения дублей",
    )

    # Тип и статус
    payment_type: Mapped[PaymentType] = mapped_column(
        Enum(PaymentType, name="payment_type_enum"),
        nullable=False,
        comment="Тип платежа (подписка или кредиты)",
    )

    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum"),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True,
        comment="Статус платежа",
    )

    # Суммы
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Сумма платежа в рублях",
    )

    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
        comment="Сумма налога НПД 4%",
    )

    commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
        comment="Комиссия ЮKassa 2.8%",
    )

    net_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Чистая сумма после вычета налогов и комиссий",
    )

    # Что получил пользователь
    credits_awarded: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Количество начисленных кредитов",
    )

    subscription_type_awarded: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Тип подписки (basic, pro, premium)",
    )

    subscription_duration_days: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Длительность подписки в днях (обычно 30)",
    )

    # Токены OpenRouter (для логирования расходов)
    tokens_used: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Количество использованных токенов OpenRouter",
    )

    # Дополнительные данные
    extra_data: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Дополнительные данные в JSON формате",
    )

    description: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Описание платежа для пользователя",
    )

    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
        index=True,
        comment="Скрыт ли платёж из истории пользователя",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="payments",
    )

    # Индексы
    __table_args__ = (
        Index("idx_user_id_created", "user_id", "created_at"),
        Index("idx_status_type", "status", "payment_type"),
        Index("idx_yookassa_id", "yookassa_id"),
        Index("idx_idempotency_key", "idempotency_key"),
    )

    def __repr__(self) -> str:
        return (
            f"<Payment(id={self.id}, yookassa_id={self.yookassa_id}, "
            f"amount={self.amount}, status={self.status})>"
        )

    # Совместимость с схемами/эндпоинтами, которые ожидают поле payment_id
    @property
    def payment_id(self) -> str:
        return self.yookassa_id

    @payment_id.setter
    def payment_id(self, value: str) -> None:
        self.yookassa_id = value

    @property
    def completed_at(self):
        """
        Псевдо-время завершения: используем updated_at, если платёж успешен.
        (Поле не хранится в БД, но нужно для сериализации ответов.)
        """
        if hasattr(self, "_completed_at"):
            return self._completed_at
        try:
            if self.status == PaymentStatus.SUCCEEDED:
                return getattr(self, "updated_at", None)
        except Exception:
            return None
        return None

    @completed_at.setter
    def completed_at(self, value):
        # Храним только в объекте, без записи в БД
        self._completed_at = value

    # Алиасы для выдачи истории платежей
    @property
    def subscription_type(self) -> Optional[str]:
        return self.subscription_type_awarded

    @property
    def credits_amount(self) -> Optional[int]:
        return self.credits_awarded

    def calculate_taxes_and_commissions(self) -> None:
        """
        Расчёт налогов и комиссий.

        НПД: 4% от суммы
        ЮKassa: 2.8% от суммы
        Чистая сумма = amount - tax - commission
        """
        from app.core.config import settings

        self.tax_amount = Decimal(str(float(self.amount) * settings.NPD_TAX_RATE))
        self.commission_amount = Decimal(
            str(float(self.amount) * settings.YUKASSA_COMMISSION_RATE)
        )
        self.net_amount = self.amount - self.tax_amount - self.commission_amount

    @property
    def is_successful(self) -> bool:
        """Проверка успешности платежа"""
        return self.status == PaymentStatus.SUCCEEDED

    @property
    def can_award_credits(self) -> bool:
        """Можно ли начислить кредиты (платёж успешен и ещё не начислены)"""
        return (
            self.is_successful
            and self.credits_awarded is not None
            and self.credits_awarded > 0
        )
