"""add event log for example seo variant analytics

Revision ID: 20260215_ex_var_events
Revises: 20260215_ex_var_analytics
Create Date: 2026-02-15 16:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260215_ex_var_events"
down_revision: Union[str, None] = "20260215_ex_var_analytics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generation_example_variant_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("example_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="unknown"),
        sa.Column("seo_variant_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("event_type", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["example_id"], ["generation_examples.id"], ondelete="CASCADE"),
    )

    op.create_index(
        "ix_generation_example_variant_events_id",
        "generation_example_variant_events",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_events_example_id",
        "generation_example_variant_events",
        ["example_id"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_events_source",
        "generation_example_variant_events",
        ["source"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_events_seo_variant_index",
        "generation_example_variant_events",
        ["seo_variant_index"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_events_event_type",
        "generation_example_variant_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_events_created_at",
        "generation_example_variant_events",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_generation_example_variant_events_created_at",
        table_name="generation_example_variant_events",
    )
    op.drop_index(
        "ix_generation_example_variant_events_event_type",
        table_name="generation_example_variant_events",
    )
    op.drop_index(
        "ix_generation_example_variant_events_seo_variant_index",
        table_name="generation_example_variant_events",
    )
    op.drop_index(
        "ix_generation_example_variant_events_source",
        table_name="generation_example_variant_events",
    )
    op.drop_index(
        "ix_generation_example_variant_events_example_id",
        table_name="generation_example_variant_events",
    )
    op.drop_index(
        "ix_generation_example_variant_events_id",
        table_name="generation_example_variant_events",
    )
    op.drop_table("generation_example_variant_events")
