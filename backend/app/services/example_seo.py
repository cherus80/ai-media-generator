"""
Сервис генерации SEO-контента для карточек примеров.
"""

from __future__ import annotations

import json
import logging
import re
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


def _normalize_prompt(prompt: str | None) -> str:
    return " ".join((prompt or "").replace("`", "").replace('"', "").split()).strip()


def _has_cyrillic(value: str) -> bool:
    return bool(re.search(r"[А-Яа-яЁё]", value or ""))


def _language_ratio_ru(value: str) -> float:
    cyrillic = re.findall(r"[А-Яа-яЁё]", value or "")
    latin = re.findall(r"[A-Za-z]", value or "")
    letters = len(cyrillic) + len(latin)
    if letters == 0:
        return 1.0
    return len(cyrillic) / letters


def _is_mostly_russian(value: str, min_ratio: float = 0.65) -> bool:
    if not value:
        return False
    return _has_cyrillic(value) and _language_ratio_ru(value) >= min_ratio


def _infer_ru_theme_from_prompt(prompt: str) -> str:
    lowered = (prompt or "").lower()
    rules: list[tuple[tuple[str, ...], str]] = [
        (("christmas", "new year", "santa", "holiday"), "Праздничный зимний портрет"),
        (("winter", "snow", "snowy"), "Зимний портрет"),
        (("selfie", "phone", "camera angle"), "Портрет с эффектом селфи"),
        (("face", "identity", "preserve"), "Портрет с сохранением черт лица"),
        (("fashion", "style", "outfit"), "Модный образ"),
        (("outdoor", "street"), "Уличная фотосцена"),
        (("studio", "lighting"), "Студийный портрет"),
        (("cinematic", "movie"), "Кинематографичный портрет"),
    ]
    for keywords, title in rules:
        if any(keyword in lowered for keyword in keywords):
            return title
    return "AI генерация по фото"


def _sanitize_seo_text(value: str) -> str:
    text = " ".join((value or "").split()).strip()
    if not text:
        return text
    replacements = (
        ("исходному промпту примера", "сценарию примера"),
        ("исходный промпт", "сценарий"),
        ("с адаптацией на русский язык", ""),
    )
    for old, new in replacements:
        text = text.replace(old, new)
        text = text.replace(old.capitalize(), new.capitalize())
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip(" .")


def _prefer_russian(candidate: str, fallback: str) -> str:
    normalized = _truncate(_sanitize_seo_text(candidate), 4000)
    if _is_mostly_russian(normalized):
        return normalized
    safe_fallback = _truncate(_sanitize_seo_text(fallback), 4000)
    if _is_mostly_russian(safe_fallback, min_ratio=0.5):
        return safe_fallback
    return "Пример генерации AI"


def _extract_title_from_prompt(prompt: str) -> str:
    cleaned = _normalize_prompt(prompt)
    if not cleaned:
        return "Пример генерации"
    if not _is_mostly_russian(cleaned, min_ratio=0.55):
        return _infer_ru_theme_from_prompt(cleaned)
    words = cleaned.split(" ")[:7]
    title = " ".join(words)
    return title[:1].upper() + title[1:]


def _build_title_variants_from_prompt(prompt: str) -> list[str]:
    base = _extract_title_from_prompt(prompt)
    variants = [
        base,
        _truncate(f"{base} — сценарий AI-генерации", 200),
        _truncate(f"{base} — пример генерации по фото", 200),
    ]
    unique: list[str] = []
    seen: set[str] = set()
    for index, item in enumerate(variants):
        candidate = _truncate(item.strip() or f"Пример генерации {index + 1}", 200)
        if candidate in seen:
            candidate = _truncate(f"{candidate} {index + 1}", 200)
        seen.add(candidate)
        unique.append(candidate)
    return unique


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


def _normalize_faq(
    raw_items: Any,
    fallback_items: list[GenerationExampleSeoFaqItem] | None = None,
) -> list[GenerationExampleSeoFaqItem]:
    fallback = fallback_items or _default_faq()
    if not isinstance(raw_items, list):
        return fallback

    normalized: list[GenerationExampleSeoFaqItem] = []
    for item in raw_items[:3]:
        if not isinstance(item, dict):
            continue
        question = _truncate(str(item.get("question") or "").strip(), 180)
        answer = _truncate(str(item.get("answer") or "").strip(), 400)
        if question and answer and _is_mostly_russian(question, 0.6) and _is_mostly_russian(answer, 0.6):
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
    prompt_text = _normalize_prompt(payload.prompt)
    tags = _normalize_tags(payload.tags)
    first_tag = next((tag for tag in tags if _is_mostly_russian(tag, min_ratio=0.5)), "AI генерации")
    title_variants = _build_title_variants_from_prompt(prompt_text)
    base_slug = slugify((payload.slug or "").strip() or title_variants[0], fallback="example")

    variants = [
        _build_variant(
            slug=base_slug,
            title=title_variants[0],
            description=_truncate(
                f'Пример "{title_variants[0]}" для {first_tag}. '
                "Шаблон уже настроен: загрузите свои фото и запустите генерацию по этому образцу.",
                400,
            ),
            seo_title=_truncate(f"{title_variants[0]} | Пример генерации AI", 120),
            seo_description=_truncate(
                f'Готовый пример "{title_variants[0]}": используйте свой исходник и получите результат по заданному промпту.',
                200,
            ),
        ),
        _build_variant(
            slug=f"{base_slug}-variant-2",
            title=title_variants[1],
            description=_truncate(
                f'Карточка "{title_variants[1]}" подготовлена для соцсетей и быстрого старта генерации по фото.',
                400,
            ),
            seo_title=_truncate(f"{title_variants[1]} | Генерация по промпту", 120),
            seo_description=_truncate(
                f'Сценарий "{title_variants[1]}" для релевантной генерации: загрузите фото и примените идею карточки.',
                200,
            ),
        ),
        _build_variant(
            slug=f"{base_slug}-variant-3",
            title=title_variants[2],
            description=_truncate(
                f'Вариант "{title_variants[2]}" ориентирован на коммерческий контент и быструю подготовку визуалов.',
                400,
            ),
            seo_title=_truncate(f"{title_variants[2]} | AI пример для генерации", 120),
            seo_description=_truncate(
                f'Карточка "{title_variants[2]}" с SEO-описанием и CTA для запуска генерации по вашему фото.',
                200,
            ),
        ),
    ]
    return _ensure_unique_variant_slugs(variants)


