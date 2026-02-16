"""exclude admin actions from example analytics and reset polluted stats

Revision ID: 20260216_ex_no_admin
Revises: 20260215_ex_var_events
Create Date: 2026-02-16 11:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260216_ex_no_admin"
down_revision: Union[str, None] = "20260215_ex_var_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "generation_example_variant_events",
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_generation_example_variant_events_actor_user_id",
        "generation_example_variant_events",
        ["actor_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_ex_var_events_actor_user",
        "generation_example_variant_events",
        "users",
        ["actor_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Исторические метрики были загрязнены действиями админов.
    # Поскольку в старых событиях нет actor_user_id, делаем полный reset,
    # чтобы с этого релиза собирать только чистую статистику.
    op.execute("DELETE FROM generation_example_variant_events")
    op.execute("DELETE FROM generation_example_variant_stats")
    op.execute("UPDATE generation_examples SET uses_count = 0")


def downgrade() -> None:
    op.drop_constraint(
        "fk_ex_var_events_actor_user",
        "generation_example_variant_events",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_generation_example_variant_events_actor_user_id",
        table_name="generation_example_variant_events",
    )
    op.drop_column("generation_example_variant_events", "actor_user_id")
