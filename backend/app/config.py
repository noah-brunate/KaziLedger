from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5431/kaziledger"
    database_pool_mode: Literal["persistent", "transaction"] = "persistent"
    database_ssl: bool = False
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    client_url: str = "http://localhost:3000"
    client_urls: str = ""
    cors_origin_regex: str = ""
    default_currency: str = "UGX"
    expert_response_hours: int = 24
    escrow_release_hours: int = 72
    platform_commission_rate: float = 0.10
    auto_create_schema: bool = True
    seed_demo_data: bool = True
    pesapal_environment: str = "sandbox"
    pesapal_consumer_key: str = ""
    pesapal_consumer_secret: str = ""
    pesapal_ipn_id: str = ""
    pesapal_ipn_url: str = ""
    pesapal_callback_url: str = "http://localhost:3000/payments/callback"

    @field_validator("database_url")
    @classmethod
    def use_asyncpg_driver(cls, value: str) -> str:
        """Accept Supabase's standard Postgres URL with the async backend driver."""
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        return value

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.client_url, *self.client_urls.split(",")]
        return list(
            dict.fromkeys(origin.strip().rstrip("/") for origin in origins if origin.strip())
        )

    @property
    def pesapal_base_url(self) -> str:
        if self.pesapal_environment == "production":
            return "https://pay.pesapal.com/v3/api"
        return "https://cybqa.pesapal.com/pesapalv3/api"


@lru_cache
def get_settings() -> Settings:
    return Settings()
