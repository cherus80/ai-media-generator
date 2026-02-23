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


def _strip_technical_prompt_noise(text: str) -> str:
    normalized = text or ""
    noise_patterns = [
        # Служебные блоки identity preservation / guardrails
        r"identity lock[^.:\n]*[:\-]\s*.*?(?=(?:\bavoid\b|\brender\b|\bprompt\b|\bscene\b|\n[A-Za-z_]+\s*:|$))",
        r"\bdo not alter\b.*?(?=(?:[.;]\s+[A-Z]|\n|$))",
        r"\bpreserve exact\b.*?(?=(?:[.;]\s+[A-Z]|\n|$))",
        r"\bno beautification\b.*?(?=(?:[.;]\s+[A-Z]|\n|$))",
        r"\bthe output must depict the exact same person\b.*?(?=(?:[.;]\s+[A-Z]|\n|$))",
        r"\bavoid\s*:\s*\[[^\]]*\]",
    ]
    for pattern in noise_patterns:
        normalized = re.sub(pattern, " ", normalized, flags=re.IGNORECASE | re.DOTALL)
    normalized = re.sub(r"\s{2,}", " ", normalized)
    return normalized.strip()


def _looks_technical_prompt_key(key: str) -> bool:
    lowered = (key or "").strip().lower()
    if not lowered:
        return False
    technical_keys = {
        "identity_lock",
        "avoid",
        "negative_prompt",
        "negative",
        "constraints",
        "guardrails",
        "rules",
        "task",
        "inputs",
        "render",
        "identity_image",
        "style_reference_image",
        "photorealism",
        "detail",
        "resolution",
        "aspect_ratio",
    }
    if lowered in technical_keys:
        return True
    return lowered.endswith("_lock") or lowered.startswith("avoid")


def _extract_semantic_prompt_text(prompt: str) -> str:
    raw = _normalize_prompt(prompt)
    if not raw:
        return ""

    # 1) Пытаемся вытащить смысловые поля из структурированного промпта (JSON и JSON-like).
    prioritized_chunks: list[str] = []
    secondary_chunks: list[str] = []

    try:
        parsed = json.loads(prompt)
    except Exception:
        parsed = None

    if isinstance(parsed, (dict, list)):
        preferred_keys = {
            "scene",
            "subject",
            "wardrobe",
            "pose_expression",
            "pose",
            "expression",
            "environment",
            "lighting",
            "camera",
            "style_grade",
            "style",
            "mood",
        }

        def walk(node: Any, path: tuple[str, ...] = ()) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    key_str = str(key)
                    next_path = (*path, key_str)
                    if _looks_technical_prompt_key(key_str):
                        continue
                    walk(value, next_path)
                return
            if isinstance(node, list):
                # Списки часто содержат "avoid"/negative пункты; собираем только если путь не технический.
                if any(_looks_technical_prompt_key(part) for part in path):
                    return
                for item in node:
                    walk(item, path)
                return
            if not isinstance(node, str):
                return

            text = _strip_technical_prompt_noise(node)
            text = _normalize_prompt(text)
            if not text:
                return
            if any(_looks_technical_prompt_key(part) for part in path):
                return

            leaf_key = path[-1].lower() if path else ""
            if leaf_key in preferred_keys:
                prioritized_chunks.append(text)
            else:
                secondary_chunks.append(text)

        walk(parsed)

    # 2) Для универсальности добавляем raw текст, но уже без техничного шума.
    raw_semantic = _normalize_prompt(_strip_technical_prompt_noise(raw))

    merged_chunks: list[str] = []
    seen: set[str] = set()
    for chunk in [*prioritized_chunks, *secondary_chunks, raw_semantic]:
        cleaned = _normalize_prompt(chunk)
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        merged_chunks.append(cleaned)

    return " ".join(merged_chunks)


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


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _extract_prompt_highlights_ru(prompt: str, max_items: int = 4) -> list[str]:
    lowered = _extract_semantic_prompt_text(prompt).lower()
    highlight_rules: list[tuple[tuple[str, ...], str]] = [
        (("trunk", "багажник"), "съёмка внутри открытого багажника"),
        (("sports car", "спорткар", "sports-car"), "яркий спорткар в кадре"),
        (("yellow sports car", "bright yellow sports car", "желт", "жёлт"), "акцент на жёлтом автомобиле"),
        (("35mm flash", "direct flash", "flash photography", "вспышк"), "жёсткий прямой свет вспышки"),
        (("high-angle", "looking down", "сверху", "верхний ракурс"), "верхний ракурс съёмки"),
        (("night outdoor", "dark ambient", "ночн", "night "), "ночная уличная атмосфера"),
        (("keyhole", "замочная скважина"), "фон в форме keyhole"),
        (("bow", "arrow", "лук", "стрела"), "поза с луком и стрелой"),
        (("full-length", "full length", "в полный рост"), "кадр в полный рост"),
        (("symmetrical", "symmetry", "симметр"), "строгая симметричная композиция"),
        (("couture", "3d roses", "rose dress", "платье с розами"), "кутюрный образ с объёмными розами"),
        (("studio lighting", "studio", "студийный свет", "мягкое студийное освещение"), "профессиональный студийный свет"),
        (("fashion editorial", "luxury fashion", "editorial", "fashion"), "стиль luxury fashion editorial"),
        (("minimalist", "минималист"), "минималистичная сценография"),
        (("red", "scarlet", "crimson", "красн"), "насыщенная красная палитра"),
        (("winter", "snow", "snowy", "снег", "снеж", "снегопад"), "зимняя атмосфера"),
        (("christmas", "new year", "holiday", "рождеств", "новогод"), "праздничное настроение"),
    ]

    highlights: list[str] = []
    for keywords, label in highlight_rules:
        if _contains_any(lowered, keywords):
            highlights.append(label)

    unique: list[str] = []
    seen: set[str] = set()
    for item in highlights:
        if item not in seen:
            unique.append(item)
            seen.add(item)
    return unique[:max_items]


