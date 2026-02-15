"""
Утилиты для генерации и проверки slug.
"""

from __future__ import annotations

import re
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GenerationExample, GenerationExampleSlug


_CYRILLIC_MAP = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "h",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def slugify(value: str | None, fallback: str = "example") -> str:
    """
    Преобразует произвольную строку в URL-friendly slug.
    """
    source = (value or "").strip().lower()
    if not source:
        return fallback

    translated = "".join(_CYRILLIC_MAP.get(char, char) for char in source)
    normalized = re.sub(r"[^a-z0-9]+", "-", translated)
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized or fallback


async def slug_exists(
    db: AsyncSession,
    slug: str,
    *,
    exclude_example_id: Optional[int] = None,
) -> bool:
    """
    Проверяет, занят ли slug в актуальных или исторических ссылках.
    """
    example_stmt = sa.select(GenerationExample.id).where(GenerationExample.slug == slug)
    history_stmt = sa.select(GenerationExampleSlug.example_id).where(GenerationExampleSlug.slug == slug)

    if exclude_example_id is not None:
        example_stmt = example_stmt.where(GenerationExample.id != exclude_example_id)
        history_stmt = history_stmt.where(GenerationExampleSlug.example_id != exclude_example_id)

    example_row = await db.execute(example_stmt.limit(1))
    if example_row.scalar_one_or_none() is not None:
        return True

    history_row = await db.execute(history_stmt.limit(1))
    return history_row.scalar_one_or_none() is not None


async def generate_unique_slug(
    db: AsyncSession,
    base_value: str | None,
    *,
    fallback_prefix: str = "example",
    exclude_example_id: Optional[int] = None,
) -> str:
    """
    Генерирует уникальный slug с суффиксом, если базовый уже занят.
    """
    base = slugify(base_value, fallback=fallback_prefix)
    candidate = base
    suffix = 2

    while await slug_exists(db, candidate, exclude_example_id=exclude_example_id):
        candidate = f"{base}-{suffix}"
        suffix += 1

    return candidate
