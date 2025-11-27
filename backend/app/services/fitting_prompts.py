"""
Сервис для работы с промптами зон примерки.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fitting_prompt import FittingPrompt

# Доступные зоны
PROMPT_ZONES = ["clothing", "head", "face", "neck", "hands", "legs", "body"]

# Дефолтные промпты (совпадают с теми, что были захардкожены в Celery задаче)
DEFAULT_FITTING_PROMPTS = {
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


def _normalize_zone(zone: Optional[str]) -> str:
    """
    Привести зону к ключу для словаря.
    None означает одежду (clothing).
    """
    return (zone or "clothing").lower()


async def get_prompt_for_zone(session: AsyncSession, zone: Optional[str]) -> str:
    """
    Получить промпт для зоны с fallback к дефолту.
    """
    zone_key = _normalize_zone(zone)
    stmt = select(FittingPrompt.prompt).where(FittingPrompt.zone == zone_key)
    result = await session.execute(stmt)
    prompt = result.scalar_one_or_none()
    if prompt:
        return prompt
    return DEFAULT_FITTING_PROMPTS.get(zone_key, DEFAULT_FITTING_PROMPTS["clothing"])


async def list_prompts(session: AsyncSession) -> list[dict]:
    """
    Получить список промптов с флагом, кастомный ли он.
    """
    stmt = select(FittingPrompt)
    result = await session.execute(stmt)
    rows = {item.zone: item for item in result.scalars().all()}

    items = []
    for zone in PROMPT_ZONES:
        db_item = rows.get(zone)
        prompt = db_item.prompt if db_item else DEFAULT_FITTING_PROMPTS[zone]
        is_default = prompt == DEFAULT_FITTING_PROMPTS[zone]
        items.append(
            {
                "zone": zone,
                "prompt": prompt,
                "is_default": is_default,
                "updated_at": db_item.updated_at if db_item else None,
                "updated_by_user_id": db_item.updated_by_user_id if db_item else None,
            }
        )
    return items


async def upsert_prompt(
    session: AsyncSession,
    zone: str,
    prompt: str,
    updated_by_user_id: Optional[int] = None,
) -> dict:
    """
    Сохранить промпт для зоны.
    """
    zone_key = _normalize_zone(zone)
    if zone_key not in PROMPT_ZONES:
        raise ValueError(f"Unknown zone: {zone}")

    prompt = prompt.strip()
    if not prompt:
        raise ValueError("Prompt must not be empty")

    stmt = select(FittingPrompt).where(FittingPrompt.zone == zone_key)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.prompt = prompt
        existing.updated_by_user_id = updated_by_user_id
        await session.commit()
        await session.refresh(existing)
        return {
            "zone": existing.zone,
            "prompt": existing.prompt,
            "is_default": existing.prompt == DEFAULT_FITTING_PROMPTS[zone_key],
            "updated_at": existing.updated_at,
            "updated_by_user_id": existing.updated_by_user_id,
        }

    new_item = FittingPrompt(
        zone=zone_key,
        prompt=prompt,
        updated_by_user_id=updated_by_user_id,
    )
    session.add(new_item)
    await session.commit()
    await session.refresh(new_item)
    return {
        "zone": new_item.zone,
        "prompt": new_item.prompt,
        "is_default": new_item.prompt == DEFAULT_FITTING_PROMPTS[zone_key],
        "updated_at": new_item.updated_at,
        "updated_by_user_id": new_item.updated_by_user_id,
    }


async def reset_prompt(session: AsyncSession, zone: str) -> dict:
    """
    Сбросить промпт к дефолту (удалить кастомный вариант).
    """
    zone_key = _normalize_zone(zone)
    if zone_key not in PROMPT_ZONES:
        raise ValueError(f"Unknown zone: {zone}")

    await session.execute(delete(FittingPrompt).where(FittingPrompt.zone == zone_key))
    await session.commit()
    default_prompt = DEFAULT_FITTING_PROMPTS[zone_key]
    return {
        "zone": zone_key,
        "prompt": default_prompt,
        "is_default": True,
        "updated_at": None,
        "updated_by_user_id": None,
    }
