"""
Сервис валидации файлов.

Проверяет MIME-тип, размер, magic bytes (сигнатуры файлов).
"""

from typing import Optional

from fastapi import UploadFile, HTTPException, status

from app.core.config import settings


# Magic bytes для различных форматов изображений
IMAGE_SIGNATURES = {
    'jpeg': [
        bytes([0xFF, 0xD8, 0xFF, 0xE0]),  # JFIF
        bytes([0xFF, 0xD8, 0xFF, 0xE1]),  # EXIF
        bytes([0xFF, 0xD8, 0xFF, 0xDB]),  # JPEG RAW
        bytes([0xFF, 0xD8, 0xFF, 0xE2]),  # MPO (Multi Picture Object) - iPhone photos
    ],
    'png': [bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    'webp': [bytes([0x52, 0x49, 0x46, 0x46])],  # RIFF (WebP starts with RIFF)
    'heic': [
        b'ftyp',  # HEIC/HEIF format marker at offset 4
    ],
}

VIDEO_SIGNATURES = {
    'mp4': [b'ftyp'],
    'mov': [b'ftyp'],
    'webm': [bytes([0x1A, 0x45, 0xDF, 0xA3])],
}


class FileValidationError(Exception):
    """Ошибка валидации файла"""
    pass


async def validate_image_file(file: UploadFile) -> bool:
    """
    Валидация загруженного изображения.

    Проверяет:
    - MIME-тип
    - Размер файла
    - Magic bytes (сигнатура файла)

    Args:
        file: Загруженный файл

    Returns:
        bool: True если файл валиден

    Raises:
        HTTPException: Если файл не проходит валидацию
    """
    # Проверка MIME-типа
    if not file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Не удалось определить тип файла. "
                "Выберите изображение в поддерживаемом формате и попробуйте снова."
            ),
        )

    allowed_mime_types = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'image/mpo',
    ]
    allowed_types_label = "JPEG, PNG, WebP, HEIC/HEIF, MPO"
    if file.content_type not in allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Неподдерживаемый формат файла. "
                f"Используйте {allowed_types_label}."
            ),
        )

    # Чтение файла для проверки
    content = await file.read()
    file_size = len(content)

    # Возвращаем указатель в начало файла
    await file.seek(0)

    # Проверка размера
    max_size = settings.MAX_FILE_SIZE_BYTES
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "Файл слишком большой. "
                f"Максимальный размер: {settings.MAX_FILE_SIZE_MB}MB. "
                "Сожмите изображение или выберите файл меньшего размера."
            ),
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл пустой. Выберите изображение и попробуйте снова.",
        )

    # Проверка magic bytes (сигнатуры файла)
    is_valid_signature = False

    # Проверяем JPEG/MPO (MPO использует JPEG magic bytes)
    for jpeg_sig in IMAGE_SIGNATURES['jpeg']:
        if content.startswith(jpeg_sig):
            is_valid_signature = True
            break

    # Проверяем PNG
    if not is_valid_signature and content.startswith(IMAGE_SIGNATURES['png'][0]):
        is_valid_signature = True

    # Проверяем WebP (RIFF + проверка WEBP в байтах 8-11)
    if not is_valid_signature and content.startswith(IMAGE_SIGNATURES['webp'][0]):
        if len(content) >= 12 and content[8:12] == b'WEBP':
            is_valid_signature = True

    # Проверяем HEIC/HEIF (ftyp на позиции 4-8)
    if not is_valid_signature and len(content) >= 12:
        # HEIC/HEIF имеют 'ftyp' в байтах 4-8, затем 'heic', 'heix', 'hevc', 'hevx', 'mif1' и др.
        if content[4:8] == b'ftyp':
            # Проверяем известные HEIC/HEIF бренды
            brand = content[8:12]
            heic_brands = [b'heic', b'heix', b'hevc', b'hevx', b'mif1', b'msf1', b'heim', b'heis']
            if brand in heic_brands:
                is_valid_signature = True

    if not is_valid_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Файл поврежден или не является изображением. "
                "Пересохраните его или выберите другой файл."
            ),
        )

    # Дополнительная проверка через Pillow (imghdr deprecated с Python 3.11)
    try:
        from PIL import Image
        import io

        # Возвращаемся в начало
        await file.seek(0)
        image_data = await file.read()
        await file.seek(0)

        # Открываем изображение через Pillow для финальной проверки
        image = Image.open(io.BytesIO(image_data))
        image_format = image.format.lower() if image.format else None

        # Проверяем формат (включая MPO и HEIC/HEIF для iPhone)
        allowed_formats = ['jpeg', 'png', 'webp', 'mpo', 'heic', 'heif']
        if image_format not in allowed_formats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Не удалось определить корректный формат изображения "
                    f"({image_format or 'неизвестный'}). "
                    "Сохраните файл в JPEG/PNG/WebP/HEIC и попробуйте снова."
                ),
            )

        # Закрываем изображение
        image.close()

    except HTTPException:
        raise
    except Exception as e:
        detail_text = str(e)
        detail_text_lower = detail_text.lower()
        if "dimensions" in detail_text_lower or "resolution" in detail_text_lower:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Недопустимое разрешение изображения. "
                    "Уменьшите ширину/высоту и попробуйте снова."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Не удалось проверить изображение. "
                "Пересохраните файл или выберите другое изображение."
            ),
        )
    finally:
        # Возвращаем указатель в начало
        await file.seek(0)

    return True


