from datetime import datetime, timedelta, timezone

import pytest

from app.models.activation_event import ActivationEvent
from app.models.generation import Generation, GenerationType
from app.models.user import User, UserRole
from app.services.activation_events import record_activation_event, record_first_generate_success
from app.utils.jwt import create_user_access_token


@pytest.fixture
async def activation_user(test_db):
    user = User(
        email="activation@example.com",
        email_verified=True,
        username="activation_user",
        auth_provider="email",
        balance_credits=6,
        freemium_actions_used=0,
        freemium_reset_at=datetime.now(timezone.utc),
        is_active=True,
        is_banned=False,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
async def admin_client(test_client, test_db):
    admin = User(
        email="admin@example.com",
        email_verified=True,
        username="admin_user",
        auth_provider="email",
        role=UserRole.ADMIN,
        balance_credits=0,
        freemium_actions_used=0,
        freemium_reset_at=datetime.now(timezone.utc),
        is_active=True,
        is_banned=False,
    )
    test_db.add(admin)
    await test_db.commit()
    await test_db.refresh(admin)

    token = create_user_access_token(user_id=admin.id, email=admin.email)
    test_client.headers["Authorization"] = f"Bearer {token}"
    return test_client


@pytest.mark.asyncio
@pytest.mark.integration
async def test_activation_state_returns_completed_generation_snapshot(test_client, test_db, activation_user):
    token = create_user_access_token(user_id=activation_user.id, email=activation_user.email)
    test_client.headers["Authorization"] = f"Bearer {token}"

    response = await test_client.get("/api/v1/activation/state")
    assert response.status_code == 200
    assert response.json()["completed_generations_count"] == 0
    assert response.json()["is_activated"] is False

    generation = Generation(
        user_id=activation_user.id,
        type=GenerationType.EDITING,
        prompt="make it brighter",
        status="completed",
        progress=100,
        image_url="/uploads/result.webp",
    )
    test_db.add(generation)
    await test_db.commit()

    response = await test_client.get("/api/v1/activation/state")
    assert response.status_code == 200
    assert response.json()["completed_generations_count"] == 1
    assert response.json()["is_activated"] is True


@pytest.mark.asyncio
@pytest.mark.integration
async def test_frontend_activation_event_deduplicates_first_only_event(test_client, test_db, activation_user):
    token = create_user_access_token(user_id=activation_user.id, email=activation_user.email)
    test_client.headers["Authorization"] = f"Bearer {token}"

    payload = {
        "event_name": "onboarding_start",
        "session_id": "sess-1",
        "flow_id": "flow-1",
        "route": "/app",
        "entry_source": "activation_onboarding",
        "utm_source": "telegram",
        "referral_code": "REF123",
    }

    first = await test_client.post("/api/v1/activation/events", json=payload)
    second = await test_client.post("/api/v1/activation/events", json=payload)

    assert first.status_code == 202
    assert first.json()["recorded"] is True
    assert second.status_code == 202
    assert second.json()["recorded"] is False
    assert second.json()["deduplicated"] is True

    rows = (await test_db.execute(
        ActivationEvent.__table__.select().where(ActivationEvent.user_id == activation_user.id)
    )).all()
    assert len(rows) == 1


@pytest.mark.asyncio
@pytest.mark.integration
async def test_record_first_generate_success_uses_context_from_generate_click(test_db, activation_user):
    await record_activation_event(
        test_db,
        event_name="first_generate_click",
        user_id=activation_user.id,
        session_id="sess-42",
        flow_id="flow-42",
        route="/app/examples/generate",
        entry_source="activation_onboarding",
        timestamp=datetime.now(timezone.utc) - timedelta(seconds=5),
    )
    await test_db.commit()

    generation = Generation(
        user_id=activation_user.id,
        type=GenerationType.EDITING,
        prompt="prompt",
        status="completed",
        progress=100,
        image_url="/uploads/generated.webp",
    )
    test_db.add(generation)
    await test_db.commit()
    await test_db.refresh(generation)

    recorded = await record_first_generate_success(test_db, generation=generation)
    await test_db.commit()

    assert recorded is True

    row = (await test_db.execute(
        ActivationEvent.__table__.select().where(ActivationEvent.event_name == "first_generate_success")
    )).mappings().one()
    assert row["session_id"] == "sess-42"
    assert row["flow_id"] == "flow-42"
    assert row["entry_source"] == "activation_onboarding"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_admin_activation_metrics_endpoint_returns_activation_rate_and_ttfg(admin_client, test_db):
    user1 = User(
        email="u1@example.com",
        email_verified=True,
        username="u1",
        auth_provider="email",
        balance_credits=0,
        freemium_actions_used=0,
        freemium_reset_at=datetime.now(timezone.utc),
        is_active=True,
        is_banned=False,
        created_at=datetime(2026, 3, 21, 10, 0, tzinfo=timezone.utc),
    )
    user2 = User(
        email="u2@example.com",
        email_verified=True,
        username="u2",
        auth_provider="email",
        balance_credits=0,
        freemium_actions_used=0,
        freemium_reset_at=datetime.now(timezone.utc),
        is_active=True,
        is_banned=False,
        created_at=datetime(2026, 3, 21, 11, 0, tzinfo=timezone.utc),
    )
    test_db.add_all([user1, user2])
    await test_db.commit()
    await test_db.refresh(user1)
    await test_db.refresh(user2)

    await record_activation_event(
        test_db,
        event_name="register_success",
        user_id=user1.id,
        timestamp=datetime(2026, 3, 21, 10, 0, tzinfo=timezone.utc),
    )
    await record_activation_event(
        test_db,
        event_name="register_success",
        user_id=user2.id,
        timestamp=datetime(2026, 3, 21, 11, 0, tzinfo=timezone.utc),
    )
    await record_activation_event(
        test_db,
        event_name="first_generate_success",
        user_id=user1.id,
        timestamp=datetime(2026, 3, 21, 10, 5, tzinfo=timezone.utc),
    )
    await test_db.commit()

    response = await admin_client.get("/api/v1/activation/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["register_success_count"] == 2
    assert data["first_generate_success_count"] == 1
    assert data["activation_rate"] == 0.5
    assert data["time_to_first_generate"]["p50_seconds"] == 300
