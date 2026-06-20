"""Test rate limiting on auth endpoints."""
import pytest
from fastapi import status

from app.core.limiter import limiter


@pytest.fixture(autouse=True)
def enable_limiter():
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.enabled = False
    limiter.reset()


def test_login_rate_limiting(client):
    """Test that login endpoint is rate limited to 5 requests per minute."""
    login_data = {"email": "test@example.com", "password": "wrongpassword"}

    # First 5 requests should work (or fail with 401 for wrong credentials)
    for _ in range(5):
        response = client.post(
            "api/v1/auth/login", json=login_data, headers={"X-Forwarded-For": "1.1.1.1"}
        )
        # Should either be 401 (wrong password) or 200 (if user exists)
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_200_OK,
        ]

    # 6th request should trigger rate limit (429)
    response = client.post(
        "api/v1/auth/login", json=login_data, headers={"X-Forwarded-For": "1.1.1.1"}
    )
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in response.headers


def test_register_rate_limiting(client):
    """Test that register endpoint is rate limited to 3 requests per hour."""
    register_data = {
        "email": "test@example.com",
        "password": "StrongPass1!",
        "role": "client",
        "full_name": "Test User",
        "phone": "1234567890",
    }

    # First 3 requests should work (or fail with 400 for duplicate email)
    for _ in range(3):
        # Use different emails to avoid duplicate errors
        register_data["email"] = f"test{_}@example.com"
        response = client.post(
            "api/v1/auth/register",
            json=register_data,
            headers={"X-Forwarded-For": "2.2.2.2"},
        )
        # Should either be 201 (success) or 400 (duplicate email)
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST,
        ]

    # 4th request should trigger rate limit (429)
    register_data["email"] = "test4@example.com"
    response = client.post(
        "api/v1/auth/register",
        json=register_data,
        headers={"X-Forwarded-For": "2.2.2.2"},
    )
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in response.headers


def test_refresh_rate_limiting(client):
    """Test that refresh endpoint is rate limited to 10 requests per minute."""
    # First create a user and login to get tokens
    register_data = {
        "email": "refresh@example.com",
        "password": "StrongPass1!",
        "role": "client",
        "full_name": "Test User",
        "phone": "1234567890",
    }
    client.post(
        "api/v1/auth/register",
        json=register_data,
        headers={"X-Forwarded-For": "3.3.3.3"},
    )

    login_data = {"email": "refresh@example.com", "password": "StrongPass1!"}
    login_resp = client.post(
        "api/v1/auth/login", json=login_data, headers={"X-Forwarded-For": "3.3.3.3"}
    )
    tokens = login_resp.json()
    refresh_token = tokens["refresh_token"]

    refresh_data = {"refresh_token": refresh_token}

    # First 10 requests should work
    for _ in range(10):
        response = client.post(
            "api/v1/auth/refresh",
            json=refresh_data,
            headers={"X-Forwarded-For": "3.3.3.3"},
        )
        # Should be 200 (success) or 401 (if token is invalid)
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_401_UNAUTHORIZED,
        ]

    # 11th request should trigger rate limit (429)
    response = client.post(
        "api/v1/auth/refresh", json=refresh_data, headers={"X-Forwarded-For": "3.3.3.3"}
    )
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in response.headers


def test_rate_limiting_retry_after_header(client):
    """Test that rate limited responses include Retry-After header."""
    login_data = {"email": "test2@example.com", "password": "wrongpassword"}

    # Make 5 requests to hit the limit
    for _ in range(5):
        client.post(
            "api/v1/auth/login", json=login_data, headers={"X-Forwarded-For": "4.4.4.4"}
        )

    # Next request should be rate limited with Retry-After header
    response = client.post(
        "api/v1/auth/login", json=login_data, headers={"X-Forwarded-For": "4.4.4.4"}
    )
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in response.headers
    # Retry-After should be a positive integer
    retry_after = int(response.headers["Retry-After"])
    assert retry_after > 0
