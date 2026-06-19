from datetime import datetime, timedelta

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_artisan
from app.core.calendar_crypto import encrypt_token
from app.core.config import settings
from app.db.session import get_db
from app.models.artisan import Artisan
from app.models.calendar import ArtisanCalendarConfig, ArtisanCalendarEvent
from app.models.user import User
from app.services.calendar_sync import calendar_sync_service

router = APIRouter(prefix="/calendar")


class CallbackPayload(BaseModel):
    code: str
    redirect_uri: str | None = None


@router.get("/auth-url")
def get_auth_url(current_user: User = Depends(require_artisan)):
    """Generate the Google OAuth authorization URL for artisans"""
    client_id = settings.GOOGLE_CLIENT_ID or "mock_client_id"
    redirect_uri = f"{settings.FRONTEND_URL}/calendar/callback"
    scope = "https://www.googleapis.com/auth/calendar.readonly"
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return {"auth_url": auth_url}


@router.post("/callback")
async def oauth_callback(
    payload: CallbackPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_artisan),
):
    """Callback endpoint to handle Google authorization code exchange"""
    artisan = db.query(Artisan).filter(Artisan.user_id == current_user.id).first()
    if not artisan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artisan profile not found",
        )

    redirect_uri = payload.redirect_uri or f"{settings.FRONTEND_URL}/calendar/callback"

    # Default mock tokens for testing/development if credentials are not configured
    access_token = "mock_access_token"
    refresh_token = "mock_refresh_token"
    expires_in = 3600

    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": payload.code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=data) as response:
                    if response.status == 200:
                        res_data = await response.json()
                        access_token = res_data.get("access_token")
                        # refresh token is only returned on the first authorization
                        refresh_token = res_data.get("refresh_token") or refresh_token
                        expires_in = res_data.get("expires_in", 3600)
                    else:
                        err_text = await response.text()
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Failed to exchange Google OAuth code: {err_text}",
                        )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Token exchange error: {str(e)}",
            ) from e

    # Securely encrypt tokens at rest
    enc_access = encrypt_token(access_token)
    enc_refresh = encrypt_token(refresh_token)
    expiry = datetime.utcnow() + timedelta(seconds=expires_in)

    config = (
        db.query(ArtisanCalendarConfig)
        .filter(ArtisanCalendarConfig.artisan_id == artisan.id)
        .first()
    )

    if config:
        config.google_access_token = enc_access
        # Do not overwrite refresh token with None if it is not returned during subsequent auths
        if refresh_token:
            config.google_refresh_token = enc_refresh
        config.token_expiry = expiry
    else:
        config = ArtisanCalendarConfig(
            artisan_id=artisan.id,
            google_access_token=enc_access,
            google_refresh_token=enc_refresh,
            token_expiry=expiry,
            calendar_id="primary",
        )
        db.add(config)

    db.commit()

    # Trigger initial ingestion of events
    await calendar_sync_service.sync_artisan_calendar(db, artisan.id)

    return {"status": "success", "message": "Google Calendar successfully connected"}


@router.get("/status")
def get_sync_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_artisan),
):
    """Get the Google Calendar connection status for the authenticated artisan"""
    artisan = db.query(Artisan).filter(Artisan.user_id == current_user.id).first()
    if not artisan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artisan profile not found",
        )

    config = (
        db.query(ArtisanCalendarConfig)
        .filter(ArtisanCalendarConfig.artisan_id == artisan.id)
        .first()
    )

    if not config:
        return {"connected": False, "last_synced_at": None}

    return {
        "connected": True,
        "calendar_id": config.calendar_id,
        "last_synced_at": config.last_synced_at,
    }


@router.post("/disconnect")
def disconnect_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_artisan),
):
    """Disconnect the Google Calendar and delete all local configurations and events"""
    artisan = db.query(Artisan).filter(Artisan.user_id == current_user.id).first()
    if not artisan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artisan profile not found",
        )

    config = (
        db.query(ArtisanCalendarConfig)
        .filter(ArtisanCalendarConfig.artisan_id == artisan.id)
        .first()
    )

    if config:
        db.delete(config)
        db.query(ArtisanCalendarEvent).filter(
            ArtisanCalendarEvent.artisan_id == artisan.id
        ).delete(synchronize_session=False)
        db.commit()

    return {"status": "success", "message": "Google Calendar disconnected"}


@router.post("/sync")
async def trigger_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_artisan),
):
    """Manually trigger ingestion of calendar events"""
    artisan = db.query(Artisan).filter(Artisan.user_id == current_user.id).first()
    if not artisan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artisan profile not found",
        )

    success = await calendar_sync_service.sync_artisan_calendar(db, artisan.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to sync calendar events",
        )

    return {"status": "success", "message": "Calendar events successfully synced"}
