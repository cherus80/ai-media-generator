"""Utilities shared by Celery generation tasks."""

from __future__ import annotations

import logging
import base64
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generation import Generation
from app.models.user import User

logger = logging.getLogger(__name__)


async def update_generation_status(
    session: AsyncSession,
    generation_id: int,
    status: str,
    progress: Optional[int] = None,
    image_url: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """
    Persist generation progress or results in the database.

    Args:
        session: Active async database session.
        generation_id: Target generation primary key.
        status: New generation status (processing/completed/failed).
        progress: Optional completion percentage.
        image_url: Optional final image URL.
        error_message: Optional error details to store.
    """
    generation = await session.get(Generation, generation_id)
    if not generation:
        logger.error(
            "Generation %s not found while updating status to %s",
            generation_id,
            status,
        )
        return

    generation.status = status

    if progress is not None:
        generation.progress = progress

    if image_url is not None:
        generation.image_url = image_url

    if error_message:
        generation.error_message = error_message

    await session.commit()


def should_add_watermark(user: User) -> bool:
    """
    Determine if a freemium watermark should be applied for the user.

    Returns:
        True when the user lacks paid credits/subscription and should get a watermark.
    """
    if user.balance_credits > 0:
        return False

    if getattr(user, "has_active_subscription", False):
        return False

    return True


def extract_file_id_from_url(url: str) -> str:
    """
    Extract stored file identifier from an uploaded file URL.

    Example:
        /uploads/1234-abcd.png -> 1234-abcd
    """
    return url.rstrip("/").split("/")[-1].split(".")[0]


def image_to_base64_data_url(file_path: str | Path) -> str:
    """
    Convert a local image into a base64 data URL.

    Args:
        file_path: Filesystem path to the image.

    Returns:
        A data URL (data:image/<mime>;base64,...)
    """
    path = Path(file_path)
    data = path.read_bytes()

    if path.suffix.lower() == ".png":
        mime = "image/png"
    elif path.suffix.lower() in {".jpg", ".jpeg"}:
        mime = "image/jpeg"
    elif path.suffix.lower() == ".webp":
        mime = "image/webp"
    else:
        mime = "image/jpeg"

    return f"data:{mime};base64,{base64.b64encode(data).decode('utf-8')}"
