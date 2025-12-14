"""add is_hidden flag for payments history

Revision ID: 20251214_payments_hide
Revises: 20251212_user_consents
Create Date: 2025-12-14 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251214_payments_hide"
down_revision: Union[str, None] = "20251212_user_consents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column(
            "is_hidden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Скрыт ли платёж из истории пользователя",
        ),
    )
    op.create_index("idx_payments_is_hidden", "payments", ["is_hidden"])


def downgrade() -> None:
    op.drop_index("idx_payments_is_hidden", table_name="payments")
    op.drop_column("payments", "is_hidden")

