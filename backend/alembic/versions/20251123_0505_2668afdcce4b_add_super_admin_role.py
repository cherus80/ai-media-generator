"""add_super_admin_role

Revision ID: 2668afdcce4b
Revises: 6c08b5a2b943
Create Date: 2025-11-23 05:05:42.110881

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2668afdcce4b'
down_revision: Union[str, None] = '6c08b5a2b943'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Добавляет роль SUPER_ADMIN в enum.

    Примечание: UPDATE users будет выполнен в следующей миграции,
    т.к. PostgreSQL требует commit между ADD VALUE и использованием нового значения.
    """
    # Добавить SUPER_ADMIN в enum user_role_enum (PostgreSQL)
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'")


def downgrade() -> None:
    """
    Откат: возвращает SUPER_ADMIN обратно в ADMIN.

    Примечание: Удаление значения из PostgreSQL ENUM требует
    пересоздания типа, поэтому просто конвертируем роли обратно.
    """
    # Вернуть SUPER_ADMIN обратно в ADMIN
    op.execute("""
        UPDATE users
        SET role = 'ADMIN'
        WHERE role = 'SUPER_ADMIN'
    """)