def _extract_prompt_details_ru(prompt: str, max_items: int = 4) -> list[str]:
    lowered = _extract_semantic_prompt_text(prompt).lower()
    detail_rules: list[tuple[tuple[str, ...], str]] = [
        (("open trunk", "inside the trunk", "багажник"), "поза внутри открытого багажника автомобиля"),
        (("yellow sports car", "bright yellow sports car", "жёлт", "желт"), "яркий жёлтый спорткар"),
        (("hard direct 35mm flash", "35mm flash", "direct flash", "жесткий", "жёсткий"), "жёсткая вспышка с контрастными тенями"),
        (("high-angle shot", "looking down", "верхний ракурс", "сверху"), "верхний ракурс в стиле flash-фото"),
        (("lit cigarette", "сигарет"), "расслабленная поза с сигаретой"),
        (("black hoodie", "cropped black hoodie", "худи"), "чёрное укороченное худи"),
        (("denim shorts", "distressed denim shorts", "джинсовые шорты"), "рваные джинсовые шорты"),
        (("onitsuka tiger", "mexico 66"), "кроссовки Onitsuka Tiger Mexico 66"),
        (("film grain", "analog flash", "плёноч", "пленоч"), "лёгкое плёночное зерно"),
        (("белое пушистое пальто", "пушистое пальто", "white fluffy coat", "fur coat"), "белое пушистое пальто"),
        (("рождественское дерево", "новогодняя ёлка", "новогоднее дерево", "christmas tree"), "размытая новогодняя ёлка на фоне"),
        (("снегопад", "snowfall", "falling snow", "снеж"), "лёгкий снегопад"),
        (("мягкое студийное освещение", "soft studio lighting", "студийный свет"), "мягкий студийный свет"),
        (("реалистичные волокна ткани", "детализация текстуры кожи", "realistic fabric fibers"), "высокая детализация кожи и ткани"),
        (("кинематографическая глубина резкости", "cinematic depth of field"), "кинематографическая глубина резкости"),
        (("нейтральная цветовая градация", "neutral color grading"), "нейтральная цветокоррекция"),
        (("смотрит прямо в камеру", "looks directly at the camera", "прямо в камеру"), "прямой взгляд в камеру"),
    ]

    details: list[str] = []
    for keywords, label in detail_rules:
        if _contains_any(lowered, keywords):
            details.append(label)

    unique: list[str] = []
    seen: set[str] = set()
    for item in details:
        if item not in seen:
            unique.append(item)
            seen.add(item)
    return unique[:max_items]


