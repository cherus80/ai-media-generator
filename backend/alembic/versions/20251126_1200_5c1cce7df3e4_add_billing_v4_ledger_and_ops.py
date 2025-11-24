"""add_billing_v4_ledger_and_ops

Revision ID: 5c1cce7df3e4
Revises: 646ff6770cea
Create Date: 2025-11-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c1cce7df3e4'
down_revision: Union[str, None] = '646ff6770cea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums for ledger
    ledger_entry_type_enum = sa.Enum(
        'tryon',
        'edit',
        'assistant',
        'subscription',
        'credit_purchase',
        name='ledger_entry_type_enum',
    )
    ledger_source_enum = sa.Enum(
        'subscription',
        'freemium',
        'credits',
        name='ledger_source_enum',
    )
    bind = op.get_bind()
    ledger_entry_type_enum.create(bind, checkfirst=True)
    ledger_source_enum.create(bind, checkfirst=True)

    # Subscription ops fields on users
    op.add_column(
        'users',
        sa.Column(
            'subscription_ops_limit',
            sa.Integer(),
            nullable=False,
            server_default='0',
            comment='Месячный лимит операций по подписке',
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'subscription_ops_used',
            sa.Integer(),
            nullable=False,
            server_default='0',
            comment='Сколько операций потрачено в текущем периоде подписки',
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'subscription_ops_reset_at',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Дата последнего сброса лимита подписки',
        ),
    )

    # Drop server defaults so future inserts rely on application defaults
    op.alter_column(
        'users',
        'subscription_ops_limit',
        server_default=None,
        existing_type=sa.Integer(),
    )
    op.alter_column(
        'users',
        'subscription_ops_used',
        server_default=None,
        existing_type=sa.Integer(),
    )

    # credits_ledger table
    op.create_table(
        'credits_ledger',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', ledger_entry_type_enum, nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False, comment='Положительное число для начисления, отрицательное для списания'),
        sa.Column('source', ledger_source_enum, nullable=False, comment='Источник операции: подписка, freemium или кредиты'),
        sa.Column('meta', sa.JSON(), nullable=True, comment='Дополнительные данные (payment_id, generation_id и т.д.)'),
        sa.Column('idempotency_key', sa.String(length=255), nullable=True, unique=True, comment='Ключ идемпотентности для платежей/вебхуков'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_credits_ledger_user_created', 'credits_ledger', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_credits_ledger_id'), 'credits_ledger', ['id'], unique=False)
    op.create_index(op.f('ix_credits_ledger_user_id'), 'credits_ledger', ['user_id'], unique=False)


def downgrade() -> None:
    # Drop ledger table
    op.drop_index(op.f('ix_credits_ledger_user_id'), table_name='credits_ledger')
    op.drop_index(op.f('ix_credits_ledger_id'), table_name='credits_ledger')
    op.drop_index('idx_credits_ledger_user_created', table_name='credits_ledger')
    op.drop_table('credits_ledger')

    # Drop user columns
    op.drop_column('users', 'subscription_ops_reset_at')
    op.drop_column('users', 'subscription_ops_used')
    op.drop_column('users', 'subscription_ops_limit')

    # Drop enums
    bind = op.get_bind()
    sa.Enum(name='ledger_entry_type_enum').drop(bind, checkfirst=True)
    sa.Enum(name='ledger_source_enum').drop(bind, checkfirst=True)
