# tests/test_event_worker.py
import pytest
from unittest.mock import AsyncMock, patch
from app.workers.event_processor import process_event


async def test_idempotent_fund_released():
    mock_db = AsyncMock()
    mock_db.execute.return_value.rowcount = 0  # simulate "already processed"
    event = {
        "id": "event-abc-123",
        "type": "FundReleasedEvent",
        "value": {"booking_id": "booking-42"},
    }
    result = process_event(mock_db, event)
    assert result is True
    # Cursor must NOT advance twice — verify execute was called with event_id guard
    call_args = mock_db.execute.call_args_list[0]
    assert "processed_event_id != :event_id" in str(call_args)


async def test_failed_db_does_not_advance_cursor():
    mock_db = AsyncMock()
    mock_db.execute.side_effect = Exception("DB write failed")
    event = {
        "id": "ev-999",
        "type": "FundReleasedEvent",
        "value": {"booking_id": "b-1"},
    }
    result = process_event(mock_db, event)
    assert result is False  # caller must NOT call save_cursor when False
