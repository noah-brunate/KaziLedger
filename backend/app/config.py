from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5431/kaziledger"
    jwt_secret: str = Field("development-only-secret-change-me", min_length=24)
    client_url: str = "http://localhost:3000"
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

    @property
    def pesapal_base_url(self) -> str:
        if self.pesapal_environment == "production":
            return "https://pay.pesapal.com/v3/api"
        return "https://cybqa.pesapal.com/pesapalv3/api"


@lru_cache
def get_settings() -> Settings:
    return Settings()
