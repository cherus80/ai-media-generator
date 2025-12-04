"""Utilities shared by Celery generation tasks."""

from __future__ import annotations

import logging
import base64
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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
    Determine if a watermark should be applied (нет оплаченных балансов).

    Returns:
        True when the user lacks оплаченные кредиты/действия.
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


def resolve_public_base_url() -> str:
    """
    Получить публичный базовый URL для раздачи файлов/ссылок.
    Если BACKEND_URL остался локальным, а окружение production — подставляем FRONTEND_URL.
    """
    backend = settings.BACKEND_URL.rstrip("/")
    is_local_backend = backend.startswith("http://localhost") or backend.startswith("http://127.0.0.1")
    if is_local_backend and settings.ENVIRONMENT.lower() == "production" and settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip("/")
    return backend


def to_public_url(path_or_url: str) -> str:
    """
    Превратить относительный путь в публичный абсолютный URL.
    """
    if not path_or_url:
        return path_or_url

    # Если получили полный URL, но он указывает на localhost — заменяем на публичный базовый
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        parsed = urlparse(path_or_url)
        if parsed.hostname in {"localhost", "127.0.0.1"}:
            base = resolve_public_base_url().rstrip("/")
            rebuilt = f"{base}{parsed.path or ''}"
            if parsed.query:
                rebuilt = f"{rebuilt}?{parsed.query}"
            return rebuilt
        return path_or_url

    trimmed = path_or_url.lstrip("./")
    base = resolve_public_base_url()
    return f"{base}/{trimmed.lstrip('/')}"
