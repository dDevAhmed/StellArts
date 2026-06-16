# app/workers/soroban_event_worker.py
import asyncio
import logging
from app.db.session import AsyncSessionLocal
from app.workers.event_processor import process_event
from app.workers.cursor_store import get_cursor, save_cursor
from app.core.config import settings
import httpx

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 5

async def fetch_events(cursor: str) -> list[dict]:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getEvents",
        "params": {
            "startLedger": cursor,
            "filters": [{"type": "contract", "contractIds": [settings.ESCROW_CONTRACT_ID]}],
            "pagination": {"limit": 100}
        }
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(settings.SOROBAN_RPC_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("result", {}).get("events", [])

async def run_worker():
    logger.info("Soroban event worker starting...")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                cursor = await get_cursor(db)
            events = await fetch_events(cursor)
            for event in events:
                async with AsyncSessionLocal() as db:
                    async with db.begin():
                        processed = await process_event(db, event)
                        if processed:
                            await save_cursor(db, event["id"])  # only advances on success
            if not events:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)