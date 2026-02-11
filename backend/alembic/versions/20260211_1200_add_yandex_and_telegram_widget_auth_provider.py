"""add yandex and telegram_widget auth providers

Revision ID: 20260211_add_auth_provider_yandex_tg_widget
Revises: 20260125_add_notifications
Create Date: 2026-02-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260211_add_auth_provider_yandex_tg_widget"
down_revision: Union[str, None] = "20260125_add_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ADD VALUE должен выполняться вне транзакции
    op.execute("COMMIT")
    op.execute("ALTER TYPE auth_provider_enum ADD VALUE IF NOT EXISTS 'yandex'")

    op.execute("COMMIT")
    op.execute("ALTER TYPE auth_provider_enum ADD VALUE IF NOT EXISTS 'telegram_widget'")


def downgrade() -> None:
    connection = op.get_bind()
    yandex_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE auth_provider = 'yandex'")
    ).scalar()
    tg_widget_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE auth_provider = 'telegram_widget'")
    ).scalar()

    if yandex_count or tg_widget_count:
        raise Exception(
            "Cannot downgrade: users exist with auth_provider='yandex' or 'telegram_widget'. "
            "Migrate these users to another auth provider first."
        )

    # PostgreSQL не поддерживает удаление enum values напрямую.
    print(
        "WARNING: Downgrade requires manual enum recreation without "
        "'yandex' and 'telegram_widget'."
    )
