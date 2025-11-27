"""add fitting prompts table"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone

# revision identifiers, used by Alembic.
revision = "20251127_fit_prompts"
# down_revision равен фактическому revision merge-миграции (без префикса даты)
down_revision = "7f5aa99c2c1e"
branch_labels = None
depends_on = None


DEFAULT_PROMPTS = {
    "clothing": (
        "A high-quality fashion photoshoot showing a person wearing the clothing item. "
        "Professional studio lighting, clean background, realistic fit and draping. "
        "Photorealistic, 8k, detailed fabric texture."
    ),
    "head": (
        "Place the accessory on the existing head without changing the face or hairstyle. "
        "Keep the original head shape and pose, no extra heads or body parts. "
        "Professional portrait lighting, realistic placement, photorealistic 8k."
    ),
    "face": (
        "Overlay the accessory on the existing face (e.g., glasses/mask) keeping facial features intact. "
        "Do not add extra faces or heads, match perspective and scale to the current face. "
        "Natural lighting, realistic fit, photorealistic 8k."
    ),
    "neck": (
        "Place the accessory on the current neck/collarbone area, preserving the person’s pose and skin. "
        "No extra necks or bodies. Realistic jewelry placement, elegant portrait lighting, photorealistic 8k."
    ),
    "hands": (
        "Place the accessory precisely on the existing wrist of the person. "
        "Do not add or replace arms or hands; preserve the original arm shape, pose, and skin. "
        "Match scale, angle, and perspective to the current wrist; keep lighting and skin tone consistent. "
        "Avoid oversized accessories and avoid covering the body. Photorealistic, high detail, 8k quality."
    ),
    "legs": (
        "Place the footwear on the existing feet of the person. "
        "Do not add extra legs or change the body/pose. "
        "Match scale, angle, and perspective to the current feet and floor; keep background unchanged and original framing/aspect ratio. "
        "Preserve skin, ankles, and original lighting; avoid oversized or floating shoes. "
        "Do not add white or blank margins; do not extend canvas. Photorealistic, high detail, 8k quality."
    ),
    "body": (
        "Replace clothing on the existing body while keeping the person’s pose, proportions, and skin visible. "
        "No extra limbs or duplicated body parts. Realistic fit and draping, studio lighting, photorealistic 8k."
    ),
}


def upgrade() -> None:
    op.create_table(
        "fitting_prompts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("zone", sa.String(length=50), nullable=False, unique=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column(
            "updated_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Заполняем дефолтами, чтобы админ видел текущие тексты
    table = sa.table(
        "fitting_prompts",
        sa.column("zone", sa.String),
        sa.column("prompt", sa.Text),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        table,
        [
            {
                "zone": zone,
                "prompt": prompt,
                "created_at": now,
                "updated_at": now,
            }
            for zone, prompt in DEFAULT_PROMPTS.items()
        ],
    )


def downgrade() -> None:
    op.drop_table("fitting_prompts")
