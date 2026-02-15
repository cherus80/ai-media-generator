"""add seo variant analytics for generation examples

Revision ID: 20260215_example_variant_analytics
Revises: 20260215_examples_slug_seo
Create Date: 2026-02-15 15:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260215_example_variant_analytics"
down_revision: Union[str, None] = "20260215_examples_slug_seo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "generation_examples",
        sa.Column("seo_variant_index", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "generation_example_variant_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("example_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="unknown"),
        sa.Column("seo_variant_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("views_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("starts_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["example_id"], ["generation_examples.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "example_id",
            "source",
            "seo_variant_index",
            name="uq_generation_example_variant_stats_example_source_variant",
        ),
    )
    op.create_index(
        "ix_generation_example_variant_stats_id",
        "generation_example_variant_stats",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_stats_example_id",
        "generation_example_variant_stats",
        ["example_id"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_stats_source",
        "generation_example_variant_stats",
        ["source"],
        unique=False,
    )
    op.create_index(
        "ix_generation_example_variant_stats_seo_variant_index",
        "generation_example_variant_stats",
        ["seo_variant_index"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_generation_example_variant_stats_seo_variant_index",
        table_name="generation_example_variant_stats",
    )
    op.drop_index(
        "ix_generation_example_variant_stats_source",
        table_name="generation_example_variant_stats",
    )
    op.drop_index(
        "ix_generation_example_variant_stats_example_id",
        table_name="generation_example_variant_stats",
    )
    op.drop_index(
        "ix_generation_example_variant_stats_id",
        table_name="generation_example_variant_stats",
    )
    op.drop_table("generation_example_variant_stats")
    op.drop_column("generation_examples", "seo_variant_index")
