#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

os.environ.setdefault("ENVIRONMENT", "production")
os.environ.setdefault("DEBUG", "False")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "postgres")
os.environ.setdefault("POSTGRES_PASSWORD", "postgres")
os.environ.setdefault("POSTGRES_DB", "ai_image_bot")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import delete, select, func

from app.db.session import AsyncSessionLocal
from app.models.generation_example import GenerationExample, GenerationExampleTag

SNAPSHOT_PATH = REPO_ROOT / "output" / "perf" / "examples_snapshot.json"


async def seed() -> None:
    if not SNAPSHOT_PATH.exists():
        raise SystemExit(f"Snapshot not found: {SNAPSHOT_PATH}")

    payload = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    items: list[dict[str, Any]] = payload.get("items", [])

    async with AsyncSessionLocal() as session:
        await session.execute(delete(GenerationExampleTag))
        await session.execute(delete(GenerationExample))
        await session.commit()

        for index, item in enumerate(items, start=1):
            example = GenerationExample(
                slug=item["slug"],
                seo_variant_index=item.get("seo_variant_index") or 0,
                title=item.get("title"),
                description=item.get("description"),
                prompt=item.get("prompt") or f"Seed prompt {index}",
                image_url=item["image_url"],
                seo_title=item.get("seo_title"),
                seo_description=item.get("seo_description"),
                uses_count=item.get("uses_count") or 0,
                is_published=True,
            )
            session.add(example)
            await session.flush()
            for tag in item.get("tags") or []:
                session.add(GenerationExampleTag(example_id=example.id, tag=tag))

        await session.commit()

        total = await session.scalar(select(func.count()).select_from(GenerationExample))
        print(f"Seeded examples: {len(items)}")
        print(f"DB rows: {total}")


if __name__ == "__main__":
    asyncio.run(seed())
