import uuid
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, status

from app.config import Settings


@dataclass(frozen=True)
class SupabaseUser:
    id: uuid.UUID
    email: str | None
    phone: str | None


async def verify_supabase_access_token(
    token: str,
    *,
    client: httpx.AsyncClient,
    settings: Settings,
) -> SupabaseUser:
    """Validate a browser access token against the Supabase Auth server."""
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured",
        )

    try:
        response = await client.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": settings.supabase_publishable_key,
                "Authorization": f"Bearer {token}",
            },
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable",
        ) from exc

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )

    payload = response.json()
    try:
        user_id = uuid.UUID(payload["id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication response",
        ) from exc

    return SupabaseUser(id=user_id, email=payload.get("email"), phone=payload.get("phone"))
