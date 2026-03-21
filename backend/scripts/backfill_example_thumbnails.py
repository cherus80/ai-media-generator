#!/usr/bin/env python3
"""
Бэкфилл миниатюр для уже сохранённых примеров генераций.

Запуск:
  cd backend
  PYTHONPATH=. python3 scripts/backfill_example_thumbnails.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import sqlalchemy as sa

from app.db.session import AsyncSessionLocal
from app.models import GenerationExample
from app.core.config import settings
from app.services.file_storage import build_thumbnail_url, resolve_thumbnail_url
from app.utils.image_utils import build_thumbnail_webp_bytes


def _resolve_source_path(image_url: str, upload_dir: Path) -> Path | None:
    if not image_url.startswith("/uploads/"):
        return None
    return upload_dir / image_url.removeprefix("/uploads/")


async def main() -> None:
    upload_dir = Path(settings.UPLOAD_DIR)
    created = 0
    skipped = 0
    missing = 0

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            sa.select(GenerationExample.id, GenerationExample.image_url).order_by(GenerationExample.id.asc())
        )
        rows = result.all()

    for example_id, image_url in rows:
        thumbnail_url = build_thumbnail_url(image_url)
        if not thumbnail_url:
            skipped += 1
            continue

        if resolve_thumbnail_url(image_url):
            skipped += 1
            continue

        source_path = _resolve_source_path(image_url, upload_dir)
        if source_path is None or not source_path.exists():
            missing += 1
            continue

        thumbnail_path = upload_dir / thumbnail_url.removeprefix("/uploads/")
        thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
        thumbnail_bytes = build_thumbnail_webp_bytes(source_path.read_bytes())
        thumbnail_path.write_bytes(thumbnail_bytes)
        created += 1
        print(f"[created] example_id={example_id} -> {thumbnail_path.name}")

    print(
        f"done created={created} skipped={skipped} missing_source={missing} total={len(rows)}"
    )


if __name__ == "__main__":
    asyncio.run(main())
