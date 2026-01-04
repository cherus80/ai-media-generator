"""add instructions and generation examples

Revision ID: 20260104_instructions_examples
Revises: 20251214_payments_hide
Create Date: 2026-01-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260104_instructions_examples"
down_revision: Union[str, None] = "20251214_payments_hide"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'instruction_type') THEN
                CREATE TYPE instruction_type AS ENUM ('video', 'text');
            END IF;
        END
        $$;
        """
    )
    instruction_type = postgresql.ENUM("video", "text", name="instruction_type", create_type=False)

    op.create_table(
        "instructions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", instruction_type, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_instructions_id", "instructions", ["id"])
    op.create_index("ix_instructions_type", "instructions", ["type"])

    op.create_table(
        "generation_examples",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("uses_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_generation_examples_id", "generation_examples", ["id"])
    op.create_index("ix_generation_examples_uses_count", "generation_examples", ["uses_count"])


def downgrade() -> None:
    op.drop_index("ix_generation_examples_uses_count", table_name="generation_examples")
    op.drop_index("ix_generation_examples_id", table_name="generation_examples")
    op.drop_table("generation_examples")

    op.drop_index("ix_instructions_type", table_name="instructions")
    op.drop_index("ix_instructions_id", table_name="instructions")
    op.drop_table("instructions")

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'instruction_type') THEN
                DROP TYPE instruction_type;
            END IF;
        END
        $$;
        """
    )
