import pytest

from app.api.v1.endpoints import content as content_endpoint
from app.models.generation_example import GenerationExample, GenerationExampleTag


@pytest.fixture
async def seeded_examples(test_db):
    examples = [
        GenerationExample(
            slug="look-1",
            seo_variant_index=0,
            title="Look 1",
            description="Desc 1",
            prompt="Prompt 1",
            image_url="/uploads/look-1.webp",
            seo_title="SEO 1",
            seo_description="SEO Desc 1",
            uses_count=30,
            is_published=True,
        ),
        GenerationExample(
            slug="look-2",
            seo_variant_index=1,
            title="Look 2",
            description="Desc 2",
            prompt="Prompt 2",
            image_url="/uploads/look-2.webp",
            seo_title="SEO 2",
            seo_description="SEO Desc 2",
            uses_count=20,
            is_published=True,
        ),
        GenerationExample(
            slug="draft-hidden",
            seo_variant_index=0,
            title="Hidden",
            description="Hidden",
            prompt="Hidden prompt",
            image_url="/uploads/hidden.webp",
            uses_count=999,
            is_published=False,
        ),
    ]

    for example in examples:
        test_db.add(example)
    await test_db.flush()

    test_db.add_all(
        [
            GenerationExampleTag(example_id=examples[0].id, tag="fashion"),
            GenerationExampleTag(example_id=examples[0].id, tag="editorial"),
            GenerationExampleTag(example_id=examples[1].id, tag="fashion"),
        ]
    )
    await test_db.commit()
    return examples


@pytest.mark.asyncio
@pytest.mark.integration
class TestContentExamplesAPI:
    async def test_examples_card_view_strips_heavy_fields(
        self,
        test_client,
        seeded_examples,
    ):
        response = await test_client.get(
            "/api/v1/content/examples",
            params={"sort": "popular", "limit": 20, "view": "card"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert "prompt" not in data["items"][0]
        assert "seo_title" not in data["items"][0]
        assert "seo_description" not in data["items"][0]

    async def test_examples_card_view_supports_page_size(
        self,
        test_client,
        seeded_examples,
    ):
        response = await test_client.get(
            "/api/v1/content/examples",
            params={"sort": "popular", "page": 1, "page_size": 1, "view": "card"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 1
        assert data["items"][0]["slug"] == "look-1"

    async def test_examples_card_view_sets_public_cache_control(
        self,
        test_client,
        seeded_examples,
    ):
        response = await test_client.get(
            "/api/v1/content/examples",
            params={"sort": "popular", "limit": 20, "view": "card"},
        )

        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "public, max-age=90"


def test_examples_cache_key_normalizes_query_order():
    first = content_endpoint.build_examples_cache_key(
        tags=["editorial", "fashion"],
        sort="popular",
        limit=20,
        page=None,
        page_size=None,
        view="card",
    )
    second = content_endpoint.build_examples_cache_key(
        tags=["fashion", "editorial"],
        sort="popular",
        limit=20,
        page=None,
        page_size=None,
        view="card",
    )

    assert first == second
