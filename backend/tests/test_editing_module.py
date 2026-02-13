"""
Unit tests для модуля редактирования изображений.

Тестирует:
- OpenRouter клиент
- Chat сервис
- Pydantic схемы
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime


class TestPydanticSchemas:
    """Тесты для Pydantic схем editing"""

    def test_chat_session_create_valid(self):
        """Тест создания валидной сессии"""
        from app.schemas.editing import ChatSessionCreate

        session = ChatSessionCreate(
            base_image_url="https://example.com/image.jpg"
        )

        assert session.base_image_url == "https://example.com/image.jpg"

    def test_chat_session_create_without_base_image(self):
        """Тест создания сессии без базового изображения (text-to-image режим)"""
        from app.schemas.editing import ChatSessionCreate

        session = ChatSessionCreate()

        assert session.base_image_url is None

    def test_chat_message_request_valid(self):
        """Тест валидного запроса сообщения"""
        from app.schemas.editing import ChatMessageRequest

        request = ChatMessageRequest(
            session_id="test-uuid-123",
            message="Make the image brighter"
        )

        assert request.session_id == "test-uuid-123"
        assert request.message == "Make the image brighter"

    def test_generate_image_request_allows_missing_session(self):
        """Тест генерации без session_id (одноразовая text-to-image генерация)"""
        from app.schemas.editing import GenerateImageRequest

        request = GenerateImageRequest(
            prompt="Generate a cinematic portrait"
        )

        assert request.session_id is None
        assert request.prompt == "Generate a cinematic portrait"

    def test_chat_message_response_role_validation(self):
        """Тест валидации роли в ответе"""
        from app.schemas.editing import ChatMessageResponse
        from pydantic import ValidationError

        # Валидные роли
        response1 = ChatMessageResponse(
            role="user",
            content="test",
            timestamp=datetime.now().isoformat()
        )
        assert response1.role == "user"

        response2 = ChatMessageResponse(
            role="assistant",
            content="test",
            prompts=["prompt1", "prompt2", "prompt3"],
            timestamp=datetime.now().isoformat()
        )
        assert response2.role == "assistant"

        # Невалидная роль
        with pytest.raises(ValidationError):
            ChatMessageResponse(
                role="invalid",
                content="test",
                timestamp=datetime.now().isoformat()
            )


class TestOpenRouterClient:
    """Тесты для OpenRouter клиента"""

    @pytest.mark.asyncio
    async def test_client_initialization(self):
        """Тест инициализации клиента"""
        from app.services.openrouter import OpenRouterClient

        client = OpenRouterClient(
            api_key="test_key",
            model="test-model"
        )

        assert client.api_key == "test_key"
        assert client.model == "test-model"
        await client.close()

    @pytest.mark.asyncio
    async def test_generate_prompts_success(self):
        """Тест успешной генерации промптов"""
        from app.services.openrouter import OpenRouterClient

        client = OpenRouterClient(api_key="test_key")

        # Mock httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": '{"prompts": ["Short prompt", "Medium prompt with details", "Detailed prompt with more information"]}'
                }
            }],
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150
            }
        }

        with patch.object(client.client, 'post', new=AsyncMock(return_value=mock_response)):
            prompt = await client.generate_prompts(
                user_message="Make the sky bluer",
                chat_history=[]
            )

            assert prompt == "Short prompt"

        await client.close()

    @pytest.mark.asyncio
    async def test_generate_prompts_fallback(self):
        """Тест fallback при некорректном ответе от AI"""
        from app.services.openrouter import OpenRouterClient

        client = OpenRouterClient(api_key="test_key")

        # Mock invalid JSON response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": '{"prompts": []}'
                }
            }],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
        }

        with patch.object(client.client, 'post', new=AsyncMock(return_value=mock_response)):
            prompt = await client.generate_prompts(
                user_message="Test message",
                chat_history=[]
            )

            assert prompt == "Test message"

        await client.close()


class TestChatService:
    """Тесты для chat сервиса (без реальной БД)"""

    def test_chat_session_not_found_error(self):
        """Тест ошибки ChatSessionNotFoundError"""
        from app.services.chat import ChatSessionNotFoundError

        with pytest.raises(ChatSessionNotFoundError):
            raise ChatSessionNotFoundError("Session not found")

    def test_chat_session_inactive_error(self):
        """Тест ошибки ChatSessionInactiveError"""
        from app.services.chat import ChatSessionInactiveError

        with pytest.raises(ChatSessionInactiveError):
            raise ChatSessionInactiveError("Session is inactive")


class TestChatModel:
    """Тесты для методов модели ChatHistory"""

    def test_add_message(self):
        """Тест добавления сообщения"""
        from app.models.chat import ChatHistory

        chat = ChatHistory(
            user_id=1,
            session_id="test-123",
            base_image_url="https://example.com/image.jpg",
            messages=[],
            is_active=True
        )

        chat.add_message(
            role="user",
            content="Test message"
        )

        assert len(chat.messages) == 1
        assert chat.messages[0]["role"] == "user"
        assert chat.messages[0]["content"] == "Test message"
        assert "timestamp" in chat.messages[0]

    def test_get_last_n_messages(self):
        """Тест получения последних N сообщений"""
        from app.models.chat import ChatHistory

        chat = ChatHistory(
            user_id=1,
            session_id="test-123",
            messages=[],
            is_active=True
        )

        # Добавляем 15 сообщений
        for i in range(15):
            chat.add_message(
                role="user" if i % 2 == 0 else "assistant",
                content=f"Message {i}"
            )

        # Получаем последние 10
        last_10 = chat.get_last_n_messages(10)

        assert len(last_10) == 10
        assert last_10[0]["content"] == "Message 5"
        assert last_10[-1]["content"] == "Message 14"

    def test_get_messages_for_ai(self):
        """Тест форматирования для AI API"""
        from app.models.chat import ChatHistory

        chat = ChatHistory(
            user_id=1,
            session_id="test-123",
            messages=[],
            is_active=True
        )

        chat.add_message(role="user", content="Hello")
        chat.add_message(role="assistant", content="Hi there")

        ai_messages = chat.get_messages_for_ai()

        assert len(ai_messages) == 2
        assert ai_messages[0] == {"role": "user", "content": "Hello"}
        assert ai_messages[1] == {"role": "assistant", "content": "Hi there"}
        # Проверяем, что timestamp не включается (только role + content)
        assert "timestamp" not in ai_messages[0]

    def test_reset_session(self):
        """Тест сброса сессии"""
        from app.models.chat import ChatHistory

        chat = ChatHistory(
            user_id=1,
            session_id="test-123",
            messages=[{"role": "user", "content": "Test"}],
            is_active=True
        )

        chat.reset()

        assert chat.messages == []
        assert chat.is_active == False

    def test_message_count_property(self):
        """Тест свойства message_count"""
        from app.models.chat import ChatHistory

        chat = ChatHistory(
            user_id=1,
            session_id="test-123",
            messages=[],
            is_active=True
        )

        assert chat.message_count == 0

        chat.add_message(role="user", content="Test 1")
        assert chat.message_count == 1

        chat.add_message(role="assistant", content="Test 2")
        assert chat.message_count == 2


def test_imports():
    """Тест что все необходимые модули импортируются"""

    # Schemas
    from app.schemas.editing import (
        ChatSessionCreate,
        ChatSessionResponse,
        ChatMessageRequest,
        ChatMessageResponse,
        GenerateImageRequest,
        GenerateImageResponse,
    )

    # Services
    from app.services.openrouter import OpenRouterClient, get_openrouter_client
    from app.services.chat import (
        create_chat_session,
        get_chat_session,
        add_message,
        reset_session,
    )

    # Models
    from app.models.chat import ChatHistory

    # API
    from app.api.v1.endpoints.editing import router

    assert True  # Если дошли сюда - все импорты успешны


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
