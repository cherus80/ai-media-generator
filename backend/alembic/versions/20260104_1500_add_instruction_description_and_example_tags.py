"""add instruction description and example tags

Revision ID: 20260104_instruction_tags
Revises: 20260104_instructions_examples
Create Date: 2026-01-04 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260104_instruction_tags"
down_revision: Union[str, None] = "20260104_instructions_examples"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("instructions", sa.Column("description", sa.String(length=300), nullable=True))

    op.create_table(
        "generation_example_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("example_id", sa.Integer(), nullable=False),
        sa.Column("tag", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["example_id"], ["generation_examples.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("example_id", "tag", name="uq_generation_example_tag"),
    )
    op.create_index("ix_generation_example_tags_id", "generation_example_tags", ["id"])
    op.create_index("ix_generation_example_tags_example_id", "generation_example_tags", ["example_id"])
    op.create_index("ix_generation_example_tags_tag", "generation_example_tags", ["tag"])


def downgrade() -> None:
    op.drop_index("ix_generation_example_tags_tag", table_name="generation_example_tags")
    op.drop_index("ix_generation_example_tags_example_id", table_name="generation_example_tags")
    op.drop_index("ix_generation_example_tags_id", table_name="generation_example_tags")
    op.drop_table("generation_example_tags")

    op.drop_column("instructions", "description")
