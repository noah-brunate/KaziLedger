from decimal import Decimal

from sqlalchemy import select, text

from app.config import Settings
from app.database import Base, SessionLocal, engine
from app.models import Permission, PriceBand, Role, ServiceSubcategory
from app.security import ROLE_PERMISSIONS

SERVICES = (
    ("Finance & accounting", "Bookkeeping", Decimal("150000"), Decimal("1200000")),
    ("Finance & accounting", "Tax filing & compliance", Decimal("250000"), Decimal("2500000")),
    ("Business operations", "Payroll management", Decimal("200000"), Decimal("1800000")),
    ("Legal & compliance", "Business registration", Decimal("200000"), Decimal("1800000")),
    ("Technology", "Website development", Decimal("400000"), Decimal("5000000")),
    ("Creative services", "Brand & graphic design", Decimal("150000"), Decimal("2500000")),
)


async def initialize_database(settings: Settings) -> None:
    if not settings.auto_create_schema:
        return

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # Keep existing local databases compatible while hosted deployments use
        # explicit migrations.
        await connection.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(24) NOT NULL DEFAULT 'client'"
            )
        )
        await connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID")
        )
        await connection.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
        await connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL"
            )
        )
        await connection.execute(
            text(
                "ALTER TABLE expert_subcategories ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMPTZ"
            )
        )
        await connection.execute(
            text("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ")
        )
        await connection.execute(
            text(
                "ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS escrow_id UUID REFERENCES escrow_transactions(id)"
            )
        )
        await connection.execute(
            text("ALTER TABLE wallets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)")
        )
        await connection.execute(text("ALTER TABLE wallets ALTER COLUMN expert_id DROP NOT NULL"))
        await connection.execute(
            text(
                "UPDATE wallets SET user_id = expert_id WHERE user_id IS NULL AND expert_id IS NOT NULL"
            )
        )
        await connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_wallets_user_id ON wallets(user_id) WHERE user_id IS NOT NULL"
            )
        )

    if not settings.seed_demo_data:
        return

    async with SessionLocal() as session:
        for role_name, permission_names in ROLE_PERMISSIONS.items():
            role = await session.scalar(select(Role).where(Role.name == role_name))
            if not role:
                session.add(
                    Role(name=role_name, description=f"{role_name.title()} access", is_system=True)
                )
            for permission_name in permission_names:
                permission = await session.scalar(
                    select(Permission).where(Permission.name == permission_name)
                )
                if not permission:
                    session.add(Permission(name=permission_name, description=permission_name))

        existing = await session.scalar(select(ServiceSubcategory.id).limit(1))
        if existing:
            await session.commit()
            return

        for category, name, minimum, maximum in SERVICES:
            service = ServiceSubcategory(
                category=category,
                name=name,
                scope_schema={"required": ["description", "deadline"]},
            )
            session.add(service)
            await session.flush()
            session.add_all(
                [
                    PriceBand(
                        subcategory_id=service.id,
                        client_type="individual",
                        minimum=minimum,
                        maximum=maximum,
                    ),
                    PriceBand(
                        subcategory_id=service.id,
                        client_type="business",
                        minimum=minimum * Decimal("1.5"),
                        maximum=maximum * Decimal("1.5"),
                    ),
                ]
            )
        await session.commit()
