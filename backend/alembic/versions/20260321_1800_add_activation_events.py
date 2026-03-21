"""add activation events table

Revision ID: 20260321_activation_events
Revises: 20260216_1100_exclude_admin_example_stats
Create Date: 2026-03-21 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260321_activation_events"
down_revision: Union[str, None] = "20260216_ex_no_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activation_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("event_name", sa.String(length=64), nullable=False),
        sa.Column("anonymous_id", sa.String(length=128), nullable=True),
        sa.Column("session_id", sa.String(length=128), nullable=True),
        sa.Column("flow_id", sa.String(length=128), nullable=True),
        sa.Column("route", sa.String(length=255), nullable=True),
        sa.Column("entry_source", sa.String(length=128), nullable=True),
        sa.Column("utm_source", sa.String(length=128), nullable=True),
        sa.Column("utm_medium", sa.String(length=128), nullable=True),
        sa.Column("utm_campaign", sa.String(length=128), nullable=True),
        sa.Column("utm_content", sa.String(length=128), nullable=True),
        sa.Column("utm_term", sa.String(length=128), nullable=True),
        sa.Column("referral_code", sa.String(length=64), nullable=True),
        sa.Column("generation_id", sa.Integer(), nullable=True),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    op.create_index("ix_activation_events_id", "activation_events", ["id"], unique=False)
    op.create_index("ix_activation_events_user_id", "activation_events", ["user_id"], unique=False)
    op.create_index("ix_activation_events_event_name", "activation_events", ["event_name"], unique=False)
    op.create_index("ix_activation_events_anonymous_id", "activation_events", ["anonymous_id"], unique=False)
    op.create_index("ix_activation_events_session_id", "activation_events", ["session_id"], unique=False)
    op.create_index("ix_activation_events_flow_id", "activation_events", ["flow_id"], unique=False)
    op.create_index("ix_activation_events_entry_source", "activation_events", ["entry_source"], unique=False)
    op.create_index("ix_activation_events_generation_id", "activation_events", ["generation_id"], unique=False)
    op.create_index(
        "idx_activation_event_user_name_created",
        "activation_events",
        ["user_id", "event_name", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_activation_event_anon_name_created",
        "activation_events",
        ["anonymous_id", "event_name", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_activation_event_anon_name_created", table_name="activation_events")
    op.drop_index("idx_activation_event_user_name_created", table_name="activation_events")
    op.drop_index("ix_activation_events_generation_id", table_name="activation_events")
    op.drop_index("ix_activation_events_entry_source", table_name="activation_events")
    op.drop_index("ix_activation_events_flow_id", table_name="activation_events")
    op.drop_index("ix_activation_events_session_id", table_name="activation_events")
    op.drop_index("ix_activation_events_anonymous_id", table_name="activation_events")
    op.drop_index("ix_activation_events_event_name", table_name="activation_events")
    op.drop_index("ix_activation_events_user_id", table_name="activation_events")
    op.drop_index("ix_activation_events_id", table_name="activation_events")
    op.drop_table("activation_events")
