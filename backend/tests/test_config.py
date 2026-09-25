from app.config import Settings


def test_standard_postgres_url_uses_asyncpg() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgresql://postgres:secret@example.supabase.co:5432/postgres",
    )

    assert settings.database_url.startswith("postgresql+asyncpg://")


def test_cors_origins_are_trimmed_and_deduplicated() -> None:
    settings = Settings(
        _env_file=None,
        client_url="http://localhost:3000/",
        client_urls="https://kaziledger.vercel.app, http://localhost:3000",
    )

    assert settings.cors_origins == [
        "http://localhost:3000",
        "https://kaziledger.vercel.app",
    ]