async def validate_video_file(file: UploadFile) -> bool:
    """
    Валидация загруженного видеофайла.

    Проверяет:
    - MIME-тип
    - Размер файла
    - Базовые сигнатуры (ftyp для MP4/MOV, EBML для WebM)
    """
    if not file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Не удалось определить тип видеофайла. "
                "Выберите видео в формате MP4/WebM/MOV и попробуйте снова."
            ),
        )

    allowed_mime_types = ['video/mp4', 'video/webm', 'video/quicktime']
    allowed_video_label = "MP4, WebM, MOV"
    if file.content_type not in allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Неподдерживаемый формат видео. "
                f"Используйте {allowed_video_label}."
            ),
        )

    content = await file.read()
    file_size = len(content)
    await file.seek(0)

    max_size = settings.MAX_VIDEO_FILE_SIZE_BYTES
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "Видео слишком большое. "
                f"Максимальный размер: {settings.MAX_VIDEO_FILE_SIZE_MB}MB. "
                "Сожмите видео или выберите файл меньшего размера."
            ),
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл пустой. Выберите видеофайл и попробуйте снова.",
        )

    is_valid_signature = False
    if len(content) >= 12 and content[4:8] == b'ftyp':
        is_valid_signature = True

    if not is_valid_signature and content.startswith(VIDEO_SIGNATURES['webm'][0]):
        is_valid_signature = True

    if not is_valid_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Файл поврежден или не является видео. "
                "Загрузите корректный файл и попробуйте снова."
            ),
        )

    await file.seek(0)
    return True


def get_file_extension(content_type: str) -> Optional[str]:
    """
    Получить расширение файла по MIME-типу.

    Args:
        content_type: MIME-тип

    Returns:
        Optional[str]: Расширение файла или None
    """
    mime_to_ext = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'image/mpo': 'mpo',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
    }

    return mime_to_ext.get(content_type)


async def get_image_dimensions(file: UploadFile) -> tuple[int, int]:
    """
    Получить размеры изображения.

    Args:
        file: Загруженный файл

    Returns:
        tuple[int, int]: (ширина, высота)

    Raises:
        HTTPException: Если не удалось определить размеры
    """
    try:
        from PIL import Image
        import io

        content = await file.read()
        await file.seek(0)

        image = Image.open(io.BytesIO(content))
        width, height = image.size

        return width, height

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image dimensions: {str(e)}"
        )
