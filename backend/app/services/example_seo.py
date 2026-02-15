"""
Сервис генерации SEO-контента для карточек примеров.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings
from app.schemas.content import (
    GenerationExampleSeoSuggestionVariant,
    GenerationExampleSeoSuggestionRequest,
    GenerationExampleSeoSuggestionResponse,
    GenerationExampleSeoFaqItem,
)
from app.services.openrouter import get_openrouter_client
from app.utils.slug import slugify

logger = logging.getLogger(__name__)


def _truncate(value: str, max_len: int) -> str:
    normalized = " ".join((value or "").split()).strip()
    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[: max_len - 1].rstrip()}…"


def _extract_title_from_prompt(prompt: str) -> str:
    cleaned = " ".join((prompt or "").replace("`", "").replace('"', "").split()).strip()
    if not cleaned:
        return "Пример генерации"
    words = cleaned.split(" ")[:7]
    title = " ".join(words)
    return title[:1].upper() + title[1:]


def _normalize_tags(tags: list[str]) -> list[str]:
    normalized: list[str] = []
    seen = set()
    for tag in tags:
        cleaned = tag.strip().lower()
        if cleaned and cleaned not in seen:
            normalized.append(cleaned)
            seen.add(cleaned)
    return normalized


def _default_faq() -> list[GenerationExampleSeoFaqItem]:
    return [
        GenerationExampleSeoFaqItem(
            question="Нужно ли входить в аккаунт перед генерацией?",
            answer="Да. Карточка открыта публично, но запуск генерации доступен только после входа в аккаунт.",
        ),
        GenerationExampleSeoFaqItem(
            question="Что делать, если бесплатные генерации закончились?",
            answer="Можно продолжить после пополнения ⭐️звезд или при активной подписке с доступными генерациями.",
        ),
        GenerationExampleSeoFaqItem(
            question="Можно ли изменить промпт перед запуском?",
            answer="Да. После перехода к генерации по примеру промпт можно отредактировать под свои задачи.",
        ),
    ]


def _normalize_faq(raw_items: Any) -> list[GenerationExampleSeoFaqItem]:
    fallback = _default_faq()
    if not isinstance(raw_items, list):
        return fallback

    normalized: list[GenerationExampleSeoFaqItem] = []
    for item in raw_items[:3]:
        if not isinstance(item, dict):
            continue
        question = _truncate(str(item.get("question") or "").strip(), 180)
        answer = _truncate(str(item.get("answer") or "").strip(), 400)
        if question and answer:
            normalized.append(GenerationExampleSeoFaqItem(question=question, answer=answer))

    return normalized or fallback


def _build_variant(
    *,
    slug: str,
    title: str,
    description: str,
    seo_title: str,
    seo_description: str,
    faq: list[GenerationExampleSeoFaqItem] | None = None,
) -> GenerationExampleSeoSuggestionVariant:
    return GenerationExampleSeoSuggestionVariant(
        slug=slugify(slug, fallback="example"),
        title=_truncate(title, 200) or "Пример генерации",
        description=_truncate(description, 400) or "Пример генерации AI.",
        seo_title=_truncate(seo_title, 120) or "Пример генерации AI",
        seo_description=_truncate(seo_description, 200) or "Пример генерации AI",
        faq=faq or _default_faq(),
    )


def _ensure_unique_variant_slugs(
    variants: list[GenerationExampleSeoSuggestionVariant],
) -> list[GenerationExampleSeoSuggestionVariant]:
    seen: set[str] = set()
    normalized: list[GenerationExampleSeoSuggestionVariant] = []

    for variant in variants:
        base_slug = slugify(variant.slug, fallback="example")
        candidate = base_slug
        suffix = 2
        while candidate in seen:
            candidate = f"{base_slug}-{suffix}"
            suffix += 1
        seen.add(candidate)
        normalized.append(
            GenerationExampleSeoSuggestionVariant(
                slug=candidate,
                title=variant.title,
                description=variant.description,
                seo_title=variant.seo_title,
                seo_description=variant.seo_description,
                faq=variant.faq,
            )
        )
    return normalized


def _build_fallback_variants(
    payload: GenerationExampleSeoSuggestionRequest,
) -> list[GenerationExampleSeoSuggestionVariant]:
    tags = _normalize_tags(payload.tags)
    title = _truncate((payload.title or "").strip(), 200) or _extract_title_from_prompt(payload.prompt or "")
    first_tag = tags[0] if tags else "AI генерации"
    base_description = _truncate(
        (payload.description or "").strip()
        or f'Пример "{title}" для {first_tag}. Загрузите свои фото и запустите генерацию по готовому сценарию.',
        400,
    )
    base_seo_title = _truncate(
        (payload.seo_title or "").strip() or f"{title} | Пример генерации AI",
        120,
    )
    base_seo_description = _truncate(
        (payload.seo_description or "").strip() or base_description,
        200,
    )
    base_slug = slugify((payload.slug or "").strip() or title, fallback="example")

    variants = [
        _build_variant(
            slug=base_slug,
            title=title,
            description=base_description,
            seo_title=base_seo_title,
            seo_description=base_seo_description,
        ),
        _build_variant(
            slug=f"{base_slug}-variant-2",
            title=title,
            description=_truncate(
                f"{base_description} Подходит для публикации в соцсетях и быстрого старта генерации по образцу.",
                400,
            ),
            seo_title=_truncate(f"{title} — сценарий генерации по фото", 120),
            seo_description=_truncate(
                f"Готовый SEO-сценарий: {title}. Загрузите фото, скорректируйте запрос и получите результат.",
                200,
            ),
        ),
        _build_variant(
            slug=f"{base_slug}-variant-3",
            title=title,
            description=_truncate(
                f"{base_description} Вариант ориентирован на коммерческий контент и маркетплейсы.",
                400,
            ),
            seo_title=_truncate(f"{title}: AI пример для генерации", 120),
            seo_description=_truncate(
                f'Карточка "{title}" с подготовленным описанием, FAQ и CTA для запуска генерации.',
                200,
            ),
        ),
    ]
    return _ensure_unique_variant_slugs(variants)


def _build_response(
    variants: list[GenerationExampleSeoSuggestionVariant],
    selected_index: int = 0,
) -> GenerationExampleSeoSuggestionResponse:
    safe_variants = variants or _build_fallback_variants(GenerationExampleSeoSuggestionRequest())
    safe_variants = _ensure_unique_variant_slugs(safe_variants)
    safe_index = min(max(selected_index, 0), len(safe_variants) - 1)
    selected = safe_variants[safe_index]
    return GenerationExampleSeoSuggestionResponse(
        slug=selected.slug,
        title=selected.title,
        description=selected.description,
        seo_title=selected.seo_title,
        seo_description=selected.seo_description,
        faq=selected.faq,
        selected_index=safe_index,
        variants=safe_variants,
    )


def _normalize_llm_result(
    raw: dict[str, Any],
    fallback: GenerationExampleSeoSuggestionResponse,
) -> GenerationExampleSeoSuggestionResponse:
    fallback_variants = fallback.variants or [
        GenerationExampleSeoSuggestionVariant(
            slug=fallback.slug,
            title=fallback.title,
            description=fallback.description,
            seo_title=fallback.seo_title,
            seo_description=fallback.seo_description,
            faq=fallback.faq,
        )
    ]
    raw_variants = raw.get("variants")
    normalized: list[GenerationExampleSeoSuggestionVariant] = []

    if isinstance(raw_variants, list):
        for idx, item in enumerate(raw_variants[:3]):
            fallback_variant = fallback_variants[min(idx, len(fallback_variants) - 1)]
            if not isinstance(item, dict):
                normalized.append(fallback_variant)
                continue
            normalized.append(
                _build_variant(
                    slug=str(item.get("slug") or fallback_variant.slug),
                    title=str(item.get("title") or fallback_variant.title),
                    description=str(item.get("description") or fallback_variant.description),
                    seo_title=str(item.get("seo_title") or fallback_variant.seo_title),
                    seo_description=str(item.get("seo_description") or fallback_variant.seo_description),
                    faq=_normalize_faq(item.get("faq")),
                )
            )
    else:
        normalized.append(
            _build_variant(
                slug=str(raw.get("slug") or fallback.slug),
                title=str(raw.get("title") or fallback.title),
                description=str(raw.get("description") or fallback.description),
                seo_title=str(raw.get("seo_title") or fallback.seo_title),
                seo_description=str(raw.get("seo_description") or fallback.seo_description),
                faq=_normalize_faq(raw.get("faq")),
            )
        )

    while len(normalized) < 3 and len(normalized) < len(fallback_variants):
        normalized.append(fallback_variants[len(normalized)])

    if len(normalized) < 3:
        normalized.extend(_build_fallback_variants(GenerationExampleSeoSuggestionRequest())[: 3 - len(normalized)])

    selected_index_raw = raw.get("recommended_index", raw.get("selected_index", fallback.selected_index))
    try:
        selected_index = int(selected_index_raw)
    except (TypeError, ValueError):
        selected_index = fallback.selected_index

    return _build_response(normalized[:3], selected_index=selected_index)


async def generate_example_seo_suggestions(
    payload: GenerationExampleSeoSuggestionRequest,
) -> GenerationExampleSeoSuggestionResponse:
    """
    Генерирует SEO suggestions для карточки примера.
    """
    fallback = _build_response(_build_fallback_variants(payload), selected_index=0)

    if not settings.OPENROUTER_API_KEY:
        return fallback

    try:
        client = get_openrouter_client()
        system_prompt = (
            "Ты SEO-редактор карточек AI генераций. Верни только JSON. "
            "Формат: {\"variants\":[{slug,title,description,seo_title,seo_description,faq}],\"recommended_index\":0}. "
            "В variants должно быть ровно 3 варианта. faq — массив из 3 объектов {question,answer}. "
            "Язык: русский. Ограничения: title<=200, description<=400, seo_title<=120, seo_description<=200."
        )
        user_payload = {
            "title": payload.title,
            "description": payload.description,
            "prompt": payload.prompt,
            "tags": _normalize_tags(payload.tags),
            "seo_title": payload.seo_title,
            "seo_description": payload.seo_description,
            "slug": payload.slug,
        }

        response = await client.client.post(
            f"{client.base_url}{client.CHAT_ENDPOINT}",
            json={
                "model": client.prompt_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
                "max_tokens": 900,
                "temperature": 0.3,
                "response_format": {"type": "json_object"},
            },
        )

        if response.status_code != 200:
            logger.warning("SEO suggestions OpenRouter error status: %s", response.status_code)
            return fallback

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content")
        if not content:
            return fallback
        raw = json.loads(content) if isinstance(content, str) else content
        if not isinstance(raw, dict):
            return fallback

        return _normalize_llm_result(raw, fallback)
    except Exception as exc:
        logger.warning("SEO suggestions fallback due to error: %s", exc)
        return fallback
