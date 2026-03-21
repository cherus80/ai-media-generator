from io import BytesIO

import pytest
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.core.config import settings
from app.services import file_storage


def _make_upload_file(filename: str, content_type: str, payload: bytes) -> UploadFile:
    return UploadFile(
        filename=filename,
        file=BytesIO(payload),
        headers=Headers({"content-type": content_type}),
    )


@pytest.mark.asyncio
async def test_save_upload_file_creates_thumbnail_sidecar(tmp_path, monkeypatch, sample_png_bytes):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))

    upload = _make_upload_file("example.png", "image/png", sample_png_bytes)

    _, file_url, _ = await file_storage.save_upload_file(
        upload,
        user_id=1,
        convert_to_webp=True,
        generate_thumbnail=True,
    )

    thumbnail_url = file_storage.resolve_thumbnail_url(file_url)

    assert file_url.endswith(".webp")
    assert thumbnail_url is not None
    assert thumbnail_url.endswith(".thumb.webp")
    assert (tmp_path / file_url.removeprefix("/uploads/")).exists()
    assert (tmp_path / thumbnail_url.removeprefix("/uploads/")).exists()


@pytest.mark.asyncio
async def test_save_upload_file_keeps_main_file_when_thumbnail_generation_fails(
    tmp_path,
    monkeypatch,
    sample_png_bytes,
):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))

    def broken_thumbnail(*args, **kwargs):
        raise RuntimeError("thumbnail failed")

    monkeypatch.setattr(file_storage, "build_thumbnail_webp_bytes", broken_thumbnail)

    upload = _make_upload_file("example.png", "image/png", sample_png_bytes)

    _, file_url, _ = await file_storage.save_upload_file(
        upload,
        user_id=1,
        convert_to_webp=True,
        generate_thumbnail=True,
    )

    assert file_url.endswith(".webp")
    assert (tmp_path / file_url.removeprefix("/uploads/")).exists()
    assert file_storage.resolve_thumbnail_url(file_url) is None
