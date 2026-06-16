import asyncio
import logging

import httpx

from app.core.config import settings
from app.db.base import SessionLocal
from app.workers.cursor_store import get_cursor, save_cursor
from app.workers.event_processor import process_event

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 5


def _process_in_db(event: dict) -> bool:
    with SessionLocal() as db:
        try:
            processed = process_event(db, event)
            if processed:
                save_cursor(db, event["id"])
                db.commit()
            return processed
        except Exception:
            db.rollback()
            raise


def _get_cursor_from_db() -> str:
    with SessionLocal() as db:
        return get_cursor(db)


async def run_worker():
    logger.info("Soroban event worker starting...")
    while True:
        try:
            cursor = await asyncio.to_thread(_get_cursor_from_db)
            events = await fetch_events(cursor)
            for event in events:
                await asyncio.to_thread(_process_in_db, event)
            if not events:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def fetch_events(cursor: str) -> list[dict]:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getEvents",
        "params": {
            "startLedger": cursor,
            "filters": [
                {"type": "contract", "contractIds": [settings.ESCROW_CONTRACT_ID]}
            ],
            "pagination": {"limit": 100},
        },
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(settings.SOROBAN_RPC_URL, json=payload)
        resp.raise_for_status()
        return resp.json().get("result", {}).get("events", [])
