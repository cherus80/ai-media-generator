"""
Integration тесты для Fitting API endpoints

Требует запущенную test database.
Запуск: pytest tests/test_fitting_integration.py -v

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
from app.models.generation import Generation


@pytest.mark.asyncio
@pytest.mark.integration
class TestFittingWorkflow:
    """Integration тесты для полного workflow примерки одежды"""

    async def test_complete_fitting_workflow_with_credits(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
        sample_jpeg_bytes: bytes,
    ):
        """
        Полный workflow примерки:
        1. Upload user image
        2. Upload garment image
        3. Generate fitting
        4. Check credits deducted
        5. Check generation saved
        """
        # Mock OpenRouter API
        with patch("app.services.openrouter.OpenRouterClient.generate_virtual_tryon") as mock_generate:
            mock_generate.return_value = {
                "image_url": "https://example.com/result.jpg",
                "task_id": "test-task-123"
            }

            # Step 1: Upload user image
            user_image = BytesIO(sample_jpeg_bytes)

            response = await authenticated_test_client.post(
                "/api/v1/fitting/upload-user-image",
                files={"file": ("user.jpg", user_image, "image/jpeg")}
            )

            assert response.status_code == 200
            user_image_data = response.json()
            assert "file_url" in user_image_data
            user_image_url = user_image_data["file_url"]

            # Step 2: Upload garment image
            garment_image = BytesIO(sample_jpeg_bytes)

            response = await authenticated_test_client.post(
                "/api/v1/fitting/upload-garment-image",
                files={"file": ("garment.jpg", garment_image, "image/jpeg")}
            )

            assert response.status_code == 200
            garment_data = response.json()
            assert "file_url" in garment_data
            garment_url = garment_data["file_url"]

            # Check initial credits
            initial_credits = test_user_with_credits.balance_credits

            # Step 3: Generate fitting
            response = await authenticated_test_client.post(
                "/api/v1/fitting/generate",
                json={
                    "user_image_url": user_image_url,
                    "garment_image_url": garment_url,
                    "garment_type": "sunglasses"
                }
            )

            assert response.status_code == 200
            result = response.json()

            assert "generation_id" in result
            assert "result_image_url" in result
            assert result["result_image_url"] == "https://example.com/result.jpg"

            # Step 4: Verify credits deducted
            await test_db.refresh(test_user_with_credits)

            # Fitting costs 2 credits
            assert test_user_with_credits.balance_credits == initial_credits - 2

            # Step 5: Verify generation saved in DB
            from sqlalchemy import select
            stmt = select(Generation).where(Generation.id == result["generation_id"])
            gen_result = await test_db.execute(stmt)
            generation = gen_result.scalar_one_or_none()

            assert generation is not None
            assert generation.user_id == test_user_with_credits.id
            assert generation.generation_type == "fitting"
            assert generation.status == "completed"
            assert generation.cost_credits == 2

    async def test_fitting_fails_without_credits(
        self,
        test_client: AsyncClient,
        test_db: AsyncSession,
        sample_jpeg_bytes: bytes,
    ):
        """
        Примерка должна провалиться, если у пользователя нет кредитов
        """
        from app.models.user import User, SubscriptionType
        from app.utils.jwt import create_access_token

        # Создаём пользователя без кредитов и без подписки
        user_no_credits = User(
            telegram_id=999888777,
            username="broke_user",
            first_name="Broke",
            last_name="User",
            balance_credits=0,
            subscription_type=SubscriptionType.NONE,
            freemium_actions_used=10,  # Freemium исчерпан
        )

        test_db.add(user_no_credits)
        await test_db.commit()
        await test_db.refresh(user_no_credits)

        # Создаём токен
        token = create_access_token(
            data={
                "user_id": user_no_credits.id,
                "telegram_id": user_no_credits.telegram_id
            }
        )

        test_client.headers["Authorization"] = f"Bearer {token}"

        # Пытаемся сгенерировать
        response = await test_client.post(
            "/api/v1/fitting/generate",
            json={
                "user_image_url": "https://example.com/user.jpg",
                "garment_image_url": "https://example.com/garment.jpg",
                "garment_type": "sunglasses"
            }
        )

        # Должна вернуться ошибка 402 Payment Required или 403 Forbidden
        assert response.status_code in [402, 403]
        data = response.json()
        assert "detail" in data

    async def test_fitting_with_freemium_adds_watermark(
        self,
        test_client: AsyncClient,
        test_user_freemium_only: User,
        test_db: AsyncSession,
    ):
        """
        Примерка в рамках Freemium должна добавлять водяной знак
        """
        from app.utils.jwt import create_access_token

        token = create_access_token(
            data={
                "user_id": test_user_freemium_only.id,
                "telegram_id": test_user_freemium_only.telegram_id
            }
        )

        test_client.headers["Authorization"] = f"Bearer {token}"

        with patch("app.services.openrouter.OpenRouterClient.generate_virtual_tryon") as mock_generate:
            mock_generate.return_value = {
                "image_url": "https://example.com/result.jpg",
                "task_id": "test-task-freemium"
            }

            response = await test_client.post(
                "/api/v1/fitting/generate",
                json={
                    "user_image_url": "https://example.com/user.jpg",
                    "garment_image_url": "https://example.com/garment.jpg",
                    "garment_type": "sunglasses"
                }
            )

            assert response.status_code == 200
            result = response.json()

            # Проверяем, что в БД сохранено с водяным знаком
            from sqlalchemy import select
            stmt = select(Generation).where(Generation.id == result["generation_id"])
            gen_result = await test_db.execute(stmt)
            generation = gen_result.scalar_one_or_none()

            assert generation is not None
            assert generation.has_watermark is True

    async def test_fitting_with_premium_subscription(
        self,
        test_client: AsyncClient,
        test_user_premium: User,
        test_db: AsyncSession,
    ):
        """
        Примерка для Premium пользователя должна списывать действие из подписки
        """
        from app.utils.jwt import create_access_token

        token = create_access_token(
            data={
                "user_id": test_user_premium.id,
                "telegram_id": test_user_premium.telegram_id
            }
        )

        test_client.headers["Authorization"] = f"Bearer {token}"

        initial_actions = test_user_premium.subscription_actions_left

        with patch("app.services.openrouter.OpenRouterClient.generate_virtual_tryon") as mock_generate:
            mock_generate.return_value = {
                "image_url": "https://example.com/premium_result.jpg",
                "task_id": "premium-task-123"
            }

            response = await test_client.post(
                "/api/v1/fitting/generate",
                json={
                    "user_image_url": "https://example.com/user.jpg",
                    "garment_image_url": "https://example.com/garment.jpg",
                    "garment_type": "dress"
                }
            )

            assert response.status_code == 200

            # Проверяем, что действие списано из подписки
            await test_db.refresh(test_user_premium)

            assert test_user_premium.subscription_actions_left == initial_actions - 1

            # Кредиты не должны списываться
            assert test_user_premium.balance_credits == 0


@pytest.mark.asyncio
@pytest.mark.integration
class TestFileValidation:
    """Тесты валидации загружаемых файлов"""

    async def test_upload_invalid_file_type(
        self,
        authenticated_test_client: AsyncClient,
    ):
        """
        Загрузка файла неправильного типа должна провалиться
        """
        # Создаём текстовый файл вместо изображения
        text_file = BytesIO(b"This is not an image")

        response = await authenticated_test_client.post(
            "/api/v1/fitting/upload-user-image",
            files={"file": ("text.txt", text_file, "text/plain")}
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    async def test_upload_file_exceeds_size_limit(
        self,
        authenticated_test_client: AsyncClient,
    ):
        """
        Загрузка файла размером > 5MB должна провалиться
        """
        # Создаём файл размером > 5MB
        large_file = BytesIO(b"x" * (6 * 1024 * 1024))  # 6MB

        response = await authenticated_test_client.post(
            "/api/v1/fitting/upload-user-image",
            files={"file": ("large.jpg", large_file, "image/jpeg")}
        )

        # Должна вернуться ошибка
        assert response.status_code == 413 or response.status_code == 400

    async def test_upload_valid_png_image(
        self,
        authenticated_test_client: AsyncClient,
        sample_png_bytes: bytes,
    ):
        """
        Загрузка валидного PNG изображения должна работать
        """
        png_file = BytesIO(sample_png_bytes)

        response = await authenticated_test_client.post(
            "/api/v1/fitting/upload-user-image",
            files={"file": ("image.png", png_file, "image/png")}
        )

        assert response.status_code == 200
        data = response.json()
        assert "file_url" in data


@pytest.mark.asyncio
@pytest.mark.integration
class TestGarmentTypes:
    """Тесты разных типов одежды"""

    @pytest.mark.parametrize("garment_type", [
        "sunglasses",
        "hat",
        "scarf",
        "earrings",
        "necklace",
    ])
    async def test_fitting_with_different_garment_types(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        garment_type: str,
    ):
        """
        Примерка должна работать для разных типов одежды/аксессуаров
        """
        with patch("app.services.openrouter.OpenRouterClient.generate_virtual_tryon") as mock_generate:
            mock_generate.return_value = {
                "image_url": f"https://example.com/{garment_type}_result.jpg",
                "task_id": f"task-{garment_type}"
            }

            response = await authenticated_test_client.post(
                "/api/v1/fitting/generate",
                json={
                    "user_image_url": "https://example.com/user.jpg",
                    "garment_image_url": "https://example.com/garment.jpg",
                    "garment_type": garment_type
                }
            )

            assert response.status_code == 200
            result = response.json()
            assert "generation_id" in result
            assert "result_image_url" in result


@pytest.mark.asyncio
@pytest.mark.integration
class TestErrorHandling:
    """Тесты обработки ошибок"""

    async def test_fitting_handles_openrouter_api_failure(
        self,
        authenticated_test_client: AsyncClient,
        test_user_with_credits: User,
        test_db: AsyncSession,
    ):
        """
        Если OpenRouter API падает, должна сохраниться ошибка в generation
        """
        # Mock OpenRouter API failure
        with patch("app.services.openrouter.OpenRouterClient.generate_virtual_tryon") as mock_generate:
            mock_generate.side_effect = Exception("OpenRouter API error")

            initial_credits = test_user_with_credits.balance_credits

            response = await authenticated_test_client.post(
                "/api/v1/fitting/generate",
                json={
                    "user_image_url": "https://example.com/user.jpg",
                    "garment_image_url": "https://example.com/garment.jpg",
                    "garment_type": "sunglasses"
                }
            )

            # API может вернуть 500 или 400
            assert response.status_code >= 400

            # Кредиты НЕ должны списаться при ошибке
            await test_db.refresh(test_user_with_credits)
            assert test_user_with_credits.balance_credits == initial_credits

    async def test_missing_required_fields(
        self,
        authenticated_test_client: AsyncClient,
    ):
        """
        Запрос без обязательных полей должен вернуть 422
        """
        response = await authenticated_test_client.post(
            "/api/v1/fitting/generate",
            json={
                # Не указан garment_type
                "user_image_url": "https://example.com/user.jpg",
                "garment_image_url": "https://example.com/garment.jpg",
            }
        )

        assert response.status_code == 422
