"""billing v5 actions + credits

Revision ID: 20251201_billing_v5
Revises: 20251128_merge_fit_refresh
Create Date: 2025-12-01 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251201_billing_v5"
down_revision: Union[str, None] = "20251128_merge_fit_refresh"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users: free trial flag and subscription start timestamp
    op.add_column(
        "users",
        sa.Column(
            "free_trial_granted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Выдан ли welcome-бонус кредитов",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Дата активации текущей подписки",
        ),
    )

    # remove server defaults after backfill
    op.alter_column("users", "free_trial_granted", server_default=None)

    # Allow new subscription value "standard" (legacy enum name kept)
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_type_enum') THEN
                BEGIN
                    ALTER TYPE subscription_type_enum ADD VALUE IF NOT EXISTS 'standard';
                EXCEPTION WHEN duplicate_object THEN NULL; END;
            END IF;
        END$$;
        """
    )

    # Ledger columns: widen to string values and add unit
    op.alter_column(
        "credits_ledger",
        "type",
        existing_type=sa.Enum(
            "tryon",
            "edit",
            "assistant",
            "subscription",
            "credit_purchase",
            name="ledger_entry_type_enum",
            native_enum=False,
        ),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
    op.alter_column(
        "credits_ledger",
        "source",
        existing_type=sa.Enum(
            "subscription",
            "freemium",
            "credits",
            name="ledger_source_enum",
            native_enum=False,
        ),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
    op.add_column(
        "credits_ledger",
        sa.Column(
            "unit",
            sa.String(length=16),
            nullable=False,
            server_default="credits",
            comment="Единица: credits или actions",
        ),
    )
    op.alter_column("credits_ledger", "unit", server_default=None)


def downgrade() -> None:
    # Ledger rollback (best effort)
    op.alter_column(
        "credits_ledger",
        "source",
        type_=sa.Enum(
            "subscription",
            "freemium",
            "credits",
            name="ledger_source_enum",
            native_enum=False,
        ),
        existing_type=sa.String(length=32),
        existing_nullable=False,
    )
    op.alter_column(
        "credits_ledger",
        "type",
        type_=sa.Enum(
            "tryon",
            "edit",
            "assistant",
            "subscription",
            "credit_purchase",
            name="ledger_entry_type_enum",
            native_enum=False,
        ),
        existing_type=sa.String(length=64),
        existing_nullable=False,
    )
    op.drop_column("credits_ledger", "unit")

    # Users
    op.drop_column("users", "subscription_started_at")
    op.drop_column("users", "free_trial_granted")
