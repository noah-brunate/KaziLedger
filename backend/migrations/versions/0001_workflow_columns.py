"""Add fields required by the persisted workflow actions.

The original MVP created its tables with SQLAlchemy at startup. These guarded
statements let an existing installation move to the workflow release without
requiring a destructive database reset.
"""

from alembic import op


revision = "0001_workflow_columns"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(24) NOT NULL DEFAULT 'client'")
    op.execute("ALTER TABLE expert_subcategories ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMPTZ")
    op.execute("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ")
    op.execute("ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS escrow_id UUID REFERENCES escrow_transactions(id)")


def downgrade() -> None:
    op.execute("ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS escrow_id")
    op.execute("ALTER TABLE quotes DROP COLUMN IF EXISTS expires_at")
    op.execute("ALTER TABLE expert_subcategories DROP COLUMN IF EXISTS interview_scheduled_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS role")
