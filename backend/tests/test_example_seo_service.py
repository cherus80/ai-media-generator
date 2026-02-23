import json

from app.schemas.content import GenerationExampleSeoSuggestionRequest
from app.services import example_seo


def test_build_llm_user_payload_ignores_stale_text_hints():
    payload = GenerationExampleSeoSuggestionRequest(
        prompt="Portrait photo of a woman in green coat near neon sign, cinematic light",
        slug="old-slug",
        title="Старый заголовок",
        description=(
            "Портрет человека на фоне насыщенной красной студии с мягким боке и глубокой резкостью."
        ),
        seo_title="Старый SEO title",
        seo_description=(
            "Полупрозрачный музыкальный интерфейс в стиле glassmorphism плавно парит перед моделью."
        ),
        tags=["портрет", "неон"],
    )

    user_payload = example_seo._build_llm_user_payload(payload, payload.prompt)
    hints = user_payload["hints_ru"]

    assert user_payload["prompt"] == payload.prompt
    assert user_payload["tags"] == ["портрет", "неон"]
    assert hints["slug_hint"] == "old-slug"
    assert hints["title_hint_ru"] == "Старый заголовок"

    # Старые AI-поля не должны уводить модель от текущего prompt.
    assert "description_hint_ru" not in hints
    assert "seo_title_hint_ru" not in hints
    assert "seo_description_hint_ru" not in hints

    # Prompt-derived hints сохраняются, чтобы модель получала контекст сцены.
    dumped = json.dumps(hints, ensure_ascii=False)
    assert "theme_hint" in dumped or "prompt_highlights" in hints
