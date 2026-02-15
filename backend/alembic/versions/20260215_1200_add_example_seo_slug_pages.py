"""add slug and seo fields for generation examples

Revision ID: 20260215_examples_slug_seo
Revises: 20260212_user_login_meta
Create Date: 2026-02-15 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260215_examples_slug_seo"
down_revision: Union[str, None] = "20260212_user_login_meta"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("generation_examples", sa.Column("slug", sa.String(length=240), nullable=True))
    op.add_column("generation_examples", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("generation_examples", sa.Column("seo_title", sa.String(length=120), nullable=True))
    op.add_column("generation_examples", sa.Column("seo_description", sa.String(length=200), nullable=True))

    op.execute(
        """
        UPDATE generation_examples
        SET slug = CONCAT('example-', id)
        WHERE slug IS NULL OR slug = '';
        """
    )

    op.create_index("ix_generation_examples_slug", "generation_examples", ["slug"], unique=True)
    op.alter_column("generation_examples", "slug", nullable=False)

    op.create_table(
        "generation_example_slugs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("example_id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=240), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["example_id"], ["generation_examples.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("slug", name="uq_generation_example_slugs_slug"),
    )
    op.create_index("ix_generation_example_slugs_id", "generation_example_slugs", ["id"], unique=False)
    op.create_index("ix_generation_example_slugs_example_id", "generation_example_slugs", ["example_id"], unique=False)
    op.create_index("ix_generation_example_slugs_slug", "generation_example_slugs", ["slug"], unique=False)

    op.execute(
        """
        INSERT INTO generation_example_slugs (example_id, slug)
        SELECT id, slug
        FROM generation_examples;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_generation_example_slugs_slug", table_name="generation_example_slugs")
    op.drop_index("ix_generation_example_slugs_example_id", table_name="generation_example_slugs")
    op.drop_index("ix_generation_example_slugs_id", table_name="generation_example_slugs")
    op.drop_table("generation_example_slugs")

    op.drop_index("ix_generation_examples_slug", table_name="generation_examples")
    op.drop_column("generation_examples", "seo_description")
    op.drop_column("generation_examples", "seo_title")
    op.drop_column("generation_examples", "description")
    op.drop_column("generation_examples", "slug")
