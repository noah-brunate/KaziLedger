from collections.abc import AsyncIterator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
database_url = make_url(settings.database_url)
engine_options: dict = {"pool_pre_ping": True}

if settings.database_ssl:
    engine_options["connect_args"] = {"ssl": "require"}

if settings.database_pool_mode == "transaction":
    # Supabase's transaction pooler is designed for short-lived serverless
    # workers. Avoid retaining application-side connections or prepared
    # statements across transactions.
    database_url = database_url.update_query_dict({"prepared_statement_cache_size": "0"})
    engine_options["poolclass"] = NullPool
    engine_options.setdefault("connect_args", {})["statement_cache_size"] = 0

engine = create_async_engine(database_url, **engine_options)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
