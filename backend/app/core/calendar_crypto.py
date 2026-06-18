import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _get_fernet() -> Fernet:
    """Derive a valid base64 key from settings.SECRET_KEY for Fernet"""
    # hashlib.sha256 yields 32 bytes
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    b64_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(b64_key)


def encrypt_token(token: str | None) -> str | None:
    """Encrypt a plain text token at rest"""
    if not token:
        return None
    try:
        f = _get_fernet()
        return f.encrypt(token.encode("utf-8")).decode("utf-8")
    except Exception as e:
        print(f"Token encryption error: {e}")
        return None


def decrypt_token(encrypted_token: str | None) -> str | None:
    """Decrypt an encrypted token from the database"""
    if not encrypted_token:
        return None
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except Exception as e:
        print(f"Token decryption error: {e}")
        return None
