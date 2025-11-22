"""
Integration тесты для Editing API endpoints (чат с AI-ассистентом)

Требует запущенную test database.
Запуск: pytest tests/test_editing_integration.py -v

Перед запуском:
1. Создайте test database: ./tests/create_test_db.sh
2. Убедитесь, что PostgreSQL запущен
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch
from io import BytesIO

from app.models.user import User
from app.models.chat import ChatHistory


@pytest.mark.asyncio
@pytest.mark.integration
class TestChatSessionWorkflow:
    """Integration тесты для работы с чат-сессиями"""

    async def test_create_new_chat_session(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
        sample_jpeg_bytes: bytes,
    ):
        """
        Создание новой чат-сессии с базовым изображением
        """
        # Upload base image
        base_image = BytesIO(sample_jpeg_bytes)

        response = await authenticated_test_client.post(
            "/api/v1/editing/upload-base-image",
            files={"file": ("base.jpg", base_image, "image/jpeg")}
        )

        assert response.status_code == 200
        data = response.json()
        assert "file_url" in data
        base_image_url = data["file_url"]

        # Create chat session
        response = await authenticated_test_client.post(
            "/api/v1/editing/create-session",
            json={"base_image_url": base_image_url}
        )

        assert response.status_code == 200
        session_data = response.json()

        assert "session_id" in session_data
        assert session_data["base_image_url"] == base_image_url
        assert session_data["is_active"] is True
        assert session_data["message_count"] == 0

        # Verify session exists in DB
        from sqlalchemy import select
        stmt = select(ChatHistory).where(ChatHistory.id == session_data["session_id"])
        result = await test_db.execute(stmt)
        chat_session = result.scalar_one_or_none()

        assert chat_session is not None
        assert chat_session.user_id == test_user_with_credits.id
        assert chat_session.is_active is True

    async def test_send_message_and_get_prompts(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Отправка сообщения в чат должна:
        1. Списать 1 кредит
        2. Вызвать OpenRouter для генерации промптов
        3. Вернуть варианты промптов
        """
        # Create session first
        from app.models.chat import ChatHistory
        from datetime import datetime

        session = ChatHistory(
            user_id=test_user_with_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=[],
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        initial_credits = test_user_with_credits.balance_credits

        # Mock OpenRouter API
        with patch("app.services.openrouter_client.OpenRouterClient.generate_prompts") as mock_prompts:
            mock_prompts.return_value = [
                "Short: make brighter",
                "Medium: enhance brightness and contrast",
                "Long: significantly increase brightness levels and improve contrast ratio"
            ]

            response = await authenticated_test_client.post(
                f"/api/v1/editing/sessions/{session.id}/message",
                json={"message": "Make this image brighter"}
            )

            assert response.status_code == 200
            result = response.json()

            assert "prompts" in result
            assert len(result["prompts"]) == 3
            assert result["prompts"][0] == "Short: make brighter"

            # Verify 1 credit deducted
            await test_db.refresh(test_user_with_credits)
            assert test_user_with_credits.balance_credits == initial_credits - 1

            # Verify message saved in session
            await test_db.refresh(session)
            assert len(session.messages) == 1
            assert session.messages[0]["role"] == "user"
            assert session.messages[0]["content"] == "Make this image brighter"

    async def test_generate_image_from_prompt(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Генерация изображения по выбранному промпту должна:
        1. Списать 1 кредит
        2. Вызвать OpenRouter API
        3. Сохранить результат в БД
        """
        # Create session
        from app.models.chat import ChatHistory
        from datetime import datetime

        session = ChatHistory(
            user_id=test_user_with_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=[
                {
                    "role": "user",
                    "content": "Make brighter",
                    "timestamp": datetime.utcnow().isoformat()
                }
            ],
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        initial_credits = test_user_with_credits.balance_credits

        # Mock OpenRouter API
        with patch("app.services.openrouter.OpenRouterClient.generate_image_edit") as mock_generate:
            mock_generate.return_value = {
                "image_url": "https://example.com/edited.jpg",
                "task_id": "edit-task-123"
            }

            response = await authenticated_test_client.post(
                f"/api/v1/editing/sessions/{session.id}/generate",
                json={"selected_prompt": "enhance brightness and contrast"}
            )

            assert response.status_code == 200
            result = response.json()

            assert "generation_id" in result
            assert "result_image_url" in result
            assert result["result_image_url"] == "https://example.com/edited.jpg"

            # Verify 1 credit deducted (message cost was separate)
            await test_db.refresh(test_user_with_credits)
            assert test_user_with_credits.balance_credits == initial_credits - 1

            # Verify generation saved in DB
            from app.models.generation import Generation
            from sqlalchemy import select

            stmt = select(Generation).where(Generation.id == result["generation_id"])
            gen_result = await test_db.execute(stmt)
            generation = gen_result.scalar_one_or_none()

            assert generation is not None
            assert generation.generation_type == "editing"
            assert generation.status == "completed"
            assert generation.cost_credits == 1

    async def test_chat_history_limits_to_10_messages(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Чат должен хранить только последние 10 сообщений
        """
        from app.models.chat import ChatHistory
        from datetime import datetime

        # Create session with 12 messages
        messages = []
        for i in range(12):
            messages.append({
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"Message {i}",
                "timestamp": datetime.utcnow().isoformat()
            })

        session = ChatHistory(
            user_id=test_user_with_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=messages,
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        # Get session via API
        response = await authenticated_test_client.get(
            f"/api/v1/editing/sessions/{session.id}"
        )

        assert response.status_code == 200
        session_data = response.json()

        # Должны быть только последние 10 сообщений
        assert len(session_data["messages"]) == 10

        # Проверяем, что это действительно последние сообщения
        assert session_data["messages"][0]["content"] == "Message 2"
        assert session_data["messages"][-1]["content"] == "Message 11"


@pytest.mark.asyncio
@pytest.mark.integration
class TestChatSessionManagement:
    """Тесты управления чат-сессиями"""

    async def test_get_active_sessions_for_user(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Получение списка активных сессий пользователя
        """
        from app.models.chat import ChatHistory
        from datetime import datetime

        # Create 3 sessions
        for i in range(3):
            session = ChatHistory(
                user_id=test_user_with_credits.id,
                base_image_url=f"https://example.com/base_{i}.jpg",
                messages=[],
                is_active=True,
                created_at=datetime.utcnow(),
            )
            test_db.add(session)

        await test_db.commit()

        # Get sessions via API
        response = await authenticated_test_client.get("/api/v1/editing/sessions")

        assert response.status_code == 200
        sessions = response.json()

        assert len(sessions) >= 3

        # Verify structure
        for session_data in sessions:
            assert "session_id" in session_data
            assert "base_image_url" in session_data
            assert "message_count" in session_data
            assert "created_at" in session_data

    async def test_close_chat_session(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Закрытие чат-сессии
        """
        from app.models.chat import ChatHistory
        from datetime import datetime

        session = ChatHistory(
            user_id=test_user_with_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=[],
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        # Close session
        response = await authenticated_test_client.post(
            f"/api/v1/editing/sessions/{session.id}/close"
        )

        assert response.status_code == 200

        # Verify session is inactive
        await test_db.refresh(session)
        assert session.is_active is False

    async def test_cannot_send_message_to_closed_session(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Нельзя отправлять сообщения в закрытую сессию
        """
        from app.models.chat import ChatHistory
        from datetime import datetime

        # Create closed session
        session = ChatHistory(
            user_id=test_user_with_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=[],
            is_active=False,  # Closed
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        # Try to send message
        response = await authenticated_test_client.post(
            f"/api/v1/editing/sessions/{session.id}/message",
            json={"message": "This should fail"}
        )

        # Should return error
        assert response.status_code in [400, 403]


@pytest.mark.asyncio
@pytest.mark.integration
class TestEditingCreditsAndPayments:
    """Тесты списания кредитов в редактировании"""

    async def test_editing_costs_2_credits_total(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Полный цикл редактирования (сообщение + генерация) стоит 2 кредита
        """
        from app.models.chat import ChatHistory
        from datetime import datetime

        session = ChatHistory(
            user_id=test_user_with_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=[],
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        initial_credits = test_user_with_credits.balance_credits

        # Step 1: Send message (1 credit)
        with patch("app.services.openrouter_client.OpenRouterClient.generate_prompts") as mock_prompts:
            mock_prompts.return_value = ["prompt 1", "prompt 2", "prompt 3"]

            response = await authenticated_test_client.post(
                f"/api/v1/editing/sessions/{session.id}/message",
                json={"message": "Make brighter"}
            )

            assert response.status_code == 200

        await test_db.refresh(test_user_with_credits)
        assert test_user_with_credits.balance_credits == initial_credits - 1

        # Step 2: Generate image (1 credit)
        with patch("app.services.openrouter.OpenRouterClient.generate_image_edit") as mock_gen:
            mock_gen.return_value = {
                "image_url": "https://example.com/result.jpg",
                "task_id": "task-123"
            }

            response = await authenticated_test_client.post(
                f"/api/v1/editing/sessions/{session.id}/generate",
                json={"selected_prompt": "prompt 1"}
            )

            assert response.status_code == 200

        # Total: 2 credits spent
        await test_db.refresh(test_user_with_credits)
        assert test_user_with_credits.balance_credits == initial_credits - 2

    async def test_editing_fails_without_enough_credits(
        self,
        test_client: AsyncClient,
        test_db: AsyncSession,
    ):
        """
        Редактирование должно провалиться, если недостаточно кредитов
        """
        from app.models.user import User, SubscriptionType
        from app.models.chat import ChatHistory
        from app.utils.jwt import create_access_token
        from datetime import datetime

        # User with only 1 credit (need 2 for full cycle)
        user_low_credits = User(
            telegram_id=888777666,
            username="low_credits_user",
            first_name="Low",
            last_name="Credits",
            balance_credits=1,
            subscription_type=SubscriptionType.NONE,
            freemium_actions_used=10,
        )

        test_db.add(user_low_credits)
        await test_db.commit()
        await test_db.refresh(user_low_credits)

        # Create session
        session = ChatHistory(
            user_id=user_low_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=[],
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        token = create_access_token(
            data={
                "user_id": user_low_credits.id,
                "telegram_id": user_low_credits.telegram_id
            }
        )

        test_client.headers["Authorization"] = f"Bearer {token}"

        # Step 1: Send message (costs 1 credit - should succeed)
        with patch("app.services.openrouter_client.OpenRouterClient.generate_prompts") as mock_prompts:
            mock_prompts.return_value = ["p1", "p2", "p3"]

            response = await test_client.post(
                f"/api/v1/editing/sessions/{session.id}/message",
                json={"message": "Edit this"}
            )

            assert response.status_code == 200

        # Now user has 0 credits

        # Step 2: Try to generate (should fail - no credits)
        response = await test_client.post(
            f"/api/v1/editing/sessions/{session.id}/generate",
            json={"selected_prompt": "p1"}
        )

        assert response.status_code in [402, 403]


@pytest.mark.asyncio
@pytest.mark.integration
class TestErrorHandling:
    """Тесты обработки ошибок в Editing API"""

    async def test_handles_openrouter_api_failure(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        При ошибке OpenRouter API не должны списываться кредиты
        """
        from app.models.chat import ChatHistory
        from datetime import datetime

        session = ChatHistory(
            user_id=test_user_with_credits.id,
            base_image_url="https://example.com/base.jpg",
            messages=[],
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(session)
        await test_db.commit()
        await test_db.refresh(session)

        initial_credits = test_user_with_credits.balance_credits

        # Mock OpenRouter failure
        with patch("app.services.openrouter_client.OpenRouterClient.generate_prompts") as mock_prompts:
            mock_prompts.side_effect = Exception("OpenRouter API error")

            response = await authenticated_test_client.post(
                f"/api/v1/editing/sessions/{session.id}/message",
                json={"message": "Make brighter"}
            )

            # Should return error
            assert response.status_code >= 400

        # Credits should NOT be deducted
        await test_db.refresh(test_user_with_credits)
        assert test_user_with_credits.balance_credits == initial_credits

    async def test_cannot_access_other_users_session(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Пользователь не должен иметь доступ к чужим сессиям
        """
        from app.models.user import User, SubscriptionType
        from app.models.chat import ChatHistory
        from datetime import datetime

        # Create another user
        other_user = User(
            telegram_id=111000111,
            username="other_user",
            first_name="Other",
            last_name="User",
            balance_credits=100,
            subscription_type=SubscriptionType.NONE,
        )

        test_db.add(other_user)
        await test_db.commit()
        await test_db.refresh(other_user)

        # Create session for other user
        other_session = ChatHistory(
            user_id=other_user.id,
            base_image_url="https://example.com/other.jpg",
            messages=[],
            is_active=True,
            created_at=datetime.utcnow(),
        )

        test_db.add(other_session)
        await test_db.commit()
        await test_db.refresh(other_session)

        # Try to access other user's session
        response = await authenticated_test_client.get(
            f"/api/v1/editing/sessions/{other_session.id}"
        )

        # Should be forbidden
        assert response.status_code in [403, 404]
