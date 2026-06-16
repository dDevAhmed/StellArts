# app/workers/cursor_store.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

CURSOR_KEY = "soroban_event_cursor"

async def get_cursor(db: AsyncSession) -> str:
    result = await db.execute(
        text("SELECT value FROM worker_state WHERE key = :key"),
        {"key": CURSOR_KEY}
    )
    row = result.fetchone()
    return row[0] if row else "0"  # "0" = from genesis

async def save_cursor(db: AsyncSession, event_id: str):
    await db.execute(
        text("""
            INSERT INTO worker_state (key, value)
            VALUES (:key, :value)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """),
        {"key": CURSOR_KEY, "value": event_id}
    )