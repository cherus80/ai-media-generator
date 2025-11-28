"""add oauth refresh token fields to users

Revision ID: 20251128_1200_add_oauth_refresh_token_fields
Revises: 20251126_1605_7f5aa99c2c1e_merge_vk_and_billing_heads
Create Date: 2025-11-28 12:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251128_1200_add_oauth_refresh_token_fields"
down_revision: Union[str, None] = "20251126_1605_7f5aa99c2c1e_merge_vk_and_billing_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "oauth_refresh_token",
            sa.String(length=512),
            nullable=True,
            comment="OAuth provider refresh token (stored server-side only)",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "oauth_access_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Access token expiry (from OAuth provider)",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "oauth_access_expires_at")
    op.drop_column("users", "oauth_refresh_token")
