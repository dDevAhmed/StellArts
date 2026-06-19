from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.artisan import Artisan
from app.models.booking import Booking, BookingStatus
from app.models.calendar import ArtisanCalendarEvent
from app.services.geolocation import geolocation_service
from app.services.routing import routing_service


class SchedulingService:
    """Service to generate optimal scheduling proposals for clients booking artisans"""

    async def propose_time_slots(
        self,
        db: Session,
        artisan_id: int,
        location: str,
        estimated_hours: float,
        target_date: datetime,
    ) -> list[dict]:
        """
        Propose 2-3 optimal time slots for a booking.
        Slots are ranked by minimizing transit time/waste (geographic grouping).
        """
        # 1. Retrieve artisan profile and home base coordinates
        artisan = db.query(Artisan).filter(Artisan.id == artisan_id).first()
        if not artisan:
            return []

        artisan_lat = (
            float(artisan.latitude) if artisan.latitude is not None else 40.7128
        )
        artisan_lng = (
            float(artisan.longitude) if artisan.longitude is not None else -74.0060
        )

        # 2. Geocode client location
        client_lat, client_lng = artisan_lat, artisan_lng
        if location:
            client_geo = await geolocation_service.geocode_address(location)
            if client_geo:
                client_lat = float(client_geo.latitude)
                client_lng = float(client_geo.longitude)

        # Normalize target date range (start and end of target day in UTC)
        target_day_start = datetime.combine(
            target_date.date(), datetime.min.time()
        ).replace(tzinfo=UTC)
        target_day_end = datetime.combine(
            target_date.date(), datetime.max.time()
        ).replace(tzinfo=UTC)

        # 3. Retrieve commitments (busy blocks) on the target date
        commitments = []

        # A. Local bookings (exclude Cancelled and Disputed)
        local_bookings = (
            db.query(Booking)
            .filter(
                Booking.artisan_id == artisan_id,
                Booking.date >= target_day_start,
                Booking.date <= target_day_end,
                Booking.status.notin_(
                    [BookingStatus.CANCELLED, BookingStatus.DISPUTED]
                ),
            )
            .all()
        )

        for booking in local_bookings:
            b_start = booking.date.replace(tzinfo=UTC)
            b_hours = float(booking.estimated_hours) if booking.estimated_hours else 2.0
            b_end = b_start + timedelta(hours=b_hours)

            # Geocode booking location
            b_lat, b_lng = artisan_lat, artisan_lng
            if booking.location:
                b_geo = await geolocation_service.geocode_address(booking.location)
                if b_geo:
                    b_lat = float(b_geo.latitude)
                    b_lng = float(b_geo.longitude)

            commitments.append(
                {
                    "start": b_start,
                    "end": b_end,
                    "lat": b_lat,
                    "lng": b_lng,
                    "source": f"booking_{booking.id}",
                }
            )

        # B. Synced external calendar events
        ext_events = (
            db.query(ArtisanCalendarEvent)
            .filter(
                ArtisanCalendarEvent.artisan_id == artisan_id,
                ArtisanCalendarEvent.start_time <= target_day_end,
                ArtisanCalendarEvent.end_time >= target_day_start,
            )
            .all()
        )

        for event in ext_events:
            e_start = event.start_time.replace(tzinfo=UTC)
            e_end = event.end_time.replace(tzinfo=UTC)

            # Keep event bounded to target day for scheduling grid checks
            e_start = max(e_start, target_day_start)
            e_end = min(e_end, target_day_end)

            e_lat, e_lng = artisan_lat, artisan_lng
            if event.location:
                e_geo = await geolocation_service.geocode_address(event.location)
                if e_geo:
                    e_lat = float(e_geo.latitude)
                    e_lng = float(e_geo.longitude)

            commitments.append(
                {
                    "start": e_start,
                    "end": e_end,
                    "lat": e_lat,
                    "lng": e_lng,
                    "source": f"external_{event.external_event_id}",
                }
            )

        # Sort commitments chronologically
        commitments.sort(key=lambda x: x["start"])

        # 4. Define working hours bounds on the target date (08:00 to 18:00)
        working_start = target_day_start + timedelta(hours=8)
        working_end = target_day_start + timedelta(hours=18)

        # 5. Grid search candidate slots (every 30 minutes)
        candidates = []
        current_candidate_start = working_start
        slot_duration = timedelta(hours=estimated_hours)

        while current_candidate_start + slot_duration <= working_end:
            slot_start = current_candidate_start
            slot_end = current_candidate_start + slot_duration

            # Check overlap with any commitments
            has_overlap = False
            for comm in commitments:
                if max(slot_start, comm["start"]) < min(slot_end, comm["end"]):
                    has_overlap = True
                    break

            if has_overlap:
                current_candidate_start += timedelta(minutes=30)
                continue

            # Find immediately preceding and succeeding commitments on this day
            preceding = None
            succeeding = None

            for comm in commitments:
                if comm["end"] <= slot_start:
                    if preceding is None or comm["end"] > preceding["end"]:
                        preceding = comm
                if comm["start"] >= slot_end:
                    if succeeding is None or comm["start"] < succeeding["start"]:
                        succeeding = comm

            # Calculate transit times
            # Preceding
            if preceding:
                travel_prev = await routing_service.get_travel_info(
                    preceding["lat"], preceding["lng"], client_lat, client_lng
                )
            else:
                # Travel from home base
                travel_prev = await routing_service.get_travel_info(
                    artisan_lat, artisan_lng, client_lat, client_lng
                )

            # Succeeding
            if succeeding:
                travel_next = await routing_service.get_travel_info(
                    client_lat, client_lng, succeeding["lat"], succeeding["lng"]
                )
            else:
                # Travel back to home base
                travel_next = await routing_service.get_travel_info(
                    client_lat, client_lng, artisan_lat, artisan_lng
                )

            t_prev_mins = travel_prev["duration_mins"]
            t_next_mins = travel_next["duration_mins"]

            # Validate feasibility constraints
            # 1. Start time must respect preceding end time + travel time
            feasible = True
            if preceding:
                if slot_start < preceding["end"] + timedelta(minutes=t_prev_mins):
                    feasible = False
            else:
                # Respect working start + travel from home
                if slot_start < working_start + timedelta(minutes=t_prev_mins):
                    feasible = False

            # 2. End time must respect succeeding start time - travel time
            if succeeding:
                if slot_end + timedelta(minutes=t_next_mins) > succeeding["start"]:
                    feasible = False
            else:
                # Respect working end (including travel back home)
                if slot_end + timedelta(minutes=t_next_mins) > working_end:
                    feasible = False

            if feasible:
                candidates.append(
                    {
                        "start_time": slot_start,
                        "end_time": slot_end,
                        "transit_time_from_preceding_mins": t_prev_mins,
                        "transit_time_to_succeeding_mins": t_next_mins,
                        "total_transit_waste_mins": t_prev_mins + t_next_mins,
                    }
                )

            current_candidate_start += timedelta(minutes=30)

        # 6. Rank by transit waste (ascending) and deduplicate
        candidates.sort(key=lambda x: x["total_transit_waste_mins"])

        proposed_slots = []
        for cand in candidates:
            # Deduplicate proposals that are too close (at least 1 hour apart)
            too_close = False
            for prop in proposed_slots:
                if (
                    abs((cand["start_time"] - prop["start_time"]).total_seconds())
                    < 3600
                ):
                    too_close = True
                    break

            if not too_close:
                proposed_slots.append(cand)
                if len(proposed_slots) >= 3:
                    break

        return proposed_slots


scheduling_service = SchedulingService()
