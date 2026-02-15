"""
Публичные SEO-страницы примеров генераций и sitemap.
"""

from __future__ import annotations

from datetime import datetime
from html import escape
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

import sqlalchemy as sa
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models import GenerationExample, GenerationExampleSlug

router = APIRouter()


def _app_url(path: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def _resolve_public_image(image_url: str) -> str:
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return image_url
    return _app_url(image_url)


def _truncate(value: str, limit: int = 170) -> str:
    text = " ".join(value.split())
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}…"


def _render_layout(
    *,
    title: str,
    description: str,
    canonical: str,
    og_image: str,
    body: str,
) -> str:
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <meta name="description" content="{escape(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="{escape(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{escape(title)}" />
  <meta property="og:description" content="{escape(description)}" />
  <meta property="og:url" content="{escape(canonical)}" />
  <meta property="og:image" content="{escape(og_image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{escape(title)}" />
  <meta name="twitter:description" content="{escape(description)}" />
  <meta name="twitter:image" content="{escape(og_image)}" />
  <style>
    :root {{ color-scheme: light; }}
    body {{
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(180deg, #f7fbff 0%, #ffffff 40%, #f6f8fb 100%);
      color: #0f172a;
    }}
    .container {{ max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }}
    .header {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; }}
    .brand {{ font-weight: 800; color: #0f172a; text-decoration: none; font-size: 18px; }}
    .top-link {{ color: #0f172a; text-decoration: none; font-size: 14px; font-weight: 600; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }}
    .card {{
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
    }}
    .card img {{ width: 100%; height: 250px; object-fit: contain; background: #f8fafc; }}
    .card-body {{ padding: 16px; display: flex; flex-direction: column; gap: 10px; }}
    .title {{ font-size: 22px; font-weight: 800; margin: 0; line-height: 1.2; }}
    .desc {{ margin: 0; color: #334155; line-height: 1.45; font-size: 15px; }}
    .meta {{ font-size: 13px; color: #475569; margin: 0; }}
    .cta {{
      display: inline-block;
      margin-top: 12px;
      text-decoration: none;
      text-align: center;
      padding: 12px 14px;
      border-radius: 12px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(90deg, #0ea5e9 0%, #8b5cf6 100%);
    }}
    .tags {{ display: flex; gap: 8px; flex-wrap: wrap; }}
    .tag {{
      padding: 4px 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #312e81;
      font-size: 12px;
      font-weight: 600;
    }}
  </style>
</head>
<body>
  <div class="container">
    {body}
  </div>
</body>
</html>"""


@router.get("/examples", response_class=HTMLResponse)
async def public_examples_catalog(
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    stmt = (
        sa.select(GenerationExample)
        .where(GenerationExample.is_published.is_(True))
        .options(selectinload(GenerationExample.tags))
        .order_by(GenerationExample.uses_count.desc(), GenerationExample.created_at.desc())
        .limit(120)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    cards = []
    for item in items:
        detail_url = f"/examples/{quote(item.slug)}"
        card_description = item.description or _truncate(item.prompt, 140)
        tags_html = "".join(f'<span class="tag">{escape(tag.tag)}</span>' for tag in item.tags[:6])
        cards.append(
            f"""
<article class="card">
  <a href="{escape(detail_url)}"><img src="{escape(_resolve_public_image(item.image_url))}" alt="{escape(item.title or 'Пример генерации')}" loading="lazy" /></a>
  <div class="card-body">
    <h2 style="font-size:20px;margin:0;line-height:1.25;"><a href="{escape(detail_url)}" style="text-decoration:none;color:#0f172a;">{escape(item.title or 'Пример генерации')}</a></h2>
    <p class="desc">{escape(card_description)}</p>
    <p class="meta">{item.uses_count} запусков</p>
    <div class="tags">{tags_html}</div>
    <a class="cta" href="{escape(detail_url)}">Открыть пример</a>
  </div>
</article>
""".strip()
        )

    body = f"""
<header class="header">
  <a class="brand" href="/">AI Generator</a>
  <a class="top-link" href="/login">Войти</a>
</header>
<h1 class="title">Примеры генераций</h1>
<p class="desc" style="margin-top:8px;margin-bottom:24px;">Выберите карточку и запустите генерацию по этому сценарию со своими фото после входа.</p>
<section class="grid">
  {''.join(cards) if cards else '<p class="desc">Пока нет опубликованных примеров.</p>'}
</section>
"""
    canonical = _app_url("/examples")
    page = _render_layout(
        title="Примеры генераций | AI Generator",
        description="Каталог примеров AI-генерации. Откройте карточку, изучите сценарий и запустите генерацию со своими фото.",
        canonical=canonical,
        og_image=_app_url("/logo.png"),
        body=body,
    )
    return HTMLResponse(content=page)


@router.get("/examples/{slug}", response_class=HTMLResponse)
async def public_example_detail(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse | RedirectResponse:
    stmt = (
        sa.select(GenerationExample)
        .where(
            GenerationExample.slug == slug,
            GenerationExample.is_published.is_(True),
        )
        .options(selectinload(GenerationExample.tags))
        .limit(1)
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        history_stmt = (
            sa.select(GenerationExample.slug)
            .join(GenerationExampleSlug, GenerationExampleSlug.example_id == GenerationExample.id)
            .where(
                GenerationExampleSlug.slug == slug,
                GenerationExample.is_published.is_(True),
            )
            .limit(1)
        )
        history_result = await db.execute(history_stmt)
        current_slug = history_result.scalar_one_or_none()
        if current_slug:
            return RedirectResponse(url=f"/examples/{quote(current_slug)}", status_code=301)
        return HTMLResponse(
            status_code=404,
            content=_render_layout(
                title="Пример не найден | AI Generator",
                description="Запрошенный пример недоступен.",
                canonical=_app_url(f"/examples/{quote(slug)}"),
                og_image=_app_url("/logo.png"),
                body='<h1 class="title">Пример не найден</h1><p class="desc">Проверьте ссылку или откройте каталог примеров.</p><a class="cta" href="/examples">Открыть каталог</a>',
            ),
        )

    page_title = item.seo_title or f"{(item.title or 'Пример генерации').strip()} | AI Generator"
    page_description = item.seo_description or item.description or _truncate(item.prompt, 170)
    canonical = _app_url(f"/examples/{quote(item.slug)}")
    image_url = _resolve_public_image(item.image_url)
    tags_html = "".join(f'<span class="tag">{escape(tag.tag)}</span>' for tag in item.tags[:10])
    cta_href = f"/app/examples/generate?example={quote(item.slug)}"

    body = f"""
<header class="header">
  <a class="brand" href="/">AI Generator</a>
  <a class="top-link" href="/examples">Все примеры</a>
</header>
<article class="card">
  <img src="{escape(image_url)}" alt="{escape(item.title or 'Пример генерации')}" />
  <div class="card-body">
    <h1 class="title">{escape(item.title or 'Пример генерации')}</h1>
    <p class="meta">{item.uses_count} запусков</p>
    <div class="tags">{tags_html}</div>
    <p class="desc">{escape(item.description or _truncate(item.prompt, 260))}</p>
    <a class="cta" href="{escape(cta_href)}">Сгенерировать по этому примеру</a>
  </div>
</article>
"""
    page = _render_layout(
        title=page_title,
        description=page_description,
        canonical=canonical,
        og_image=image_url,
        body=body,
    )
    return HTMLResponse(content=page)


@router.get("/sitemap.xml")
async def public_sitemap(
    db: AsyncSession = Depends(get_db),
) -> Response:
    stmt = (
        sa.select(GenerationExample.slug, GenerationExample.updated_at)
        .where(GenerationExample.is_published.is_(True))
        .order_by(GenerationExample.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    urls = [
        ("", datetime.utcnow()),
        ("/examples", datetime.utcnow()),
    ]
    urls.extend((f"/examples/{slug}", updated_at) for slug, updated_at in rows)

    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, updated_at in urls:
        loc = xml_escape(_app_url(path or "/"))
        lastmod = updated_at.date().isoformat() if isinstance(updated_at, datetime) else datetime.utcnow().date().isoformat()
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")

    return Response("\n".join(lines), media_type="application/xml")
