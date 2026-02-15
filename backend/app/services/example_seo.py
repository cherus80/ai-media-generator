"""
Сервис генерации SEO-контента для карточек примеров.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings
from app.schemas.content import (
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


def _normalize_faq(raw_items: Any) -> list[GenerationExampleSeoFaqItem]:
    fallback = [
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


def _build_fallback(payload: GenerationExampleSeoSuggestionRequest) -> GenerationExampleSeoSuggestionResponse:
    tags = _normalize_tags(payload.tags)
    title = _truncate((payload.title or "").strip(), 200) or _extract_title_from_prompt(payload.prompt or "")
    first_tag = tags[0] if tags else "AI генерации"
    description = _truncate(
        (payload.description or "").strip()
        or f'Пример "{title}" для {first_tag}. Загрузите свои фото и запустите генерацию по готовому сценарию.',
        400,
    )
    seo_title = _truncate(
        (payload.seo_title or "").strip() or f"{title} | Пример генерации AI",
        120,
    )
    seo_description = _truncate(
        (payload.seo_description or "").strip() or description,
        200,
    )
    suggested_slug = slugify((payload.slug or "").strip() or title, fallback="example")

    return GenerationExampleSeoSuggestionResponse(
        slug=suggested_slug,
        title=title,
        description=description,
        seo_title=seo_title,
        seo_description=seo_description,
        faq=_normalize_faq(None),
    )


def _normalize_llm_result(
    raw: dict[str, Any],
    fallback: GenerationExampleSeoSuggestionResponse,
) -> GenerationExampleSeoSuggestionResponse:
    title = _truncate(str(raw.get("title") or fallback.title), 200) or fallback.title
    description = _truncate(str(raw.get("description") or fallback.description), 400) or fallback.description
    seo_title = _truncate(str(raw.get("seo_title") or fallback.seo_title), 120) or fallback.seo_title
    seo_description = _truncate(
        str(raw.get("seo_description") or fallback.seo_description),
        200,
    ) or fallback.seo_description
    suggested_slug = slugify(str(raw.get("slug") or fallback.slug), fallback=fallback.slug or "example")
    faq = _normalize_faq(raw.get("faq"))

    return GenerationExampleSeoSuggestionResponse(
        slug=suggested_slug,
        title=title,
        description=description,
        seo_title=seo_title,
        seo_description=seo_description,
        faq=faq,
    )


async def generate_example_seo_suggestions(
    payload: GenerationExampleSeoSuggestionRequest,
) -> GenerationExampleSeoSuggestionResponse:
    """
    Генерирует SEO suggestions для карточки примера.
    """
    fallback = _build_fallback(payload)

    if not settings.OPENROUTER_API_KEY:
        return fallback

    try:
        client = get_openrouter_client()
        system_prompt = (
            "Ты SEO-редактор карточек AI генераций. Верни только JSON "
            "со структурой: slug, title, description, seo_title, seo_description, faq. "
            "faq — массив из 3 объектов {question, answer}. Язык: русский. "
            "Ограничения: title<=200, description<=400, seo_title<=120, seo_description<=200."
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
