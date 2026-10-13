"""Password hashing, JWT access tokens and opaque random tokens."""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_hasher = PasswordHasher()  # Argon2id with library defaults
ALGORITHM = "HS256"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    s = get_settings()
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_minutes),
    }
    return jwt.encode(payload, s.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        data = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return data if data.get("type") == "access" else None


def generate_token() -> str:
    """Random URL-safe token to hand to the client (refresh / reset / verify)."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """Only the SHA-256 hash is stored, so a DB leak does not expose usable tokens."""
    return hashlib.sha256(token.encode()).hexdigest()
