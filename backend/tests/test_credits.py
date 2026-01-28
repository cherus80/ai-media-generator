"""
Unit тесты для модуля управления кредитами

Тестируемый модуль:
- app/services/credits.py — проверка, списание, начисление кредитов
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock
from fastapi import HTTPException

from app.services.credits import (
    check_user_can_perform_action,
    deduct_credits,
    award_credits,
    award_subscription,
)
from app.models.user import User, SubscriptionType, UserRole


@pytest.mark.asyncio
class TestCheckUserCanPerformAction:
    """Тесты проверки возможности выполнения действия"""

    async def test_user_with_credits(self):
        """Пользователь с достаточным количеством кредитов"""
        user = Mock(spec=User)
        user.balance_credits = 10
        user.subscription_type = None
        user.subscription_end = None
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 0
        user.role = UserRole.USER

        result = await check_user_can_perform_action(user, credits_cost=5)

        assert result == (True, "credits")

    async def test_user_with_insufficient_credits(self):
        """Пользователь с недостаточным количеством кредитов"""
        user = Mock(spec=User)
        user.balance_credits = 2
        user.subscription_type = None
        user.subscription_end = None
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 0
        user.role = UserRole.USER

        with pytest.raises(HTTPException) as exc_info:
            await check_user_can_perform_action(user, credits_cost=5)
        assert exc_info.value.status_code == 402

    async def test_user_with_active_subscription(self):
        """Пользователь с активной подпиской"""
        user = Mock(spec=User)
        user.balance_credits = 0
        user.subscription_type = SubscriptionType.BASIC
        user.subscription_ops_used = 5
        user.subscription_ops_limit = 30
        user.subscription_end = datetime.utcnow() + timedelta(days=15)
        user.role = UserRole.USER

        result = await check_user_can_perform_action(user, credits_cost=1)

        assert result == (True, "subscription")

    async def test_user_with_expired_subscription(self):
        """Пользователь с истёкшей подпиской"""
        user = Mock(spec=User)
        user.balance_credits = 0
        user.subscription_type = SubscriptionType.BASIC
        user.subscription_ops_used = 10
        user.subscription_ops_limit = 30
        user.subscription_end = datetime.utcnow() - timedelta(days=1)
        user.role = UserRole.USER

        with pytest.raises(HTTPException) as exc_info:
            await check_user_can_perform_action(user, credits_cost=1)
        assert exc_info.value.status_code == 402

    async def test_user_with_freemium_available(self):
        """Freemium отключён: без подписки и кредитов -> ошибка"""
        user = Mock(spec=User)
        user.balance_credits = 0
        user.subscription_type = None
        user.subscription_end = None
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 0
        user.freemium_actions_used = 5
        user.freemium_reset_at = datetime.utcnow()
        user.role = UserRole.USER

        with pytest.raises(HTTPException) as exc_info:
            await check_user_can_perform_action(user, credits_cost=1)
        assert exc_info.value.status_code == 402

    async def test_user_with_freemium_exhausted(self):
        """Freemium отключён: при отсутствии средств ожидаем ошибку"""
        user = Mock(spec=User)
        user.balance_credits = 0
        user.subscription_type = None
        user.subscription_end = None
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 0
        user.freemium_actions_used = 10
        user.freemium_reset_at = datetime.utcnow()
        user.role = UserRole.USER

        with pytest.raises(HTTPException) as exc_info:
            await check_user_can_perform_action(user, credits_cost=1)
        assert exc_info.value.status_code == 402


@pytest.mark.asyncio
class TestDeductCredits:
    """Тесты списания кредитов"""

    async def test_deduct_from_balance_credits(self):
        """Списание с баланса кредитов"""
        user = Mock(spec=User)
        user.balance_credits = 10
        user.subscription_type = None
        user.subscription_end = None
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 0
        user.freemium_actions_used = 0
        user.role = UserRole.USER

        db_mock = AsyncMock()

        result = await deduct_credits(db_mock, user, credits_cost=3)

        assert result["payment_method"] == "credits"
        assert user.balance_credits == 7
        db_mock.commit.assert_called_once()

    async def test_deduct_from_subscription(self):
        """Списание с подписки"""
        user = Mock(spec=User)
        user.balance_credits = 0
        user.subscription_type = SubscriptionType.PREMIUM
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 50
        user.subscription_end = datetime.utcnow() + timedelta(days=20)
        user.freemium_actions_used = 0
        user.role = UserRole.USER

        db_mock = AsyncMock()

        result = await deduct_credits(db_mock, user, credits_cost=1)

        assert result["payment_method"] == "subscription"
        assert user.subscription_ops_used == 1
        db_mock.commit.assert_called_once()

    async def test_deduct_without_funds(self):
        """Попытка списания при отсутствии подписки и кредитов"""
        user = Mock(spec=User)
        user.balance_credits = 0
        user.subscription_type = None
        user.subscription_end = None
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 0
        user.freemium_actions_used = 10
        user.freemium_reset_at = datetime.utcnow()
        user.role = UserRole.USER

        db_mock = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await deduct_credits(db_mock, user, credits_cost=1)
        assert exc_info.value.status_code == 402
        db_mock.commit.assert_not_called()

    async def test_deduct_insufficient_credits(self):
        """Попытка списания при недостатке средств"""
        user = Mock(spec=User)
        user.balance_credits = 1
        user.subscription_type = None
        user.subscription_end = None
        user.subscription_ops_used = 0
        user.subscription_ops_limit = 0
        user.freemium_actions_used = 10
        user.freemium_reset_at = datetime.utcnow()
        user.role = UserRole.USER

        db_mock = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await deduct_credits(db_mock, user, credits_cost=5)
        assert exc_info.value.status_code == 402
        db_mock.commit.assert_not_called()


@pytest.mark.asyncio
class TestAwardCredits:
    """Тесты начисления кредитов"""

    async def test_award_credits_success(self):
        """Успешное начисление кредитов"""
        user = Mock(spec=User)
        user.id = 123
        user.balance_credits = 10

        db_mock = AsyncMock()
        result_mock = Mock()
        result_mock.scalar_one_or_none.return_value = None
        db_mock.execute.return_value = result_mock
        db_mock.get.return_value = user

        result = await award_credits(
            db_mock,
            user_id=123,
            credits=50,
            payment_id="test-payment-123",
            idempotency_key="test_payment_123",
        )

        assert result["status"] == "success"
        assert result["credits_awarded"] == 50
        assert user.balance_credits == 60
        db_mock.commit.assert_called_once()

    async def test_award_credits_idempotency(self):
        """Проверка идемпотентности начисления"""
        # TODO: Требует mock для Payment модели
        pass


@pytest.mark.asyncio
class TestAwardSubscription:
    """Тесты начисления подписки"""

    async def test_award_subscription_new(self):
        """Начисление новой подписки"""
        user = Mock(spec=User)
        user.id = 123
        user.subscription_type = None
        user.subscription_ops_limit = 0
        user.subscription_ops_used = 0
        user.subscription_end = None

        db_mock = AsyncMock()
        db_mock.get.return_value = user

        result = await award_subscription(
            db_mock,
            user_id=123,
            subscription_type="premium",
            duration_days=30,
            payment_id="sub_payment_456",
        )

        assert result["status"] == "success"
        assert user.subscription_type == "premium"
        assert user.subscription_ops_limit == 120
        assert user.subscription_ops_used == 0
        assert user.subscription_end is not None
        db_mock.commit.assert_called_once()

    async def test_award_subscription_renewal(self):
        """Продление существующей подписки"""
        user = Mock(spec=User)
        user.id = 123
        user.subscription_type = SubscriptionType.BASIC
        user.subscription_ops_limit = 30
        user.subscription_ops_used = 10
        user.subscription_end = datetime.utcnow() + timedelta(days=10)

        db_mock = AsyncMock()
        db_mock.get.return_value = user

        result = await award_subscription(
            db_mock,
            user_id=123,
            subscription_type="premium",
            duration_days=30,
            payment_id="sub_payment_789",
        )

        assert result["status"] == "success"
        assert user.subscription_type == "premium"
        assert user.subscription_ops_limit == 120
        assert user.subscription_ops_used == 0
        db_mock.commit.assert_called_once()
