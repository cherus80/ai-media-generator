"""
Pytest fixtures для тестов AI Generator.

Содержит общие фикстуры для:
- Mock объектов (DB, Redis, API clients)
- Тестовых данных (users, sessions, generations)
- Environment переменных
"""

import pytest
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, AsyncMock, MagicMock
from typing import Dict, Any

# Устанавливаем тестовые переменные окружения перед импортом app
os.environ["ENVIRONMENT"] = "testing"
os.environ["DEBUG"] = "True"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key"
os.environ["TELEGRAM_BOT_TOKEN"] = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
os.environ["TELEGRAM_BOT_SECRET"] = "test-bot-secret"
os.environ["OPENROUTER_API_KEY"] = "test-openrouter-key"
os.environ["YUKASSA_SHOP_ID"] = "test-shop-id"
os.environ["YUKASSA_SECRET_KEY"] = "test-yukassa-secret"
os.environ["YUKASSA_WEBHOOK_SECRET"] = "test-webhook-secret"
os.environ["ADMIN_SECRET_KEY"] = "test-admin-secret"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost/test"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"


# ==================== Mock Database ====================

@pytest.fixture
def mock_db_session():
    """Mock async database session"""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_db_engine():
    """Mock async database engine"""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    return engine


# ==================== Mock Redis ====================

@pytest.fixture
def mock_redis_client():
    """Mock Redis client"""
    redis = Mock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    redis.expire = AsyncMock(return_value=True)
    redis.publish = AsyncMock(return_value=1)
    return redis


# ==================== Mock API Clients ====================

@pytest.fixture
def mock_openrouter_client():
    """Mock OpenRouter API client"""
    client = Mock()
    client.generate_prompts = AsyncMock(
        return_value=[
            "Short prompt: make image brighter",
            "Medium prompt: enhance brightness and contrast of the image",
            "Detailed prompt: significantly increase the brightness levels and improve contrast ratio to make the image more vibrant"
        ]
    )
    return client


@pytest.fixture
def mock_yukassa_client():
    """Mock YuKassa API client"""
    client = Mock()
    client.create_payment = AsyncMock(
        return_value={
            "id": "test-payment-123",
            "status": "pending",
            "confirmation": {
                "type": "redirect",
                "confirmation_url": "https://example.com/pay"
            }
        }
    )
    client.get_payment_info = AsyncMock(
        return_value={
            "id": "test-payment-123",
            "status": "succeeded"
        }
    )
    client.verify_webhook_signature = Mock(return_value=True)
    return client


# ==================== Test Data ====================