def _infer_ru_theme_from_prompt(prompt: str) -> str:
    lowered = _extract_semantic_prompt_text(prompt).lower()
    is_fashion = _contains_any(lowered, ("fashion", "editorial", "couture", "outfit", "стиль", "модн"))
    is_studio = _contains_any(lowered, ("studio", "студ"))
    has_bow = _contains_any(lowered, ("bow", "arrow", "лук", "стрела"))
    has_keyhole = _contains_any(lowered, ("keyhole", "замочная скважина"))
    has_red = _contains_any(lowered, ("red", "scarlet", "crimson", "красн"))
    has_couture = _contains_any(lowered, ("couture", "3d roses", "rose dress", "роз"))
    has_holiday = _contains_any(lowered, ("christmas", "new year", "holiday", "рождеств", "новогод"))
    has_winter = _contains_any(lowered, ("winter", "snow", "snowy", "снег", "снеж", "зим"))
    has_trunk = _contains_any(lowered, ("trunk", "багажник"))
    has_car = _contains_any(lowered, ("sports car", "car", "авто", "машин", "спорткар"))
    has_flash = _contains_any(lowered, ("flash", "вспышк"))
    has_night = _contains_any(lowered, ("night", "ночн", "dark ambient"))
    has_high_angle = _contains_any(lowered, ("high-angle", "looking down", "сверху", "верхний ракурс"))

    if has_trunk and has_car and has_flash:
        return "Ночная флэш-съёмка в багажнике спорткара"
    if has_car and has_flash and has_night:
        return "Ночная флэш-съёмка у спорткара"
    if has_flash and has_high_angle:
        return "Флэш-портрет с верхнего ракурса"

    if is_studio and is_fashion and has_bow:
        return "Студийная fashion-съёмка с луком"
    if is_studio and is_fashion and has_keyhole:
        return "Fashion-съёмка в keyhole-сцене"
    if is_fashion and has_couture and has_red:
        return "Кутюрный красный fashion-образ"
    if has_holiday and has_winter:
        return "Праздничный зимний портрет"
    if has_holiday:
        return "Праздничный портрет у новогодней ёлки"
    if has_winter:
        return "Зимний портрет"
    if is_studio and has_red:
        return "Красная студийная фотосцена"

    rules: list[tuple[tuple[str, ...], str]] = [
        (("christmas", "new year", "santa", "holiday", "рождеств", "новогод"), "Праздничный зимний портрет"),
        (("winter", "snow", "snowy", "снег", "снеж", "зим"), "Зимний портрет"),
        (("selfie", "phone", "camera angle"), "Портрет с эффектом селфи"),
        (("face", "identity", "preserve"), "Портрет с сохранением черт лица"),
        (("fashion", "style", "outfit", "модн"), "Модный редакционный портрет"),
        (("outdoor", "street"), "Уличная фотосцена"),
        (("studio", "lighting", "студ"), "Студийный портрет"),
        (("cinematic", "movie", "кинематограф"), "Кинематографичный портрет"),
    ]
    for keywords, title in rules:
        if _contains_any(lowered, keywords):
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
        ("с seo-описанием и cta", ""),
        ("с seo описанием и cta", ""),
        ("сценарий уже оптимизирован для быстрого старта и качественного результата", ""),
        ("ориентирован на коммерческие визуалы и рекламные публикации", "подходит для публикаций в соцсетях и рекламных креативов"),
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


