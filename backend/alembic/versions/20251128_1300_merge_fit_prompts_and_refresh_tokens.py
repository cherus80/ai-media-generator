"""merge fit prompts and refresh token branches

Revision ID: 20251128_1300_merge_fit_prompts_and_refresh_tokens
Revises: 20251127_fit_prompts, 20251128_1200_add_oauth_refresh_token_fields
Create Date: 2025-11-28 13:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "20251128_merge_fit_refresh"
down_revision: Union[str, None] = ("20251127_fit_prompts", "20251128_refresh_tokens")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
