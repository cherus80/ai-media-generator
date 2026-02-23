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


STRUCTURED_JSON_PROMPT = """{
  "task": "neuro_photoshoot",
  "inputs": {
    "identity_image": "ATTACHED_REFERENCE_IMAGE",
    "style_reference_image": null
  },
  "prompt": {
    "scene": "Night outdoor setting with dark ambient background, faint building silhouettes and partial car wheel visible. Subject placed inside the open trunk of a bright yellow sports car.",
    "subject": "the exact same person from ATTACHED_REFERENCE_IMAGE",
    "wardrobe": "Sleeveless cropped black hoodie with high collar, faded black distressed denim shorts with raw hem, Onitsuka Tiger Mexico 66 sneakers (yellow and black).",
    "pose_expression": "Lying relaxed inside the trunk, legs bent and crossed, right arm stretched upward, left hand holding a lit cigarette near mouth, relaxed dreamy expression looking to the side.",
    "environment": "Open trunk interior with transparent box and yellow bottle or black tube attached to side, realistic car paint reflections.",
    "lighting": "Hard direct 35mm flash lighting with dark ambient background, strong contrast and realistic flash shadows.",
    "camera": "High-angle shot looking down, 35mm analog flash photography style, subtle film grain.",
    "style_grade": "Edgy, mysterious, candid flash aesthetic, ultra-photorealistic, 4K, high dynamic range, natural skin micro-texture.",
    "identity_lock": "IDENTITY LOCK — CRITICAL: Use the attached reference image as the sole identity reference. The output must depict the exact same person. Do NOT alter facial structure, bone structure, proportions, symmetry, eye shape/spacing, nose shape, lips shape, jawline, ears, hairline. Preserve exact skin tone and all visible unique identifiers.",
    "avoid": ["identity drift", "facial restructuring", "skin smoothing"]
  },
  "render": {
    "photorealism": "ultra",
    "detail": "maximum",
    "resolution": "4K",
    "aspect_ratio": "4:5"
  }
}"""


def test_fallback_variants_for_structured_json_prompt_use_scene_details_not_identity_lock():
    payload = GenerationExampleSeoSuggestionRequest(prompt=STRUCTURED_JSON_PROMPT)

    variants = example_seo._build_fallback_variants(payload)
    first = variants[0]
    combined = f"{first.title} {first.description} {first.seo_description}".lower()

    # Не должно сваливаться в служебный identity_lock как в основной теме.
    assert "сохранени" not in first.title.lower()
    assert "черт лица" not in first.title.lower()

    # Должны появиться реальные детали сцены/съёмки из JSON prompt.
    assert any(
        token in combined
        for token in ("багажник", "спорткар", "жёлт", "вспышк", "верхний ракурс")
    )
