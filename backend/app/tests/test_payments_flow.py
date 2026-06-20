from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from app.services import payments


def get_auth_headers(client, email, password, role):
    # register & login helper copied from test_crud_endpoints
    client.post(
        "api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "role": role,
            "full_name": f"Test {role.capitalize()}",
            "phone": "9999999999",
        },
    )
    login_resp = client.post(
        "api/v1/auth/login", json={"email": email, "password": password}
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_booking(client, artisan_headers, client_headers):
    # create a simple booking so we have an id to work with
    resp = client.post(
        "api/v1/artisans/profile",
        json={"business_name": "Test Artisan", "specialties": ["plumbing"]},
        headers=artisan_headers,
    )
    artisan_id = resp.json()["id"]

    booking_data = {
        "artisan_id": artisan_id,
        "service": "Fix my sink",
        "estimated_hours": 2,
        "estimated_cost": 100.0,
        "date": "2024-12-25T10:00:00",
        "location": "123 Main St",
        "notes": "Urgent",
    }
    resp = client.post(
        "api/v1/bookings/create", json=booking_data, headers=client_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# Fake XDR string returned by the mocked soroban deposit builder
FAKE_SOROBAN_XDR = "AAAAAgAAAAA="


def test_payments_prepare_returns_soroban_xdr(monkeypatch, client, db_session):
    """
    prepare_payment should delegate to soroban.prepare_escrow_deposit and
    return the unsigned Soroban XDR without hitting a live RPC.
    """
    artisan_headers = get_auth_headers(
        client, "artpay2@test.com", "Pass123!", "artisan"
    )
    client_headers = get_auth_headers(
        client, "clipay2@test.com", "Pass123!", "client"
    )

    booking_id = create_booking(client, artisan_headers, client_headers)

    # Patch at the service level so no Soroban RPC is contacted
    with patch(
        "app.services.soroban.prepare_escrow_deposit",
        return_value=FAKE_SOROBAN_XDR,
    ):
        resp = client.post(
            "api/v1/payments/prepare",
            json={
                "booking_id": booking_id,
                "amount": 100.5,
                "client_public": "GABC1234DUMMYPUBLIC",
            },
            headers=client_headers,
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "prepared"
    assert payload["unsigned_xdr"] == FAKE_SOROBAN_XDR
    assert payload["booking_id"] == booking_id
    assert payload["amount"] == "100.5"


def test_payments_prepare_forwards_escrow_error(monkeypatch, client, db_session):
    """
    If prepare_escrow_deposit raises (e.g. no contract configured), prepare_payment
    must return status='error' rather than crashing.
    """
    artisan_headers = get_auth_headers(
        client, "artpay3@test.com", "Pass123!", "artisan"
    )
    client_headers = get_auth_headers(
        client, "clipay3@test.com", "Pass123!", "client"
    )

    booking_id = create_booking(client, artisan_headers, client_headers)

    with patch(
        "app.services.soroban.prepare_escrow_deposit",
        side_effect=RuntimeError("Escrow contract ID not configured"),
    ):
        resp = client.post(
            "api/v1/payments/prepare",
            json={
                "booking_id": booking_id,
                "amount": 50.0,
                "client_public": "GABC1234DUMMYPUBLIC",
            },
            headers=client_headers,
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "error"
    assert "Escrow contract ID not configured" in payload["message"]


def test_hold_endpoint_removed(client):
    # any call to /payments/hold should 404
    resp = client.post("api/v1/payments/hold", json={})
    assert resp.status_code in (404, 405)


def test_release_payment_uses_soroban(client, db_session):
    """
    release_payment should call soroban.prepare_escrow_release and
    submit_soroban_transaction instead of the old Horizon path.
    """
    from app.models.payment import Payment, PaymentStatus

    booking_uuid = uuid4()

    # Seed a HELD payment record directly into the test DB
    held = Payment(
        booking_id=booking_uuid,
        transaction_hash="OLDHASH",
        status=PaymentStatus.HELD,
        amount=Decimal("75.0"),
        from_account="GCLIENT",
        to_account="GESCROW",
        memo="hold-test",
        asset_code="XLM",
        asset_issuer=None,
    )
    db_session.add(held)
    db_session.commit()

    with (
        patch(
            "app.services.soroban.prepare_escrow_release",
            return_value=FAKE_SOROBAN_XDR,
        ),
        patch("app.services.soroban.get_backend_signer") as mock_signer,
        patch(
            "app.services.soroban.submit_soroban_transaction",
            return_value={"status": "SUCCESS", "hash": "SOROBANHASH"},
        ),
        patch("stellar_sdk.TransactionEnvelope.from_xdr") as mock_env,
    ):
        from stellar_sdk import Keypair

        mock_signer.return_value = Keypair.random()
        mock_tx = mock_env.return_value
        mock_tx.to_xdr.return_value = FAKE_SOROBAN_XDR

        result = payments.release_payment(
            db=db_session,
            booking_id=str(booking_uuid),
            artisan_public="GARTISAN",
            amount=Decimal("75.0"),
        )

    assert result.get("status") != "error", result.get("message")
    assert result.get("transaction_hash") == "SOROBANHASH"
