"""Test authentication guards on payment release and refund endpoints."""
from fastapi import status


def test_unauthenticated_release_returns_401(client):
    """Test that unauthenticated requests to /payments/release return 403."""
    release_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "artisan_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post("api/v1/payments/release", json=release_data)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_unauthenticated_refund_returns_401(client):
    """Test that unauthenticated requests to /payments/refund return 403."""
    refund_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "client_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post("api/v1/payments/refund", json=refund_data)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_client_cannot_release_payment(client):
    """Test that client role cannot access /payments/release (requires admin)."""
    # Create and login as client
    register_data = {
        "email": "client@example.com",
        "password": "StrongPass1!",
        "role": "client",
        "full_name": "Client User",
        "phone": "1234567890",
    }
    client.post("api/v1/auth/register", json=register_data)

    login_data = {"email": "client@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    release_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "artisan_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post(
        "api/v1/payments/release", json=release_data, headers=headers
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_artisan_cannot_release_payment(client):
    """Test that artisan role cannot access /payments/release (requires admin)."""
    # Create and login as artisan
    register_data = {
        "email": "artisan@example.com",
        "password": "StrongPass1!",
        "role": "artisan",
        "full_name": "Artisan User",
        "phone": "1234567890",
    }
    client.post("api/v1/auth/register", json=register_data)

    login_data = {"email": "artisan@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    release_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "artisan_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post(
        "api/v1/payments/release", json=release_data, headers=headers
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_client_cannot_refund_payment(client):
    """Test that client role cannot access /payments/refund (requires admin)."""
    # Create and login as client
    register_data = {
        "email": "client2@example.com",
        "password": "StrongPass1!",
        "role": "client",
        "full_name": "Client User",
        "phone": "1234567890",
    }
    client.post("api/v1/auth/register", json=register_data)

    login_data = {"email": "client2@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    refund_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "client_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post("api/v1/payments/refund", json=refund_data, headers=headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_artisan_cannot_refund_payment(client):
    """Test that artisan role cannot access /payments/refund (requires admin)."""
    # Create and login as artisan
    register_data = {
        "email": "artisan2@example.com",
        "password": "StrongPass1!",
        "role": "artisan",
        "full_name": "Artisan User",
        "phone": "1234567890",
    }
    client.post("api/v1/auth/register", json=register_data)

    login_data = {"email": "artisan2@example.com", "password": "StrongPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    refund_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "client_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post("api/v1/payments/refund", json=refund_data, headers=headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_admin_can_release_payment(client, db_session):
    """Test that admin role can access /payments/release."""
    from app.core.security import get_password_hash
    from app.models.user import User

    # Create admin user directly in DB
    admin_user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("AdminPass1!"),
        role="admin",
        full_name="Admin User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    db_session.commit()

    # Login as admin
    login_data = {"email": "admin@example.com", "password": "AdminPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    release_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "artisan_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post(
        "api/v1/payments/release", json=release_data, headers=headers
    )
    # Should return 404 (booking not found) rather than 401 or 403
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_admin_can_refund_payment(client, db_session):
    """Test that admin role can access /payments/refund."""
    from app.core.security import get_password_hash
    from app.models.user import User

    # Create admin user directly in DB
    admin_user = User(
        email="admin2@example.com",
        hashed_password=get_password_hash("AdminPass1!"),
        role="admin",
        full_name="Admin User",
        phone="1234567890",
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    db_session.commit()

    # Login as admin
    login_data = {"email": "admin2@example.com", "password": "AdminPass1!"}
    login_resp = client.post("api/v1/auth/login", json=login_data)
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    refund_data = {
        "booking_id": "00000000-0000-0000-0000-000000000000",
        "client_public": "GD123456789",
        "amount": 100.00,
    }
    response = client.post("api/v1/payments/refund", json=refund_data, headers=headers)
    # Should return 404 (booking not found) rather than 401 or 403
    assert response.status_code == status.HTTP_404_NOT_FOUND
