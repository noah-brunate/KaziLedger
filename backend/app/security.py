import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException, status
from pwdlib import PasswordHash

from app.config import get_settings


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    return password_hash.verify(password, encoded)


def create_access_token(user_id: uuid.UUID, permissions: list[str], role: str = "client") -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "role": role, "permissions": permissions, "iat": now, "exp": now + timedelta(hours=8)}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


ROLE_PERMISSIONS: dict[str, list[str]] = {
    "client": ["requests:create", "requests:read", "payments:create", "disputes:create"],
    "expert": ["requests:read", "requests:respond", "quotes:create", "wallet:read", "wallet:withdraw"],
    "admin": ["admin:read", "admin:write", "services:manage", "applications:review", "disputes:resolve", "wallet:review"],
}


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def require_permission(payload: dict, permission: str) -> None:
    if permission not in payload.get("permissions", []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
