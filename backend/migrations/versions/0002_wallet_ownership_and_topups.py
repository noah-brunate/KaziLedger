"""Add user-owned wallets and Pesapal wallet top-ups."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_wallet_ownership_and_topups"
down_revision = "0001_workflow_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("wallets", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_wallets_user_id", "wallets", "users", ["user_id"], ["id"])
    op.alter_column("wallets", "expert_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.execute("UPDATE wallets SET user_id = expert_id WHERE user_id IS NULL AND expert_id IS NOT NULL")
    op.create_index("ix_wallets_user_id", "wallets", ["user_id"], unique=True, postgresql_where=sa.text("user_id IS NOT NULL"))
    op.create_table(
        "wallet_topups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("wallets.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("pesapal_tracking_id", sa.String(120), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_wallet_topups_wallet_id", "wallet_topups", ["wallet_id"])


def downgrade() -> None:
    op.drop_index("ix_wallet_topups_wallet_id", table_name="wallet_topups")
    op.drop_table("wallet_topups")
    op.drop_index("ix_wallets_user_id", table_name="wallets")
    op.drop_constraint("fk_wallets_user_id", "wallets", type_="foreignkey")
    op.drop_column("wallets", "user_id")
