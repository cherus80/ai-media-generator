import pytest


@pytest.mark.asyncio
async def test_register_accepts_short_simple_password(test_client):
    response = await test_client.post(
        "/api/v1/auth-web/register",
        json={
            "email": "shortpass@example.com",
            "password": "simple",
            "consent_version": "v1",
        },
    )

    assert response.status_code == 201, response.text

    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "shortpass@example.com"
    assert data["user"]["auth_provider"] == "email"
