from pydantic import ValidationError

from app.schemas.auth_web import RegisterRequest


def test_register_request_allows_simple_password():
    payload = RegisterRequest(
        email="user@example.com",
        password="simple",
    )

    assert payload.password == "simple"


def test_register_request_rejects_empty_password():
    try:
        RegisterRequest(
            email="user@example.com",
            password="",
        )
    except ValidationError as exc:
        assert "at least 1 character" in str(exc)
    else:
        raise AssertionError("Empty password must be rejected")