def _looks_generic_title(value: str) -> bool:
    lowered = " ".join((value or "").lower().split())
    if not lowered:
        return True
    generic_patterns = (
        "пример генерации",
        "ai генерац",
        "готовый пример",
        "шаблон",
        "контент для соцсетей",
        "пример генерации по фото",
        "сценарий ai-генерации",
        "основанный на фотографическом",
    )
    if any(pattern in lowered for pattern in generic_patterns):
        return True
    return len(lowered.split()) < 2


def _is_low_signal_text(value: str) -> bool:
    lowered = " ".join((value or "").lower().split())
    if not lowered:
        return True
    low_signal_patterns = (
        "ориентирован на коммерческие визуалы",
        "с seo-описанием",
        "с seo описанием",
        "сценарий уже оптимизирован",
        "пример генерации по фото",
        "карточка \"",
        "собран по промпту",
        "адаптацией на русский язык",
    )
    return any(pattern in lowered for pattern in low_signal_patterns)


def _normalize_title_phrase(value: str) -> str:
    text = _sanitize_seo_text(value)
    text = re.sub(
        r"\s*[—-]\s*(пример генерации по фото|сценарий ai-генерации|ai пример для генерации)\b.*$",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r",?\s*основан[аоы]?[^\.,;:]*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s{2,}", " ", text).strip(" .,:;—-")
    return text


def _prefer_title(candidate: str, fallback: str) -> str:
    selected = _normalize_title_phrase(_prefer_russian(candidate, fallback))
    if _looks_generic_title(selected) or len(selected.split()) > 11:
        return _truncate(_normalize_title_phrase(fallback), 200)
    return _truncate(selected, 200)


def _extract_title_from_prompt(prompt: str) -> str:
    cleaned = _extract_semantic_prompt_text(prompt)
    if not cleaned:
        return "Пример генерации"
    theme_title = _infer_ru_theme_from_prompt(cleaned)
    if theme_title != "AI генерация по фото":
        return _truncate(theme_title, 200)
    first_sentence = re.split(r"[.!?\n]", cleaned, maxsplit=1)[0]
    phrase = _normalize_title_phrase(first_sentence)
    if not phrase:
        return "Пример генерации"
    words = phrase.split()
    if len(words) > 8:
        phrase = " ".join(words[:8])
    phrase = phrase[:1].upper() + phrase[1:]
    return _truncate(phrase, 200)


