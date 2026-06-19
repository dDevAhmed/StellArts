from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.calendar_crypto import decrypt_token, encrypt_token
from app.models.artisan import Artisan
from app.models.booking import Booking, BookingStatus
from app.models.calendar import ArtisanCalendarEvent
from app.models.user import User
from app.services.routing import routing_service
from app.services.scheduling import scheduling_service


def test_token_encryption():
    token = "my-secret-access-token"
    encrypted = encrypt_token(token)
    assert encrypted is not None
    assert encrypted != token

    decrypted = decrypt_token(encrypted)
    assert decrypted == token

    # Handle None
    assert encrypt_token(None) is None
    assert decrypt_token(None) is None


@pytest.mark.asyncio
async def test_routing_service():
    # Same location
    info = await routing_service.get_travel_info(40.7128, -74.0060, 40.7128, -74.0060)
    assert info["duration_mins"] == 0.0
    assert info["distance_km"] == 0.0

    # Different locations (fallback to geodesic or OSRM if reachable)
    # NY (40.7128, -74.0060) to Brooklyn (40.6782, -73.9442)
    info2 = await routing_service.get_travel_info(40.7128, -74.0060, 40.6782, -73.9442)
    assert info2["distance_km"] > 0
    assert info2["duration_mins"] > 0
    assert info2["source"] in ("osrm", "fallback_geodesic")


def get_auth_headers(client, email, password, role):
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


