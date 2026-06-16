# app/workers/event_processor.py
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

EVENT_HANDLERS = {
    "EngagementInitializedEvent": "pending",
    "FundReleasedEvent": "released",
    "ReclaimedEvent": "reclaimed",
}

def parse_booking_id(event: dict) -> str | None:
    # Adjust XDR/field path to match your actual Soroban event schema
    for topic in event.get("topic", []):
        if isinstance(topic, dict) and topic.get("type") == "symbol":
            pass  # navigate to booking_id in `value` field
    value = event.get("value", {})
    return value.get("booking_id")  # adjust per your contract ABI

async def process_event(db: AsyncSession, event: dict) -> bool:
    event_type = event.get("type")
    event_id = event.get("id")
    new_status = EVENT_HANDLERS.get(event_type)
    if not new_status:
        return True  # unknown event — skip but advance cursor

    booking_id = parse_booking_id(event)
    if not booking_id:
        logger.warning(f"Could not parse booking_id from event {event_id}")
        return False

    # IDEMPOTENT: only update if event_id not already processed
    result = await db.execute(
        text("""
            UPDATE bookings
            SET status = :status, processed_event_id = :event_id
            WHERE booking_id = :booking_id
              AND (processed_event_id IS NULL OR processed_event_id != :event_id)
        """),
        {"status": new_status, "booking_id": booking_id, "event_id": event_id}
    )
    if result.rowcount == 0:
        logger.info(f"Event {event_id} already processed (idempotent skip).")
    return True