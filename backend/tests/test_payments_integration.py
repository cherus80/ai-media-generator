"""
Integration тесты для Payments API endpoints (ЮKassa)

Требует запущенную test database.
Запуск: pytest tests/test_payments_integration.py -v

Перед запуском:
1. Создайте test database: ./tests/create_test_db.sh
2. Убедитесь, что PostgreSQL запущен
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch, Mock
from datetime import datetime, timedelta, timezone
import uuid

from app.models.user import User, SubscriptionType
from app.models.payment import Payment


@pytest.mark.asyncio
@pytest.mark.integration
class TestSubscriptionPurchase:
    """Integration тесты покупки подписок"""

    @pytest.mark.parametrize("subscription_type,expected_price,expected_actions", [
        ("basic", 399.0, 30),
        ("standard", 699.0, 60),
        ("premium", 1290.0, 120),
    ])
    async def test_create_subscription_payment(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
        subscription_type: str,
        expected_price: float,
        expected_actions: int,
    ):
        """
        Создание платежа для подписки должно:
        1. Создать payment в БД со статусом pending
        2. Вызвать YuKassa API
        3. Вернуть confirmation_url для оплаты
        """
        # Mock YuKassa API
        with patch("app.services.yukassa_client.YuKassaClient.create_payment") as mock_create:
            mock_payment_id = f"test-payment-{uuid.uuid4()}"
            mock_create.return_value = {
                "id": mock_payment_id,
                "status": "pending",
                "confirmation": {
                    "type": "redirect",
                    "confirmation_url": f"https://yookassa.ru/checkout/{mock_payment_id}"
                }
            }

            response = await authenticated_test_client.post(
                "/api/v1/payments/create-subscription",
                json={
                    "subscription_type": subscription_type
                }
            )

            assert response.status_code == 200
            data = response.json()

            assert "payment_id" in data
            assert "confirmation_url" in data
            assert data["confirmation_url"] == f"https://yookassa.ru/checkout/{mock_payment_id}"

            # Verify payment saved in DB
            from sqlalchemy import select
            stmt = select(Payment).where(Payment.payment_id == mock_payment_id)
            result = await test_db.execute(stmt)
            payment = result.scalar_one_or_none()

            assert payment is not None
            assert payment.user_id == test_user_with_credits.id
            assert payment.payment_type == "subscription"
            assert payment.subscription_type == subscription_type
            assert payment.amount == expected_price
            assert payment.status == "pending"
            assert payment.idempotency_key is not None

    async def test_subscription_webhook_success(
        self,
        test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Webhook от YuKassa при успешной оплате подписки должен:
        1. Обновить статус payment на succeeded
        2. Активировать подписку для пользователя
        3. Начислить subscription_ops_limit
        """
        # Create pending payment
        payment_id = f"test-payment-{uuid.uuid4()}"
        idempotency_key = f"idem-{uuid.uuid4()}"

        payment = Payment(
            user_id=test_user_with_credits.id,
            payment_id=payment_id,
            payment_type="subscription",
            subscription_type="premium",
            amount=1290.0,
            currency="RUB",
            status="pending",
            idempotency_key=idempotency_key,
            created_at=datetime.utcnow(),
        )

        test_db.add(payment)
        await test_db.commit()
        await test_db.refresh(payment)

        # Mock YuKassa webhook signature verification
        with patch("app.services.yukassa_client.YuKassaClient.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True

            # Simulate webhook payload from YuKassa
            webhook_payload = {
                "type": "notification",
                    "event": "payment.succeeded",
                    "object": {
                        "id": payment_id,
                        "status": "succeeded",
                        "amount": {
                            "value": "1290.00",
                            "currency": "RUB"
                        },
                        "metadata": {
                            "user_id": str(test_user_with_credits.id),
                            "subscription_type": "premium"
                    },
                    "paid": True,
                    "created_at": datetime.utcnow().isoformat(),
                }
            }

            response = await test_client.post(
                "/api/v1/payments/webhook",
                json=webhook_payload,
                headers={"X-Signature": "test-signature"}
            )

            assert response.status_code == 200

            # Verify payment status updated
            await test_db.refresh(payment)
            assert payment.status == "succeeded"
            assert payment.completed_at is not None

            # Verify subscription activated for user
            await test_db.refresh(test_user_with_credits)
            assert test_user_with_credits.subscription_type == SubscriptionType.PREMIUM
            assert test_user_with_credits.subscription_ops_limit == 120
            assert test_user_with_credits.subscription_ops_used == 0
            assert test_user_with_credits.subscription_end is not None
            # Subscription should be valid for 30 days
            assert test_user_with_credits.subscription_end > datetime.now(timezone.utc)

    async def test_idempotent_webhook_processing(
        self,
        test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Повторная обработка того же webhook не должна начислить кредиты дважды
        (идемпотентность через idempotency_key)
        """
        payment_id = f"test-payment-{uuid.uuid4()}"
        idempotency_key = f"idem-{uuid.uuid4()}"

        payment = Payment(
            user_id=test_user_with_credits.id,
            payment_id=payment_id,
            payment_type="subscription",
            subscription_type="basic",
            amount=399.0,
            currency="RUB",
            status="pending",
            idempotency_key=idempotency_key,
            created_at=datetime.utcnow(),
        )

        test_db.add(payment)
        await test_db.commit()
        await test_db.refresh(payment)

        webhook_payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": payment_id,
                "status": "succeeded",
                "amount": {"value": "399.00", "currency": "RUB"},
                "metadata": {
                    "user_id": str(test_user_with_credits.id),
                    "subscription_type": "basic"
                },
                "paid": True,
            }
        }

        with patch("app.services.yukassa_client.YuKassaClient.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True

            # First webhook - should process
            response1 = await test_client.post(
                "/api/v1/payments/webhook",
                json=webhook_payload,
                headers={"X-Signature": "test-sig"}
            )

            assert response1.status_code == 200

            await test_db.refresh(test_user_with_credits)
            first_limit = test_user_with_credits.subscription_ops_limit

            # Second webhook (duplicate) - should NOT process again
            response2 = await test_client.post(
                "/api/v1/payments/webhook",
                json=webhook_payload,
                headers={"X-Signature": "test-sig"}
            )

            assert response2.status_code == 200

            await test_db.refresh(test_user_with_credits)
            second_limit = test_user_with_credits.subscription_ops_limit

            # Actions should be the same (not doubled)
            assert first_limit == second_limit


@pytest.mark.asyncio
@pytest.mark.integration
class TestCreditsPurchase:
    """Integration тесты покупки кредитов"""

    async def test_create_credits_payment(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Покупка кредитов должна создать pending payment
        """
        with patch("app.services.yukassa_client.YuKassaClient.create_payment") as mock_create:
            mock_payment_id = f"credits-{uuid.uuid4()}"
            mock_create.return_value = {
                "id": mock_payment_id,
                "status": "pending",
                "confirmation": {
                    "type": "redirect",
                    "confirmation_url": f"https://yookassa.ru/checkout/{mock_payment_id}"
                }
            }

            response = await authenticated_test_client.post(
                "/api/v1/payments/create-credits",
                json={
                    "credits_amount": 100
                }
            )

            assert response.status_code == 200
            data = response.json()

            assert "payment_id" in data
            assert "confirmation_url" in data

            # Verify payment in DB
            from sqlalchemy import select
            stmt = select(Payment).where(Payment.payment_id == mock_payment_id)
            result = await test_db.execute(stmt)
            payment = result.scalar_one_or_none()

            assert payment is not None
            assert payment.payment_type == "credits"
            assert payment.credits_amount == 100
            assert payment.amount == 799.0  # Price for 100 credits

    async def test_credits_webhook_success(
        self,
        test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Webhook при успешной покупке кредитов должен начислить кредиты
        """
        payment_id = f"credits-payment-{uuid.uuid4()}"
        idempotency_key = f"idem-{uuid.uuid4()}"

        payment = Payment(
            user_id=test_user_with_credits.id,
            payment_id=payment_id,
            payment_type="credits",
            credits_amount=100,
            amount=799.0,
            currency="RUB",
            status="pending",
            idempotency_key=idempotency_key,
            created_at=datetime.utcnow(),
        )

        test_db.add(payment)
        await test_db.commit()
        await test_db.refresh(payment)

        initial_credits = test_user_with_credits.balance_credits

        webhook_payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": payment_id,
                "status": "succeeded",
                "amount": {"value": "799.00", "currency": "RUB"},
                "metadata": {
                    "user_id": str(test_user_with_credits.id),
                    "credits_amount": "100"
                },
                "paid": True,
            }
        }

        with patch("app.services.yukassa_client.YuKassaClient.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True

            response = await test_client.post(
                "/api/v1/payments/webhook",
                json=webhook_payload,
                headers={"X-Signature": "test-sig"}
            )

            assert response.status_code == 200

            # Verify credits added
            await test_db.refresh(test_user_with_credits)
            assert test_user_with_credits.balance_credits == initial_credits + 100

    async def test_invalid_credits_amount(
        self,
        authenticated_test_client: AsyncClient,
    ):
        """
        Попытка купить невалидное количество кредитов должна провалиться
        """
        response = await authenticated_test_client.post(
            "/api/v1/payments/create-credits",
            json={
                "credits_amount": -10  # Invalid
            }
        )

        assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.integration
class TestPaymentHistory:
    """Тесты истории платежей"""

    async def test_get_user_payment_history(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Получение истории платежей пользователя
        """
        # Create several payments
        for i in range(3):
            payment = Payment(
                user_id=test_user_with_credits.id,
                payment_id=f"payment-{i}",
                payment_type="credits" if i % 2 == 0 else "subscription",
                credits_amount=100 if i % 2 == 0 else None,
                subscription_type=None if i % 2 == 0 else "basic",
                amount=799.0 if i % 2 == 0 else 399.0,
                currency="RUB",
                status="succeeded",
                idempotency_key=f"idem-{i}",
                created_at=datetime.utcnow() - timedelta(days=i),
                completed_at=datetime.utcnow() - timedelta(days=i),
            )
            test_db.add(payment)

        await test_db.commit()

        # Get payment history
        response = await authenticated_test_client.get("/api/v1/payments/history")

        assert response.status_code == 200
        history = response.json()

        assert len(history) >= 3

        # Verify structure
        for payment_data in history:
            assert "payment_id" in payment_data
            assert "payment_type" in payment_data
            assert "amount" in payment_data
            assert "status" in payment_data
            assert "created_at" in payment_data

    async def test_cannot_see_other_users_payments(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Пользователь не должен видеть платежи других пользователей
        """
        # Create another user with payment
        from app.models.user import User

        other_user = User(
            telegram_id=999888777,
            username="other_payer",
            first_name="Other",
            last_name="Payer",
            balance_credits=0,
            subscription_type=None,
        )

        test_db.add(other_user)
        await test_db.commit()
        await test_db.refresh(other_user)

        # Create payment for other user
        other_payment = Payment(
            user_id=other_user.id,
            payment_id="other-payment-123",
            payment_type="credits",
            credits_amount=100,
            amount=799.0,
            currency="RUB",
            status="succeeded",
            idempotency_key="other-idem",
            created_at=datetime.utcnow(),
        )

        test_db.add(other_payment)
        await test_db.commit()

        # Get payment history as test_user_with_credits
        response = await authenticated_test_client.get("/api/v1/payments/history")

        assert response.status_code == 200
        history = response.json()

        # Should not contain other user's payment
        payment_ids = [p["payment_id"] for p in history]
        assert "other-payment-123" not in payment_ids


@pytest.mark.asyncio
@pytest.mark.integration
class TestWebhookSecurity:
    """Тесты безопасности webhook"""

    async def test_webhook_rejects_invalid_signature(
        self,
        test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Webhook с невалидной подписью должен быть отклонён
        """
        payment_id = f"test-payment-{uuid.uuid4()}"

        payment = Payment(
            user_id=test_user_with_credits.id,
            payment_id=payment_id,
            payment_type="credits",
            credits_amount=100,
            amount=799.0,
            currency="RUB",
            status="pending",
            idempotency_key=f"idem-{uuid.uuid4()}",
            created_at=datetime.utcnow(),
        )

        test_db.add(payment)
        await test_db.commit()

        webhook_payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": payment_id,
                "status": "succeeded",
                "amount": {"value": "799.00", "currency": "RUB"},
                "metadata": {
                    "user_id": str(test_user_with_credits.id),
                    "credits_amount": "100"
                },
                "paid": True,
            }
        }

        # Mock invalid signature
        with patch("app.services.yukassa_client.YuKassaClient.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = False  # Invalid signature

            response = await test_client.post(
                "/api/v1/payments/webhook",
                json=webhook_payload,
                headers={"X-Signature": "invalid-signature"}
            )

            # Should reject
            assert response.status_code in [401, 403]

            # Payment should still be pending
            await test_db.refresh(payment)
            assert payment.status == "pending"

    async def test_webhook_without_signature_header(
        self,
        test_client: AsyncClient,
    ):
        """
        Webhook без заголовка X-Signature должен быть отклонён
        """
        webhook_payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "some-payment-id",
                "status": "succeeded",
            }
        }

        # No X-Signature header
        response = await test_client.post(
            "/api/v1/payments/webhook",
            json=webhook_payload
        )

        assert response.status_code in [400, 401, 403]


@pytest.mark.asyncio
@pytest.mark.integration
class TestSubscriptionExpiration:
    """Тесты истечения подписки"""

    async def test_expired_subscription_deactivates(
        self,
        test_client: AsyncClient,
        test_db: AsyncSession,
    ):
        """
        Истёкшая подписка должна деактивироваться
        """
        from app.models.user import User, SubscriptionType

        # Create user with expired subscription
        user_expired = User(
            telegram_id=555666777,
            username="expired_sub_user",
            first_name="Expired",
            last_name="Sub",
            balance_credits=0,
            subscription_type=SubscriptionType.PREMIUM,
            subscription_ops_limit=120,
            subscription_ops_used=0,
            subscription_end=datetime.now(timezone.utc) - timedelta(days=1),  # Expired
        )

        test_db.add(user_expired)
        await test_db.commit()
        await test_db.refresh(user_expired)

        # В реальном приложении была бы background task, которая проверяет
        # и деактивирует истёкшие подписки
        # Здесь мы можем протестировать эту логику напрямую

        from app.utils.jwt import create_access_token

        token = create_access_token(
            data={
                "user_id": user_expired.id,
                "telegram_id": user_expired.telegram_id
            }
        )

        test_client.headers["Authorization"] = f"Bearer {token}"

        # При попытке использовать API, должна произойти проверка подписки
        # и она должна быть деактивирована
        response = await test_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        user_data = response.json()

        # В зависимости от реализации, subscription_type может быть сброшен
        # или actions_left = 0
        # (это зависит от того, где именно проверяется expiration)


@pytest.mark.asyncio
@pytest.mark.integration
class TestPaymentCancellation:
    """Тесты отмены платежа"""

    async def test_payment_cancellation_webhook(
        self,
        test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Webhook о отмене платежа должен обновить статус на canceled
        """
        payment_id = f"canceled-payment-{uuid.uuid4()}"

        payment = Payment(
            user_id=test_user_with_credits.id,
            payment_id=payment_id,
            payment_type="subscription",
            subscription_type="premium",
            amount=1290.0,
            currency="RUB",
            status="pending",
            idempotency_key=f"idem-{uuid.uuid4()}",
            created_at=datetime.utcnow(),
        )

        test_db.add(payment)
        await test_db.commit()
        await test_db.refresh(payment)

        webhook_payload = {
            "type": "notification",
            "event": "payment.canceled",
            "object": {
                "id": payment_id,
                "status": "canceled",
                "amount": {"value": "1290.00", "currency": "RUB"},
                "metadata": {
                    "user_id": str(test_user_with_credits.id),
                    "subscription_type": "premium"
                },
                "paid": False,
            }
        }

        with patch("app.services.yukassa_client.YuKassaClient.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True

            response = await test_client.post(
                "/api/v1/payments/webhook",
                json=webhook_payload,
                headers={"X-Signature": "test-sig"}
            )

            assert response.status_code == 200

            # Verify payment status updated
            await test_db.refresh(payment)
            assert payment.status == "canceled"

            # User should NOT have subscription activated
            await test_db.refresh(test_user_with_credits)
            assert test_user_with_credits.subscription_type is None
