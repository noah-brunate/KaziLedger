import uuid

import httpx
import pytest
from fastapi import HTTPException

from app.config import Settings
from app.supabase_auth import verify_supabase_access_token

PROJECT_URL = "https://example.supabase.co"
PUBLISHABLE_KEY = "sb_publishable_test"


def auth_settings() -> Settings:
    return Settings(
        _env_file=None,
        supabase_url=PROJECT_URL,
        supabase_publishable_key=PUBLISHABLE_KEY,
    )


@pytest.mark.asyncio
async def test_verifies_token_with_supabase_auth_server() -> None:
    user_id = uuid.uuid4()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == f"{PROJECT_URL}/auth/v1/user"
        assert request.headers["apikey"] == PUBLISHABLE_KEY
        assert request.headers["authorization"] == "Bearer valid-token"
        return httpx.Response(
            200,
            json={"id": str(user_id), "email": "client@example.com", "phone": None},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        user = await verify_supabase_access_token(
            "valid-token", client=client, settings=auth_settings()
        )

    assert user.id == user_id
    assert user.email == "client@example.com"


@pytest.mark.asyncio
async def test_rejects_token_supabase_does_not_accept() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(401, json={"message": "bad jwt"}))

    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(HTTPException) as error:
            await verify_supabase_access_token("bad-token", client=client, settings=auth_settings())

    assert error.value.status_code == 401