def test_calendar_endpoints(client: TestClient):
    # Register and create artisan profile
    art_headers = get_auth_headers(
        client, "artisan_cal@test.com", "Pass123!", "artisan"
    )
    profile_data = {
        "business_name": "Calendar Artisan",
        "specialties": ["painting"],
        "latitude": 40.7128,
        "longitude": -74.0060,
    }
    client.post("api/v1/artisans/profile", json=profile_data, headers=art_headers)

    # Test auth-url
    response = client.get("/api/v1/calendar/auth-url", headers=art_headers)
    assert response.status_code == 200
    assert "auth_url" in response.json()

    # Test callback (mock mode)
    response = client.post(
        "/api/v1/calendar/callback",
        json={
            "code": "oauth_code_xyz",
            "redirect_uri": "http://localhost:3000/callback",
        },
        headers=art_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Test status
    response = client.get("/api/v1/calendar/status", headers=art_headers)
    assert response.status_code == 200
    status_data = response.json()
    assert status_data["connected"] is True
    assert status_data["last_synced_at"] is not None

    # Test manual sync
    response = client.post("/api/v1/calendar/sync", headers=art_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Test disconnect
    response = client.post("/api/v1/calendar/disconnect", headers=art_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Status after disconnect
    response = client.get("/api/v1/calendar/status", headers=art_headers)
    assert response.status_code == 200
    assert response.json()["connected"] is False


@pytest.mark.asyncio
async def test_smart_scheduling_slots(db_session: Session):
    # Create artisan
    user = User(
        email="artisan_cal@example.com",
        hashed_password="hashedpassword",
        role="artisan",
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    artisan = Artisan(
        user_id=user.id,
        business_name="Calendar Artisan",
        latitude=Decimal("40.7128"),
        longitude=Decimal("-74.0060"),
        location="123 Main St, New York",
        hourly_rate=Decimal("60.00"),
    )
    db_session.add(artisan)
    db_session.commit()

    # Setup Google Calendar events
    tomorrow = datetime.now(UTC).date() + timedelta(days=1)
    event1 = ArtisanCalendarEvent(
        artisan_id=artisan.id,
        external_event_id="test_busy_event_1",
        summary="Busy Event",
        start_time=datetime.combine(
            tomorrow, datetime.strptime("09:00:00", "%H:%M:%S").time()
        ).replace(tzinfo=UTC),
        end_time=datetime.combine(
            tomorrow, datetime.strptime("10:30:00", "%H:%M:%S").time()
        ).replace(tzinfo=UTC),
        location="Brooklyn, NY",
    )
    db_session.add(event1)

    # Also setup a local booking tomorrow 14:00 - 16:00
    from app.models.client import Client

    client_user = User(
        email="client_cal@example.com",
        hashed_password="hashedpassword",
        role="client",
        is_verified=True,
    )
    db_session.add(client_user)
    db_session.commit()

    client_profile = Client(user_id=client_user.id)
    db_session.add(client_profile)
    db_session.commit()

    booking1 = Booking(
        client_id=client_profile.id,
        artisan_id=artisan.id,
        service="Plumbing",
        estimated_hours=Decimal("2.0"),
        estimated_cost=Decimal("120.00"),
        status=BookingStatus.CONFIRMED,
        date=datetime.combine(
            tomorrow, datetime.strptime("14:00:00", "%H:%M:%S").time()
        ).replace(tzinfo=UTC),
        location="Queens, NY",
    )
    db_session.add(booking1)
    db_session.commit()

    with (
        patch(
            "app.services.geolocation.geolocation_service.geocode_address"
        ) as mock_geocode,
        patch("app.services.routing.routing_service.get_travel_info") as mock_route,
    ):
        # Mock geocoding coordinates
        from app.schemas.artisan import GeolocationResponse

        mock_geocode.return_value = GeolocationResponse(
            latitude=Decimal("40.7282"),
            longitude=Decimal("-73.7949"),
            formatted_address="Queens, NY",
            confidence=1.0,
        )

        # Mock travel times: let's say 20 minutes everywhere
        mock_route.return_value = {
            "duration_mins": 20.0,
            "distance_km": 10.0,
            "source": "mock",
        }

        slots = await scheduling_service.propose_time_slots(
            db=db_session,
            artisan_id=artisan.id,
            location="Queens, NY",
            estimated_hours=2.0,
            target_date=datetime.combine(tomorrow, datetime.min.time()).replace(
                tzinfo=UTC
            ),
        )

        assert len(slots) > 0
        for slot in slots:
            start = slot["start_time"]
            end = slot["end_time"]

            # Assert no overlap with dentist (09:00 - 10:30)
            dentist_start = datetime.combine(
                tomorrow, datetime.strptime("09:00:00", "%H:%M:%S").time()
            ).replace(tzinfo=UTC)
            dentist_end = datetime.combine(
                tomorrow, datetime.strptime("10:30:00", "%H:%M:%S").time()
            ).replace(tzinfo=UTC)
            assert max(start, dentist_start) >= min(end, dentist_end)

            # Assert no overlap with plumbing (14:00 - 16:00)
            plumb_start = datetime.combine(
                tomorrow, datetime.strptime("14:00:00", "%H:%M:%S").time()
            ).replace(tzinfo=UTC)
            plumb_end = datetime.combine(
                tomorrow, datetime.strptime("16:00:00", "%H:%M:%S").time()
            ).replace(tzinfo=UTC)
            assert max(start, plumb_start) >= min(end, plumb_end)


def test_propose_slots_endpoint(client: TestClient):
    # Register and create artisan profile
    art_headers = get_auth_headers(
        client, "artisan_cal@test.com", "Pass123!", "artisan"
    )
    profile_data = {
        "business_name": "Calendar Artisan",
        "specialties": ["painting"],
        "latitude": 40.7128,
        "longitude": -74.0060,
    }
    profile_resp = client.post(
        "api/v1/artisans/profile", json=profile_data, headers=art_headers
    )
    artisan_id = profile_resp.json()["id"]

    tomorrow_str = (datetime.now(UTC) + timedelta(days=1)).isoformat()

    with (
        patch(
            "app.services.geolocation.geolocation_service.geocode_address"
        ) as mock_geocode,
        patch("app.services.routing.routing_service.get_travel_info") as mock_route,
    ):
        # Mock geocoding coordinates
        from app.schemas.artisan import GeolocationResponse

        mock_geocode.return_value = GeolocationResponse(
            latitude=Decimal("40.7282"),
            longitude=Decimal("-73.7949"),
            formatted_address="Queens, NY",
            confidence=1.0,
        )

        # Mock travel times: let's say 20 minutes everywhere
        mock_route.return_value = {
            "duration_mins": 20.0,
            "distance_km": 10.0,
            "source": "mock",
        }

        response = client.post(
            "/api/v1/bookings/propose-slots",
            json={
                "artisan_id": artisan_id,
                "location": "Queens, NY",
                "estimated_hours": 2.0,
                "target_date": tomorrow_str,
            },
            headers=art_headers,
        )
        assert response.status_code == 200
        slots = response.json()
        assert len(slots) > 0
        for slot in slots:
            assert "start_time" in slot
            assert "end_time" in slot
            assert "total_transit_waste_mins" in slot
