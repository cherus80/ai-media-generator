"""add user login metadata for anti multiaccounting

Revision ID: 20260212_user_login_meta
Revises: 20260211_yandex_tg_widget_auth
Create Date: 2026-02-12 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260212_user_login_meta"
down_revision: Union[str, None] = "20260211_yandex_tg_widget_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Дата и время последней успешной авторизации",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_ip",
            sa.String(length=64),
            nullable=True,
            comment="IP адрес последнего входа",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_user_agent",
            sa.String(length=1024),
            nullable=True,
            comment="Raw User-Agent последнего входа",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_device",
            sa.String(length=255),
            nullable=True,
            comment="Краткая сводка устройства последнего входа",
        ),
    )

    op.create_index("idx_last_login_at", "users", ["last_login_at"], unique=False)
    op.create_index("idx_last_login_ip", "users", ["last_login_ip"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_last_login_ip", table_name="users")
    op.drop_index("idx_last_login_at", table_name="users")

    op.drop_column("users", "last_login_device")
    op.drop_column("users", "last_login_user_agent")
    op.drop_column("users", "last_login_ip")
    op.drop_column("users", "last_login_at")