def _build_title_variants_from_prompt(prompt: str) -> list[str]:
    base = _extract_title_from_prompt(prompt)
    lowered = _extract_semantic_prompt_text(prompt).lower()
    details = _extract_prompt_details_ru(prompt, max_items=2)
    detail_hint = details[0] if details else ""
    has_holiday = _contains_any(lowered, ("christmas", "new year", "holiday", "рождеств", "новогод"))
    has_winter = _contains_any(lowered, ("winter", "snow", "snowy", "снег", "снеж", "зим"))
    is_fashion = _contains_any(lowered, ("fashion", "editorial", "couture", "outfit", "модн"))
    is_studio = _contains_any(lowered, ("studio", "lighting", "студ"))

    variant_two = _infer_ru_theme_from_prompt(prompt)
    if variant_two == "AI генерация по фото" or variant_two == base:
        if detail_hint:
            variant_two = _truncate(f"{base} с акцентом: {detail_hint}", 200)
        elif is_studio:
            variant_two = _truncate(f"{base} с мягким студийным светом", 200)
        else:
            variant_two = _truncate(f"{base} с фотореалистичной детализацией", 200)

    has_trunk = _contains_any(lowered, ("trunk", "багажник"))
    has_car = _contains_any(lowered, ("sports car", "car", "спорткар", "авто", "машин"))
    has_flash = _contains_any(lowered, ("flash", "вспышк"))
    has_high_angle = _contains_any(lowered, ("high-angle", "looking down", "сверху", "верхний ракурс"))

    if has_holiday or has_winter:
        variant_three = _truncate(f"{base} в зимней праздничной атмосфере", 200)
    elif has_trunk and has_car and has_flash and has_high_angle:
        variant_three = _truncate(f"{base} с верхним ракурсом и жёсткой вспышкой", 200)
    elif has_trunk and has_car and has_flash:
        variant_three = _truncate(f"{base} в дерзкой ночной флэш-эстетике", 200)
    elif is_fashion:
        variant_three = _truncate(f"{base} в редакционном fashion-стиле", 200)
    elif is_studio:
        variant_three = _truncate(f"{base} в студийной постановке", 200)
    else:
        variant_three = _truncate(f"{base} с акцентом на реалистичную фактуру", 200)

    variants = [
        _truncate(_normalize_title_phrase(base), 200),
        _truncate(_normalize_title_phrase(variant_two), 200),
        _truncate(_normalize_title_phrase(variant_three), 200),
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


def _build_semantic_description(
    *,
    title: str,
    prompt: str,
    tags: list[str],
    angle: str,
) -> str:
    details = _extract_prompt_details_ru(prompt, max_items=3)
    highlights = _extract_prompt_highlights_ru(prompt, max_items=2)
    details_part = ", ".join(details[:2]) if details else ", ".join(highlights[:2])

    first_tag = next((tag for tag in tags if _is_mostly_russian(tag, min_ratio=0.5)), "")
    tag_context = f" для сценария «{first_tag}»" if first_tag else ""

    if details_part:
        details_sentence = f"Ключевые детали: {details_part}."
    else:
        details_sentence = "Сцена построена как фотореалистичный портрет с аккуратным светом и глубиной."

    if angle == "social":
        usage_sentence = "Подходит для публикаций в соцсетях, промо-постов и визуалов для карточек товара."
    elif angle == "mood":
        usage_sentence = "Подходит для атмосферных подборок, сезонных публикаций и креативных обложек."
    else:
        usage_sentence = "Подходит для персональных портретов, рекламных креативов и контент-съёмок."

    return _truncate(
        f"«{title}»{tag_context}. {details_sentence} {usage_sentence}",
        400,
    )


def _build_semantic_seo_title(title: str) -> str:
    clean_title = _truncate(_normalize_title_phrase(title), 88)
    return _truncate(f"{clean_title} | AI генерация по фото", 120)


def _build_semantic_seo_description(title: str, prompt: str) -> str:
    details = _extract_prompt_details_ru(prompt, max_items=2)
    details_part = ", ".join(details) if details else "естественный свет, фотореализм и аккуратная фактура"
    return _truncate(
        f"{title}: {details_part}. Загрузите своё фото и получите результат в этом стиле за пару шагов.",
        200,
    )


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
    title_variants = _build_title_variants_from_prompt(prompt_text)
    base_slug = slugify((payload.slug or "").strip() or title_variants[0], fallback="example")

    variants = [
        _build_variant(
            slug=base_slug,
            title=title_variants[0],
            description=_build_semantic_description(
                title=title_variants[0],
                prompt=prompt_text,
                tags=tags,
                angle="main",
            ),
            seo_title=_build_semantic_seo_title(title_variants[0]),
            seo_description=_build_semantic_seo_description(title_variants[0], prompt_text),
        ),
        _build_variant(
            slug=f"{base_slug}-variant-2",
            title=title_variants[1],
            description=_build_semantic_description(
                title=title_variants[1],
                prompt=prompt_text,
                tags=tags,
                angle="social",
            ),
            seo_title=_build_semantic_seo_title(title_variants[1]),
            seo_description=_build_semantic_seo_description(title_variants[1], prompt_text),
        ),
        _build_variant(
            slug=f"{base_slug}-variant-3",
            title=title_variants[2],
            description=_build_semantic_description(
                title=title_variants[2],
                prompt=prompt_text,
                tags=tags,
                angle="mood",
            ),
            seo_title=_build_semantic_seo_title(title_variants[2]),
            seo_description=_build_semantic_seo_description(title_variants[2], prompt_text),
        ),
    ]
    return _ensure_unique_variant_slugs(variants)


def _build_response(
    variants: list[GenerationExampleSeoSuggestionVariant],
    selected_index: int = 0,
    source: str = "fallback",
    model: str | None = None,
    warning: str | None = None,
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
        source=_truncate(source or "fallback", 32),
        model=_truncate(model, 120) if model else None,
        warning=_truncate(warning, 300) if warning else None,
    )


def _apply_variant_quality_guard(
    variant: GenerationExampleSeoSuggestionVariant,
    fallback_variant: GenerationExampleSeoSuggestionVariant,
) -> GenerationExampleSeoSuggestionVariant:
    safe_title = _normalize_title_phrase(variant.title)
    if _looks_generic_title(safe_title) or len(safe_title.split()) > 11:
        safe_title = fallback_variant.title

    safe_description = variant.description
    if _is_low_signal_text(safe_description):
        safe_description = fallback_variant.description

    safe_seo_title = _normalize_title_phrase(variant.seo_title)
    if _looks_generic_title(safe_seo_title) or _is_low_signal_text(safe_seo_title):
        safe_seo_title = fallback_variant.seo_title

    safe_seo_description = variant.seo_description
    if _is_low_signal_text(safe_seo_description):
        safe_seo_description = fallback_variant.seo_description

    return _build_variant(
        slug=variant.slug,
        title=safe_title,
        description=safe_description,
        seo_title=safe_seo_title,
        seo_description=safe_seo_description,
        faq=variant.faq or fallback_variant.faq,
    )


def _normalize_llm_result(
    raw: dict[str, Any],
    fallback: GenerationExampleSeoSuggestionResponse,
    *,
    source: str = "openrouter",
    model: str | None = None,
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
            candidate_variant = _build_variant(
                slug=str(item.get("slug") or fallback_variant.slug),
                title=_prefer_title(
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
            normalized.append(_apply_variant_quality_guard(candidate_variant, fallback_variant))
    else:
        fallback_variant = fallback_variants[0]
        candidate_variant = _build_variant(
            slug=str(raw.get("slug") or fallback.slug),
            title=_prefer_title(str(raw.get("title") or fallback.title), fallback.title),
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
        normalized.append(_apply_variant_quality_guard(candidate_variant, fallback_variant))

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

    return _build_response(
        normalized[:3],
        selected_index=selected_index,
        source=source,
        model=model,
    )


def _resolve_seo_model(prompt_model: str | None) -> str | None:
    raw_models = (settings.OPENROUTER_SEO_MODELS or "").strip()
    if raw_models:
        first = next((model.strip() for model in raw_models.split(",") if model.strip()), None)
        if first:
            return first
    if prompt_model and prompt_model.strip():
        return prompt_model.strip()
    return None


def _build_llm_user_payload(
    payload: GenerationExampleSeoSuggestionRequest,
    prompt_text: str,
) -> dict[str, Any]:
    highlights = _extract_prompt_highlights_ru(prompt_text, max_items=5)
    details = _extract_prompt_details_ru(prompt_text, max_items=5)

    hints_ru: dict[str, Any] = {
        "prompt_highlights": highlights,
        "prompt_details": details,
        "theme_hint": _infer_ru_theme_from_prompt(prompt_text),
        "slug_hint": payload.slug,
    }
    if _is_mostly_russian(payload.title or "", min_ratio=0.5):
        hints_ru["title_hint_ru"] = payload.title

    # Не передаём в LLM предыдущие description/seo_* тексты из формы.
    # Часто это старый AI-ответ от другой карточки/попытки, который начинает
    # доминировать над текущим prompt и даёт повторяющиеся шаблонные описания.
    return {
        "prompt": prompt_text,
        "tags": _normalize_tags(payload.tags),
        "hints_ru": hints_ru,
    }


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
    fallback = _build_response(
        _build_fallback_variants(fallback_payload),
        selected_index=0,
        source="fallback",
    )

    if not settings.OPENROUTER_API_KEY:
        return fallback.model_copy(
            update={"warning": "OpenRouter не настроен: применён локальный SEO-шаблон."}
        )

    try:
        client = get_openrouter_client()
    except Exception as exc:
        logger.warning("SEO suggestions OpenRouter client init failed: %s", exc)
        return fallback.model_copy(
            update={"warning": "OpenRouter недоступен: применён локальный SEO-шаблон."}
        )
    model_name = _resolve_seo_model(client.prompt_model)
    if not model_name:
        return fallback.model_copy(
            update={"warning": "Не удалось определить OpenRouter-модель: применён локальный SEO-шаблон."}
        )

    system_prompt = (
        "Ты старший SEO-редактор карточек AI-генераций. Верни только JSON без пояснений. "
        "Формат ответа строго: {\"variants\":[{slug,title,description,seo_title,seo_description,faq}],\"recommended_index\":0}. "
        "variants: ровно 3 элемента. faq: ровно 3 вопроса, каждый объект {question,answer}. "
        "Контент строится из prompt; tags/hints используй только как дополнительный контекст. "
        "Критерии качества: "
        "1) title должен быть коротким, человеческим и предметным (обычно 3-8 слов), без канцеляризмов и хвостов. "
        "2) description и seo_description обязаны содержать 2-3 конкретные детали сцены из prompt (одежда, фон, свет, ракурс, настроение). "
        "3) seo_title должен быть читабельным и не дублировать title слово-в-слово с шаблонным хвостом. "
        "Жёсткие запреты: "
        "- не писать 'пример генерации по фото', 'сценарий AI-генерации', 'ориентирован на коммерческие визуалы', "
        "'с SEO-описанием и CTA', 'собран по промпту', 'адаптация на русский язык'. "
        "- не использовать бессмысленные абстракции и мета-описание карточки вместо описания изображения. "
        "- не оставлять английские фразы в title/description/seo_title/seo_description/faq. "
        "Если prompt не на русском, сначала переведи смысл на русский и только затем формируй финальные поля. "
        "Все текстовые поля строго на русском языке (кириллица), кроме slug. "
        "Ограничения длины: title<=200, description<=400, seo_title<=120, seo_description<=200."
    )
    user_payload = _build_llm_user_payload(payload, prompt_text)

    try:
        response = await client.client.post(
            f"{client.base_url}{client.CHAT_ENDPOINT}",
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
                "max_tokens": 1000,
                "temperature": 0.15,
                "response_format": {"type": "json_object"},
            },
        )

        if response.status_code != 200:
            logger.warning(
                "SEO suggestions OpenRouter error status=%s model=%s",
                response.status_code,
                model_name,
            )
            return fallback.model_copy(
                update={
                    "warning": _truncate(
                        f"OpenRouter вернул ошибку {response.status_code}: применён локальный SEO-шаблон.",
                        300,
                    )
                }
            )

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content")
        if not content:
            return fallback.model_copy(
                update={"warning": "OpenRouter вернул пустой ответ: применён локальный SEO-шаблон."}
            )
        raw = json.loads(content) if isinstance(content, str) else content
        if not isinstance(raw, dict):
            return fallback.model_copy(
                update={"warning": "OpenRouter вернул невалидный JSON: применён локальный SEO-шаблон."}
            )

        return _normalize_llm_result(
            raw,
            fallback,
            source="openrouter",
            model=model_name,
        )
    except Exception as exc:
        logger.warning("SEO suggestions OpenRouter request failed model=%s error=%s", model_name, exc)
        return fallback.model_copy(
            update={
                "warning": _truncate(
                    f"OpenRouter недоступен ({type(exc).__name__}): применён локальный SEO-шаблон.",
                    300,
                )
            }
        )