@pytest.fixture
def test_user_data() -> Dict[str, Any]:
    """Test user data"""
    return {
        "id": 1,
        "telegram_id": 123456789,
        "username": "test_user",
        "first_name": "Test",
        "last_name": "User",
        "balance_credits": 100,
        "subscription_type": None,
        "subscription_expires_at": None,
        "freemium_actions_used": 0,
        "freemium_reset_at": datetime.utcnow() + timedelta(days=30),
        "referral_code": "TEST123",
        "referred_by_id": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


@pytest.fixture
def test_user(test_user_data):
    """Mock User model instance"""
    user = Mock()
    for key, value in test_user_data.items():
        setattr(user, key, value)

    # Methods
    user.can_use_freemium = Mock(return_value=True)
    user.reset_freemium_if_needed = Mock()

    return user


@pytest.fixture
def test_chat_session_data() -> Dict[str, Any]:
    """Test chat session data"""
    return {
        "id": "test-session-123",
        "user_id": 1,
        "base_image_url": "https://example.com/base.jpg",
        "messages": [],
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


@pytest.fixture
def test_chat_session(test_chat_session_data):
    """Mock ChatHistory model instance"""
    session = Mock()
    for key, value in test_chat_session_data.items():
        setattr(session, key, value)

    # Methods
    session.add_message = Mock()
    session.get_last_messages = Mock(return_value=[])
    session.get_messages_for_ai = Mock(return_value=[])
    session.reset = Mock()
    session.message_count = len(test_chat_session_data["messages"])

    return session


@pytest.fixture
def test_generation_data() -> Dict[str, Any]:
    """Test generation data"""
    return {
        "id": "test-gen-123",
        "user_id": 1,
        "task_id": "task-123",
        "generation_type": "fitting",
        "status": "completed",
        "input_image_url": "https://example.com/input.jpg",
        "output_image_url": "https://example.com/output.jpg",
        "prompt": "Try on sunglasses",
        "cost_credits": 2,
        "has_watermark": False,
        "error_message": None,
        "created_at": datetime.utcnow(),
        "completed_at": datetime.utcnow(),
    }


@pytest.fixture
def test_generation(test_generation_data):
    """Mock Generation model instance"""
    gen = Mock()
    for key, value in test_generation_data.items():
        setattr(gen, key, value)
    return gen


@pytest.fixture
def test_payment_data() -> Dict[str, Any]:
    """Test payment data"""
    return {
        "id": 1,
        "user_id": 1,
        "payment_id": "test-payment-123",
        "payment_type": "subscription",
        "subscription_type": "basic",
        "credits_amount": None,
        "amount": 399.0,
        "currency": "RUB",
        "status": "succeeded",
        "idempotency_key": "test-idempotency-123",
        "created_at": datetime.utcnow(),
        "completed_at": datetime.utcnow(),
    }


@pytest.fixture
def test_payment(test_payment_data):
    """Mock Payment model instance"""
    payment = Mock()
    for key, value in test_payment_data.items():
        setattr(payment, key, value)
    return payment


# ==================== Telegram Init Data ====================

@pytest.fixture
def valid_telegram_init_data() -> str:
    """Valid Telegram initData for testing"""
    # Simplified version - в реальном тесте нужно генерировать с правильным HMAC
    return "user=%7B%22id%22%3A123456789%2C%22username%22%3A%22test_user%22%7D&auth_date=1234567890&hash=valid_hash"


@pytest.fixture
def expired_telegram_init_data() -> str:
    """Expired Telegram initData"""
    # auth_date более 24 часов назад
    old_timestamp = int((datetime.utcnow() - timedelta(days=2)).timestamp())
    return f"user=%7B%22id%22%3A123456789%7D&auth_date={old_timestamp}&hash=some_hash"


# ==================== JWT Tokens ====================

@pytest.fixture
def valid_jwt_token() -> str:
    """Valid JWT token for testing"""
    from app.utils.jwt import create_access_token

    data = {"sub": "123456789", "type": "access"}
    return create_access_token(data, expires_delta=timedelta(minutes=60))


@pytest.fixture
def expired_jwt_token() -> str:
    """Expired JWT token"""
    from app.utils.jwt import create_access_token

    data = {"sub": "123456789", "type": "access"}
    return create_access_token(data, expires_delta=timedelta(seconds=-1))


# ==================== File Mocks ====================

@pytest.fixture
def mock_uploaded_file():
    """Mock UploadFile for testing"""
    file = Mock()
    file.filename = "test_image.jpg"
    file.content_type = "image/jpeg"
    file.file = Mock()
    file.file.read = AsyncMock(return_value=b"\xff\xd8\xff\xe0")  # JPEG magic bytes
    file.file.seek = Mock()
    return file


@pytest.fixture
def mock_invalid_file():
    """Mock invalid file (not an image)"""
    file = Mock()
    file.filename = "test_file.txt"
    file.content_type = "text/plain"
    file.file = Mock()
    file.file.read = AsyncMock(return_value=b"not an image")
    file.file.seek = Mock()
    return file


# ==================== Environment ====================

@pytest.fixture
def test_env_vars():
    """Test environment variables"""
    return {
        "ENVIRONMENT": "testing",
        "DEBUG": "True",
        "SECRET_KEY": "test-secret-key",
        "JWT_SECRET_KEY": "test-jwt-secret",
        "TELEGRAM_BOT_TOKEN": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
        "TELEGRAM_BOT_SECRET": "test-bot-secret",
    }


# ==================== Test Database (для integration тестов) ====================

# Test database URL
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_image_bot_test"
)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db():
    """
    Create a test database session for integration tests.

    Creates all tables before test, yields session, drops tables after.
    Requires PostgreSQL test database to be available.
    """
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy.pool import NullPool
    from app.db.base import Base

    # Create test engine (no connection pooling)
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    # Create all tables (skip tests if DB is unavailable)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        await engine.dispose()
        pytest.skip(f"PostgreSQL test DB unavailable: {exc}")

    # Create session factory
    TestSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Yield session for test
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()

    # Drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    # Dispose engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def test_client(test_db):
    """
    Create a test HTTP client with test database dependency override.
    """
    from httpx import AsyncClient
    from app.main import app
    from app.db.session import get_db

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ==================== Test Users (для integration тестов) ====================

@pytest.fixture
async def test_user_with_credits(test_db):
    """Create a real test user with 50 credits in test database."""
    from app.models.user import User

    user = User(
        telegram_id=123456789,
        username="test_user_credits",
        first_name="Test",
        last_name="User",
        balance_credits=50,
        subscription_type=None,
        freemium_actions_used=0,
        freemium_reset_at=datetime.utcnow(),
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def test_user_premium(test_db):
    """Create a test user with Premium subscription."""
    from app.models.user import User, SubscriptionType

    user = User(
        telegram_id=987654321,
        username="premium_tester",
        first_name="Premium",
        last_name="Tester",
        balance_credits=0,
        subscription_type=SubscriptionType.PREMIUM,
        subscription_end=datetime.now(timezone.utc) + timedelta(days=30),
        subscription_ops_limit=150,
        subscription_ops_used=0,
        subscription_ops_reset_at=datetime.utcnow(),
        freemium_actions_used=0,
        freemium_reset_at=datetime.utcnow(),
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def test_user_freemium_only(test_db):
    """Create a Freemium-only test user (5/10 actions used)."""
    from app.models.user import User

    user = User(
        telegram_id=111222333,
        username="freemium_tester",
        first_name="Freemium",
        last_name="Tester",
        balance_credits=0,
        subscription_type=None,
        freemium_actions_used=5,
        freemium_reset_at=datetime.utcnow(),
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def authenticated_test_client(test_client, test_user_with_credits):
    """
    Create an authenticated test client with JWT token.
    """
    from app.utils.jwt import create_access_token

    token = create_access_token(
        data={
            "user_id": test_user_with_credits.id,
            "telegram_id": test_user_with_credits.telegram_id
        }
    )

    test_client.headers["Authorization"] = f"Bearer {token}"

    return test_client


# ==================== Helper Fixtures ====================

@pytest.fixture
def sample_jpeg_bytes() -> bytes:
    """Minimal valid JPEG image (1x1 pixel)."""
    return (
        b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c'
        b'\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c'
        b'\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00'
        b'\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00'
        b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xda\x00\x08\x01'
        b'\x01\x00\x00?\x00\x7f\xd9'
    )


@pytest.fixture
def sample_png_bytes() -> bytes:
    """Minimal valid PNG image (1x1 pixel)."""
    return (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\x00\x01\x00'
        b'\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    )


# ==================== Billing v5 Fixtures ====================

@pytest.fixture
async def test_user_with_subscription_v5(test_db):
    """Create a test user with active subscription (Billing v5)."""
    from app.models.user import User, SubscriptionType, UserRole

    user = User(
        email="sub_user@example.com",
        first_name="Subscription",
        last_name="User",
        balance_credits=10,
        subscription_type=SubscriptionType.BASIC,
        subscription_end=datetime.now(timezone.utc) + timedelta(days=30),
        subscription_ops_limit=30,
        subscription_ops_used=10,
        subscription_ops_reset_at=datetime.utcnow(),
        freemium_actions_used=0,
        freemium_reset_at=datetime.utcnow(),
        role=UserRole.USER,
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def test_user_freemium_v5(test_db):
    """Create a test user with only freemium (Billing v5)."""
    from app.models.user import User, UserRole

    user = User(
        email="freemium_v5@example.com",
        first_name="Freemium",
        last_name="User",
        balance_credits=0,
        subscription_type=None,
        subscription_ops_limit=0,
        subscription_ops_used=0,
        subscription_ops_reset_at=None,
        freemium_actions_used=2,
        freemium_reset_at=datetime.utcnow(),
        role=UserRole.USER,
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def test_user_credits_only_v5(test_db):
    """Create a test user with only credits (Billing v5)."""
    from app.models.user import User, UserRole

    user = User(
        email="credits_v5@example.com",
        first_name="Credits",
        last_name="User",
        balance_credits=20,
        subscription_type=None,
        subscription_ops_limit=0,
        subscription_ops_used=0,
        subscription_ops_reset_at=None,
        freemium_actions_used=5,  # Freemium exhausted
        freemium_reset_at=datetime.utcnow(),
        role=UserRole.USER,
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def test_user_no_funds_v5(test_db):
    """Create a test user with no funds (Billing v5)."""
    from app.models.user import User, UserRole

    user = User(
        email="nofunds_v5@example.com",
        first_name="NoFunds",
        last_name="User",
        balance_credits=0,
        subscription_type=None,
        subscription_ops_limit=0,
        subscription_ops_used=0,
        subscription_ops_reset_at=None,
        freemium_actions_used=5,  # Freemium exhausted
        freemium_reset_at=datetime.utcnow(),
        role=UserRole.USER,
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def test_admin_user_v5(test_db):
    """Create an admin test user (Billing v5)."""
    from app.models.user import User, UserRole

    user = User(
        email="admin_v5@example.com",
        first_name="Admin",
        last_name="User",
        balance_credits=0,
        subscription_type=None,
        subscription_ops_limit=0,
        subscription_ops_used=0,
        freemium_actions_used=0,
        role=UserRole.ADMIN,
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


@pytest.fixture
async def test_user_expired_subscription_v5(test_db):
    """Create a test user with expired subscription (Billing v5)."""
    from app.models.user import User, SubscriptionType, UserRole

    user = User(
        email="expired_sub_v5@example.com",
        first_name="Expired",
        last_name="Subscription",
        balance_credits=0,
        subscription_type=SubscriptionType.PREMIUM,
        subscription_end=datetime.now(timezone.utc) - timedelta(days=5),  # Expired
        subscription_ops_limit=120,
        subscription_ops_used=60,
        subscription_ops_reset_at=datetime.utcnow() - timedelta(days=35),
        freemium_actions_used=1,
        freemium_reset_at=datetime.utcnow(),
        role=UserRole.USER,
    )

    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)

    return user


# ==================== Cleanup ====================

@pytest.fixture(autouse=True)
def cleanup_after_test():
    """Cleanup after each test"""
    yield
    # Cleanup code here if needed
    pass


# ==================== Pytest Markers ====================

def pytest_configure(config):
    """Configure custom pytest markers"""
    config.addinivalue_line("markers", "unit: mark test as a unit test")
    config.addinivalue_line("markers", "integration: mark test as an integration test")
    config.addinivalue_line("markers", "slow: mark test as slow")
    config.addinivalue_line("markers", "auth: mark test as authentication related")
    config.addinivalue_line("markers", "payments: mark test as payment related")
    config.addinivalue_line("markers", "file: mark test as file handling related")
    config.addinivalue_line("markers", "credits: mark test as credits management related")
    config.addinivalue_line("markers", "chat: mark test as chat/messaging related")
    config.addinivalue_line("markers", "billing: mark test as billing v5 related")
