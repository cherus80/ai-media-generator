"""add_user_role_and_last_active

Revision ID: 6c08b5a2b943
Revises: 4e5ae641717a
Create Date: 2025-11-22 21:51:56.203844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '6c08b5a2b943'
down_revision: Union[str, None] = '4e5ae641717a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Создаем enum для ролей пользователей
    user_role_enum = sa.Enum('user', 'admin', name='user_role_enum', create_type=True)
    user_role_enum.create(op.get_bind(), checkfirst=True)

    # Добавляем поле role
    # Делаем nullable=True, чтобы избежать проблем с asyncpg и enum
    # Дефолтное значение будет устанавливаться на уровне модели Python
    op.add_column('users', sa.Column(
        'role',
        user_role_enum,
        nullable=True,
        comment='Роль пользователя (user, admin)'
    ))

    # Для существующих пользователей устанавливаем значение через ALTER TABLE DEFAULT
    # а затем UPDATE без параметров (если в БД есть данные)
    # Примечание: в новом приложении вероятно нет пользователей, поэтому UPDATE можно пропустить

    # Добавляем поле last_active_at
    op.add_column('users', sa.Column(
        'last_active_at',
        sa.DateTime(timezone=True),
        nullable=True,
        comment='Дата и время последней активности'
    ))

    # Создаем индексы для быстрого поиска
    op.create_index('idx_role', 'users', ['role'], unique=False)
    op.create_index('idx_last_active_at', 'users', ['last_active_at'], unique=False)


def downgrade() -> None:
    # Удаляем индексы
    op.drop_index('idx_last_active_at', table_name='users')
    op.drop_index('idx_role', table_name='users')

    # Удаляем поля
    op.drop_column('users', 'last_active_at')
    op.drop_column('users', 'role')

    # Удаляем enum
    sa.Enum(name='user_role_enum').drop(op.get_bind(), checkfirst=True)
