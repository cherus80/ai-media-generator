"""
Unit тесты для модуля валидации файлов

Тестируемый модуль:
- app/services/file_validator.py — валидация изображений
"""

import pytest
import io
from fastapi import UploadFile, HTTPException
from starlette.datastructures import Headers

from app.services.file_validator import (
    validate_image_file,
    get_file_extension,
    get_image_dimensions,
)


class TestValidateImageFile:
    """Тесты валидации файлов изображений"""

    @pytest.mark.asyncio
    async def test_valid_jpeg_file(self, sample_jpeg_bytes: bytes):
        """Тест валидации корректного JPEG файла"""
        # JPEG magic bytes (FF D8 FF)
        jpeg_content = sample_jpeg_bytes
        file = UploadFile(
            filename="test.jpg",
            file=io.BytesIO(jpeg_content),
            headers=Headers({"content-type": "image/jpeg"}),
        )

        result = await validate_image_file(file)

        assert result is True

    @pytest.mark.asyncio
    async def test_valid_png_file(self, sample_png_bytes: bytes):
        """Тест валидации корректного PNG файла"""
        # PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)
        png_content = sample_png_bytes
        file = UploadFile(
            filename="test.png",
            file=io.BytesIO(png_content),
            headers=Headers({"content-type": "image/png"}),
        )

        result = await validate_image_file(file)

        assert result is True

    @pytest.mark.asyncio
    async def test_invalid_mime_type(self):
        """Тест с неподдерживаемым MIME-типом"""
        content = b'some content'
        file = UploadFile(
            filename="test.gif",
            file=io.BytesIO(content),
            headers=Headers({"content-type": "image/gif"}),
        )

        with pytest.raises(HTTPException) as exc_info:
            await validate_image_file(file)
        assert exc_info.value.status_code == 400
        assert "Неподдерживаемый формат" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_file_too_large(self):
        """Тест с файлом больше лимита"""
        content = b'x' * (11 * 1024 * 1024)  # 11 MB
        file = UploadFile(
            filename="test.jpg",
            file=io.BytesIO(content),
            headers=Headers({"content-type": "image/jpeg"}),
        )

        with pytest.raises(HTTPException) as exc_info:
            await validate_image_file(file)
        assert exc_info.value.status_code == 413
        assert "Файл слишком большой" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_invalid_magic_bytes_jpeg(self):
        """Тест с неправильными magic bytes для JPEG"""
        # Неправильные magic bytes, но правильный MIME-тип
        content = b'fake jpeg content'
        file = UploadFile(
            filename="test.jpg",
            file=io.BytesIO(content),
            headers=Headers({"content-type": "image/jpeg"}),
        )

        with pytest.raises(HTTPException) as exc_info:
            await validate_image_file(file)
        assert exc_info.value.status_code == 400
        assert "Файл поврежден" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_invalid_magic_bytes_png(self):
        """Тест с неправильными magic bytes для PNG"""
        content = b'fake png content'
        file = UploadFile(
            filename="test.png",
            file=io.BytesIO(content),
            headers=Headers({"content-type": "image/png"}),
        )

        with pytest.raises(HTTPException) as exc_info:
            await validate_image_file(file)
        assert exc_info.value.status_code == 400
        assert "Файл поврежден" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_mime_type_mismatch(self):
        """Тест когда MIME-тип не соответствует расширению"""
        # PNG magic bytes, но JPEG MIME-тип
        png_content = b'\x89PNG\r\n\x1a\n'
        file = UploadFile(
            filename="test.jpg",
            file=io.BytesIO(png_content),
            headers=Headers({"content-type": "image/jpeg"}),
        )

        # Должна быть ошибка, так как magic bytes не соответствуют MIME-типу
        with pytest.raises(HTTPException) as exc_info:
            await validate_image_file(file)
        assert exc_info.value.status_code == 400


class TestGetFileExtension:
    """Тесты получения расширения файла"""

    def test_get_extension_from_filename(self):
        """Получение расширения из имени файла"""
        result = get_file_extension("image/jpeg")

        assert result == "jpg"

    def test_get_extension_from_mime_type(self):
        """Получение расширения из MIME-типа"""
        result = get_file_extension("image/png")

        assert result == "png"

    def test_get_extension_uppercase(self):
        """Расширение в верхнем регистре"""
        result = get_file_extension("image/jpeg")

        assert result == "jpg"

    def test_get_extension_no_extension(self):
        """Имя файла без расширения"""
        result = get_file_extension("image/jpeg")

        assert result == "jpg"


class TestGetImageDimensions:
    """Тесты получения размеров изображения"""

    @pytest.mark.skip(reason="Требует создание реального изображения с PIL")
    def test_get_dimensions_valid_image(self):
        """Получение размеров валидного изображения"""
        # TODO: Создать реальное изображение с Pillow
        pass

    @pytest.mark.skip(reason="Требует создание реального изображения с PIL")
    def test_get_dimensions_invalid_image(self):
        """Попытка получить размеры невалидного изображения"""
        # TODO: Проверить обработку ошибки
        pass
