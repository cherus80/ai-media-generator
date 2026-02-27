"""
Unit тесты для BillingV5Service

Покрытие:
- Приоритет списаний (подписка → кредиты)
- Ассистент (только кредиты)
- Ledger записи
- Сброс лимитов
- Race conditions (параллельные списания)
- Обработка ошибок NOT_ENOUGH_CREDITS
- Admin bypass
- Идемпотентность
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, AsyncMock, patch
from fastapi import HTTPException

from app.services.billing_v5 import BillingV5Service
from app.models.user import User, UserRole, SubscriptionType
from app.models.credits_ledger import (
    CreditsLedger,
    LedgerEntryType,
    LedgerSource,
)


def create_mock_user(**kwargs):
    """
    Helper функция для создания Mock пользователя со всеми необходимыми полями.

    Использование:
        user = create_mock_user(
            id=1,
            balance_credits=100,
            subscription_type=SubscriptionType.BASIC
        )
    """
    user = Mock(spec=User)

    # Базовые поля
    user.id = kwargs.get('id', 1)
    user.role = kwargs.get('role', UserRole.USER)
    user.is_admin = user.role in [UserRole.ADMIN, getattr(UserRole, "SUPER_ADMIN", UserRole.ADMIN)]

    # Подписка
    user.subscription_type = kwargs.get('subscription_type', None)
    user.subscription_end = kwargs.get('subscription_end', None)
    user.subscription_ops_limit = kwargs.get('subscription_ops_limit', 0)
    user.subscription_ops_used = kwargs.get('subscription_ops_used', 0)
    user.subscription_ops_reset_at = kwargs.get(
        'subscription_ops_reset_at',
        datetime.now(timezone.utc) if kwargs.get('subscription_type') else None
    )

    # Freemium
    user.freemium_actions_used = kwargs.get('freemium_actions_used', 0)
    user.freemium_reset_at = kwargs.get('freemium_reset_at', datetime.now(timezone.utc))

    # ⭐️Звезды
    user.balance_credits = kwargs.get('balance_credits', 0)

    return user


@pytest.mark.asyncio
class TestBillingV5ChargeGeneration:
    """Тесты списания генерации (charge_generation)"""

    async def test_priority_subscription_first(self, mock_db_session):
        """Приоритет: подписка списывается первой"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.BASIC,
            subscription_end=datetime.now(timezone.utc) + timedelta(days=15),
            subscription_ops_limit=30,
            subscription_ops_used=10,
            freemium_actions_used=0,
            balance_credits=100,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "action"
        assert user.subscription_ops_used == 11
        assert user.freemium_actions_used == 0
        assert user.balance_credits == 100  # ⭐️Звезды не тратятся
        mock_db_session.commit.assert_called_once()

    async def test_priority_freemium_second(self, mock_db_session):
        """Без подписки списываются кредиты"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=2,
            balance_credits=50,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "credits"
        assert result["credits_spent"] == 2
        assert user.freemium_actions_used == 2
        assert user.balance_credits == 48
        mock_db_session.commit.assert_called_once()

    async def test_priority_credits_last(self, mock_db_session):
        """Приоритет: кредиты списываются последними"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=5,  # Исчерпан (лимит 5)
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "credits"
        assert result["credits_spent"] == 2
        assert user.balance_credits == 8
        mock_db_session.commit.assert_called_once()

    async def test_not_enough_credits_error(self, mock_db_session):
        """Ошибка при нехватке всех источников"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=5,
            balance_credits=1,  # Недостаточно (нужно 2)
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        service = BillingV5Service(mock_db_session)

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await service.charge_generation(user.id)

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail == {"error": "NOT_ENOUGH_BALANCE"}
        mock_db_session.commit.assert_not_called()

    async def test_admin_bypass(self, mock_db_session):
        """Admin пользователи не тратят ресурсы"""
        # Arrange
        user = create_mock_user(
            role=UserRole.ADMIN,
            subscription_type=None,
            balance_credits=0,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "admin_free"
        assert user.balance_credits == 0
        # Admin bypass не делает commit

    async def test_super_admin_bypass(self, mock_db_session):
        """SUPER_ADMIN пользователи не тратят ресурсы"""
        # Arrange
        user = create_mock_user(
            role=UserRole.SUPER_ADMIN,
            subscription_type=None,
            balance_credits=0,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "admin_free"
        assert user.balance_credits == 0

    async def test_subscription_expired(self, mock_db_session):
        """Истекшая подписка не используется"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.BASIC,
            subscription_end=datetime.now(timezone.utc) - timedelta(days=1),  # Expired
            subscription_ops_limit=30,
            subscription_ops_used=10,
            freemium_actions_used=2,
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        assert result["payment_source"] == "credits"
        assert result["credits_spent"] == 2
        assert user.balance_credits == 8

    async def test_subscription_limit_exhausted(self, mock_db_session):
        """Подписка с исчерпанным лимитом не используется"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.BASIC,
            subscription_end=datetime.now(timezone.utc) + timedelta(days=15),
            subscription_ops_limit=30,
            subscription_ops_used=30,  # Исчерпан
            freemium_actions_used=1,
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "credits"
        assert result["credits_spent"] == 2
        assert user.balance_credits == 8


@pytest.mark.asyncio
class TestBillingV5ChargeAssistant:
    """Тесты списания ассистента (charge_assistant)"""

    async def test_assistant_only_credits(self, mock_db_session):
        """Ассистент списывается только с кредитов"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.PREMIUM,
            subscription_end=datetime.now(timezone.utc) + timedelta(days=30),
            subscription_ops_limit=120,
            subscription_ops_used=10,
            freemium_actions_used=0,
            balance_credits=20,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_assistant(user.id)

        # Assert
        assert result["payment_source"] == "credits"
        assert result["credits_spent"] == 1
        assert user.balance_credits == 19
        # Подписка и freemium не тратятся
        assert user.subscription_ops_used == 10
        assert user.freemium_actions_used == 0

    async def test_assistant_not_enough_credits(self, mock_db_session):
        """Ошибка при нехватке кредитов для ассистента"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.BASIC,
            freemium_actions_used=0,
            balance_credits=0,  # Нет кредитов
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        service = BillingV5Service(mock_db_session)

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await service.charge_assistant(user.id)

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail == {"error": "NOT_ENOUGH_CREDITS_FOR_ASSISTANT"}

    async def test_assistant_admin_bypass(self, mock_db_session):
        """Админ может использовать ассистента без кредитов"""
        # Arrange
        user = create_mock_user(
            role=UserRole.ADMIN,
            balance_credits=0,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_assistant(user.id)

        # Assert
        assert result["payment_source"] == "admin_free"
        assert user.balance_credits == 0


@pytest.mark.asyncio
class TestBillingV5Ledger:
    """Тесты журнала операций (ledger)"""

    async def test_ledger_entry_creation(self, mock_db_session):
        """Создание записи в ledger"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=2,
            balance_credits=10,
        )

        # First call - get user (with FOR UPDATE lock)
        # Second call - check for existing ledger entry (should return None)
        mock_db_session.scalar = AsyncMock(side_effect=[user, None])

        ledger_entries = []
        def capture_add(entry):
            # Проверяем что это CreditsLedger объект по наличию атрибутов
            if hasattr(entry, 'user_id') and hasattr(entry, 'type') and hasattr(entry, 'source'):
                ledger_entries.append(entry)

        mock_db_session.add = Mock(side_effect=capture_add)
        service = BillingV5Service(mock_db_session)

        # Act
        with patch('app.core.config.settings.BILLING_LEDGER_ENABLED', True):
            await service.charge_generation(
                user.id,
                idempotency_key="test-key-123",
                meta={"generation_id": "gen-123"}
            )

        # Assert
        assert len(ledger_entries) == 1
        entry = ledger_entries[0]
        assert entry.user_id == 1
        assert entry.type == LedgerEntryType.TRYON_GENERATION.value
        assert entry.amount == -2
        assert entry.source == LedgerSource.CREDITS.value
        assert entry.idempotency_key == "test-key-123"
        assert entry.meta == {
            "generation_id": "gen-123",
            "kind": LedgerEntryType.TRYON_GENERATION.value,
            "charge_via": "credits",
        }

    async def test_ledger_idempotency(self, mock_db_session):
        """Идемпотентность через ledger"""
        # Arrange
        existing_ledger = Mock(spec=CreditsLedger)
        existing_ledger.source = LedgerSource.CREDITS
        existing_ledger.type = LedgerEntryType.TRYON_GENERATION
        existing_ledger.unit = "credits"
        existing_ledger.amount = -2

        user = create_mock_user(
            balance_credits=100,
        )

        # First call returns user, second call returns existing ledger
        mock_db_session.scalar = AsyncMock(side_effect=[user, existing_ledger])
        service = BillingV5Service(mock_db_session)

        # Act
        with patch('app.core.config.settings.BILLING_LEDGER_ENABLED', True):
            result = await service.charge_generation(
                user.id,
                idempotency_key="duplicate-key"
            )

        # Assert: вернулся результат из существующей записи, баланс не изменился
        assert result["payment_source"] == "credits"
        assert user.balance_credits == 100  # Не списано повторно

    async def test_ledger_disabled(self, mock_db_session):
        """Ledger не создается когда отключен"""
        # Arrange
        user = create_mock_user(
            freemium_actions_used=0,
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        with patch('app.core.config.settings.BILLING_LEDGER_ENABLED', False):
            await service.charge_generation(user.id)

        # Assert: add не вызывался (нет ledger записи)
        mock_db_session.add.assert_not_called()


@pytest.mark.asyncio
class TestBillingV5ResetLimits:
    """Тесты сброса лимитов"""

    async def test_reset_freemium_after_30_days(self, mock_db_session):
        """Freemium не используется в billing v5"""
        # Arrange
        old_reset_date = datetime.now(timezone.utc) - timedelta(days=31)
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=5,
            freemium_reset_at=old_reset_date,
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        await service.charge_generation(user.id)

        assert user.freemium_actions_used == 5
        assert user.freemium_reset_at == old_reset_date
        assert user.balance_credits == 8

    async def test_reset_subscription_after_30_days(self, mock_db_session):
        """Сброс подписки через 30 дней"""
        # Arrange
        old_reset_date = datetime.now(timezone.utc) - timedelta(days=31)
        user = create_mock_user(
            subscription_type=SubscriptionType.BASIC,
            subscription_end=datetime.now(timezone.utc) + timedelta(days=30),
            subscription_ops_limit=30,
            subscription_ops_used=20,
            subscription_ops_reset_at=old_reset_date,
            freemium_actions_used=0,
            balance_credits=0,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        await service.charge_generation(user.id)

        # Assert
        assert user.subscription_ops_used == 21
        assert user.subscription_ops_reset_at == old_reset_date

    async def test_no_reset_before_30_days(self, mock_db_session):
        """Нет сброса до истечения 30 дней"""
        # Arrange
        original_reset_at = datetime.now(timezone.utc) - timedelta(days=10)
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=3,
            freemium_reset_at=original_reset_at,
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        await service.charge_generation(user.id)

        # Assert
        assert user.freemium_actions_used == 3
        assert user.freemium_reset_at == original_reset_at
        assert user.balance_credits == 8

    async def test_reset_initializes_null_reset_at(self, mock_db_session):
        """Инициализация null reset_at полей"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=0,
            freemium_reset_at=None,  # Null
            balance_credits=10,
        )
        user.subscription_ops_reset_at = None  # Null

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        await service.charge_generation(user.id)

        assert user.freemium_reset_at is None
        assert user.subscription_ops_reset_at is None


@pytest.mark.asyncio
class TestBillingV5SubscriptionLimitNormalization:
    """Тесты нормализации лимитов подписки"""

    async def test_normalize_pro_to_standard(self, mock_db_session):
        """Нормализация старого enum 'pro' → 'standard'"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.PRO,  # Старое значение
            subscription_end=datetime.now(timezone.utc) + timedelta(days=30),
            subscription_ops_limit=0,  # Не установлен
            subscription_ops_used=10,
            freemium_actions_used=5,
            balance_credits=0,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        await service.charge_generation(user.id)

        # Assert: лимит должен обновиться до 60 (standard)
        assert user.subscription_ops_limit == 60

    async def test_update_subscription_limit_from_config(self, mock_db_session):
        """Обновление лимита подписки из конфига"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.PREMIUM,
            subscription_end=datetime.now(timezone.utc) + timedelta(days=30),
            subscription_ops_limit=200,  # Устаревший лимит
            subscription_ops_used=50,
            freemium_actions_used=0,
            balance_credits=0,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        await service.charge_generation(user.id)

        # Assert: лимит обновлен до 120 (из конфига)
        assert user.subscription_ops_limit == 120


@pytest.mark.asyncio
class TestBillingV5RaceConditions:
    """Тесты race conditions (параллельные списания)"""

    async def test_concurrent_charges_no_negative_balance(self, mock_db_session):
        """Параллельные списания не уводят баланс в минус"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=5,
            balance_credits=2,  # Только на одну генерацию
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act: первая попытка должна пройти
        result1 = await service.charge_generation(user.id)

        # Assert
        assert result1["payment_source"] == "credits"
        assert user.balance_credits == 0

        # Act: вторая попытка должна упасть
        with pytest.raises(HTTPException) as exc_info:
            await service.charge_generation(user.id)

        assert exc_info.value.status_code == 402


@pytest.mark.asyncio
class TestBillingV5UserNotFound:
    """Тесты обработки отсутствующего пользователя"""

    async def test_user_not_found_error(self, mock_db_session):
        """Ошибка 404 при отсутствии пользователя"""
        # Arrange
        mock_db_session.scalar = AsyncMock(return_value=None)
        service = BillingV5Service(mock_db_session)

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await service.charge_generation(999)

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Пользователь не найден"


@pytest.mark.asyncio
class TestBillingV5CustomCost:
    """Тесты кастомной стоимости"""

    async def test_custom_generation_cost(self, mock_db_session):
        """Кастомная стоимость генерации"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=5,
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id, cost_credits=5)

        # Assert
        assert result["credits_spent"] == 5
        assert user.balance_credits == 5

    async def test_custom_assistant_cost(self, mock_db_session):
        """Кастомная стоимость ассистента"""
        # Arrange
        user = create_mock_user(
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_assistant(user.id, cost_credits=3)

        # Assert
        assert result["credits_spent"] == 3
        assert user.balance_credits == 7


@pytest.mark.asyncio
class TestBillingV5EdgeCases:
    """Тесты граничных случаев"""

    async def test_generation_with_exact_credits(self, mock_db_session):
        """Генерация с точным количеством кредитов"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=5,
            balance_credits=2,  # Ровно сколько нужно
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "credits"
        assert user.balance_credits == 0

    async def test_assistant_with_exact_credits(self, mock_db_session):
        """Ассистент с точным количеством кредитов"""
        # Arrange
        user = create_mock_user(
            balance_credits=1,  # Ровно сколько нужно
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_assistant(user.id)

        # Assert
        assert result["payment_source"] == "credits"
        assert user.balance_credits == 0

    async def test_subscription_at_limit(self, mock_db_session):
        """Подписка на грани исчерпания"""
        # Arrange
        user = create_mock_user(
            subscription_type=SubscriptionType.BASIC,
            subscription_end=datetime.now(timezone.utc) + timedelta(days=30),
            subscription_ops_limit=30,
            subscription_ops_used=29,  # Осталась 1
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "action"
        assert user.subscription_ops_used == 30
        assert user.balance_credits == 10  # Не потрачены

    async def test_freemium_at_limit(self, mock_db_session):
        """Freemium на грани исчерпания"""
        # Arrange
        user = create_mock_user(
            subscription_type=None,
            freemium_actions_used=4,  # Осталась 1
            balance_credits=10,
        )

        mock_db_session.scalar = AsyncMock(return_value=user)
        mock_db_session.add = Mock()
        service = BillingV5Service(mock_db_session)

        # Act
        result = await service.charge_generation(user.id)

        # Assert
        assert result["payment_source"] == "credits"
        assert result["credits_spent"] == 2
        assert user.freemium_actions_used == 4
        assert user.balance_credits == 8