def _build_response(
    variants: list[GenerationExampleSeoSuggestionVariant],
    selected_index: int = 0,
) -> GenerationExampleSeoSuggestionResponse:
    safe_variants = variants or _build_fallback_variants(
        GenerationExampleSeoSuggestionRequest(prompt="Пример генерации AI")
    )
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
                    title=_prefer_russian(
                        str(item.get("title") or fallback_variant.title),
                        fallback_variant.title,
                    ),
                    description=_prefer_russian(
                        str(item.get("description") or fallback_variant.description),
                        fallback_variant.description,
                    ),
                    seo_title=_prefer_russian(
                        str(item.get("seo_title") or fallback_variant.seo_title),
                        fallback_variant.seo_title,
                    ),
                    seo_description=_prefer_russian(
                        str(item.get("seo_description") or fallback_variant.seo_description),
                        fallback_variant.seo_description,
                    ),
                    faq=_normalize_faq(item.get("faq"), fallback_variant.faq),
                )
            )
    else:
        normalized.append(
            _build_variant(
                slug=str(raw.get("slug") or fallback.slug),
                title=_prefer_russian(str(raw.get("title") or fallback.title), fallback.title),
                description=_prefer_russian(
                    str(raw.get("description") or fallback.description),
                    fallback.description,
                ),
                seo_title=_prefer_russian(str(raw.get("seo_title") or fallback.seo_title), fallback.seo_title),
                seo_description=_prefer_russian(
                    str(raw.get("seo_description") or fallback.seo_description),
                    fallback.seo_description,
                ),
                faq=_normalize_faq(raw.get("faq"), fallback.faq),
            )
        )

    while len(normalized) < 3 and len(normalized) < len(fallback_variants):
        normalized.append(fallback_variants[len(normalized)])

    if len(normalized) < 3:
        normalized.extend(
            _build_fallback_variants(GenerationExampleSeoSuggestionRequest(prompt="Пример генерации AI"))[
                : 3 - len(normalized)
            ]
        )

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
    prompt_text = _normalize_prompt(payload.prompt)
    fallback_payload = GenerationExampleSeoSuggestionRequest(
        prompt=prompt_text or "Пример генерации AI",
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        tags=payload.tags,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
    )
    fallback = _build_response(_build_fallback_variants(fallback_payload), selected_index=0)

    if not settings.OPENROUTER_API_KEY:
        return fallback

    try:
        client = get_openrouter_client()
        system_prompt = (
            "Ты SEO-редактор карточек AI генераций. Верни только JSON. "
            "Формат: {\"variants\":[{slug,title,description,seo_title,seo_description,faq}],\"recommended_index\":0}. "
            "В variants должно быть ровно 3 варианта. faq — массив из 3 объектов {question,answer}. "
            "Основа для контента — поле prompt. Остальные поля только как вспомогательный контекст. "
            "title в каждом варианте обязателен и должен отличаться. "
            "Если prompt не на русском, сначала переведи смысл на русский и только затем формируй SEO-тексты. "
            "Запрещённые формулировки: 'исходный промпт', 'адаптация на русский язык', 'собран по промпту'. "
            "Нельзя оставлять английские фразы в title/description/seo_title/seo_description/faq. "
            "Все текстовые поля строго на русском языке (кириллица), кроме slug. "
            "Ограничения: title<=200, description<=400, seo_title<=120, seo_description<=200."
        )
        user_payload = {
            "prompt": prompt_text,
            "tags": _normalize_tags(payload.tags),
            "context": {
                "title_hint_ru": payload.title if _is_mostly_russian(payload.title or "", min_ratio=0.5) else None,
                "description_hint_ru": payload.description if _is_mostly_russian(payload.description or "", min_ratio=0.5) else None,
                "seo_title_hint_ru": payload.seo_title if _is_mostly_russian(payload.seo_title or "", min_ratio=0.5) else None,
                "seo_description_hint_ru": payload.seo_description if _is_mostly_russian(payload.seo_description or "", min_ratio=0.5) else None,
                "slug_hint": payload.slug,
            },
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
