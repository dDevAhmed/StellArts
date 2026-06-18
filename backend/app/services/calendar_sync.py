from datetime import UTC, datetime, timedelta

import aiohttp
from sqlalchemy.orm import Session

from app.core.calendar_crypto import decrypt_token, encrypt_token
from app.core.config import settings
from app.models.calendar import ArtisanCalendarConfig, ArtisanCalendarEvent


class CalendarSyncService:
    """Service to handle OAuth token refreshes and ingestion of Google Calendar events"""

    async def get_valid_access_token(
        self, db: Session, config: ArtisanCalendarConfig
    ) -> str | None:
        """Get a valid access token. Refreshes if expired."""
        now = datetime.now(UTC)

        # Access token is still valid (using 5 minute buffer)
        if (
            config.google_access_token
            and config.token_expiry
            and config.token_expiry.replace(tzinfo=UTC) > now + timedelta(minutes=5)
        ):
            return decrypt_token(config.google_access_token)

        # Token is expired or missing, refresh it
        refresh_token = decrypt_token(config.google_refresh_token)
        if not refresh_token:
            return None

        # Mock mode if no credentials configured (useful for tests/dev)
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            # For mock/test: return a mock token, and update expiry
            config.google_access_token = encrypt_token("mock_access_token")
            config.token_expiry = datetime.utcnow() + timedelta(hours=1)
            db.commit()
            return "mock_access_token"

        # Call Google Token endpoint
        url = "https://oauth2.googleapis.com/token"
        payload = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        access_token = data.get("access_token")
                        expires_in = data.get("expires_in", 3600)

                        config.google_access_token = encrypt_token(access_token)
                        config.token_expiry = datetime.utcnow() + timedelta(
                            seconds=expires_in
                        )

                        new_refresh = data.get("refresh_token")
                        if new_refresh:
                            config.google_refresh_token = encrypt_token(new_refresh)

                        db.commit()
                        return access_token
                    else:
                        err_text = await response.text()
                        print(
                            f"Failed to refresh Google token: {response.status} - {err_text}"
                        )
                        return None
        except Exception as e:
            print(f"Error refreshing Google token: {e}")
            return None

    async def sync_artisan_calendar(self, db: Session, artisan_id: int) -> bool:
        """Ingest calendar events for the artisan into our local database"""
        config = (
            db.query(ArtisanCalendarConfig)
            .filter(ArtisanCalendarConfig.artisan_id == artisan_id)
            .first()
        )
        if not config:
            return False

        access_token = await self.get_valid_access_token(db, config)
        if not access_token:
            return False

        # In mock mode, we generate mock events to simulate sync
        if access_token == "mock_access_token":
            self._create_mock_calendar_events(db, artisan_id)
            config.last_synced_at = datetime.utcnow()
            db.commit()
            return True

        # Call Google Calendar API
        time_min = datetime.now(UTC).isoformat()
        time_max = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        url = f"https://www.googleapis.com/calendar/v3/calendars/{config.calendar_id}/events"
        params = {
            "timeMin": time_min,
            "timeMax": time_max,
            "singleEvents": "true",
            "orderBy": "startTime",
        }
        headers = {"Authorization": f"Bearer {access_token}"}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        events = data.get("items", [])

                        # Get existing event IDs for the artisan to prevent duplicates
                        existing_events = (
                            db.query(ArtisanCalendarEvent)
                            .filter(ArtisanCalendarEvent.artisan_id == artisan_id)
                            .all()
                        )
                        existing_map = {e.external_event_id: e for e in existing_events}

                        fetched_ids = set()
                        for item in events:
                            event_id = item.get("id")
                            if not event_id:
                                continue
                            fetched_ids.add(event_id)

                            start_data = item.get("start", {})
                            end_data = item.get("end", {})

                            start_str = start_data.get("dateTime") or start_data.get(
                                "date"
                            )
                            end_str = end_data.get("dateTime") or end_data.get("date")

                            if not start_str or not end_str:
                                continue

                            start_time = datetime.fromisoformat(
                                start_str.replace("Z", "+00:00")
                            )
                            end_time = datetime.fromisoformat(
                                end_str.replace("Z", "+00:00")
                            )

                            summary = item.get("summary", "Busy")
                            location = item.get("location")

                            if event_id in existing_map:
                                local_event = existing_map[event_id]
                                local_event.summary = summary
                                local_event.start_time = start_time
                                local_event.end_time = end_time
                                local_event.location = location
                            else:
                                local_event = ArtisanCalendarEvent(
                                    artisan_id=artisan_id,
                                    external_event_id=event_id,
                                    summary=summary,
                                    start_time=start_time,
                                    end_time=end_time,
                                    location=location,
                                )
                                db.add(local_event)

                        # Clean up events that were deleted from Google Calendar
                        for ext_id, local_event in existing_map.items():
                            if ext_id not in fetched_ids:
                                db.delete(local_event)

                        config.last_synced_at = datetime.utcnow()
                        db.commit()
                        return True
                    else:
                        err_text = await response.text()
                        print(
                            f"Failed to fetch Google Calendar events: {response.status} - {err_text}"
                        )
                        return False
        except Exception as e:
            print(f"Error fetching Google Calendar events: {e}")
            return False

    def _create_mock_calendar_events(self, db: Session, artisan_id: int):
        """Create mock calendar events for testing/development"""
        # Clear existing mock events first to prevent duplicate errors
        db.query(ArtisanCalendarEvent).filter(
            ArtisanCalendarEvent.artisan_id == artisan_id,
            ArtisanCalendarEvent.external_event_id.like("mock_event_%"),
        ).delete(synchronize_session=False)

        tomorrow = datetime.now(UTC).date() + timedelta(days=1)
        day_after = datetime.now(UTC).date() + timedelta(days=2)

        mock_events = [
            ArtisanCalendarEvent(
                artisan_id=artisan_id,
                external_event_id="mock_event_1",
                summary="Dentist Appointment",
                start_time=datetime.combine(
                    tomorrow, datetime.strptime("09:00:00", "%H:%M:%S").time()
                ).replace(tzinfo=UTC),
                end_time=datetime.combine(
                    tomorrow, datetime.strptime("10:30:00", "%H:%M:%S").time()
                ).replace(tzinfo=UTC),
                location="123 Dental Clinic, NYC",
            ),
            ArtisanCalendarEvent(
                artisan_id=artisan_id,
                external_event_id="mock_event_2",
                summary="Lunch with Client",
                start_time=datetime.combine(
                    tomorrow, datetime.strptime("12:00:00", "%H:%M:%S").time()
                ).replace(tzinfo=UTC),
                end_time=datetime.combine(
                    tomorrow, datetime.strptime("13:30:00", "%H:%M:%S").time()
                ).replace(tzinfo=UTC),
                location="456 Art Ave, Brooklyn",
            ),
            ArtisanCalendarEvent(
                artisan_id=artisan_id,
                external_event_id="mock_event_3",
                summary="Workshop Maintenance",
                start_time=datetime.combine(
                    day_after, datetime.strptime("14:00:00", "%H:%M:%S").time()
                ).replace(tzinfo=UTC),
                end_time=datetime.combine(
                    day_after, datetime.strptime("17:00:00", "%H:%M:%S").time()
                ).replace(tzinfo=UTC),
                location="Artisan Workshop",
            ),
        ]
        db.add_all(mock_events)
        db.commit()


calendar_sync_service = CalendarSyncService()
